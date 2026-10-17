import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

const STORAGE_KEY = "bloom-notes-text";

interface NotesPanelProps {
	/** Keeps the notch open while the note has focus. */
	onPinChange: (pinned: boolean) => void;
}

export function NotesPanel({ onPinChange }: NotesPanelProps) {
	const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latest = useRef(text);
	latest.current = text;

	// Save shortly after typing stops, and once more when the panel closes.
	const scheduleSave = () => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			localStorage.setItem(STORAGE_KEY, latest.current);
		}, 400);
	};

	useEffect(() => {
		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
			localStorage.setItem(STORAGE_KEY, latest.current);
			onPinChange(false);
		};
	}, [onPinChange]);

	return (
		<div className="notes-panel" onClick={(e) => e.stopPropagation()}>
			<textarea
				className="notes-area"
				value={text}
				placeholder="Jot something down. It saves automatically."
				spellCheck={false}
				onChange={(e) => {
					setText(e.target.value);
					scheduleSave();
				}}
				onFocus={() => onPinChange(true)}
				onBlur={() => onPinChange(false)}
				onKeyDown={(e) => e.stopPropagation()}
			/>
			<div className="notes-footer">
				<span>{text.length} characters · saved on this PC</span>
				<button
					type="button"
					className="ai-icon-btn"
					aria-label="Clear note"
					disabled={text.length === 0}
					onClick={() => {
						setText("");
						localStorage.setItem(STORAGE_KEY, "");
					}}
				>
					<Eraser size={13} strokeWidth={2} />
				</button>
			</div>
		</div>
	);
}
