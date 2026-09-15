import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bridgeDir = path.join(rootDir, "Main", "mt5-bridge");
const serverPath = path.join(bridgeDir, "server.py");
const requirementsPath = path.join(bridgeDir, "requirements.txt");
const venvDir = path.join(bridgeDir, ".venv");
const bridgeHost = "127.0.0.1";
const configuredPort = Number.parseInt(process.env.FYODOR_BRIDGE_PORT ?? "8001", 10);
const bridgePort = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535 ? configuredPort : 8001;
const bridgeHealthUrl = `http://${bridgeHost}:${bridgePort}/health`;
const bridgeLivenessUrl = `http://${bridgeHost}:${bridgePort}/health/live`;
const logRoot = process.env.FYODOR_BRIDGE_LOG_DIR?.trim() || (process.env.LOCALAPPDATA?.trim()
  ? path.join(process.env.LOCALAPPDATA, "Fyodor Trading Terminal", "logs")
  : path.join(os.tmpdir(), "Fyodor Trading Terminal", "logs"));
const outputLogPath = path.join(logRoot, "bridge-output.log");
const lifecycleLogPath = path.join(logRoot, "bridge-lifecycle.jsonl");
const startupGraceMs = 20_000;
const monitorIntervalMs = 2_000;
const probeTimeoutMs = 2_500;
const unhealthyThreshold = 6;
const stableRunResetMs = 60_000;
const forceStopGraceMs = 8_000;
const outputLogMaxBytes = 10 * 1024 * 1024;
const lifecycleLogMaxBytes = 2 * 1024 * 1024;
const venvPython = path.join(
  venvDir,
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

let managedChild = null;
let shuttingDown = false;
let restartCount = 0;
let generation = 0;
let restartTimer = null;
let existingMonitor = null;
let managedMonitor = null;
let managedHealthProbeRunning = false;
let existingHealthProbeRunning = false;
let managedStartedAt = 0;
let consecutiveMissingHealth = 0;
let restartFailureStreak = 0;
let expectedApiRevisionValue = null;

function expectedApiRevision() {
  if (expectedApiRevisionValue) return expectedApiRevisionValue;
  const source = fs.readFileSync(serverPath, "utf8");
  const match = source.match(/^BRIDGE_API_REVISION\s*=\s*["']([^"']+)["']/m);
  if (!match) throw new Error(`BRIDGE_API_REVISION not found in ${serverPath}`);
  expectedApiRevisionValue = match[1];
  return expectedApiRevisionValue;
}

function reportLogFailure(logPath, error) {
  try {
    process.stderr.write(`Fyodor bridge could not write ${logPath}: ${String(error)}\n`);
  } catch {
    // Logging must never become a process-lifecycle failure.
  }
}

function rotateLogIfNeeded(logPath, maxBytes) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size < maxBytes) return;
    const previousPath = `${logPath}.1`;
    fs.copyFileSync(logPath, previousPath);
    fs.truncateSync(logPath, 0);
  } catch (error) {
    reportLogFailure(logPath, error);
  }
}

function safeAppend(logPath, value, maxBytes) {
  try {
    fs.mkdirSync(logRoot, { recursive: true });
    rotateLogIfNeeded(logPath, maxBytes);
    fs.appendFileSync(logPath, value);
  } catch (error) {
    reportLogFailure(logPath, error);
  }
}

function appendLifecycle(event, detail = {}) {
  safeAppend(lifecycleLogPath, `${JSON.stringify({
    time: new Date().toISOString(), event, launcherPid: process.pid, ...detail,
  })}\n`, lifecycleLogMaxBytes);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function probeBridgeHealth(url = bridgeLivenessUrl, timeoutMs = probeTimeoutMs) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (status) => {
      if (resolved) return;
      resolved = true;
      resolve(status);
    };
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          const payload = JSON.parse(body);
          if (response.statusCode !== 200 || payload?.ok !== true) finish("unavailable");
          else finish(payload?.api_revision === expectedApiRevision() ? "compatible" : "stale");
        } catch {
          finish("unavailable");
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("liveness timeout")));
    request.on("error", () => finish("unavailable"));
  });
}

