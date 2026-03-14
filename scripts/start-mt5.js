import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const DEFAULT_MT5_PATH = "C:\\Program Files\\MetaTrader 5\\terminal64.exe";
const mt5Path = process.env.MT5_EXE?.trim() || DEFAULT_MT5_PATH;

function isMt5Running() {
  if (process.platform !== "win32") {
    return false;
  }

  const result = spawnSync("tasklist", ["/FI", "IMAGENAME eq terminal64.exe"], {
    encoding: "utf8",
    shell: false,
  });

  return result.status === 0 && typeof result.stdout === "string" && result.stdout.includes("terminal64.exe");
}

if (!fs.existsSync(mt5Path)) {
  console.error(`MetaTrader 5 executable not found: ${mt5Path}`);
  process.exit(1);
}

if (isMt5Running()) {
  console.log("MetaTrader 5 is already running.");
  process.exit(0);
}

const child = spawn(mt5Path, [], {
  detached: true,
  stdio: "ignore",
  shell: false,
});

child.unref();

console.log(`Launched MetaTrader 5: ${mt5Path}`);
