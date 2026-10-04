import { execFileSync } from 'node:child_process';

const PORTS = [5173, 8001, 8002];

async function main() {
  const isWindows = process.platform === 'win32';
  const killedPids = new Set();

  if (isWindows) {
    try {
      const psScript = `Get-NetTCPConnection -State Listen -LocalPort ${PORTS.join(', ')} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`;
      const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (output) {
        const pids = output.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        for (const pid of pids) {
          if (pid === '0' || pid === `${process.pid}`) continue;
          try {
            execFileSync('taskkill.exe', ['/PID', pid, '/T', '/F'], {
              stdio: 'ignore',
            });
            killedPids.add(pid);
          } catch {
            // Process may have already terminated
          }
        }
      }
    } catch {
      // No active listeners found or query completed without results
    }
  } else {
    for (const port of PORTS) {
      try {
        const output = execFileSync('lsof', ['-t', `-i:${port}`], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        if (output) {
          const pids = output.split(/\s+/).filter(Boolean);
          for (const pid of pids) {
            if (pid === `${process.pid}`) continue;
            try {
              execFileSync('kill', ['-9', pid], { stdio: 'ignore' });
              killedPids.add(pid);
            } catch {
              // Process already terminated
            }
          }
        }
      } catch {
        // Port free or lsof returned non-zero
      }
    }
  }

  if (killedPids.size > 0) {
    console.log(`[clean-ports] Terminated stale process(es) holding ports: ${Array.from(killedPids).join(', ')}`);
    // Brief settle period allowing operating system network stack to release socket handles
    await new Promise((resolve) => setTimeout(resolve, 400));
  } else {
    console.log('[clean-ports] Target ports (5173, 8001, 8002) are clear.');
  }
}

await main();
