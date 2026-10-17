# Bloom: moving from Tauri + React to pure Rust + Slint

## Why
Bloom's Rust backend is already about 14,000 lines. The weight comes from four
WebView2 windows (notch, dock, overlay, settings) running about 21,000 lines of
React, TypeScript and CSS. Slint draws natively with no browser engine, no
JavaScript runtime and no IPC bridge.

## Status
| Piece | Old | New | Status |
|---|---|---|---|
| Notch: media, CPU, RAM, battery | `App.tsx` | `ui/notch.slint` + `src/media.rs`, `src/system.rs` | Written, not yet compiled |
| Window styling (topmost, no taskbar, no focus steal) | Tauri config | `src/winutil.rs` | Written, not yet compiled |
| Single instance | `main.rs` | `src/winutil.rs` | Written, not yet compiled |
| Dock | `Dock.tsx` + `dock_extras.rs` | next | Not started |
| Overlay (volume/brightness OSD) | `Overlay.tsx` | next | Not started |
| Settings | `Settings.tsx` + `settings/*` | next | Not started |
| Wi-Fi, Bluetooth, tray, shelf, updater, Gemini chat, weather | React panels + Rust | next | Not started |

## Reusing the existing Rust
Tauri references per file (fewer is easier to reuse):
`tray.rs` 0, `types.rs` 0, `shelf_preview.rs` 0, `session.rs` 1, `state.rs` 1,
`shelf.rs` 1, `dock_extras.rs` 7, `utils.rs` 6, `updater.rs` 6, `bluetooth.rs` 12,
`wifi.rs` 12, `services.rs` 18, `main.rs` 26, `commands.rs` 134.

Plan: the Tauri-free files move over unchanged. In the others, each
`app_handle.emit("event", payload)` becomes a call into the Slint UI through
`Weak::upgrade_in_event_loop`, and each `#[tauri::command]` becomes a plain
function that a Slint callback calls directly.

## Known risks to check on the first build
1. Transparent windows with the femtovg renderer. If the notch shows a black
   rectangle, switch to the `renderer-skia` feature or round the window with
   `SetWindowRgn`.
2. `windows` 0.61 API signatures (the code follows the 0.61 style used in the
   current project).
3. The window handle only exists after the event loop starts, so styling is
   applied from a 50 ms timer.
