// Short synthesized alert sounds (no audio files). Played only when the user
// turns on "Alert sounds" in Settings → Extras.

export type AlertSound = "connect" | "disconnect" | "low" | "critical" | "lock" | "unlock" | "break";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
	try {
		if (!ctx) ctx = new AudioContext();
		if (ctx.state === "suspended") ctx.resume().catch(() => {});
		return ctx;
	} catch {
		return null;
	}
}

/** Call from a user gesture (a click) so the webview lets later sounds play. */
export function unlockAudio() {
	getCtx();
}

function tone(c: AudioContext, freq: number, at: number, length: number, volume: number) {
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = "sine";
	osc.frequency.value = freq;
	const start = c.currentTime + 0.02 + at;
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(gain);
	gain.connect(c.destination);
	osc.start(start);
	osc.stop(start + length + 0.05);
}

const PATTERNS: Record<AlertSound, { freq: number; at: number; len: number }[]> = {
	connect: [
		{ freq: 659.25, at: 0, len: 0.25 },
		{ freq: 880, at: 0.12, len: 0.35 }
	],
	disconnect: [
		{ freq: 880, at: 0, len: 0.25 },
		{ freq: 659.25, at: 0.12, len: 0.35 }
	],
	low: [
		{ freq: 740, at: 0, len: 0.2 },
		{ freq: 587.33, at: 0.2, len: 0.3 }
	],
	critical: [
		{ freq: 880, at: 0, len: 0.15 },
		{ freq: 880, at: 0.22, len: 0.15 },
		{ freq: 880, at: 0.44, len: 0.25 }
	],
	lock: [
		{ freq: 784, at: 0, len: 0.2 },
		{ freq: 523.25, at: 0.14, len: 0.35 }
	],
	unlock: [
		{ freq: 523.25, at: 0, len: 0.2 },
		{ freq: 659.25, at: 0.12, len: 0.2 },
		{ freq: 783.99, at: 0.24, len: 0.4 }
	],
	break: [
		{ freq: 1046.5, at: 0, len: 0.4 },
		{ freq: 783.99, at: 0.25, len: 0.6 }
	]
};

export function playAlertSound(kind: AlertSound) {
	const c = getCtx();
	if (!c) return;
	for (const note of PATTERNS[kind]) tone(c, note.freq, note.at, note.len, 0.16);
}
