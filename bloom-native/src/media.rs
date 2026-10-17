//! Now-playing info and transport controls via Windows' media session API.

use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

#[derive(Clone, Default, PartialEq, Eq)]
pub struct Track {
    pub title: String,
    pub artist: String,
    pub playing: bool,
}

pub fn init_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

pub fn current() -> Option<Track> {
    let session = Manager::RequestAsync().ok()?.get().ok()?.GetCurrentSession().ok()?;
    let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
    let playing = session.GetPlaybackInfo().ok()?.PlaybackStatus().ok()? == Status::Playing;
    Some(Track {
        title: props.Title().ok()?.to_string(),
        artist: props.Artist().ok()?.to_string(),
        playing,
    })
}

#[derive(Clone, Copy)]
pub enum Cmd {
    PlayPause,
    Next,
    Previous,
}

/// Runs on its own short-lived thread so the UI never blocks.
pub fn send(cmd: Cmd) {
    std::thread::spawn(move || {
        init_com();
        let Some(session) = Manager::RequestAsync()
            .ok()
            .and_then(|op| op.get().ok())
            .and_then(|m| m.GetCurrentSession().ok())
        else {
            return;
        };
        let _ = match cmd {
            Cmd::PlayPause => session.TryTogglePlayPauseAsync().and_then(|o| o.get()),
            Cmd::Next => session.TrySkipNextAsync().and_then(|o| o.get()),
            Cmd::Previous => session.TrySkipPreviousAsync().and_then(|o| o.get()),
        };
    });
}
