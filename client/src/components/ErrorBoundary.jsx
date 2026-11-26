import { Component } from "react";
import { reportError } from "../utils/reportError";

// If any page crashes, show a calm message instead of a blank white screen
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
    reportError(error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sorry, this page hit a problem. Your test answers are saved on this device. Reloading usually fixes it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className="rounded-lg bg-[#17140f] px-5 py-2.5 text-sm font-semibold text-[#e5c372] hover:bg-black">
              Reload page
            </button>
            <a href="/" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}