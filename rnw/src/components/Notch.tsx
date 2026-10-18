import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SETTING, useBoolSetting } from "../bridge/settings";
import { useAlerts } from "../hooks/useAlerts";
import { formatTime, useSnapshot } from "../hooks/useSnapshot";
import type { ChatMessage } from "../lib/gemini";
import { colors, notch } from "../theme";
import {
	AiPanel,
	CalculatorPanel,
	NotesPanel,
	NotificationsPanel,
	StatusPanel,
	SystemPanel,
	WeatherPanel
} from "./Panels";

type PageId = "status" | "ai" | "system" | "weather" | "notes" | "calculator" | "notifications";

const PAGE_TITLE: Record<PageId, string> = {
	status: "Now",
	ai: "Assistant",
	system: "System",
	weather: "Weather",
	notes: "Quick Notes",
	calculator: "Calculator",
	notifications: "Notifications"
};

// Height of each page's content, below the 34px header.
const PAGE_HEIGHT: Record<PageId, number> = {
	status: 110,
	ai: 250,
	system: 120,
	weather: 190,
	notes: 200,
	calculator: 270,
	notifications: 210
};

const HEADER = notch.collapsedHeight;

export function Notch() {
	const snapshot = useSnapshot(3000);
	const pulse = useAlerts(snapshot);

	const aiEnabled = useBoolSetting(SETTING.aiEnabled, true);
	const weatherEnabled = useBoolSetting(SETTING.weatherEnabled, true);
	const notesEnabled = useBoolSetting(SETTING.notesEnabled, false);
	const calculatorEnabled = useBoolSetting(SETTING.calculatorEnabled, false);

	const pages = useMemo(() => {
		const list: PageId[] = ["status"];
		if (aiEnabled) list.push("ai");
		list.push("system");
		if (weatherEnabled) list.push("weather");
		if (notesEnabled) list.push("notes");
		if (calculatorEnabled) list.push("calculator");
		list.push("notifications");
		return list;
	}, [aiEnabled, weatherEnabled, notesEnabled, calculatorEnabled]);

	const [index, setIndex] = useState(0);
	const page = pages[Math.min(index, pages.length - 1)];
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	const [hovered, setHovered] = useState(false);
	const [pinned, setPinned] = useState(false);
	const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const expanded = hovered || pinned;

	const width = useRef(new Animated.Value(notch.collapsedWidth)).current;
	const height = useRef(new Animated.Value(HEADER)).current;
	const fade = useRef(new Animated.Value(0)).current;

	const targetWidth = expanded ? notch.expandedWidth : pulse ? notch.pulseWidth : notch.collapsedWidth;
	const targetHeight = expanded ? HEADER + PAGE_HEIGHT[page] : HEADER;

	useEffect(() => {
		const timing = (value: Animated.Value, to: number, duration: number) =>
			Animated.timing(value, {
				toValue: to,
				duration,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: false // width and height can't use the native driver
			});
		Animated.parallel([
			timing(width, targetWidth, 280),
			timing(height, targetHeight, 280),
			timing(fade, expanded ? 1 : 0, 220)
		]).start();
	}, [targetWidth, targetHeight, expanded, width, height, fade]);

	const onHoverIn = () => {
		if (leaveTimer.current) clearTimeout(leaveTimer.current);
		setHovered(true);
	};
	const onHoverOut = () => {
		if (leaveTimer.current) clearTimeout(leaveTimer.current);
		leaveTimer.current = setTimeout(() => setHovered(false), 180);
	};
	useEffect(
		() => () => {
			if (leaveTimer.current) clearTimeout(leaveTimer.current);
		},
		[]
	);

	const go = (step: number) => setIndex((current) => (current + step + pages.length) % pages.length);
	const pin = useCallback((value: boolean) => setPinned(value), []);

	const renderPage = () => {
		switch (page) {
			case "status":
				return <StatusPanel snapshot={snapshot} />;
			case "ai":
				return <AiPanel messages={messages} setMessages={setMessages} onPin={pin} />;
			case "system":
				return <SystemPanel snapshot={snapshot} />;
			case "weather":
				return <WeatherPanel />;
			case "notes":
				return <NotesPanel onPin={pin} />;
			case "calculator":
				return <CalculatorPanel />;
			case "notifications":
				return <NotificationsPanel />;
		}
	};

	return (
		<View style={styles.area}>
			<Pressable onHoverIn={onHoverIn} onHoverOut={onHoverOut}>
				<Animated.View style={[styles.pill, { width, height }]}>
					<View style={styles.header}>
						{expanded ? (
							<>
								<Pressable onPress={() => go(-1)} style={styles.arrow}>
									<Text style={styles.arrowText}>‹</Text>
								</Pressable>
								<Text style={styles.title}>
									{PAGE_TITLE[page]}  ·  {Math.min(index, pages.length - 1) + 1}/{pages.length}
								</Text>
								<Pressable onPress={() => go(1)} style={styles.arrow}>
									<Text style={styles.arrowText}>›</Text>
								</Pressable>
							</>
						) : pulse ? (
							<Text style={[styles.title, { color: pulse.color ?? colors.text }]}>
								{pulse.icon}  {pulse.label}
							</Text>
						) : (
							<Text style={styles.title}>{formatTime(snapshot)}</Text>
						)}
					</View>
					<Animated.View style={{ flex: 1, opacity: fade }} pointerEvents={expanded ? "auto" : "none"}>
						{expanded ? renderPage() : null}
					</Animated.View>
				</Animated.View>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	area: { width: 440, alignItems: "center" },
	pill: {
		backgroundColor: colors.pill,
		borderBottomLeftRadius: notch.radius,
		borderBottomRightRadius: notch.radius,
		overflow: "hidden"
	},
	header: {
		height: HEADER,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 8
	},
	title: { flex: 1, textAlign: "center", color: colors.text, fontSize: 13, fontWeight: "600" },
	arrow: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
	arrowText: { color: colors.muted, fontSize: 20, lineHeight: 22 }
});
