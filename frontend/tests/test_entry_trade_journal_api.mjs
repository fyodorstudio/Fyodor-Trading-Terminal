import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { entryTradeJournalPlugin } from '../scripts/entry-trade-journal-plugin.mjs'
const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.runtime')
fs.mkdirSync(runtime, { recursive: true })
const directory = fs.mkdtempSync(path.join(runtime, 'journal-'))
const filename = path.join(directory, 'journal.json')
let middleware
entryTradeJournalPlugin(filename).configureServer({ middlewares: { use: value => { middleware = value } } })
const server = http.createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end() }))
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/entry-trade-api/journal`
const get = async () => { const response = await fetch(url); return { status: response.status, body: await response.json() } }
const post = async (revision, operations, headers = {}) => { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ expectedRevision: revision, operations }) }); return { status: response.status, body: await response.json() } }
const arrow = { id: 'research_api_eurusd', symbol: 'EURUSD', eventAt: '2026-10-14T12:30:00Z', createdAt: 1791954300000,
  time: 0, direction: 'waiting', entryPrice: null, slPrice: null, tpPrice: null, slPips: null, tpPips: null, rrRatio: null,
  note: 'Original thesis — preserve 日本語 and user notes.' }
try {
  assert.equal((await get()).body.arrows.length, 0)
  const first = { operationId: 'one', action: 'insert', id: arrow.id, arrow }
  let result = await post(0, [first]); assert.equal(result.status, 200); assert.equal(result.body.revision, 1)
  assert.equal(result.body.arrows[0].note, arrow.note)
  result = await post(0, [first]); assert.equal(result.status, 200); assert.equal(result.body.revision, 1, 'Retry after a lost response is idempotent')
  result = await post(1, [{ operationId: 'two', action: 'update', id: arrow.id, changes: { direction: 'long' } }])
  assert.equal(result.status, 200); assert.equal(result.body.arrows[0].direction, 'long'); assert.equal(result.body.arrows[0].slPrice, null)
  const conflict = await post(1, [{ operationId: 'three', action: 'update', id: arrow.id, changes: { note: 'stale overwrite' } }])
  assert.equal(conflict.status, 409); assert.equal((await get()).body.arrows[0].note, arrow.note)
  const concurrent = await Promise.all([
    post(2, [{ operationId: 'parallel-a', action: 'update', id: arrow.id, changes: { entryPrice: 1.1 } }]),
    post(2, [{ operationId: 'parallel-b', action: 'update', id: arrow.id, changes: { note: 'Another client' } }]),
  ])
  assert.deepEqual(concurrent.map(value => value.status).sort(), [200, 409])
  let state = (await get()).body
  result = await post(state.revision, [{ operationId: 'four', action: 'update', id: arrow.id, changes: { archived: true, note: 'Final entry note' } }])
  assert.equal(result.body.arrows[0].archived, true)
  result = await post(result.body.revision, [{ operationId: 'five', action: 'update', id: arrow.id, changes: { archived: false } }])
  assert.equal(result.body.arrows[0].note, 'Final entry note')
  const unchanged = result.body.arrows[0].note
  assert.equal((await post(result.body.revision, [{ operationId: 'partial-good', action: 'update', id: arrow.id, changes: { note: 'should roll back' } }, { operationId: 'partial-bad', action: 'update', id: arrow.id, changes: { symbol: 'GBPUSD' } }])).status, 400)
  assert.equal((await get()).body.arrows[0].note, unchanged, 'A failed batch is atomic')
  assert.equal((await post(result.body.revision, [{ operationId: 'unsafe', action: 'update', id: arrow.id, changes: { id: 'changed-identity' } }])).status, 400)
  assert.equal((await post(result.body.revision, [first], { Origin: 'http://unrelated.example' })).status, 403)
  const independentTime = 1792038600
  result = await post(result.body.revision, [{ operationId: 'anchor', action: 'update', id: arrow.id, changes: { eventAt: '2026-10-15T00:30:00Z', eventTitle: 'Australia jobs', time: independentTime } }])
  assert.equal(result.body.arrows[0].eventAt, '2026-10-15T00:30:00Z')
  assert.equal(result.body.arrows[0].eventTitle, 'Australia jobs')
  result = await post(result.body.revision, [{ operationId: 'arrow-date', action: 'update', id: arrow.id, changes: { time: independentTime + 86400 } }])
  assert.equal(result.body.arrows[0].eventAt, '2026-10-15T00:30:00Z', 'Arrow movement preserves the event anchor on disk')
  result = await post(result.body.revision, [{ operationId: 'clear-anchor', action: 'update', id: arrow.id, changes: { eventAt: null } }])
  assert.equal(result.body.arrows[0].eventAt, null)
  result = await post(result.body.revision, [{ operationId: 'six', action: 'delete', id: arrow.id }])
  assert.equal(result.body.arrows.length, 0); assert.ok(result.body.deletedIds.includes(arrow.id))
  result = await post(result.body.revision, [{ ...first, operationId: 'seven', action: 'migrate' }])
  assert.equal(result.body.arrows.length, 0, 'Old browser migration cannot resurrect deletions')
  const disk = JSON.parse(fs.readFileSync(filename, 'utf8'))
  assert.equal(disk.history[0].arrow.note, arrow.note, 'History retains the original thesis')
  assert.ok(disk.history.some(item => item.changes?.note === 'Final entry note'))
  // A corrupt file is never silently replaced, even by a valid operation.
  const valid = fs.readFileSync(filename); fs.writeFileSync(filename, 'invalid journal')
  assert.equal((await get()).status, 400)
  assert.equal((await post(disk.revision, [first])).status, 400)
  assert.equal(fs.readFileSync(filename, 'utf8'), 'invalid journal')
  fs.writeFileSync(filename, valid)
  assert.equal((await get()).body.revision, disk.revision, 'New readers restore the durable journal')
  console.log('Repository journal API: atomic persistence, directions with blank levels, concurrency, retries, archive/history, migration, corruption and origin guards passed.')
} finally {
  await new Promise(resolve => server.close(resolve))
  assert.ok(path.resolve(directory).startsWith(runtime + path.sep))
  fs.rmSync(directory, { recursive: true, force: true })
}
