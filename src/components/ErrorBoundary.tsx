import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	failed: boolean;
}

/**
 * Keeps one render error from blanking a whole Bloom window. After a failure it
 * shows nothing, then remounts the tree once so transient glitches recover.
 */
export class ErrorBoundary extends Component<Props, State> {
	state: State = { failed: false };
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private retries = 0;

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Bloom UI error:", error, info.componentStack);
		if (this.retries < 3) {
			this.retries += 1;
			this.retryTimer = setTimeout(() => this.setState({ failed: false }), 1000);
		}
	}

	componentWillUnmount() {
		if (this.retryTimer) clearTimeout(this.retryTimer);
	}

	render() {
		return this.state.failed ? null : this.props.children;
	}
}
