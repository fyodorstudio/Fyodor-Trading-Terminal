import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const require=createRequire(new URL('../frontend/package.json',import.meta.url))
const {createServer}=await import(pathToFileURL(require.resolve('vite')).href)
const server=await createServer({root:path.resolve('frontend'),server:{middlewareMode:true,hmr:false}})
try {
  const {validCurrencySummary}=await server.ssrLoadModule('/src/thesis/currency-summary-model.ts')
  const response=await fetch('http://127.0.0.1:8002/api/v1/theses/summary')
  assert(response.ok,`Summary HTTP ${response.status}`)
  const summary=await response.json()
  assert(validCurrencySummary(summary),'Production frontend rejected the summary')
  const cli=JSON.parse((await fs.readFile('tmp/assess-20261103-summary-after.json','utf8')).replace(/^\uFEFF/,''))
  assert.deepEqual(summary.rows,cli.rows,'CLI and live API rows differ')
  assert.equal(summary.as_of_utc,'2026-11-02T23:57:36.324334Z')
  console.log(JSON.stringify({summaryValid:true,asOf:summary.as_of_utc,rows:summary.rows.map(r=>({currency:r.currency,verdict:r.verdict,intensity:r.intensity,evidence:r.evidence_anchor,reassessment:r.reassessment.event_at,gap:r.reassessment_gap}))}))
  const {validRecommendedPairs}=await server.ssrLoadModule('/src/thesis/recommended-pairs-model.ts')
  const pairResponse=await fetch('http://127.0.0.1:8002/api/v1/theses/recommended-pairs')
  assert(pairResponse.ok,`Pairs HTTP ${pairResponse.status}`)
  const pairs=await pairResponse.json()
  assert(validRecommendedPairs(pairs),'Production frontend rejected recommendations')
  const chosen=pairs.items.find(i=>i.pair==='EURCAD')
  assert(chosen && chosen.status==='current' && chosen.intensity==='moderate' && chosen.rank===1,'EURCAD recommendation is not current')
  console.log(JSON.stringify({recommendationsValid:true,pair:chosen.pair,status:chosen.status,until:chosen.until_utc,evidence:chosen.evidence.map(e=>({currency:e.currency,id:e.assessment_id}))}))
  await fs.writeFile('tmp/assess-20261103-live-summary.json',JSON.stringify(summary,null,2))
} finally {await server.close()}
