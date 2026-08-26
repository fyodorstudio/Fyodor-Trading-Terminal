import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bridgeDir = path.join(rootDir, "Main", "mt5-bridge");
const requirementsPath = path.join(bridgeDir, "requirements.txt");
const venvDir = path.join(bridgeDir, ".venv");
const bridgeHost = "127.0.0.1";
const bridgePort = 8001;
const bridgeHealthUrl = `http://${bridgeHost}:${bridgePort}/health`;
const expectedApiRevision = "2026-08-26-fms-workbench-v1";
const venvPython = path.join(
  venvDir,
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function probeBridgeHealth(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const request = http.get(bridgeHealthUrl, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          const payload = JSON.parse(body);
          if (response.statusCode !== 200 || payload?.ok !== true || payload?.bridge_connected !== true) {
            resolve("unavailable");
          } else {
            resolve(payload?.api_revision === expectedApiRevision ? "compatible" : "stale");
          }
        } catch {
          resolve("unavailable");
        }
      });
    });

    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve("unavailable"));
  });
}

function isBridgePortInUse(timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: bridgeHost, port: bridgePort });
    const finish = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function findRunningBridge() {
  // A reloader may briefly own the port before the FastAPI app is ready.
  // Retry before deciding that another application owns the bridge port.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const status = await probeBridgeHealth();
    if (status !== "unavailable") {
      return status;
    }
    if (attempt < 2) {
      await wait(500);
    }
  }
  return "unavailable";
}

function superviseExistingBridge() {
  console.log(`Fyodor bridge is already running at ${bridgeHealthUrl}. Reusing it.`);

  // Keep this command alive so concurrently does not interpret successful
  // bridge reuse as a completed child and terminate the frontend.
  const keepAlive = setInterval(() => {}, 60_000);
  const stop = () => {
    clearInterval(keepAlive);
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

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
    ["-m", "uvicorn", "server:app", "--reload", "--host", bridgeHost, "--port", String(bridgePort)],
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

async function main() {
  ensureBridgeFiles();

  const runningBridge = await findRunningBridge();
  if (runningBridge === "compatible") {
    superviseExistingBridge();
    return;
  }

  if (runningBridge === "stale") {
    throw new Error(
      `An outdated Fyodor bridge is already running on port ${bridgePort}. Stop that bridge and run this command again so the current API can start.`,
    );
  }

  if (await isBridgePortInUse()) {
    throw new Error(
      `Port ${bridgePort} is already in use, but ${bridgeHealthUrl} is not a healthy Fyodor bridge. Close the process using that port and try again.`,
    );
  }

  ensureVenv();
  startBridge();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
