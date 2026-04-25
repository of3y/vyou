import { Component, type ErrorInfo, type ReactNode } from "react";

// Top-level boundary so a render-time exception lands as a visible message
// instead of a black void. Critical for diagnosing iOS / PWA / installed-
// home-screen quirks where there is no easy console access.

type Props = { children: ReactNode };
type State = {
  error: Error | null;
  info: ErrorInfo | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    const stack = (this.state.info?.componentStack ?? e.stack ?? "").slice(0, 4000);
    return (
      <div className="flex min-h-dvh flex-col gap-4 overflow-y-auto bg-black p-6 text-white">
        <h1 className="text-lg font-semibold text-red-300">Something broke</h1>
        <p className="text-sm text-white/80">
          <strong>{e.name}:</strong> {e.message}
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/5 p-3 text-[11px] leading-snug text-white/60">
          {stack}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="rounded-full bg-white/10 px-4 py-2 text-xs"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-full bg-white/10 px-4 py-2 text-xs"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
