//! The few Windows calls the prototype needs, declared by hand so there is no
//! dependency on a particular `windows` crate version. x86_64 Windows only.

#[repr(C)]
struct Filetime {
    low: u32,
    high: u32,
}

#[repr(C)]
struct SystemTime {
    year: u16,
    month: u16,
    day_of_week: u16,
    day: u16,
    hour: u16,
    minute: u16,
    second: u16,
    millis: u16,
}

#[repr(C)]
struct PowerStatus {
    ac_line: u8,
    battery_flag: u8,
    battery_percent: u8,
    system_flag: u8,
    life_time: u32,
    full_life_time: u32,
}

#[repr(C)]
struct MemoryStatusEx {
    length: u32,
    load: u32,
    total_phys: u64,
    avail_phys: u64,
    total_page: u64,
    avail_page: u64,
    total_virtual: u64,
    avail_virtual: u64,
    avail_extended: u64,
}

#[repr(C)]
struct ProcessMemoryCounters {
    cb: u32,
    page_faults: u32,
    peak_working_set: usize,
    working_set: usize,
    quota_peak_paged: usize,
    quota_paged: usize,
    quota_peak_non_paged: usize,
    quota_non_paged: usize,
    pagefile: usize,
    peak_pagefile: usize,
}

#[link(name = "kernel32")]
extern "system" {
    fn GetLocalTime(out: *mut SystemTime);
    fn GetSystemPowerStatus(out: *mut PowerStatus) -> i32;
    fn GlobalMemoryStatusEx(out: *mut MemoryStatusEx) -> i32;
    fn GetSystemTimes(idle: *mut Filetime, kernel: *mut Filetime, user: *mut Filetime) -> i32;
    fn GetCurrentProcess() -> isize;
    fn K32GetProcessMemoryInfo(process: isize, counters: *mut ProcessMemoryCounters, size: u32) -> i32;
}

pub struct LocalTime {
    pub hour: u16,
    pub minute: u16,
    pub day: u16,
    pub month: u16,
    pub weekday: u16, // 0 = Sunday
}

pub fn local_time() -> LocalTime {
    let mut t = SystemTime {
        year: 0,
        month: 1,
        day_of_week: 0,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millis: 0,
    };
    unsafe { GetLocalTime(&mut t) };
    LocalTime {
        hour: t.hour,
        minute: t.minute,
        day: t.day,
        month: t.month,
        weekday: t.day_of_week,
    }
}

/// Battery percent and whether the charger is plugged in, or `None` on a PC
/// without a battery.
pub fn battery() -> Option<(u8, bool)> {
    let mut s = PowerStatus {
        ac_line: 0,
        battery_flag: 0,
        battery_percent: 0,
        system_flag: 0,
        life_time: 0,
        full_life_time: 0,
    };
    unsafe {
        if GetSystemPowerStatus(&mut s) == 0 {
            return None;
        }
    }
    if s.battery_percent > 100 || s.battery_flag == 128 {
        return None;
    }
    Some((s.battery_percent, s.ac_line == 1))
}

pub fn ram_percent() -> f32 {
    let mut m = MemoryStatusEx {
        length: std::mem::size_of::<MemoryStatusEx>() as u32,
        load: 0,
        total_phys: 0,
        avail_phys: 0,
        total_page: 0,
        avail_page: 0,
        total_virtual: 0,
        avail_virtual: 0,
        avail_extended: 0,
    };
    unsafe {
        if GlobalMemoryStatusEx(&mut m) == 0 {
            return 0.0;
        }
    }
    m.load as f32
}

/// Working set of the whole process (UI and backend together) in megabytes, so
/// it can be compared with the WebView2-based Bloom in Task Manager.
pub fn own_memory_mb() -> f32 {
    let mut c = ProcessMemoryCounters {
        cb: std::mem::size_of::<ProcessMemoryCounters>() as u32,
        page_faults: 0,
        peak_working_set: 0,
        working_set: 0,
        quota_peak_paged: 0,
        quota_paged: 0,
        quota_peak_non_paged: 0,
        quota_non_paged: 0,
        pagefile: 0,
        peak_pagefile: 0,
    };
    unsafe {
        if K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c, c.cb) == 0 {
            return 0.0;
        }
    }
    c.working_set as f32 / (1024.0 * 1024.0)
}

pub struct CpuSampler {
    prev: Option<(u64, u64)>,
}

impl CpuSampler {
    pub const fn new() -> Self {
        Self { prev: None }
    }

    /// CPU use in percent since the previous call (0 on the first call).
    pub fn usage(&mut self) -> f32 {
        let mut idle = Filetime { low: 0, high: 0 };
        let mut kernel = Filetime { low: 0, high: 0 };
        let mut user = Filetime { low: 0, high: 0 };
        unsafe {
            if GetSystemTimes(&mut idle, &mut kernel, &mut user) == 0 {
                return 0.0;
            }
        }
        let to_u64 = |f: &Filetime| ((f.high as u64) << 32) | f.low as u64;
        let idle_now = to_u64(&idle);
        // Kernel time already includes idle time.
        let total_now = to_u64(&kernel) + to_u64(&user);

        let usage = match self.prev {
            Some((idle_prev, total_prev)) if total_now > total_prev => {
                let idle_delta = idle_now.saturating_sub(idle_prev) as f32;
                let total_delta = (total_now - total_prev) as f32;
                (100.0 * (1.0 - idle_delta / total_delta)).clamp(0.0, 100.0)
            }
            _ => 0.0,
        };
        self.prev = Some((idle_now, total_now));
        usage
    }
}
