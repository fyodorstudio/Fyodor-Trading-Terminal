import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import concurrently from 'concurrently'
import { waitForServices } from './wait-for-services.mjs'

const frontend = fileURLToPath(new URL('..', import.meta.url))
const root = path.resolve(frontend, '..')
const elapsed = performance.now()
const log = message => console.log(`[startup +${((performance.now() - elapsed) / 1000).toFixed(1)}s] ${message}`)
const quote = value => `"${value}"`
const node = quote(process.execPath)
const python = quote(path.join(root, 'bridge', '.venv', 'Scripts', 'python.exe'))
const cleanup = spawnSync(process.execPath, [path.join(frontend, 'scripts', 'clean-ports.mjs')], { cwd: frontend, stdio: 'inherit' })
if (cleanup.status !== 0) {
  console.error('[startup] Desktop ports could not be cleared.')
  process.exit(cleanup.status ?? 1)
}

log('Desktop ports clear. Starting desktop, alarms, and phone services.')
const { commands, result } = concurrently([
  { name: 'BRIDGE', cwd: root, command: `${python} ${quote(path.join(root, 'bridge', 'run_dev.py'))}` },
  { name: 'STORAGE', cwd: root, command: `${python} ${quote(path.join(root, 'storage', 'run.py'))} serve` },
  { name: 'UI', cwd: frontend, command: `${node} scripts/wait-for-services.mjs && ${node} ${quote(path.join(frontend, 'node_modules/vite/bin/vite.js'))} --port 5173 --strictPort` },
], { killOthersOn: ['success', 'failure'], prefixColors: ['green', 'yellow', 'cyan'] })

const launchers = new Set()
const runPhase = (label, executable, args, cwd = root) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { cwd, stdio: 'inherit', windowsHide: true })
  launchers.add(child)
  child.once('error', reject)
  // Detached workers may inherit output handles. The launcher exit verifies
  // its status without waiting for descendants to close those handles.
  child.once('exit', (code, signal) => {
    launchers.delete(child)
    if (code === 0) resolve()
    else reject(new Error(`${label} failed (${code ?? signal}).`))
  })
})
const restart = (label, script) => runPhase(label, 'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', script), '-Restart'])
const ready = Promise.all([
  waitForServices(['http://localhost:5173/'], { log: () => {} }).then(() => log('Desktop ready at http://localhost:5173')),
  restart('Alarm worker', 'start-alarms.ps1'),
  runPhase('Phone build', process.execPath, ['scripts/build-news-if-needed.mjs'], frontend)
    .then(() => restart('Phone services', 'start-news-phone.ps1')),
]).then(() => {
  log('All six services ready.')
}).catch(error => {
  console.error(error.message)
  process.exitCode = 1
  for (const command of commands) if (command.state === 'started') command.kill()
})
try { await result } catch { process.exitCode = 1 }
for (const child of launchers) child.kill()
// Do not let a readiness retry hold the old invocation open after the core exits.
void ready
process.exit(process.exitCode ?? 0)
