import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

const root = new URL('..', import.meta.url)
const stamp = new URL('dist-news/.build-fingerprint', root)
const hash = createHash('sha256')
async function include(relative, directory = false) {
  hash.update(relative).update('\0')
  if (!directory) {
    hash.update(await readFile(new URL(relative, root))).update('\0')
    return
  }
  const entries = await readdir(new URL(`${relative}/`, root), { withFileTypes: true })
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() || entry.isFile()) await include(`${relative}/${entry.name}`, entry.isDirectory())
  }
}
async function hasAssets() {
  try {
    const html = await readFile(new URL('dist-news/news.html', root), 'utf8')
    const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map(match => match[1])
    if (!assets.length) return false
    await Promise.all(assets.map(asset => readFile(new URL(`dist-news/${asset}`, root))))
    return true
  } catch { return false }
}

hash.update(process.version)
for (const file of ['news.html', 'vite.news.config.ts', 'package.json', 'pnpm-lock.yaml']) await include(file)
for (const directory of ['src', 'public', '../config']) {
  try { await include(directory, true) } catch (error) { if (error.code !== 'ENOENT' || directory !== 'public') throw error }
}
const fingerprint = hash.digest('hex')
const last = await readFile(stamp, 'utf8').catch(() => '')
if (last === fingerprint && await hasAssets()) {
  console.log('[startup] Phone frontend assets are current.')
} else {
  const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.news.config.ts'], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0 || !(await hasAssets())) process.exit(result.status || 1)
  await writeFile(stamp, fingerprint)
}
