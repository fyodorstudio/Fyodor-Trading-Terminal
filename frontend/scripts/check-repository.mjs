import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listFiles, reachableFiles, sourceGraph } from './lib/source-graph.mjs'
import { sourceUsage, unreferencedClasses } from './lib/source-hygiene.mjs'
import { documentNavigation, staleFeatureDescriptions } from './lib/document-navigation.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(root, 'frontend/src'), graph = sourceGraph(source)
const relative = file => path.relative(root, file).replaceAll('\\', '/')
const problems = graph.unresolved.map(({ filename, specifier }) => `${relative(filename)}: unresolved dependency ${specifier}`)
const compatibility = ['inspector/calendar-display-range.ts', 'inspector/event-symbols.ts',
  'inspector/storage/calendar-admission-time.ts', 'inspector/storage/calendar-snapshot-identity.ts', 'inspector/useStoredCalendar.ts']
const entries = ['bootstrap/mount-fyodor-terminal.tsx', ...compatibility].map(file => path.join(source, file))
const reached = reachableFiles(graph, entries)
const usage = sourceUsage(graph.files)
for (const { filename, name } of usage.unused) problems.push(`${relative(filename)}: unreferenced runtime export ${name}`)
for (const filename of listFiles(source).filter(file => file.endsWith('.css'))) {
  if (!reached.has(filename)) problems.push(`${relative(filename)}: unreachable stylesheet`)
  for (const name of unreferencedClasses(fs.readFileSync(filename, 'utf8'), usage)) problems.push(`${relative(filename)}: unreferenced class .${name}`)
}
for (const file of graph.files) {
  if (!reached.has(file) && !file.endsWith('.d.ts')) problems.push(`${relative(file)}: unreachable source module`)
  if (/[/\\](scoring-system|usd-context|pair-context|raycaster|fundamental-tools|scatter-plot|trader-notebook|workspace-portability)[/\\]/.test(file))
    problems.push(`${relative(file)}: retired feature in Lite`)
  if (/new\s+Worker\s*\(/.test(fs.readFileSync(file, 'utf8'))) problems.push(`${relative(file)}: calculation worker in Lite`)
}
// The inherited bridge is byte-for-byte unchanged, including its old README.
// Validate maintained Lite documents.
let links = 0
const documents = ['README.md', 'AGENTS.md', 'user manual.md', ...listFiles(path.join(root, 'docs')).filter(file => file.endsWith('.md')).map(relative),
  ...listFiles(path.join(root, '.agents')).filter(file => file.endsWith('.md')).map(relative)]
for (const file of documents) {
  const filename = path.join(root, file)
  if (!fs.existsSync(filename)) { problems.push(`${file}: missing canonical document`); continue }
  const navigation = documentNavigation(filename)
  links += navigation.links.length
  problems.push(...navigation.problems.map(problem => `${file}: ${problem}`))
  for (const pattern of staleFeatureDescriptions(fs.readFileSync(filename, 'utf8'))) problems.push(`${file}: retired Alert instructions (${pattern})`)
}
if (!fs.existsSync(path.join(root, 'docs/tools/icon-catalogue.html'))) problems.push('Missing retained icon catalogue')
console.log(`Checked ${graph.files.length} Lite source modules, styles and exports; ${links} links across ${documents.length} maintained documents.`)
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1 }
else console.log('Lite ownership, retirement and navigation checks passed.')
