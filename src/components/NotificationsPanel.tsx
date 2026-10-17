import { invoke } from "@tauri-apps/api/core";
import { BatteryLow, Bell, Bluetooth, ChevronLeft, Coffee, Download, Lock, Timer, Trash2, Zap } from "lucide-react";
import "./QuickPanel.css";

export interface NotchNotification {
	id: number;
	kind: "battery" | "power" | "lock" | "update" | "timer" | "break" | "bluetooth";
	title: string;
	body?: string;
	at: number;
}

function KindIcon({ kind }: { kind: NotchNotification["kind"] }) {
	switch (kind) {
		case "battery":
			return <BatteryLow />;
		case "power":
			return <Zap />;
		case "lock":
			return <Lock />;
		case "update":
			return <Download />;
		case "timer":
			return <Timer />;
		case "break":
			return <Coffee />;
		case "bluetooth":
			return <Bluetooth />;
		default:
			return <Bell />;
	}
}

function timeAgo(at: number) {
	const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

interface NotificationsPanelProps {
	items: NotchNotification[];
	onClear: () => void;
	onBack: () => void;
}

export function NotificationsPanel({ items, onClear, onBack }: NotificationsPanelProps) {
	return (
		<div className="qp" onClick={(e) => e.stopPropagation()}>
			<div className="qp-header">
				<button className="qp-icon-btn" onClick={onBack} aria-label="Back to controls">
					<ChevronLeft />
				</button>
				<span className="qp-title">Notifications</span>
				<button
					className="qp-icon-btn"
					onClick={onClear}
					disabled={items.length === 0}
					aria-label="Clear notifications"
				>
					<Trash2 />
				</button>
			</div>
			<div className="qp-body">
				{items.length === 0 ? (
					<div className="qp-empty">
						<Bell />
						<span>No alerts yet</span>
						<span className="qp-row-sub">
							Battery, charger, lock, update and timer alerts show up here.
						</span>
					</div>
				) : (
					<ul className="qp-list">
						{items.map((n) => (
							<li key={n.id} className="qp-row">
								<div className="qp-row-main notif-row">
									<span className="qp-row-icon">
										<KindIcon kind={n.kind} />
									</span>
									<span className="qp-row-text">
										<span className="qp-row-name">{n.title}</span>
										<span className="qp-row-sub">
											{n.body ? `${n.body} · ` : ""}
											{timeAgo(n.at)}
										</span>
									</span>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
			<button
				className="qp-footer"
				onClick={() => invoke("open_notification_center").catch(() => {})}
			>
				Open Windows notifications
			</button>
		</div>
	);
}
