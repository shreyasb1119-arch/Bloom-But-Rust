#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media;
mod system;
mod winutil;

use slint::{ComponentHandle, PhysicalPosition, PhysicalSize, Timer};
use std::time::Duration;

slint::include_modules!();

// Window sizes in logical pixels. The window itself is resized so the empty
// area around the collapsed pill never blocks clicks on apps underneath.
const COLLAPSED: (f32, f32) = (200.0, 40.0);
const EXPANDED: (f32, f32) = (420.0, 170.0);

fn place(ui: &Notch, (w, h): (f32, f32)) {
    let win = ui.window();
    let scale = win.scale_factor();
    let (pw, ph) = ((w * scale) as u32, (h * scale) as u32);
    let x = (winutil::screen_width_px() - pw as i32) / 2;
    win.set_size(PhysicalSize::new(pw, ph));
    win.set_position(PhysicalPosition::new(x, 0));
}

fn start_worker(ui: slint::Weak<Notch>) {
    std::thread::spawn(move || {
        media::init_com();
        let mut sampler = system::Sampler::new();
        let mut last_stats = system::Stats::default();
        let mut last_track = media::Track::default();
        let mut tick: u32 = 0;
        loop {
            let stats = (tick % 2 == 0).then(|| sampler.sample());
            let track = media::current().unwrap_or_default();

            let stats_changed = stats.filter(|s| *s != last_stats);
            let track_changed = (track != last_track).then(|| track.clone());
            if let Some(s) = stats_changed {
                last_stats = s;
            }
            if let Some(t) = &track_changed {
                last_track = t.clone();
            }

            if stats_changed.is_some() || track_changed.is_some() {
                let sent = ui.upgrade_in_event_loop(move |ui| {
                    if let Some(s) = stats_changed {
                        ui.set_cpu(s.cpu);
                        ui.set_ram(s.ram);
                        ui.set_battery(s.battery);
                        ui.set_charging(s.charging);
                    }
                    if let Some(t) = track_changed {
                        ui.set_track_title(if t.title.is_empty() {
                            "Nothing playing".into()
                        } else {
                            t.title.into()
                        });
                        ui.set_track_artist(t.artist.into());
                        ui.set_playing(t.playing);
                    }
                });
                if sent.is_err() {
                    break; // UI is gone
                }
            }
            tick = tick.wrapping_add(1);
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}

fn main() -> Result<(), slint::PlatformError> {
    if !winutil::acquire_single_instance() {
        return Ok(());
    }

    let ui = Notch::new()?;

    ui.on_play_pause(|| media::send(media::Cmd::PlayPause));
    ui.on_next(|| media::send(media::Cmd::Next));
    ui.on_previous(|| media::send(media::Cmd::Previous));
    ui.on_quit(|| {
        let _ = slint::quit_event_loop();
    });

    let weak = ui.as_weak();
    ui.on_expanded_changed(move |expanded| {
        let Some(ui) = weak.upgrade() else { return };
        if expanded {
            place(&ui, EXPANDED);
        } else {
            // Let the collapse animation finish before shrinking the window.
            let weak = weak.clone();
            Timer::single_shot(Duration::from_millis(260), move || {
                if let Some(ui) = weak.upgrade() {
                    if !ui.get_expanded() {
                        place(&ui, COLLAPSED);
                    }
                }
            });
        }
    });

    // The native window only exists once the event loop is running.
    let weak = ui.as_weak();
    Timer::single_shot(Duration::from_millis(50), move || {
        if let Some(ui) = weak.upgrade() {
            winutil::apply_overlay_style(ui.window());
            place(&ui, COLLAPSED);
        }
    });

    start_worker(ui.as_weak());
    ui.run()
}
