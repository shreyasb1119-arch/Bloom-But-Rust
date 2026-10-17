//! The few Win32 calls that Tauri used to do for us.

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use windows::core::w;
use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HWND};
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
    HWND_TOPMOST, SM_CXSCREEN, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};

/// Returns false if Bloom is already running.
pub fn acquire_single_instance() -> bool {
    unsafe {
        match CreateMutexW(None, true, w!("BloomNativeSingleInstance")) {
            Ok(handle) => {
                if GetLastError() == ERROR_ALREADY_EXISTS {
                    let _ = CloseHandle(handle);
                    false
                } else {
                    true // keep the handle open for the life of the process
                }
            }
            Err(_) => true,
        }
    }
}

pub fn screen_width_px() -> i32 {
    unsafe { GetSystemMetrics(SM_CXSCREEN) }
}

fn hwnd_of(window: &slint::Window) -> Option<HWND> {
    let handle = window.window_handle();
    let wh = handle.window_handle().ok()?;
    match wh.as_raw() {
        RawWindowHandle::Win32(h) => Some(HWND(h.hwnd.get() as *mut core::ffi::c_void)),
        _ => None,
    }
}

/// Hide from Alt+Tab and the taskbar, never steal focus, stay on top.
pub fn apply_overlay_style(window: &slint::Window) {
    let Some(hwnd) = hwnd_of(window) else { return };
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let ex = ex | (WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0) as isize;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex);
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}
