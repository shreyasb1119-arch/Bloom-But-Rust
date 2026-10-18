import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "../bridge/backend";
import { pushNotification } from "../bridge/notifications";
import { SETTING, useBoolSetting, useNumberSetting } from "../bridge/settings";
import type { Snapshot } from "./useSnapshot";

export interface Pulse {
	icon: string;
	label: string;
	color?: string;
}

const PULSE_MS = 4000;

/**
 * Turns battery changes, lock/unlock and break reminders into short "pulses"
 * for the collapsed notch, and logs each one in the notifications feed.
 */
export function useAlerts(snapshot: Snapshot | null): Pulse | null {
	const quiet = useBoolSetting(SETTING.quietMode, false);
	const greeting = useBoolSetting(SETTING.welcomeGreeting, false);
	const breaks = useBoolSetting(SETTING.breakReminders, false);
	const breakMinutes = useNumberSetting(SETTING.breakInterval, 20);
	const lowThreshold = useNumberSetting(SETTING.lowBattery, 20);

	const [pulse, setPulse] = useState<Pulse | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const quietRef = useRef(quiet);
	quietRef.current = quiet;

	const show = useCallback((next: Pulse, ms = PULSE_MS) => {
		if (quietRef.current) return;
		setPulse(next);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setPulse(null), ms);
	}, []);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[]
	);

	// Battery: charger connected/disconnected, low, critical, fully charged.
	const previousCharging = useRef<boolean | null>(null);
	const lowShown = useRef(false);
	const criticalShown = useRef(false);
	const fullShown = useRef(false);
	useEffect(() => {
		const battery = snapshot?.battery;
		if (!battery) return;
		const { percent, charging } = battery;
		const critical = Math.max(5, Math.floor(lowThreshold / 2));

		if (previousCharging.current !== null && previousCharging.current !== charging) {
			pushNotification({
				kind: "power",
				title: charging ? "Charger connected" : "Charger disconnected",
				body: `${percent}%`
			});
			show({
				icon: charging ? "⚡" : "🔋",
				label: `${charging ? "Charging" : "On battery"} · ${percent}%`,
				color: charging ? "#32d74b" : undefined
			});
		}
		previousCharging.current = charging;

		if (!charging && percent <= lowThreshold && !lowShown.current) {
			lowShown.current = true;
			pushNotification({ kind: "battery", title: "Low battery", body: `${percent}%` });
			show({ icon: "🪫", label: `Low battery · ${percent}%`, color: "#ff453a" });
		}
		if (!charging && percent <= critical && !criticalShown.current) {
			criticalShown.current = true;
			pushNotification({ kind: "battery", title: "Battery critical", body: `${percent}%, plug in now` });
			show({ icon: "🪫", label: `Battery critical · ${percent}%`, color: "#ff453a" }, 8000);
		}
		if (charging || percent > lowThreshold) lowShown.current = false;
		if (charging || percent > critical) criticalShown.current = false;

		if (charging && percent >= 100 && !fullShown.current) {
			fullShown.current = true;
			pushNotification({ kind: "power", title: "Fully charged", body: "100%" });
			show({ icon: "✅", label: "Fully charged", color: "#32d74b" });
		}
		if (!charging || percent < 100) fullShown.current = false;
	}, [snapshot, lowThreshold, show]);

	// Lock and unlock, reported by the Rust backend.
	useEffect(() => {
		return listen("session-lock-changed", (locked: boolean) => {
			const hour = new Date().getHours();
			const hello =
				hour >= 5 && hour < 12
					? "Good morning"
					: hour < 17 && hour >= 12
						? "Good afternoon"
						: hour >= 17 && hour < 22
							? "Good evening"
							: "Welcome back";
			pushNotification({ kind: "lock", title: locked ? "PC locked" : "PC unlocked" });
			show(
				locked
					? { icon: "🔒", label: "Locked" }
					: { icon: "🔓", label: greeting ? hello : "Unlocked", color: "#32d74b" },
				3000
			);
		});
	}, [greeting, show]);

	// Break reminders.
	useEffect(() => {
		if (!breaks) return;
		const id = setInterval(
			() => {
				pushNotification({ kind: "break", title: "Time for a break", body: "Rest your eyes for 20 seconds" });
				show({ icon: "☕", label: "Take a break" }, 5000);
			},
			Math.max(5, breakMinutes) * 60_000
		);
		return () => clearInterval(id);
	}, [breaks, breakMinutes, show]);

	return pulse;
}
