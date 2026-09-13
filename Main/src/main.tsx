import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { preloadMacroSignalGlobalRegistry } from "./app/lib/bridge";
import "./styles.css";

// Hydrate the last known all-market registry synchronously, then refresh it while React mounts.
void preloadMacroSignalGlobalRegistry().catch(() => undefined);

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
