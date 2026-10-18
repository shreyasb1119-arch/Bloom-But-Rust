// Settings live in the backend (settings.json). They are cached here so any
// component can read them synchronously through the hooks below.

import { useSyncExternalStore } from "react";
import { invoke } from "./backend";

let cache: Record<string, string> = {};
let loaded = false;
const subscribers = new Set<() => void>();

function notify() {
	subscribers.forEach((callback) => callback());
}

function subscribe(callback: () => void) {
	subscribers.add(callback);
	return () => {
		subscribers.delete(callback);
	};
}

export async function loadSettings(): Promise<boolean> {
	try {
		cache = await invoke<Record<string, string>>("load_settings");
		loaded = true;
		notify();
	} catch {
		// Backend not up yet; the caller retries.
	}
	return loaded;
}

export function settingsLoaded() {
	return loaded;
}

export function setSetting(key: string, value: string | number | boolean) {
	cache = { ...cache, [key]: String(value) };
	notify();
	invoke("save_setting", { key, value: String(value) }).catch(() => {});
}

export function useSetting(key: string, fallback: string): string {
	return useSyncExternalStore(subscribe, () => cache[key] ?? fallback);
}

export function useBoolSetting(key: string, fallback: boolean): boolean {
	return useSetting(key, String(fallback)) === "true";
}

export function useNumberSetting(key: string, fallback: number): number {
	const value = Number(useSetting(key, String(fallback)));
	return Number.isFinite(value) ? value : fallback;
}

export const SETTING = {
	aiEnabled: "bloom-ai-enabled",
	aiApiKey: "bloom-ai-api-key",
	weatherEnabled: "bloom-weather-enabled",
	weatherUnit: "bloom-weather-unit",
	notesEnabled: "bloom-notes-enabled",
	notesText: "bloom-notes-text",
	calculatorEnabled: "bloom-calculator-enabled",
	quietMode: "bloom-quiet-mode",
	welcomeGreeting: "bloom-welcome-greeting-enabled",
	breakReminders: "bloom-break-reminder-enabled",
	breakInterval: "bloom-break-interval",
	lowBattery: "bloom-low-battery-threshold"
} as const;
