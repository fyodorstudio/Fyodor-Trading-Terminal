import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { suites } from '../tests/suites.mjs'
import { selectSuites } from './lib/select-suites.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// SSR servers share Vite's dependency cache, so keep suites sequential.
let selected
try { selected=selectSuites(suites,process.argv.slice(2)) }
catch(error){ console.error(error.message);process.exit(1) }
for (const suite of selected) {
  console.log(`\nRunning ${suite}`)
  const result = spawnSync(process.execPath, [suite], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    console.error(`${suite} failed${result.signal ? ` (${result.signal})` : ''}`)
    process.exit(result.status ?? 1)
  }
}
console.log(`\nAll ${selected.length} ${selected.length===suites.length ? '' : 'selected '}suites passed.`)
