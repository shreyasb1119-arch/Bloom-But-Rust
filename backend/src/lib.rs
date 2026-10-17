//! Bloom's backend as a DLL.
//!
//! The Nim UI calls `bloom_call` with a small JSON request and gets a JSON
//! string back; it hands that string to `bloom_free` when done. Phase 0 has a
//! single command, "snapshot". Later phases move Bloom's existing Windows code
//! (media, Bluetooth, dock, tray and so on) behind the same two functions.

use std::ffi::{c_char, CStr, CString};
use std::sync::Mutex;

mod sys;

static CPU: Mutex<sys::CpuSampler> = Mutex::new(sys::CpuSampler::new());

fn snapshot() -> String {
    let t = sys::local_time();
    let cpu = CPU.lock().map(|mut c| c.usage()).unwrap_or(0.0);
    let battery = match sys::battery() {
        Some((percent, charging)) => {
            format!("{{\"percent\":{},\"charging\":{}}}", percent, charging)
        }
        None => "null".to_string(),
    };
    format!(
        "{{\"hour\":{},\"minute\":{},\"day\":{},\"month\":{},\"weekday\":{},\"cpu\":{:.1},\"ram\":{:.1},\"battery\":{},\"memMb\":{:.1}}}",
        t.hour,
        t.minute,
        t.day,
        t.month,
        t.weekday,
        cpu,
        sys::ram_percent(),
        battery,
        sys::own_memory_mb()
    )
}

/// Takes a UTF-8 JSON request and returns a UTF-8 JSON reply that the caller
/// must release with `bloom_free`. Returns null only if allocation fails.
#[no_mangle]
pub extern "C" fn bloom_call(request: *const c_char) -> *mut c_char {
    let req = if request.is_null() {
        String::new()
    } else {
        unsafe { CStr::from_ptr(request) }.to_string_lossy().into_owned()
    };
    let reply = if req.contains("\"snapshot\"") {
        snapshot()
    } else {
        "{\"error\":\"unknown command\"}".to_string()
    };
    CString::new(reply)
        .map(CString::into_raw)
        .unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub extern "C" fn bloom_free(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            drop(CString::from_raw(s));
        }
    }
}
