import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const ports = [5173, 8001, 8002]
const root = fileURLToPath(new URL('../..', import.meta.url))
const run = (file, args) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const normalize = value => (value ?? '').replaceAll('\\', '/').toLowerCase()
const rootPath = normalize(root).replace(/\/$/, '')
const windows = process.platform === 'win32'

export function parseDesktopListeners(output) {
  return output.split(/\r?\n/).flatMap(line => {
    const [protocol, address, , state, pid] = line.trim().split(/\s+/)
    const port = Number(address?.split(':').at(-1))
    return protocol === 'TCP' && state === 'LISTENING' && ports.includes(port) ? [{ port, pid: Number(pid) }] : []
  })
}

function listeners() {
  if (windows) return parseDesktopListeners(run('netstat.exe', ['-ano']))
  try {
    return run('lsof', ['-nP', '-a', ...ports.flatMap(port => ['-i', `TCP:${port}`]), '-sTCP:LISTEN', '-Fpn'])
      .trim().split(/\np/).flatMap(record => {
        const [owner, ...addresses] = record.replace(/^p/, '').split('\n')
        return addresses.map(address => ({ pid: Number(owner), port: Number(address.split(':').at(-1)) }))
      }).filter(record => ports.includes(record.port))
  } catch (error) {
    if (error.status === 1 && !error.stderr) return []
    throw error
  }
}

function verifyOwners(owners) {
  if (!windows) {
    for (const { pid, port } of owners) {
      if (!normalize(run('ps', ['-p', String(pid), '-o', 'command='])).includes(rootPath + '/')) {
        throw new Error(`Port ${port} belongs to a process outside this checkout (PID ${pid}).`)
      }
    }
    return
  }
  const rows = JSON.parse(run('powershell.exe', ['-NoProfile', '-Command',
    'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine)']))
  const processes = new Map(rows.map(row => [row.ProcessId, row]))
  const ancestors = pid => {
    const tree = []
    let worker = processes.get(pid)
    while (worker) {
      tree.push(worker)
      const parent = processes.get(worker.ParentProcessId)
      if (!parent || parent.CreationDate > worker.CreationDate || tree.includes(parent)) break
      worker = parent
    }
    return tree
  }
  const vite = owners.find(({ port, pid }) => port === 5173
    && /\/vite\/bin\/vite\.js\b/.test(normalize(processes.get(pid)?.CommandLine))
    && normalize(processes.get(pid)?.CommandLine).includes(rootPath + '/frontend/'))
  const legacyStack = new Set(vite ? ancestors(vite.pid).filter(worker =>
    /concurrently.*dev:bridge.*dev:storage.*dev:ready/.test(normalize(worker.CommandLine))).map(worker => worker.ProcessId) : [])
  for (const { port, pid } of owners) {
    const command = normalize(processes.get(pid)?.CommandLine)
    const script = port === 8001 ? 'bridge/run_dev.py' : 'storage/run.py'
    const suffix = port === 8002 ? ' serve' : ''
    const current = port === 5173 ? pid === vite?.pid
      : command.includes(`${rootPath}/${script}`) && (!suffix || command.endsWith(suffix))
    const legacy = port !== 5173 && command.endsWith(`${script}${suffix}`)
      && ancestors(pid).some(worker => legacyStack.has(worker.ProcessId))
    if (!current && !legacy) throw new Error(`Port ${port} has an unverified listener (PID ${pid}). No desktop listener was stopped.`)
  }
}

async function main() {
  const owners = listeners()
  if (owners.length) {
    verifyOwners(owners)
    for (const pid of new Set(owners.map(owner => owner.pid))) {
      try {
        if (windows) run('taskkill.exe', ['/PID', String(pid), '/T', '/F'])
        else process.kill(pid, 'SIGTERM')
      } catch (error) {
        if (listeners().some(owner => owner.pid === pid)) throw error
      }
    }
    const deadline = Date.now() + 5_000
    let pending = listeners()
    while (pending.length && Date.now() < deadline) { await delay(150); pending = listeners() }
    if (pending.length) throw new Error(`Ports still busy: ${pending.map(owner => owner.port).join(', ')}.`)
    console.log('[clean-ports] Previous desktop listeners stopped.')
  } else console.log('[clean-ports] Desktop ports are clear.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) {
    console.error(`[clean-ports] ${error.message}`)
    process.exitCode = 1
  }
}
