// A small in-memory feed of Bloom's own alerts, shown by the Notifications page.

import { useSyncExternalStore } from "react";

export type NotificationKind = "battery" | "power" | "lock" | "timer" | "break";

export interface BloomNotification {
	id: number;
	kind: NotificationKind;
	title: string;
	body?: string;
	at: number;
}

let items: BloomNotification[] = [];
let nextId = 1;
const subscribers = new Set<() => void>();

function notify() {
	subscribers.forEach((callback) => callback());
}

export function pushNotification(n: Omit<BloomNotification, "id" | "at">) {
	items = [{ ...n, id: nextId++, at: Date.now() }, ...items].slice(0, 30);
	notify();
}

export function clearNotifications() {
	items = [];
	notify();
}

export function useNotifications(): BloomNotification[] {
	return useSyncExternalStore(
		(callback) => {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		() => items
	);
}