function isBridgePortInUse(timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: bridgeHost, port: bridgePort });
    const finish = (inUse) => { socket.destroy(); resolve(inUse); };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function findRunningBridge() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Readiness is used only to identify an already-running bridge and its
    // revision. The managed watchdog below uses the zero-dependency endpoint.
    const status = await probeBridgeHealth(bridgeHealthUrl, 1500);
    if (status !== "unavailable") return status;
    if (attempt < 2) await wait(500);
  }
  return "unavailable";
}

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, ...options });
  if (result.error) throw result.error;
  if ((result.status ?? 0) !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
}

function ensureBridgeFiles() {
  for (const requiredPath of [bridgeDir, serverPath, requirementsPath]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`Bridge path not found: ${requiredPath}`);
  }
}

function ensureVenv() {
  if (fs.existsSync(venvPython)) return;
  console.log("Bridge venv not found. Bootstrapping Main/mt5-bridge/.venv ...");
  const candidates = process.platform === "win32"
    ? [{ command: "py", args: ["-3", "-m", "venv", ".venv"] }, { command: "python", args: ["-m", "venv", ".venv"] }]
    : [{ command: "python3", args: ["-m", "venv", ".venv"] }];
  const created = candidates.some((candidate) => {
    const result = spawnSync(candidate.command, candidate.args, { cwd: bridgeDir, stdio: "inherit", shell: false });
    return !result.error && result.status === 0;
  });
  if (!created || !fs.existsSync(venvPython)) throw new Error("Failed to create bridge virtual environment.");
  runOrThrow(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], { cwd: bridgeDir });
}

function teeChildOutput(stream, destination) {
  stream.on("data", (chunk) => {
    try { destination.write(chunk); } catch { /* parent console may already be closing */ }
    safeAppend(outputLogPath, chunk, outputLogMaxBytes);
  });
  stream.on("error", (error) => appendLifecycle("bridge_output_stream_error", { message: String(error) }));
}

async function restartWhenPortIsFree() {
  if (shuttingDown || managedChild) return;
  if (await isBridgePortInUse()) {
    const status = await probeBridgeHealth(bridgeHealthUrl, 1000);
    if (status === "compatible") {
      restartTimer = null;
      superviseExistingBridge();
      return;
    }
    restartTimer = setTimeout(() => {
      restartTimer = null;
      restartWhenPortIsFree().catch((error) => scheduleRestart(String(error)));
    }, 1000);
    return;
  }
  startManagedBridge(true);
}

function scheduleRestart(reason) {
  if (shuttingDown || restartTimer) return;
  restartCount += 1;
  restartFailureStreak += 1;
  const delayMs = Math.min(30_000, 500 * (2 ** Math.min(restartFailureStreak - 1, 6)));
  appendLifecycle("restart_scheduled", { reason, restartCount, restartFailureStreak, delayMs });
  console.error(`Fyodor bridge stopped (${reason}). Restarting in ${delayMs}ms; details: ${lifecycleLogPath}`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartWhenPortIsFree().catch((error) => scheduleRestart(String(error)));
  }, delayMs);
}

