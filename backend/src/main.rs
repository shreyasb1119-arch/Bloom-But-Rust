//! Bloom's backend as a small local service.
//!
//! The React Native Windows UI talks to it over plain HTTP on 127.0.0.1:
//!   POST /invoke        {"cmd": "...", ...args}  ->  JSON reply
//!   GET  /events?after=N                          ->  long-poll for events
//!
//! This first drop has a few commands (`snapshot`, `load_settings`,
//! `save_setting`, `ping`). Bloom's existing Windows code moves in behind the
//! same `cmd` names, one per Tauri command.

#![windows_subsystem = "windows"]

mod session;
mod sys;

use serde_json::{json, Map, Value};
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

const PORT: u16 = 47831;

// ------------------------------------------------------------------ events

struct Bus {
    next: u64,
    events: VecDeque<(u64, String, Value)>,
}

static BUS: Mutex<Bus> = Mutex::new(Bus {
    next: 1,
    events: VecDeque::new(),
});
static BUS_SIGNAL: Condvar = Condvar::new();

fn emit(event: &str, payload: Value) {
    let mut bus = BUS.lock().unwrap_or_else(|e| e.into_inner());
    let id = bus.next;
    bus.next += 1;
    bus.events.push_back((id, event.to_string(), payload));
    while bus.events.len() > 200 {
        bus.events.pop_front();
    }
    BUS_SIGNAL.notify_all();
}

/// Events newer than `after`, waiting up to `timeout` for one to arrive.
fn poll_events(after: u64, timeout: Duration) -> (Vec<Value>, u64) {
    let deadline = Instant::now() + timeout;
    let mut bus = BUS.lock().unwrap_or_else(|e| e.into_inner());
    loop {
        let newer: Vec<Value> = bus
            .events
            .iter()
            .filter(|(id, _, _)| *id > after)
            .map(|(id, event, payload)| json!({ "id": id, "event": event, "payload": payload }))
            .collect();
        let last = bus.next.saturating_sub(1);
        if !newer.is_empty() {
            return (newer, last);
        }
        let now = Instant::now();
        if now >= deadline {
            return (newer, last.max(after));
        }
        let (guard, _) = BUS_SIGNAL
            .wait_timeout(bus, deadline - now)
            .unwrap_or_else(|e| e.into_inner());
        bus = guard;
    }
}

fn current_event_id() -> u64 {
    let bus = BUS.lock().unwrap_or_else(|e| e.into_inner());
    bus.next.saturating_sub(1)
}

// ---------------------------------------------------------------- settings

static SETTINGS: OnceLock<Mutex<Map<String, Value>>> = OnceLock::new();

fn settings_path() -> PathBuf {
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("BloomRN").join("settings.json")
}

fn settings() -> &'static Mutex<Map<String, Value>> {
    SETTINGS.get_or_init(|| {
        let loaded = std::fs::read_to_string(settings_path())
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .and_then(|value| match value {
                Value::Object(map) => Some(map),
                _ => None,
            })
            .unwrap_or_default();
        Mutex::new(loaded)
    })
}

fn save_setting(key: &str, value: &str) {
    let mut map = settings().lock().unwrap_or_else(|e| e.into_inner());
    map.insert(key.to_string(), Value::String(value.to_string()));
    let path = settings_path();
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let tmp = path.with_extension("json.tmp");
    if let Ok(text) = serde_json::to_string_pretty(&Value::Object(map.clone())) {
        if std::fs::write(&tmp, text).is_ok() {
            let _ = std::fs::rename(&tmp, &path);
        }
    }
}

// ---------------------------------------------------------------- commands

static CPU: Mutex<sys::CpuSampler> = Mutex::new(sys::CpuSampler::new());

fn snapshot() -> Value {
    let t = sys::local_time();
    let cpu = CPU.lock().map(|mut c| c.usage()).unwrap_or(0.0);
    json!({
        "hour": t.hour,
        "minute": t.minute,
        "day": t.day,
        "month": t.month,
        "weekday": t.weekday,
        "cpu": cpu,
        "ram": sys::ram_percent(),
        "battery": sys::battery().map(|(percent, charging)| json!({ "percent": percent, "charging": charging })),
        "memMb": sys::own_memory_mb()
    })
}

fn invoke(request: &Value) -> Value {
    let cmd = request.get("cmd").and_then(Value::as_str).unwrap_or("");
    match cmd {
        "ping" => json!({ "ok": true }),
        "snapshot" => snapshot(),
        "load_settings" => {
            let map = settings().lock().unwrap_or_else(|e| e.into_inner());
            Value::Object(map.clone())
        }
        "save_setting" => {
            let key = request.get("key").and_then(Value::as_str);
            let value = request.get("value").and_then(Value::as_str);
            match (key, value) {
                (Some(key), Some(value)) => {
                    save_setting(key, value);
                    json!({ "ok": true })
                }
                _ => json!({ "error": "save_setting needs a key and a value" }),
            }
        }
        _ => json!({ "error": format!("unknown command: {}", cmd) }),
    }
}

// -------------------------------------------------------------------- http

fn query_param(query: &str, name: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        (key == name).then(|| value.to_string())
    })
}

fn route(method: &str, path: &str, query: &str, body: &[u8]) -> (&'static str, Value) {
    match (method, path) {
        ("OPTIONS", _) => ("204 No Content", Value::Null),
        ("POST", "/invoke") => match serde_json::from_slice::<Value>(body) {
            Ok(request) => ("200 OK", invoke(&request)),
            Err(_) => ("400 Bad Request", json!({ "error": "invalid JSON" })),
        },
        ("GET", "/events") => {
            let after = query_param(query, "after").and_then(|v| v.parse::<u64>().ok());
            match after {
                // First call: just report where the stream is now, so old
                // events are never replayed.
                None | Some(0) => (
                    "200 OK",
                    json!({ "events": [], "last": current_event_id() }),
                ),
                Some(after) => {
                    let (events, last) = poll_events(after, Duration::from_secs(20));
                    ("200 OK", json!({ "events": events, "last": last }))
                }
            }
        }
        _ => ("404 Not Found", json!({ "error": "not found" })),
    }
}

fn handle(mut stream: TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(10)))?;
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 {
            break;
        }
        let line = line.trim();
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse().unwrap_or(0);
            }
        }
    }

    let mut body = vec![0u8; content_length.min(1 << 20)];
    reader.read_exact(&mut body)?;

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("/");
    let (path, query) = target.split_once('?').unwrap_or((target, ""));

    let (status, payload) = route(method, path, query, &body);
    let text = if payload.is_null() {
        String::new()
    } else {
        payload.to_string()
    };
    let head = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\n\r\n",
        status,
        text.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(text.as_bytes())?;
    stream.flush()
}

fn main() {
    session::start_monitor(emit);

    // If the port is taken, another copy is already running.
    let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
        Ok(listener) => listener,
        Err(_) => return,
    };
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            std::thread::spawn(move || {
                let _ = handle(stream);
            });
        }
    }
}
