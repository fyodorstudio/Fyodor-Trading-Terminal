import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceGraph } from '../scripts/lib/source-graph.mjs'
import { sourceUsage, unreferencedClasses } from '../scripts/lib/source-hygiene.mjs'
import { documentNavigation, staleFeatureDescriptions } from '../scripts/lib/document-navigation.mjs'

const runtime = fileURLToPath(new URL('./.runtime/', import.meta.url))
fs.mkdirSync(runtime, { recursive: true })
const directory = fs.mkdtempSync(path.join(runtime, 'repository-'))
const write = (name, text) => fs.writeFileSync(path.join(directory, name), text)
try {
  write('reader.ts', 'export const Reader = () => null; export const RetiredScreen = () => null')
  write('entry.tsx', 'import { Reader } from "./reader"; export const Shell = () => <div className={`panel-${Reader()}`}><Reader /></div>; Shell()')
  write('types.ts', 'export type Contract = { version: number }')
  const usage = sourceUsage(sourceGraph(directory).files)
  assert.deepEqual(usage.unused.map(item => item.name), ['RetiredScreen'], 'A reachable file cannot hide an unused co-export')
  assert.deepEqual(unreferencedClasses('/* .comment {} */ .panel-open { color: red } @media (width < 900px) { .obsolete-row { color: red } }', usage), ['obsolete-row'], 'Class checks recognize interpolation prefixes and nested media rules')
  write('namespace.ts', 'import * as collection from "./reader"; collection.Reader()')
  assert.deepEqual(sourceUsage(sourceGraph(directory).files).unused, [], 'Namespace APIs are conservatively retained')
  write('guide.md', '# Guide\n## Current controls\n## Current controls\n[local](#current-controls-1)\n[bad](#removed)\n```md\n[example](missing.md)\n```\n')
  write('README.md', '# Start\n[guide](guide.md#current-controls)\n[missing](lost.md)\n')
  assert.deepEqual(documentNavigation(path.join(directory, 'guide.md')).problems, ['missing heading #removed'])
  assert.deepEqual(documentNavigation(path.join(directory, 'README.md')).problems, ['missing link lost.md'])
  assert.equal(staleFeatureDescriptions("Alert's **Research** button prepares the report.").length, 1)
  assert.equal(staleFeatureDescriptions('Alert no longer offers Prepare research.').length, 0)
  console.log('✓ Repository checks detect unused runtime exports, orphan selectors, broken document links/anchors and retired Alert instructions')
} finally {
  // This fixture is flat; remove only the exact files created for this test.
  for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name))
  fs.rmdirSync(directory)
}
