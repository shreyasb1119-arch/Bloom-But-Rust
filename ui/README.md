# Bloom Nim UI: phase 0 prototype

The notch drawn natively in Nim (Windy + Boxy + Pixie, the stack Fidget is built
on) with the Rust backend in `../backend` loaded as `bloom_backend.dll`. No
WebView2. The main Bloom app is untouched.

What it checks:

1. A transparent, borderless, always-on-top window shaped like the notch.
2. Clicks outside the pill reach the apps below.
3. A smooth grow animation when the cursor moves onto the pill.
4. Memory: hover the pill; the bottom line shows the MB used by this whole
   process (UI + Rust backend). Compare with the ~390 MB of WebView2 processes.

## Build in the cloud

Actions tab -> "Build Nim prototype" -> Run workflow. Download `bloom-nim`, keep
`bloom-ui.exe` and `bloom_backend.dll` in the same folder, run `bloom-ui.exe`.
It has no taskbar entry; quit it from Task Manager.

If the window is black or invisible, run `bloom-ui.exe --no-clickthrough`.

## How the two halves talk

`bloom_call(json)` returns a JSON string; `bloom_free(ptr)` releases it. Phase 0
has one command (`snapshot`). Later, Bloom's Windows code moves behind the same
two functions, one command name per existing Tauri command.
