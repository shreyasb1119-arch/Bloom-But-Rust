# Bloom for React Native Windows (early preview)

The old Tauri/WebView2 TypeScript UI, ported to React Native for Windows, with
the Rust backend running as a small local service (`../backend`).

This is a **harness**: the notch and the settings sit in one normal window so the
ported UI can be tested. The borderless, always-on-top notch window needs native
host work and comes next.

## Build in the cloud

Actions tab -> "Build React Native Windows preview" -> Run workflow. It produces
two artifacts: `bloom-backend` and `bloom-rnw`.

## Run it

1. Turn on Developer Mode: Settings -> Privacy & security -> For developers.
2. Run `bloom-backend.exe` (no window; it runs in the background).
3. In PowerShell, from the unzipped `bloom-rnw` folder:

   ```
   Add-AppxPackage -Register .\app\AppxManifest.xml
   ```

4. Open the new app from the Start menu.

To stop the backend, end `bloom-backend` in Task Manager.

## Layout

- `src/bridge/` - `invoke`/`listen` over HTTP to the backend, settings cache,
  notification feed.
- `src/hooks/` - live snapshot, alerts (charger, battery, lock, breaks), forecast.
- `src/components/` - the notch and its pages.
- `src/settings/` - the settings screen.
