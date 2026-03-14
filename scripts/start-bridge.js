import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bridgeDir = path.join(rootDir, "Main", "mt5-bridge");
const requirementsPath = path.join(bridgeDir, "requirements.txt");
const venvDir = path.join(bridgeDir, ".venv");
const venvPython = path.join(
  venvDir,
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function ensureBridgeFiles() {
  if (!fs.existsSync(bridgeDir)) {
    throw new Error(`Bridge directory not found: ${bridgeDir}`);
  }
  if (!fs.existsSync(requirementsPath)) {
    throw new Error(`requirements.txt not found: ${requirementsPath}`);
  }
}

function ensureVenv() {
  if (fs.existsSync(venvPython)) {
    return;
  }

  console.log("Bridge venv not found. Bootstrapping Main/mt5-bridge/.venv ...");

  const candidates = process.platform === "win32"
    ? [
        { command: "py", args: ["-3", "-m", "venv", ".venv"] },
        { command: "python", args: ["-m", "venv", ".venv"] },
      ]
    : [{ command: "python3", args: ["-m", "venv", ".venv"] }];

  let created = false;
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      cwd: bridgeDir,
      stdio: "inherit",
      shell: false,
    });

    if (!result.error && result.status === 0) {
      created = true;
      break;
    }
  }

  if (!created || !fs.existsSync(venvPython)) {
    throw new Error("Failed to create bridge virtual environment.");
  }

  runOrThrow(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], {
    cwd: bridgeDir,
  });
}

function startBridge() {
  const child = spawn(
    venvPython,
    ["-m", "uvicorn", "server:app", "--reload", "--host", "127.0.0.1", "--port", "8001"],
    {
      cwd: bridgeDir,
      stdio: "inherit",
      shell: false,
    },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

try {
  ensureBridgeFiles();
  ensureVenv();
  startBridge();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