function startManagedBridge(isRestart = false) {
  generation += 1;
  const childGeneration = generation;
  consecutiveMissingHealth = 0;
  managedStartedAt = Date.now();
  try { fs.mkdirSync(logRoot, { recursive: true }); } catch (error) { reportLogFailure(logRoot, error); }
  const args = ["-m", "uvicorn", "server:app", "--host", bridgeHost, "--port", String(bridgePort), "--no-access-log"];
  if (process.env.FYODOR_BRIDGE_RELOAD === "1") args.splice(3, 0, "--reload");
  appendLifecycle("bridge_spawn", { generation: childGeneration, restartCount, isRestart, args });
  managedChild = spawn(venvPython, args, {
    cwd: bridgeDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: {
      ...process.env,
      FYODOR_BRIDGE_GENERATION: String(childGeneration),
      FYODOR_BRIDGE_RESTART_COUNT: String(restartCount),
      FYODOR_BRIDGE_LAUNCHER_PID: String(process.pid),
      FYODOR_BRIDGE_LIFECYCLE_LOG: lifecycleLogPath,
    },
  });
  teeChildOutput(managedChild.stdout, process.stdout);
  teeChildOutput(managedChild.stderr, process.stderr);
  if (managedMonitor) clearInterval(managedMonitor);
  managedMonitor = setInterval(async () => {
    if (shuttingDown || !managedChild || managedHealthProbeRunning) return;
    if (Date.now() - managedStartedAt < startupGraceMs) return;
    managedHealthProbeRunning = true;
    try {
      const status = await probeBridgeHealth(bridgeLivenessUrl, probeTimeoutMs);
      if (status === "compatible") {
        consecutiveMissingHealth = 0;
        if (Date.now() - managedStartedAt >= stableRunResetMs) restartFailureStreak = 0;
        return;
      }
      consecutiveMissingHealth += 1;
      if (consecutiveMissingHealth < unhealthyThreshold) return;
      const unresponsiveChild = managedChild;
      appendLifecycle("bridge_unresponsive", {
        generation: childGeneration,
        status,
        consecutiveMissingHealth,
        childPid: unresponsiveChild.pid,
        livenessUrl: bridgeLivenessUrl,
      });
      clearInterval(managedMonitor);
      managedMonitor = null;
      unresponsiveChild.kill("SIGTERM");
      setTimeout(() => {
        if (managedChild === unresponsiveChild) {
          appendLifecycle("bridge_force_stop", { generation: childGeneration, childPid: unresponsiveChild.pid });
          unresponsiveChild.kill("SIGKILL");
        }
      }, forceStopGraceMs);
    } finally {
      managedHealthProbeRunning = false;
    }
  }, monitorIntervalMs);
  managedChild.once("error", (error) => appendLifecycle("bridge_spawn_error", { generation: childGeneration, message: String(error) }));
  managedChild.once("exit", (code, signal) => {
    const stoppedGeneration = childGeneration;
    managedChild = null;
    if (managedMonitor) clearInterval(managedMonitor);
    managedMonitor = null;
    appendLifecycle("bridge_exit", { generation: stoppedGeneration, code, signal });
    if (!shuttingDown) scheduleRestart(`exit code=${code ?? "null"} signal=${signal ?? "none"}`);
  });
}

function superviseExistingBridge() {
  if (existingMonitor) clearInterval(existingMonitor);
  console.log(`Fyodor bridge is already running at ${bridgeHealthUrl}. Monitoring it.`);
  appendLifecycle("existing_bridge_reused", { apiRevision: expectedApiRevision() });
  existingMonitor = setInterval(async () => {
    if (shuttingDown || managedChild || existingHealthProbeRunning) return;
    existingHealthProbeRunning = true;
    try {
      const status = await probeBridgeHealth(bridgeLivenessUrl, probeTimeoutMs);
      if (status === "compatible") { consecutiveMissingHealth = 0; return; }
      if (status === "stale") {
        appendLifecycle("existing_bridge_became_stale", { expectedApiRevision: expectedApiRevision() });
        return;
      }
      consecutiveMissingHealth += 1;
      if (consecutiveMissingHealth < unhealthyThreshold || await isBridgePortInUse()) return;
      clearInterval(existingMonitor);
      existingMonitor = null;
      appendLifecycle("existing_bridge_missing", { consecutiveMissingHealth });
      scheduleRestart("reused bridge stopped listening");
    } finally {
      existingHealthProbeRunning = false;
    }
  }, monitorIntervalMs);
}

function stop(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (existingMonitor) clearInterval(existingMonitor);
  if (managedMonitor) clearInterval(managedMonitor);
  if (restartTimer) clearTimeout(restartTimer);
  appendLifecycle("launcher_stop", { signal, managedPid: managedChild?.pid ?? null });
  if (managedChild && !managedChild.killed) { managedChild.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM"); return; }
  process.exit(0);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

async function main() {
  ensureBridgeFiles();
  const runningBridge = await findRunningBridge();
  if (runningBridge === "compatible") { superviseExistingBridge(); return; }
  if (runningBridge === "stale") {
    throw new Error(`An outdated Fyodor bridge is already running on port ${bridgePort}. Stop it before starting API revision ${expectedApiRevision()}.`);
  }
  if (await isBridgePortInUse()) throw new Error(`Port ${bridgePort} is occupied but ${bridgeHealthUrl} is not a healthy Fyodor bridge.`);
  ensureVenv();
  startManagedBridge(false);
}

main().catch((error) => {
  appendLifecycle("launcher_error", { message: error instanceof Error ? error.message : String(error) });
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
