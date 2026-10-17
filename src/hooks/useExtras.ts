import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsSync } from "./useSettingsSync";

/**
 * The optional extras from Settings → Extras. Self-contained so both the notch
 * and the settings window can read the same values without extra plumbing.
 */
export interface ExtrasSettings {
	notesEnabled: boolean;
	calculatorEnabled: boolean;
	alertSounds: boolean;
	welcomeGreeting: boolean;
	breakReminders: boolean;
	breakInterval: number;
	quietMode: boolean;
}

const DEFAULTS: ExtrasSettings = {
	notesEnabled: false,
	calculatorEnabled: false,
	alertSounds: false,
	welcomeGreeting: false,
	breakReminders: false,
	breakInterval: 20,
	quietMode: false
};

const KEYS: Record<keyof ExtrasSettings, string> = {
	notesEnabled: "bloom-notes-enabled",
	calculatorEnabled: "bloom-calculator-enabled",
	alertSounds: "bloom-alert-sounds-enabled",
	welcomeGreeting: "bloom-welcome-greeting-enabled",
	breakReminders: "bloom-break-reminder-enabled",
	breakInterval: "bloom-break-interval",
	quietMode: "bloom-quiet-mode"
};

const NAMES = Object.keys(KEYS) as (keyof ExtrasSettings)[];

function coerce(name: keyof ExtrasSettings, raw: unknown): boolean | number {
	if (name === "breakInterval") {
		const n = Number(raw);
		return Number.isFinite(n) ? Math.min(90, Math.max(5, Math.round(n))) : DEFAULTS.breakInterval;
	}
	return raw === true || raw === "true";
}

function readLocal(): ExtrasSettings {
	const out: Record<string, boolean | number> = { ...DEFAULTS };
	for (const name of NAMES) {
		const stored = localStorage.getItem(KEYS[name]);
		if (stored !== null) out[name] = coerce(name, stored);
	}
	return out as unknown as ExtrasSettings;
}

export function useExtras() {
	const [values, setValues] = useState<ExtrasSettings>(readLocal);

	// Pick up what is saved in settings.json.
	useEffect(() => {
		let alive = true;
		invoke<Record<string, string>>("load_settings")
			.then((saved) => {
				if (!alive || !saved) return;
				setValues((prev) => {
					const next: Record<string, boolean | number> = { ...prev };
					for (const name of NAMES) {
						const raw = saved[KEYS[name]];
						if (raw !== undefined && raw !== null) {
							next[name] = coerce(name, raw);
							localStorage.setItem(KEYS[name], String(raw));
						}
					}
					return next as unknown as ExtrasSettings;
				});
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, []);

	// Stay in sync when another window (or the file) changes a value.
	const handlers: Record<string, (value: any) => void> = {};
	for (const name of NAMES) {
		handlers[KEYS[name]] = (value) =>
			setValues((prev) => ({ ...prev, [name]: coerce(name, value) }));
	}
	useSettingsSync(handlers);

	const set = useCallback(<K extends keyof ExtrasSettings>(name: K, value: ExtrasSettings[K]) => {
		setValues((prev) => ({ ...prev, [name]: value }));
		const key = KEYS[name];
		localStorage.setItem(key, String(value));
		invoke("save_setting", { key, value: String(value) }).catch(console.error);
	}, []);

	return { values, set };
}
