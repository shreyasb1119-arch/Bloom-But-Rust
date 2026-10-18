import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { clearNotifications, useNotifications } from "../bridge/notifications";
import { SETTING, setSetting, useSetting } from "../bridge/settings";
import { askGemini, GEMINI_LABEL } from "../lib/gemini";
import type { ChatMessage } from "../lib/gemini";
import { formatDate, formatTime } from "../hooks/useSnapshot";
import type { Snapshot } from "../hooks/useSnapshot";
import { useForecast, weatherEmoji } from "../hooks/useForecast";
import { colors } from "../theme";
import { Bar, Page, PillButton } from "./ui";

// ------------------------------------------------------------------- status

export function StatusPanel({ snapshot }: { snapshot: Snapshot | null }) {
	const battery = snapshot?.battery;
	return (
		<Page>
			<Text style={styles.big}>{formatTime(snapshot)}</Text>
			<Text style={styles.sub}>{formatDate(snapshot)}</Text>
			<Text style={[styles.sub, { marginTop: 10 }]}>
				{battery
					? `Battery ${battery.percent}%${battery.charging ? " · charging" : ""}`
					: "No battery detected"}
			</Text>
		</Page>
	);
}

// ------------------------------------------------------------------- system

export function SystemPanel({ snapshot }: { snapshot: Snapshot | null }) {
	const battery = snapshot?.battery;
	const batteryTint = battery?.charging ? colors.good : (battery?.percent ?? 100) < 20 ? colors.bad : colors.text;
	return (
		<Page>
			<View style={{ gap: 6, marginTop: 6 }}>
				<Bar label="CPU" value={snapshot?.cpu ?? 0} valueText={`${Math.round(snapshot?.cpu ?? 0)}%`} />
				<Bar label="RAM" value={snapshot?.ram ?? 0} valueText={`${Math.round(snapshot?.ram ?? 0)}%`} />
				<Bar
					label="BAT"
					value={battery?.percent ?? 100}
					valueText={battery ? `${battery.percent}%` : "n/a"}
					tint={batteryTint}
				/>
			</View>
			<Text style={[styles.faint, { marginTop: 10, textAlign: "center" }]}>
				Backend uses {Math.round(snapshot?.memMb ?? 0)} MB
			</Text>
		</Page>
	);
}

// ------------------------------------------------------------------ weather

