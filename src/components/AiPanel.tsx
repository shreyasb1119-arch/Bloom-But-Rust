import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Send, Eraser, KeyRound } from "lucide-react";
import { askGemini, GEMINI_LABEL } from "../lib/gemini";
import type { ChatMessage } from "../lib/gemini";

interface AiPanelProps {
	apiKey: string;
	messages: ChatMessage[];
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	/** Keeps the notch open while the input has focus. */
	onPinChange: (pinned: boolean) => void;
}

export function AiPanel({ apiKey, messages, setMessages, onPinChange }: AiPanelProps) {
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [modelUsed, setModelUsed] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			onPinChange(false);
		};
	}, [onPinChange]);

	useEffect(() => {
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages, busy, error]);

	const hasKey = apiKey.trim().length > 0;

	const send = async () => {
		const text = input.trim();
		if (!text || busy || !hasKey) return;
		const next: ChatMessage[] = [...messages, { role: "user", text }];
		setMessages(next);
		setInput("");
		setError(null);
		setBusy(true);
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			const reply = await askGemini(apiKey, next, controller.signal);
			setModelUsed(reply.model);
			setMessages((prev) => [...prev, { role: "model", text: reply.text }]);
		} catch (err) {
			if ((err as Error)?.name !== "AbortError") {
				setError((err as Error).message || "Something went wrong.");
			}
		} finally {
			setBusy(false);
		}
	};

	const clear = () => {
		abortRef.current?.abort();
		setMessages([]);
		setError(null);
		setBusy(false);
		setModelUsed(null);
	};

	return (
		<div className="ai-panel-inner">
			<div className="ai-messages" ref={listRef}>
				{!hasKey ? (
					<div className="ai-empty">
						<KeyRound size={16} strokeWidth={1.75} />
						<span>Add your Gemini API key in Settings → Notch to start chatting.</span>
					</div>
				) : messages.length === 0 ? (
					<div className="ai-empty">
						<span>Ask me anything.</span>
					</div>
				) : (
					messages.map((m, i) => (
						<div key={i} className={`ai-msg ${m.role === "user" ? "user" : "model"}`}>
							{m.text}
						</div>
					))
				)}
				{busy && <div className="ai-msg model ai-thinking">Thinking…</div>}
				{error && <div className="ai-error">{error}</div>}
				{modelUsed && !busy && <div className="ai-model">Answered by {modelUsed}</div>}
			</div>
			<div className="ai-input-row">
				<input
					className="ai-input"
					type="text"
					value={input}
					placeholder={hasKey ? `Message ${GEMINI_LABEL}` : "API key required"}
					disabled={!hasKey}
					spellCheck={false}
					onChange={(e) => setInput(e.target.value)}
					onFocus={() => onPinChange(true)}
					onBlur={() => onPinChange(false)}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter") void send();
					}}
				/>
				<button
					type="button"
					className="ai-icon-btn"
					aria-label="Clear chat"
					disabled={messages.length === 0 && !error}
					onClick={clear}
				>
					<Eraser size={13} strokeWidth={2} />
				</button>
				<button
					type="button"
					className="ai-icon-btn send"
					aria-label="Send"
					disabled={!hasKey || busy || input.trim().length === 0}
					onClick={() => void send()}
				>
					<Send size={13} strokeWidth={2} />
				</button>
			</div>
		</div>
	);
}
