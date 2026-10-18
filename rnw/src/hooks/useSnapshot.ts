import { useEffect, useState } from "react";
import { invoke } from "../bridge/backend";

export interface Snapshot {
	hour: number;
	minute: number;
	day: number;
	month: number;
	weekday: number;
	cpu: number;
	ram: number;
	battery: { percent: number; charging: boolean } | null;
	memMb: number;
}

/** Live clock, CPU, RAM and battery from the backend. */
export function useSnapshot(intervalMs = 3000): Snapshot | null {
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

	useEffect(() => {
		let alive = true;
		const tick = async () => {
			try {
				const next = await invoke<Snapshot>("snapshot");
				if (alive) setSnapshot(next);
			} catch {
				// Backend offline; try again on the next tick.
			}
		};
		void tick();
		const id = setInterval(tick, intervalMs);
		return () => {
			alive = false;
			clearInterval(id);
		};
	}, [intervalMs]);

	return snapshot;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTime(s: Snapshot | null): string {
	if (!s) return "--:--";
	const hour12 = s.hour % 12 === 0 ? 12 : s.hour % 12;
	return `${hour12}:${String(s.minute).padStart(2, "0")} ${s.hour < 12 ? "AM" : "PM"}`;
}

export function formatDate(s: Snapshot | null): string {
	if (!s) return "";
	return `${WEEKDAYS[s.weekday % 7]}, ${MONTHS[(s.month - 1 + 12) % 12]} ${s.day}`;
}
