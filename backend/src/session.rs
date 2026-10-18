//! Reports Windows session lock and unlock as `session-lock-changed` events.
//!
//! Calls one Win32 function directly (no `windows` crate), so it needs no extra
//! crate features. A tiny thread reads the session's lock flag twice a second.

use std::ffi::c_void;

#[link(name = "wtsapi32")]
extern "system" {
    fn WTSQuerySessionInformationW(
        h_server: *mut c_void,
        session_id: u32,
        info_class: i32,
        buffer: *mut *mut c_void,
        bytes_returned: *mut u32,
    ) -> i32;
    fn WTSFreeMemory(p_memory: *mut c_void);
}

const WTS_CURRENT_SESSION: u32 = 0xFFFF_FFFF;
const WTS_SESSION_INFO_EX: i32 = 25;
const WTS_SESSIONSTATE_LOCK: i32 = 0;
const WTS_SESSIONSTATE_UNLOCK: i32 = 1;

/// `Some(true)` when locked, `Some(false)` when unlocked, `None` if unknown.
fn session_locked() -> Option<bool> {
    unsafe {
        let mut buffer: *mut c_void = std::ptr::null_mut();
        let mut bytes: u32 = 0;
        let ok = WTSQuerySessionInformationW(
            std::ptr::null_mut(),
            WTS_CURRENT_SESSION,
            WTS_SESSION_INFO_EX,
            &mut buffer,
            &mut bytes,
        );
        if ok == 0 || buffer.is_null() {
            return None;
        }

        // WTSINFOEXW: Level (u32) at 0, then an 8-aligned union whose first
        // fields are SessionId (8), SessionState (12) and SessionFlags (16).
        let result = if bytes >= 20 {
            let level = std::ptr::read_unaligned(buffer as *const u32);
            if level == 1 {
                let flags = std::ptr::read_unaligned((buffer as *const u8).add(16) as *const i32);
                match flags {
                    WTS_SESSIONSTATE_LOCK => Some(true),
                    WTS_SESSIONSTATE_UNLOCK => Some(false),
                    _ => None,
                }
            } else {
                None
            }
        } else {
            None
        };

        WTSFreeMemory(buffer);
        result
    }
}

pub fn start_monitor(emit: fn(&str, serde_json::Value)) {
    std::thread::spawn(move || {
        let mut last: Option<bool> = None;
        loop {
            if let Some(locked) = session_locked() {
                if last != Some(locked) {
                    // The first reading is only a baseline, not a change.
                    if last.is_some() {
                        emit("session-lock-changed", serde_json::Value::Bool(locked));
                    }
                    last = Some(locked);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}
