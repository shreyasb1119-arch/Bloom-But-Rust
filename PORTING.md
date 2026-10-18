# Porting status: Tauri/TypeScript UI -> React Native Windows

## Ported (rnw/)
- Notch pill with hover expand and page switching
- Now / System (CPU, RAM, battery) / Weather (5 days) / AI chat (Gemini 3.6 Flash) /
  Quick Notes / Calculator / Notifications pages
- Alerts: charger connected and disconnected, low, critical and full battery,
  lock and unlock (with greeting), break reminders, quiet mode
- Settings: Notch, Extras, About

## Rust backend (backend/)
- Moved: system snapshot, settings storage, lock/unlock events
- Not yet: the rest of Bloom's Tauri commands (media, volume, brightness,
  Wi-Fi, Bluetooth, tray, window previews, dock/AppBar, autostart, updater)

## Not ported yet
- Command Center controls, Calendar and Timer, Music, Wi-Fi and Bluetooth panels,
  tray and notification-center buttons, Bluetooth pairing popup
- Dock (all of it) and the volume/brightness overlay
- Borderless, transparent, always-on-top notch and dock windows (native host)
- Alert sounds (React Native has no audio API; needs a native module)
- Screen corner rounding, system tray icon, autostart, updater
