// Talks to the Rust backend (bloom-backend.exe) over local HTTP. It offers the
// same two calls the old Tauri UI used, `invoke` and `listen`, so ported code
// can keep its shape.

import { useSyncExternalStore } from "react";

const BASE = "http://127.0.0.1:47831";

type Handler = (payload: any) => void;

const handlers = new Map<string, Set<Handler>>();
const statusListeners = new Set<() => void>();
let online = false;
let polling = false;
let lastEventId = 0;

function setOnline(next: boolean) {
	if (online === next) return;
	online = next;
	statusListeners.forEach((listener) => listener());
}

export async function invoke<T = any>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${BASE}/invoke`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...args, cmd })
		});
	} catch {
		setOnline(false);
		throw new Error("The Bloom backend isn't running.");
	}
	setOnline(true);
	const data = await response.json();
	if (data && typeof data === "object" && "error" in data) {
		throw new Error(String((data as { error: unknown }).error));
	}
	return data as T;
}

async function pollEvents() {
	if (polling) return;
	polling = true;
	while (handlers.size > 0) {
		try {
			const response = await fetch(`${BASE}/events?after=${lastEventId}`);
			const data = await response.json();
			setOnline(true);
			for (const event of data.events ?? []) {
				lastEventId = Math.max(lastEventId, event.id);
				handlers.get(event.event)?.forEach((handler) => {
					try {
						handler(event.payload);
					} catch {
						// One broken handler must not stop the others.
					}
				});
			}
			if (typeof data.last === "number") lastEventId = Math.max(lastEventId, data.last);
		} catch {
			setOnline(false);
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
	polling = false;
}

export function listen(event: string, handler: Handler): () => void {
	let set = handlers.get(event);
	if (!set) {
		set = new Set();
		handlers.set(event, set);
	}
	set.add(handler);
	void pollEvents();
	return () => {
		set?.delete(handler);
		if (set && set.size === 0) handlers.delete(event);
	};
}

function subscribeStatus(callback: () => void) {
	statusListeners.add(callback);
	return () => {
		statusListeners.delete(callback);
	};
}

export function useBackendOnline(): boolean {
	return useSyncExternalStore(subscribeStatus, () => online);
}
