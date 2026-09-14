import ReactDOM from "react-dom/client";
import App from "./app/App";
import { recordAppActivity } from "./app/features/chart-shell/appActivityLog";
import { preloadMacroSignalGlobalStartupRegistry } from "./app/lib/bridge";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

window.addEventListener("error", (event) => {
  const filename = event.filename ? event.filename.split("/").slice(-1)[0] ?? event.filename : null;
  recordAppActivity({
    level: "error",
    source: "Application error",
    message: event.message || "Unhandled browser error",
    detail: filename ? `${filename}:${event.lineno}:${event.colno}` : null,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  recordAppActivity({
    level: "error",
    source: "Unhandled task",
    message: reason instanceof Error ? reason.message : "Promise rejected without a handler",
    detail: reason instanceof Error ? reason.stack?.slice(0, 400) ?? null : String(reason).slice(0, 400),
  });
});

if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.duration < 250) return;
      recordAppActivity({
        level: "warning",
        source: "Performance",
        message: "Main thread was blocked",
        detail: `${Math.round(entry.duration)} ms`,
      });
    });
  });
  observer.observe({ type: "longtask", buffered: true });
}

ReactDOM.createRoot(root).render(
  <App />,
);

// Never hold the application shell behind bridge I/O. The cached bounded
// projection is hydrated synchronously; a missing/stale projection refreshes
// while the Charts workspace is loading and the authoritative registry follows.
void preloadMacroSignalGlobalStartupRegistry().catch(() => undefined);
