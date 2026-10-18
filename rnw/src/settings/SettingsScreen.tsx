import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useBackendOnline } from "../bridge/backend";
import { SETTING, setSetting, useBoolSetting, useNumberSetting, useSetting } from "../bridge/settings";
import { PillButton } from "../components/ui";
import { colors } from "../theme";

function Row({ label, desc, children }: { label: string; desc?: string; children?: ReactNode }) {
	return (
		<View style={styles.row}>
			<View style={{ flex: 1, paddingRight: 12 }}>
				<Text style={styles.label}>{label}</Text>
				{desc ? <Text style={styles.desc}>{desc}</Text> : null}
			</View>
			{children}
		</View>
	);
}

function Toggle({ name, fallback }: { name: string; fallback: boolean }) {
	const value = useBoolSetting(name, fallback);
	return (
		<Switch
			value={value}
			onValueChange={(next) => setSetting(name, next)}
			trackColor={{ false: "#3a3a3c", true: colors.accent }}
			thumbColor="#ffffff"
		/>
	);
}

function Stepper({
	name,
	fallback,
	min,
	max,
	step,
	suffix
}: {
	name: string;
	fallback: number;
	min: number;
	max: number;
	step: number;
	suffix: string;
}) {
	const value = useNumberSetting(name, fallback);
	return (
		<View style={styles.stepper}>
			<PillButton label="−" disabled={value <= min} onPress={() => setSetting(name, Math.max(min, value - step))} />
			<Text style={styles.stepperValue}>
				{value} {suffix}
			</Text>
			<PillButton label="+" disabled={value >= max} onPress={() => setSetting(name, Math.min(max, value + step))} />
		</View>
	);
}

function NotchTab() {
	const aiEnabled = useBoolSetting(SETTING.aiEnabled, true);
	const unit = useSetting(SETTING.weatherUnit, "celsius");
	const apiKey = useSetting(SETTING.aiApiKey, "");
	const [draft, setDraft] = useState(apiKey);
	return (
		<>
			<Row label="AI Assistant" desc="Chat with Gemini 3.6 Flash from the notch">
				<Toggle name={SETTING.aiEnabled} fallback={true} />
			</Row>
			{aiEnabled && (
				<Row label="Gemini API Key" desc="Stored on this PC and sent only to Google">
					<TextInput
						style={styles.textInput}
						value={draft}
						onChangeText={setDraft}
						onBlur={() => draft.trim() !== apiKey && setSetting(SETTING.aiApiKey, draft.trim())}
						onSubmitEditing={() => setSetting(SETTING.aiApiKey, draft.trim())}
						secureTextEntry
						placeholder="Paste your key"
						placeholderTextColor={colors.faint}
					/>
				</Row>
			)}
			<Row label="Weather" desc="Show the weather page">
				<Toggle name={SETTING.weatherEnabled} fallback={true} />
			</Row>
			<Row label="Temperature Unit">
				<View style={{ flexDirection: "row", gap: 6 }}>
					<PillButton label="°C" strong={unit !== "fahrenheit"} onPress={() => setSetting(SETTING.weatherUnit, "celsius")} />
					<PillButton label="°F" strong={unit === "fahrenheit"} onPress={() => setSetting(SETTING.weatherUnit, "fahrenheit")} />
				</View>
			</Row>
			<Row label="Low Battery Alert" desc="Warn when the battery drops to this level">
				<Stepper name={SETTING.lowBattery} fallback={20} min={5} max={50} step={5} suffix="%" />
			</Row>
		</>
	);
}

function ExtrasTab() {
	const breaks = useBoolSetting(SETTING.breakReminders, false);
	return (
		<>
			<Row label="Quick Notes" desc="A notepad page in the notch">
				<Toggle name={SETTING.notesEnabled} fallback={false} />
			</Row>
			<Row label="Calculator" desc="A simple calculator page in the notch">
				<Toggle name={SETTING.calculatorEnabled} fallback={false} />
			</Row>
			<Row label="Quiet Mode" desc="Silence notch alerts (they still appear in the list)">
				<Toggle name={SETTING.quietMode} fallback={false} />
			</Row>
			<Row label="Welcome Back Greeting" desc="Greet you when you unlock your PC">
				<Toggle name={SETTING.welcomeGreeting} fallback={false} />
			</Row>
			<Row label="Break Reminders" desc="A gentle nudge to rest your eyes">
				<Toggle name={SETTING.breakReminders} fallback={false} />
			</Row>
			{breaks && (
				<Row label="Reminder Interval" desc="Minutes between reminders">
					<Stepper name={SETTING.breakInterval} fallback={20} min={10} max={90} step={5} suffix="min" />
				</Row>
			)}
		</>
	);
}

function AboutTab() {
	const online = useBackendOnline();
	return (
		<>
			<Row label="Bloom for React Native Windows" desc="Early preview. Many pages are still being ported." />
			<Row label="Backend" desc={online ? "Connected" : "Not running. Start bloom-backend.exe"} />
			<Text style={styles.credit}>Made with love from shrey ❤️</Text>
		</>
	);
}

const TABS = [
	{ id: "notch", label: "Notch" },
	{ id: "extras", label: "Extras" },
	{ id: "about", label: "About" }
] as const;

export function SettingsScreen() {
	const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("notch");
	return (
		<View style={styles.screen}>
			<View style={styles.tabs}>
				{TABS.map((t) => (
					<Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
						<Text style={styles.tabText}>{t.label}</Text>
					</Pressable>
				))}
			</View>
			<ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
				{tab === "notch" && <NotchTab />}
				{tab === "extras" && <ExtrasTab />}
				{tab === "about" && <AboutTab />}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
	tabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
	tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface },
	tabActive: { backgroundColor: colors.surfaceStrong },
	tabText: { color: colors.text, fontSize: 13 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border
	},
	label: { color: colors.text, fontSize: 14 },
	desc: { color: colors.muted, fontSize: 12, marginTop: 2 },
	textInput: {
		width: 220,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: colors.surface,
		color: colors.text,
		fontSize: 13
	},
	stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
	stepperValue: { color: colors.text, fontSize: 13, minWidth: 56, textAlign: "center" },
	credit: { color: colors.muted, fontSize: 13, marginTop: 24, textAlign: "center" }
});
