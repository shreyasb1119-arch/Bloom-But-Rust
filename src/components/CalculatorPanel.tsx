import { useState } from "react";

type Op = "+" | "−" | "×" | "÷";

function compute(a: number, b: number, op: Op): number {
	switch (op) {
		case "+":
			return a + b;
		case "−":
			return a - b;
		case "×":
			return a * b;
		case "÷":
			return b === 0 ? NaN : a / b;
	}
}

function format(n: number): string {
	if (!Number.isFinite(n)) return "Error";
	return String(parseFloat(n.toPrecision(12)));
}

const KEYS: { label: string; kind: "fn" | "op" | "num" | "eq"; wide?: boolean }[] = [
	{ label: "C", kind: "fn" },
	{ label: "±", kind: "fn" },
	{ label: "%", kind: "fn" },
	{ label: "÷", kind: "op" },
	{ label: "7", kind: "num" },
	{ label: "8", kind: "num" },
	{ label: "9", kind: "num" },
	{ label: "×", kind: "op" },
	{ label: "4", kind: "num" },
	{ label: "5", kind: "num" },
	{ label: "6", kind: "num" },
	{ label: "−", kind: "op" },
	{ label: "1", kind: "num" },
	{ label: "2", kind: "num" },
	{ label: "3", kind: "num" },
	{ label: "+", kind: "op" },
	{ label: "0", kind: "num" },
	{ label: ".", kind: "num" },
	{ label: "⌫", kind: "fn" },
	{ label: "=", kind: "eq" }
];

export function CalculatorPanel() {
	const [display, setDisplay] = useState("0");
	const [acc, setAcc] = useState<number | null>(null);
	const [op, setOp] = useState<Op | null>(null);
	const [fresh, setFresh] = useState(true);

	const current = () => (display === "Error" ? 0 : parseFloat(display));

	const press = (label: string) => {
		if (/^[0-9]$/.test(label)) {
			if (fresh || display === "Error") {
				setDisplay(label);
				setFresh(false);
			} else if (display.replace(/[-.]/g, "").length < 12) {
				setDisplay(display === "0" ? label : display + label);
			}
			return;
		}
		switch (label) {
			case ".":
				if (fresh || display === "Error") {
					setDisplay("0.");
					setFresh(false);
				} else if (!display.includes(".")) {
					setDisplay(display + ".");
				}
				return;
			case "C":
				setDisplay("0");
				setAcc(null);
				setOp(null);
				setFresh(true);
				return;
			case "⌫":
				if (fresh || display === "Error") return;
				setDisplay(display.length > 1 && display !== "-0" ? display.slice(0, -1) || "0" : "0");
				return;
			case "±":
				if (display === "Error" || display === "0") return;
				setDisplay(display.startsWith("-") ? display.slice(1) : `-${display}`);
				return;
			case "%":
				setDisplay(format(current() / 100));
				setFresh(true);
				return;
			case "=":
				if (acc !== null && op) {
					setDisplay(format(compute(acc, current(), op)));
					setAcc(null);
					setOp(null);
					setFresh(true);
				}
				return;
			default: {
				const next = label as Op;
				if (acc !== null && op && !fresh) {
					const result = compute(acc, current(), op);
					setAcc(Number.isFinite(result) ? result : null);
					setDisplay(format(result));
				} else {
					setAcc(current());
				}
				setOp(next);
				setFresh(true);
			}
		}
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		e.stopPropagation();
		const map: Record<string, string> = {
			"*": "×",
			"/": "÷",
			"-": "−",
			"+": "+",
			Enter: "=",
			"=": "=",
			Backspace: "⌫",
			Escape: "C",
			".": ".",
			"%": "%"
		};
		const label = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
		if (label) {
			e.preventDefault();
			press(label);
		}
	};

	return (
		<div className="calc" tabIndex={0} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}>
			<div className="calc-display">
				<span className="calc-pending">{acc !== null && op ? `${format(acc)} ${op}` : "\u00A0"}</span>
				<span className="calc-value">{display}</span>
			</div>
			<div className="calc-grid">
				{KEYS.map((k) => (
					<button
						key={k.label}
						type="button"
						className={`calc-key ${k.kind}`}
						onClick={() => press(k.label)}
					>
						{k.label}
					</button>
				))}
			</div>
		</div>
	);
}
