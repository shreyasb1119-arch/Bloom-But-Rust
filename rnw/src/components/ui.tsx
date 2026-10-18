import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function Bar({
	label,
	value,
	valueText,
	tint = colors.accent
}: {
	label: string;
	value: number;
	valueText: string;
	tint?: string;
}) {
	const pct = Math.min(Math.max(value, 0), 100);
	return (
		<View style={styles.barRow}>
			<Text style={styles.barLabel}>{label}</Text>
			<View style={styles.barTrack}>
				<View style={[styles.barFill, { width: `${pct}%`, backgroundColor: tint }]} />
			</View>
			<Text style={styles.barValue}>{valueText}</Text>
		</View>
	);
}

export function PillButton({
	label,
	onPress,
	disabled,
	strong
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	strong?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={[styles.pill, strong && styles.pillStrong, disabled && { opacity: 0.35 }]}
		>
			<Text style={styles.pillText}>{label}</Text>
		</Pressable>
	);
}

export function Page({ children }: { children: ReactNode }) {
	return <View style={styles.page}>{children}</View>;
}

const styles = StyleSheet.create({
	barRow: { flexDirection: "row", alignItems: "center", height: 20 },
	barLabel: { width: 38, color: colors.muted, fontSize: 11 },
	barTrack: {
		flex: 1,
		height: 6,
		borderRadius: 3,
		backgroundColor: "rgba(255,255,255,0.15)",
		overflow: "hidden"
	},
	barFill: { height: 6, borderRadius: 3 },
	barValue: { width: 42, color: colors.text, fontSize: 11, textAlign: "right" },
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 5,
		borderRadius: 999,
		backgroundColor: colors.surface,
		alignItems: "center",
		justifyContent: "center"
	},
	pillStrong: { backgroundColor: colors.surfaceStrong },
	pillText: { color: colors.text, fontSize: 12 },
	page: { flex: 1, paddingHorizontal: 14, paddingBottom: 12 }
});
