import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { preloadMacroSignalGlobalRegistry, preloadMacroSignalGlobalStartupRegistry } from "./app/lib/bridge";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

const render = () => {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  void preloadMacroSignalGlobalRegistry().catch(() => undefined);
};

// A bounded all-market projection is enough for the first Trade-dock paint.
// The complete authoritative registry refreshes as soon as React is mounted.
void preloadMacroSignalGlobalStartupRegistry().catch(() => undefined).finally(render);
