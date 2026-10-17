// Minimal Gemini client for the notch AI panel.
// The key lives in settings (bloom-ai-api-key) and is sent straight to Google.

export const GEMINI_MODEL = "gemini-3.6-flash";
export const GEMINI_LABEL = "Gemini 3.6 Flash";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// The notch is tiny, so keep answers short and plain. The identity line stops
// the model from guessing an older version name when asked what it is.
const SYSTEM_PROMPT =
	`You are Bloom, a concise assistant living in a small desktop notch on Windows, powered by Google's ${GEMINI_LABEL} model. ` +
	`If asked which model or version you are, say you are ${GEMINI_LABEL}. ` +
	"Answer in a few short sentences. Use plain text only (no markdown, no headings). " +
	"Be friendly, clear and professional.";

// Only the most recent turns are sent, to keep requests small and cheap.
const MAX_HISTORY = 12;

export interface ChatMessage {
	role: "user" | "model";
	text: string;
}

export interface GeminiReply {
	text: string;
	/** The model name Google reports it actually used for this response. */
	model: string;
}

export async function askGemini(
	apiKey: string,
	history: ChatMessage[],
	signal?: AbortSignal
): Promise<GeminiReply> {
	const key = apiKey.trim();
	if (!key) throw new Error("Add your Gemini API key in Settings → Notch.");

	// Gemini 3.x rejects requests whose last turn is from the model.
	const turns = history.slice(-MAX_HISTORY);
	if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
		throw new Error("Nothing to send.");
	}

	let res: Response;
	try {
		res = await fetch(ENDPOINT, {
			method: "POST",
			signal,
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": key
			},
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
				contents: turns.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
			})
		});
	} catch (err) {
		if ((err as Error)?.name === "AbortError") throw err;
		throw new Error("Couldn't reach Gemini. Check your connection.");
	}

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const detail: string | undefined = body?.error?.message;
		if (res.status === 400 || res.status === 403) {
			throw new Error(
				detail && /api key/i.test(detail)
					? "That API key doesn't look valid. Check it in Settings → Notch."
					: detail ?? "Gemini rejected the request."
			);
		}
		if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
		throw new Error(detail ?? `Gemini error (${res.status}).`);
	}

	const data = await res.json();
	const text = (data?.candidates?.[0]?.content?.parts ?? [])
		.map((p: { text?: string }) => p.text ?? "")
		.join("")
		.trim();
	return {
		text: text || "I didn't get a response. Try rephrasing.",
		model: typeof data?.modelVersion === "string" && data.modelVersion ? data.modelVersion : GEMINI_MODEL
	};
}
