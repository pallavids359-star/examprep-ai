// Sends app crashes to the server, so they show on the admin "App errors" page.
// At most 10 reports per page load, and never the same message twice.
let sent = 0;
const seen = new Set();

export function reportError(error, extra = "") {
  try {
    const message = String(error?.message || error || "Unknown error").slice(0, 500);
    if (sent >= 10 || seen.has(message)) return;
    if (/ResizeObserver loop|Script error\.?$|Load failed|chrome-extension/i.test(message)) return; // harmless browser noise
    seen.add(message);
    sent += 1;
    const body = JSON.stringify({
      message,
      stack: String(error?.stack || "").slice(0, 3000) + (extra ? `\n${String(extra).slice(0, 1000)}` : ""),
      page: location.pathname,
    });
    fetch("/api/app-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* never break the app while reporting */
  }
}

export function watchErrors() {
  window.addEventListener("error", (e) => reportError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    if (r?.isAxiosError) return; // server answers are shown to the user already
    reportError(r);
  });
}
