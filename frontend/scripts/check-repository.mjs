import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { reachableFiles, sourceGraph } from './lib/source-graph.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(root, 'frontend/src')
const relative = filename => path.relative(root, filename).replaceAll('\\', '/')
const graph = sourceGraph(source)
const problems = graph.unresolved.map(({ filename, specifier }) => `${relative(filename)}: unresolved dependency ${specifier}`)
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(filename => filename && fs.existsSync(path.join(root, filename)))
const documents = files.filter(filename => /\.md$/i.test(filename) && !filename.startsWith('reports/'))
let links = 0
for (const filename of documents) {
  const markdown = fs.readFileSync(path.join(root, filename), 'utf8').replace(/```[\s\S]*?```/g, '')
  for (const match of markdown.matchAll(/\[[^\]\n]*\]\((<[^>]+>|[^)]+)\)/g)) {
    let target = match[1].replace(/^<|>$/g, '').trim()
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(target)) continue
    target = decodeURIComponent(target.split('#')[0])
    if (!target) continue
    links++
    if (!fs.existsSync(path.resolve(root, path.dirname(filename), target))) problems.push(`${filename}: missing link ${target}`)
  }
}
// Retained test/public exports; their implementation is in economic-calendar/.
const compatibilityEntries = ['inspector/calendar-display-range.ts', 'inspector/event-symbols.ts',
  'inspector/storage/calendar-admission-time.ts', 'inspector/storage/calendar-snapshot-identity.ts', 'inspector/useStoredCalendar.ts']
const entries = [path.join(source, 'bootstrap/mount-fyodor-terminal.tsx'),
  ...compatibilityEntries.map(filename => path.join(source, filename))]
problems.push(...entries.filter(filename => !graph.dependencies.has(filename)).map(filename => `${relative(filename)}: missing entry point`))
const reached = reachableFiles(graph, entries)
const detached = graph.files.filter(filename => !reached.has(filename) && !filename.endsWith('.d.ts'))
console.log(`Checked ${graph.files.length} source modules and ${links} local links in ${documents.length} current documents.`)
problems.push(...detached.map(filename => `${relative(filename)}: unreachable from bootstrap or retained public entries`))
if (problems.length) {
  console.error(problems.join('\n'))
  process.exitCode = 1
} else console.log('Repository navigation checks passed. Historical reports are excluded from link enforcement.')
