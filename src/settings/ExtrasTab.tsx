import { StickyNote, Calculator, Volume2, BellOff, Smile, Coffee } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useExtras } from "../hooks/useExtras";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
	return (
		<label className="toggle-switch">
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			<span className="slider"></span>
		</label>
	);
}

export function ExtrasTab() {
	const { values, set } = useExtras();

	return (
		<>
			<div className="setting-group-label">Extra Panels</div>
			<div className="setting-group">
				<SettingRow
					icon={StickyNote}
					label="Quick Notes"
					desc="A notepad page in the notch, after Weather. Saved on this PC"
				>
					<Toggle checked={values.notesEnabled} onChange={(v) => set("notesEnabled", v)} />
				</SettingRow>
				<SettingRow
					icon={Calculator}
					label="Calculator"
					desc="A simple calculator page in the notch, after Quick Notes"
				>
					<Toggle checked={values.calculatorEnabled} onChange={(v) => set("calculatorEnabled", v)} />
				</SettingRow>
			</div>

			<div className="setting-group-label">Alerts</div>
			<div className="setting-group">
				<SettingRow
					icon={BellOff}
					label="Quiet Mode"
					desc="Silence notch alerts and sounds (they still appear in the notification list)"
				>
					<Toggle checked={values.quietMode} onChange={(v) => set("quietMode", v)} />
				</SettingRow>
				<SettingRow
					icon={Volume2}
					label="Alert Sounds"
					desc="Soft chimes for charger, low battery, lock and unlock. Starts after your first click on the notch"
				>
					<Toggle checked={values.alertSounds} onChange={(v) => set("alertSounds", v)} />
				</SettingRow>
				<SettingRow
					icon={Smile}
					label="Welcome Back Greeting"
					desc="Say good morning, afternoon or evening when you unlock your PC"
				>
					<Toggle checked={values.welcomeGreeting} onChange={(v) => set("welcomeGreeting", v)} />
				</SettingRow>
			</div>

			<div className="setting-group-label">Wellbeing</div>
			<div className="setting-group">
				<SettingRow
					icon={Coffee}
					label="Break Reminders"
					desc={
						values.breakReminders
							? `A gentle nudge every ${values.breakInterval} minutes to rest your eyes`
							: "A gentle nudge now and then to rest your eyes"
					}
				>
					<Toggle checked={values.breakReminders} onChange={(v) => set("breakReminders", v)} />
				</SettingRow>
				{values.breakReminders && (
					<SettingRow icon={Coffee} label="Reminder Interval" desc="Minutes between reminders">
						<input
							type="range"
							min="10"
							max="90"
							step="5"
							value={values.breakInterval}
							onChange={(e) => set("breakInterval", parseInt(e.target.value))}
							className="settings-slider"
						/>
					</SettingRow>
				)}
			</div>
		</>
	);
}
