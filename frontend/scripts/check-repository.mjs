import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { reachableFiles, sourceGraph } from './lib/source-graph.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(root, 'frontend/src'), graph = sourceGraph(source)
const relative = file => path.relative(root, file).replaceAll('\\', '/')
const problems = graph.unresolved.map(({ filename, specifier }) => `${relative(filename)}: unresolved dependency ${specifier}`)
const compatibility = ['inspector/calendar-display-range.ts', 'inspector/event-symbols.ts',
  'inspector/storage/calendar-admission-time.ts', 'inspector/storage/calendar-snapshot-identity.ts', 'inspector/useStoredCalendar.ts']
const entries = ['bootstrap/mount-fyodor-terminal.tsx', ...compatibility].map(file => path.join(source, file))
const reached = reachableFiles(graph, entries)
for (const file of graph.files) {
  if (!reached.has(file) && !file.endsWith('.d.ts')) problems.push(`${relative(file)}: unreachable source module`)
  if (/[/\\](scoring-system|usd-context|pair-context|raycaster|fundamental-tools|scatter-plot|trader-notebook|workspace-portability)[/\\]/.test(file))
    problems.push(`${relative(file)}: retired feature in Lite`)
  if (/new\s+Worker\s*\(/.test(fs.readFileSync(file, 'utf8'))) problems.push(`${relative(file)}: calculation worker in Lite`)
}
// The inherited bridge is byte-for-byte unchanged, including its old README.
// Validate maintained Lite documents.
let links = 0
for (const file of ['README.md', 'AGENTS.md', 'docs/DATA-CONTRACT.md', 'user manual.md']) {
  const filename = path.join(root, file)
  if (!fs.existsSync(filename)) { problems.push(`${file}: missing canonical document`); continue }
  const markdown = fs.readFileSync(filename, 'utf8').replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, '')
  for (const match of markdown.matchAll(/\[[^\]\n]*\]\((<[^>]+>|[^)]+)\)/g)) {
    let target = match[1].replace(/^<|>$/g, '').trim()
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(target)) continue
    target = decodeURIComponent(target.split('#')[0]); if (!target) continue
    links++
    if (!fs.existsSync(path.resolve(path.dirname(filename), target))) problems.push(`${file}: missing link ${target}`)
  }
}
if (!fs.existsSync(path.join(root, 'docs/tools/icon-catalogue.html'))) problems.push('Missing retained icon catalogue')
console.log(`Checked ${graph.files.length} Lite source modules and ${links} documentation links.`)
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1 }
else console.log('Lite ownership, retirement and navigation checks passed.')