export function WeatherPanel() {
	const unit = useSetting(SETTING.weatherUnit, "celsius");
	const { data, loading, error, reload } = useForecast(unit);

	if (!data) {
		return (
			<Page>
				<View style={styles.center}>
					<Text style={styles.sub}>{error ?? (loading ? "Loading forecast…" : "No forecast available.")}</Text>
					{error && <PillButton label="Try again" onPress={() => void reload()} />}
				</View>
			</Page>
		);
	}

	return (
		<Page>
			<Text style={styles.sub}>📍 {data.city}</Text>
			<View style={styles.row}>
				<Text style={{ fontSize: 30 }}>{weatherEmoji(data.condition, data.isDay)}</Text>
				<Text style={styles.big}>{data.temperature}°</Text>
				<View style={{ marginLeft: 10, flex: 1 }}>
					<Text style={styles.strong}>{data.condition}</Text>
					<Text style={styles.faint}>
						Feels {data.feelsLike}° · {data.humidity}% · {data.wind} {unit === "fahrenheit" ? "mph" : "km/h"}
					</Text>
				</View>
			</View>
			<View style={[styles.row, { gap: 6, marginTop: 8 }]}>
				{data.days.map((day) => (
					<View key={day.date} style={styles.dayCard}>
						<Text style={styles.faint}>
							{day.isToday
								? "Today"
								: new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
						</Text>
						<Text style={{ fontSize: 18 }}>{weatherEmoji(day.condition)}</Text>
						<Text style={styles.strong}>{day.max}°</Text>
						<Text style={styles.faint}>{day.min}°</Text>
					</View>
				))}
			</View>
		</Page>
	);
}

// ---------------------------------------------------------------------- ai

export function AiPanel({
	messages,
	setMessages,
	onPin
}: {
	messages: ChatMessage[];
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	onPin: (pinned: boolean) => void;
}) {
	const apiKey = useSetting(SETTING.aiApiKey, "");
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [model, setModel] = useState<string | null>(null);
	const scroller = useRef<ScrollView>(null);
	const hasKey = apiKey.trim().length > 0;

	useEffect(() => () => onPin(false), [onPin]);
	useEffect(() => {
		scroller.current?.scrollToEnd({ animated: true });
	}, [messages, busy, error]);

	const send = async () => {
		const text = input.trim();
		if (!text || busy || !hasKey) return;
		const next: ChatMessage[] = [...messages, { role: "user", text }];
		setMessages(next);
		setInput("");
		setError(null);
		setBusy(true);
		try {
			const reply = await askGemini(apiKey, next);
			setModel(reply.model);
			setMessages((previous) => [...previous, { role: "model", text: reply.text }]);
		} catch (e) {
			setError((e as Error).message || "Something went wrong.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Page>
			<ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
				{!hasKey ? (
					<Text style={[styles.faint, { textAlign: "center", marginTop: 20 }]}>
						🔑 Add your Gemini API key in Settings to start chatting.
					</Text>
				) : messages.length === 0 ? (
					<Text style={[styles.faint, { textAlign: "center", marginTop: 20 }]}>Ask me anything.</Text>
				) : (
					messages.map((m, i) => (
						<View key={i} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleModel]}>
							<Text style={styles.bubbleText}>{m.text}</Text>
						</View>
					))
				)}
				{busy && <Text style={styles.faint}>Thinking…</Text>}
				{error && <Text style={[styles.faint, { color: colors.bad, textAlign: "center" }]}>{error}</Text>}
				{model && !busy && <Text style={[styles.faint, { textAlign: "center", fontSize: 9 }]}>Answered by {model}</Text>}
			</ScrollView>
			<View style={[styles.row, { gap: 6 }]}>
				<TextInput
					style={styles.input}
					value={input}
					onChangeText={setInput}
					editable={hasKey}
					placeholder={hasKey ? `Message ${GEMINI_LABEL}` : "API key required"}
					placeholderTextColor={colors.faint}
					onFocus={() => onPin(true)}
					onBlur={() => onPin(false)}
					onSubmitEditing={() => void send()}
				/>
				<PillButton label="Send" strong disabled={!hasKey || busy || input.trim().length === 0} onPress={() => void send()} />
			</View>
		</Page>
	);
}

// -------------------------------------------------------------------- notes

export function NotesPanel({ onPin }: { onPin: (pinned: boolean) => void }) {
	const saved = useSetting(SETTING.notesText, "");
	const [text, setText] = useState(saved);
	const latest = useRef(text);
	latest.current = text;
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Save shortly after typing stops, and once more when the page closes.
	const schedule = (value: string) => {
		setText(value);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setSetting(SETTING.notesText, value), 600);
	};

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
			setSetting(SETTING.notesText, latest.current);
			onPin(false);
		},
		[onPin]
	);

	return (
		<Page>
			<TextInput
				style={[styles.input, { flex: 1, textAlignVertical: "top", borderRadius: 12, paddingTop: 8 }]}
				multiline
				value={text}
				onChangeText={schedule}
				placeholder="Jot something down. It saves automatically."
				placeholderTextColor={colors.faint}
				onFocus={() => onPin(true)}
				onBlur={() => onPin(false)}
			/>
			<View style={[styles.row, { justifyContent: "space-between", marginTop: 6 }]}>
				<Text style={styles.faint}>{text.length} characters</Text>
				<PillButton label="Clear" disabled={text.length === 0} onPress={() => schedule("")} />
			</View>
		</Page>
	);
}

// --------------------------------------------------------------- calculator

type Op = "+" | "−" | "×" | "÷";

function compute(a: number, b: number, op: Op): number {
	switch (op) {
		case "+":
			return a + b;
		case "−":
			return a - b;
		case "×":
			return a * b;
		case "÷":
			return b === 0 ? NaN : a / b;
	}
}

const format = (n: number) => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : "Error");

const KEYS = [
	["C", "±", "%", "÷"],
	["7", "8", "9", "×"],
	["4", "5", "6", "−"],
	["1", "2", "3", "+"],
	["0", ".", "⌫", "="]
];

