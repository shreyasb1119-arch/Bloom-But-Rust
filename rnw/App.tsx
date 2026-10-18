import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useBackendOnline } from "./src/bridge/backend";
import { loadSettings } from "./src/bridge/settings";
import { Notch } from "./src/components/Notch";
import { SettingsScreen } from "./src/settings/SettingsScreen";
import { colors } from "./src/theme";

// Phase 1 harness: the notch and the settings sit in one normal window so the
// ported UI can be tested. The borderless, always-on-top notch window comes
// from the native host in a later step.
export default function App() {
	const online = useBackendOnline();

	// Load settings as soon as the backend answers.
	useEffect(() => {
		let alive = true;
		const run = async () => {
			while (alive && !(await loadSettings())) {
				await new Promise((resolve) => setTimeout(resolve, 2500));
			}
		};
		void run();
		return () => {
			alive = false;
		};
	}, []);

	return (
		<View style={styles.root}>
			<View style={styles.notchArea}>
				<Notch />
			</View>
			{!online && (
				<Text style={styles.banner}>The Bloom backend isn't running. Start bloom-backend.exe, then reopen this window.</Text>
			)}
			<SettingsScreen />
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.desk },
	notchArea: { alignItems: "center", zIndex: 10 },
	banner: {
		marginTop: 10,
		marginHorizontal: 24,
		padding: 8,
		borderRadius: 8,
		backgroundColor: "rgba(255,69,58,0.18)",
		color: colors.bad,
		fontSize: 12,
		textAlign: "center"
	}
});
