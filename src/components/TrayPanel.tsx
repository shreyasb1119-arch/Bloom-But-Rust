import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronLeft, RefreshCw } from "lucide-react";
import type { TrayApp } from "../dockApps";
import "./QuickPanel.css";

interface TrayTile {
	key: string;
	trayId: string;
	name: string;
	path: string;
}

// Icons rarely change, so keep them for the life of the window.
const iconCache = new Map<string, string | null>();

interface TrayPanelProps {
	onBack: () => void;
}

export function TrayPanel({ onBack }: TrayPanelProps) {
	const [tiles, setTiles] = useState<TrayTile[]>([]);
	const [icons, setIcons] = useState<Record<string, string | null>>({});
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const alive = useRef(true);

	const load = useCallback(async () => {
		setLoading(true);
		setFailed(false);
		try {
			const apps = await invoke<TrayApp[]>("get_tray_apps");
			if (!alive.current) return;
			const next: TrayTile[] = apps.flatMap((app) =>
				app.tray_ids.map((id, index) => ({
					key: `${app.path}|${id}`,
					trayId: id,
					name: app.tray_ids.length > 1 ? `${app.name} (${index + 1})` : app.name,
					path: app.path
				}))
			);
			setTiles(next);

			const cached: Record<string, string | null> = {};
			for (const tile of next) {
				if (iconCache.has(tile.path)) cached[tile.path] = iconCache.get(tile.path) ?? null;
			}
			setIcons(cached);

			const missing = Array.from(new Set(next.map((t) => t.path))).filter(
				(path) => !iconCache.has(path)
			);
			await Promise.all(
				missing.map(async (path) => {
					const name = next.find((t) => t.path === path)?.name ?? null;
					try {
						const icon = await invoke<string | null>("get_app_icon", {
							path,
							name,
							hwnd: null
						});
						iconCache.set(path, icon);
					} catch {
						iconCache.set(path, null);
					}
					if (alive.current) {
						setIcons((prev) => ({ ...prev, [path]: iconCache.get(path) ?? null }));
					}
				})
			);
		} catch {
			if (alive.current) setFailed(true);
		} finally {
			if (alive.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		alive.current = true;
		void load();
		return () => {
			alive.current = false;
		};
	}, [load]);

	const activate = (trayId: string) => {
		invoke("activate_tray_icon", { trayId }).catch(() => {});
	};

	const openMenu = (trayId: string) => {
		invoke("show_tray_context_menu", { trayId }).catch(() => {});
	};

	return (
		<div className="qp" onClick={(e) => e.stopPropagation()}>
			<div className="qp-header">
				<button className="qp-icon-btn" onClick={onBack} aria-label="Back to controls">
					<ChevronLeft />
				</button>
				<span className="qp-title">System Tray</span>
				<button
					className="qp-icon-btn"
					onClick={() => void load()}
					disabled={loading}
					aria-label="Refresh tray icons"
				>
					<RefreshCw className={loading ? "qp-spin" : ""} />
				</button>
			</div>
			<div className="qp-body">
				{failed ? (
					<div className="qp-empty">
						<span>Couldn't read the tray.</span>
						<button className="qp-btn" onClick={() => void load()}>
							Try again
						</button>
					</div>
				) : tiles.length === 0 ? (
					<div className="qp-empty">
						<span>{loading ? "Looking for tray icons…" : "No tray icons right now."}</span>
					</div>
				) : (
					<div className="tray-grid">
						{tiles.map((tile) => {
							const icon = icons[tile.path];
							return (
								<button
									key={tile.key}
									className="tray-tile"
									title={`${tile.name}\nClick to open · Right-click for menu`}
									onClick={() => activate(tile.trayId)}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										openMenu(tile.trayId);
									}}
								>
									{icon ? (
										<img src={icon} alt="" draggable={false} />
									) : (
										<span className="tray-fallback">{tile.name.charAt(0).toUpperCase()}</span>
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>
			<button className="qp-footer" onClick={() => invoke("open_system_tray").catch(() => {})}>
				Click to open · Right-click for menu · Show full tray
			</button>
		</div>
	);
}
