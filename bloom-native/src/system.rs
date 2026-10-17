//! CPU, RAM and battery through plain Win32 calls. No WMI, no extra threads,
//! no allocations in the hot path.

use windows::Win32::Foundation::FILETIME;
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows::Win32::System::Threading::GetSystemTimes;

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub struct Stats {
    pub cpu: i32,
    pub ram: i32,
    pub battery: i32,
    pub charging: bool,
}

fn ticks(f: FILETIME) -> u64 {
    ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64
}

#[derive(Default)]
pub struct Sampler {
    last: Option<(u64, u64)>, // (idle, total)
}

impl Sampler {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn sample(&mut self) -> Stats {
        let mut idle = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        unsafe {
            let _ = GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user));
        }
        // Kernel time already includes idle time.
        let (idle, total) = (ticks(idle), ticks(kernel) + ticks(user));
        let cpu = match self.last {
            Some((li, lt)) => {
                let dt = total.saturating_sub(lt);
                let di = idle.saturating_sub(li);
                if dt > 0 {
                    (dt.saturating_sub(di) * 100 / dt) as i32
                } else {
                    0
                }
            }
            None => 0,
        };
        self.last = Some((idle, total));

        let mut mem = MEMORYSTATUSEX {
            dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
            ..Default::default()
        };
        let ram = unsafe { GlobalMemoryStatusEx(&mut mem) }
            .map(|_| mem.dwMemoryLoad as i32)
            .unwrap_or(0);

        let mut power = SYSTEM_POWER_STATUS::default();
        let (battery, charging) = if unsafe { GetSystemPowerStatus(&mut power) }.is_ok() {
            let pct = if power.BatteryLifePercent == 255 { 100 } else { power.BatteryLifePercent as i32 };
            (pct, power.ACLineStatus == 1 && pct < 100)
        } else {
            (100, false)
        };

        Stats { cpu, ram, battery, charging }
    }
}
