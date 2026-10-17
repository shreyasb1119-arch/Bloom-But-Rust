import { Cpu, MemoryStick, Battery, BatteryCharging } from "lucide-react";
import type { ReactNode } from "react";

interface SystemPanelProps {
	cpu: number;
	ram: number;
	battery: number;
	charging: boolean;
	lowBatteryThreshold: number;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Gauge({
	value,
	label,
	sub,
	icon,
	warn
}: {
	value: number;
	label: string;
	sub?: string;
	icon: ReactNode;
	warn?: boolean;
}) {
	const pct = Math.min(Math.max(Math.round(value), 0), 100);
	return (
		<div className="sys-gauge">
			<div className="sys-ring">
				<svg width="68" height="68" viewBox="0 0 68 68">
					<circle className="sys-ring-track" cx="34" cy="34" r={RADIUS} />
					<circle
						className={`sys-ring-fill ${warn ? "warn" : ""}`}
						cx="34"
						cy="34"
						r={RADIUS}
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
					/>
				</svg>
				<span className="sys-value">{pct}%</span>
			</div>
			<div className="sys-label">
				{icon}
				<span>{label}</span>
			</div>
			<div className="sys-sub">{sub ?? "\u00A0"}</div>
		</div>
	);
}

export function SystemPanel({ cpu, ram, battery, charging, lowBatteryThreshold }: SystemPanelProps) {
	const low = battery <= lowBatteryThreshold && !charging;
	return (
		<div className="sys-panel">
			<Gauge value={cpu} label="CPU" icon={<Cpu size={11} strokeWidth={2} />} warn={cpu >= 90} />
			<Gauge
				value={ram}
				label="Memory"
				icon={<MemoryStick size={11} strokeWidth={2} />}
				warn={ram >= 90}
			/>
			<Gauge
				value={battery}
				label="Battery"
				sub={charging ? "Charging" : "On battery"}
				icon={
					charging ? (
						<BatteryCharging size={11} strokeWidth={2} />
					) : (
						<Battery size={11} strokeWidth={2} />
					)
				}
				warn={low}
			/>
		</div>
	);
}