export function CalculatorPanel() {
	const [display, setDisplay] = useState("0");
	const [acc, setAcc] = useState<number | null>(null);
	const [op, setOp] = useState<Op | null>(null);
	const [fresh, setFresh] = useState(true);
	const current = () => (display === "Error" ? 0 : parseFloat(display));

	const press = (label: string) => {
		if (/^[0-9]$/.test(label)) {
			if (fresh || display === "Error") {
				setDisplay(label);
				setFresh(false);
			} else if (display.replace(/[-.]/g, "").length < 12) {
				setDisplay(display === "0" ? label : display + label);
			}
			return;
		}
		switch (label) {
			case ".":
				if (fresh || display === "Error") {
					setDisplay("0.");
					setFresh(false);
				} else if (!display.includes(".")) {
					setDisplay(display + ".");
				}
				return;
			case "C":
				setDisplay("0");
				setAcc(null);
				setOp(null);
				setFresh(true);
				return;
			case "⌫":
				if (fresh || display === "Error") return;
				setDisplay(display.length > 1 && display !== "-0" ? display.slice(0, -1) || "0" : "0");
				return;
			case "±":
				if (display === "Error" || display === "0") return;
				setDisplay(display.startsWith("-") ? display.slice(1) : `-${display}`);
				return;
			case "%":
				setDisplay(format(current() / 100));
				setFresh(true);
				return;
			case "=":
				if (acc !== null && op) {
					setDisplay(format(compute(acc, current(), op)));
					setAcc(null);
					setOp(null);
					setFresh(true);
				}
				return;
			default: {
				const next = label as Op;
				if (acc !== null && op && !fresh) {
					const result = compute(acc, current(), op);
					setAcc(Number.isFinite(result) ? result : null);
					setDisplay(format(result));
				} else {
					setAcc(current());
				}
				setOp(next);
				setFresh(true);
			}
		}
	};

	return (
		<Page>
			<View style={{ alignItems: "flex-end", minHeight: 40, justifyContent: "flex-end", paddingHorizontal: 6 }}>
				<Text style={styles.faint}>{acc !== null && op ? `${format(acc)} ${op}` : " "}</Text>
				<Text style={styles.calcValue}>{display}</Text>
			</View>
			<View style={{ flex: 1, gap: 5, marginTop: 6 }}>
				{KEYS.map((row, r) => (
					<View key={r} style={{ flex: 1, flexDirection: "row", gap: 5 }}>
						{row.map((label) => {
							const accent = "+−×÷=".includes(label);
							return (
								<Pressable
									key={label}
									onPress={() => press(label)}
									style={[styles.calcKey, accent && { backgroundColor: colors.accent }]}
								>
									<Text style={styles.calcKeyText}>{label}</Text>
								</Pressable>
							);
						})}
					</View>
				))}
			</View>
		</Page>
	);
}

// ------------------------------------------------------------ notifications

const KIND_ICON: Record<string, string> = {
	battery: "🪫",
	power: "⚡",
	lock: "🔒",
	timer: "⏱️",
	break: "☕"
};

function timeAgo(at: number) {
	const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsPanel() {
	const items = useNotifications();
	return (
		<Page>
			<View style={[styles.row, { justifyContent: "space-between", marginBottom: 4 }]}>
				<Text style={styles.strong}>Notifications</Text>
				<PillButton label="Clear" disabled={items.length === 0} onPress={clearNotifications} />
			</View>
			<ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
				{items.length === 0 ? (
					<Text style={[styles.faint, { textAlign: "center", marginTop: 24 }]}>
						No alerts yet. Battery, charger, lock and break alerts show up here.
					</Text>
				) : (
					items.map((n) => (
						<View key={n.id} style={[styles.row, styles.notifRow]}>
							<Text style={{ fontSize: 16 }}>{KIND_ICON[n.kind] ?? "🔔"}</Text>
							<View style={{ marginLeft: 8, flex: 1 }}>
								<Text style={styles.strong}>{n.title}</Text>
								<Text style={styles.faint}>
									{n.body ? `${n.body} · ` : ""}
									{timeAgo(n.at)}
								</Text>
							</View>
						</View>
					))
				)}
			</ScrollView>
		</Page>
	);
}

const styles = StyleSheet.create({
	big: { color: colors.text, fontSize: 30, fontWeight: "600" },
	strong: { color: colors.text, fontSize: 12, fontWeight: "600" },
	sub: { color: colors.muted, fontSize: 12 },
	faint: { color: colors.faint, fontSize: 10 },
	row: { flexDirection: "row", alignItems: "center" },
	center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
	dayCard: {
		flex: 1,
		alignItems: "center",
		gap: 3,
		paddingVertical: 7,
		borderRadius: 10,
		backgroundColor: colors.surface
	},
	bubble: { maxWidth: "88%", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
	bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.surfaceStrong },
	bubbleModel: { alignSelf: "flex-start", backgroundColor: colors.surface },
	bubbleText: { color: colors.text, fontSize: 12 },
	input: {
		flex: 1,
		minHeight: 32,
		paddingHorizontal: 12,
		borderRadius: 999,
		backgroundColor: colors.surface,
		color: colors.text,
		fontSize: 12
	},
	calcValue: { color: colors.text, fontSize: 22, fontWeight: "600" },
	calcKey: {
		flex: 1,
		borderRadius: 10,
		backgroundColor: colors.surface,
		alignItems: "center",
		justifyContent: "center"
	},
	calcKeyText: { color: colors.text, fontSize: 13 },
	notifRow: { padding: 8, borderRadius: 10, backgroundColor: colors.surface }
});
