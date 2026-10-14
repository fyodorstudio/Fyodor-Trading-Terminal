import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const levels = ['entryPrice', 'tpPrice', 'slPrice', 'tpPips', 'slPips', 'rrRatio']
const validArrow = arrow => arrow && typeof arrow.id === 'string' && typeof arrow.symbol === 'string'
  && typeof arrow.note === 'string' && ['waiting', 'long', 'short'].includes(arrow.direction)
  && [arrow.time, arrow.createdAt].every(value => typeof value === 'number' && Number.isFinite(value))
  && levels.every(key => arrow[key] === null || (typeof arrow[key] === 'number' && Number.isFinite(arrow[key])))
  && (arrow.archived === undefined || typeof arrow.archived === 'boolean')
  && (arrow.targetRr === undefined || arrow.targetRr === null || (typeof arrow.targetRr === 'number' && Number.isFinite(arrow.targetRr) && arrow.targetRr > 0))
  && (arrow.eventTitle === undefined || (typeof arrow.eventTitle === 'string' && arrow.eventTitle.length <= 512))
  && (arrow.eventAt === undefined || arrow.eventAt === null || (typeof arrow.eventAt === 'string' && Number.isFinite(Date.parse(arrow.eventAt))))
const calculateMetrics = arrow => {
  const { direction, entryPrice: entry, slPrice: sl, tpPrice: tp } = arrow
  const side = direction !== 'waiting' ? direction : entry == null ? null
    : sl != null && sl !== entry ? sl < entry ? 'long' : 'short' : tp != null && tp !== entry ? tp > entry ? 'long' : 'short' : null
  const multiplier = arrow.symbol.toUpperCase().includes('XAU') ? 10 : arrow.symbol.toUpperCase().includes('BTC') ? 1
    : arrow.precision === 2 || arrow.precision === 3 || arrow.symbol.includes('JPY') ? 100 : 10000
  const tpPips = entry > 0 && tp > 0 && side ? (side === 'long' ? tp - entry : entry - tp) * multiplier : null
  const slPips = entry > 0 && sl > 0 && side ? (side === 'long' ? entry - sl : sl - entry) * multiplier : null
  return { tpPips, slPips, rrRatio: tpPips != null && slPips > 0 ? tpPips / slPips : null }
}
const route = '/entry-trade-api/journal'
const editable = new Set(['note', 'time', 'direction', 'entryPrice', 'tpPrice', 'slPrice', 'tpPips', 'slPips', 'rrRatio', 'archived', 'targetRr', 'eventAt', 'eventTitle'])
export function entryTradeJournalPlugin(filename = path.resolve(import.meta.dirname, '../../Market Analyst Workflow/entry-trade/journal.json')) {
  const read = () => {
    if (!fs.existsSync(filename)) return { version: 1, revision: 0, arrows: [], deletedIds: [], seedIds: [], history: [] }
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (data.version !== 1 || !Number.isSafeInteger(data.revision) || !Array.isArray(data.arrows) || !data.arrows.every(validArrow)
      || !Array.isArray(data.deletedIds) || !data.deletedIds.every(id => typeof id === 'string')
      || !Array.isArray(data.seedIds) || !Array.isArray(data.history)) throw new Error('Repository journal is invalid; existing data was preserved.')
    return data
  }
  const snapshot = (data) => ({ version: data.version, revision: data.revision, arrows: data.arrows, deletedIds: data.deletedIds })
  const send = (response, status, body) => {
    response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body))
  }
  const middleware = async (request, response, next) => {
    if (request.url?.split('?')[0] !== route) { next(); return }
    try {
      if (request.method === 'GET') { send(response, 200, snapshot(read())); return }
      if (request.method !== 'POST') { send(response, 405, { error: 'Use GET or POST.' }); return }
      if (!request.headers['content-type']?.startsWith('application/json')
        || (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)) {
        send(response, 403, { error: 'Journal writes must come from this terminal.' }); return
      }
      request.setEncoding('utf8')
      let body = ''
      for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 2_000_000) { send(response, 413, { error: 'Journal update too large.' }); return } }
      const payload = JSON.parse(body)
      if (!Array.isArray(payload.operations) || payload.operations.length > 500) throw new Error('Invalid journal operations.')
      const data = read(), seen = new Set(data.history.map(item => item.operationId))
      const pending = payload.operations.filter(item => !seen.has(item.operationId))
      if (!pending.length) { send(response, 200, snapshot(data)); return }
      if (payload.expectedRevision !== data.revision) { send(response, 409, { error: 'Journal changed; refresh and retry.', ...snapshot(data) }); return }
      for (const operation of pending) {
        if (!operation || typeof operation.operationId !== 'string' || operation.operationId.length > 160
          || typeof operation.id !== 'string' || operation.id.length > 180 || seen.has(operation.operationId)) throw new Error('Invalid journal operation.')
        seen.add(operation.operationId)
        const index = data.arrows.findIndex(item => item.id === operation.id)
        if (operation.action === 'insert' || operation.action === 'migrate') {
          if (!validArrow(operation.arrow) || operation.arrow.id !== operation.id || operation.arrow.note.length > 32000) throw new Error('Invalid journal arrow.')
          if (!data.deletedIds.includes(operation.id)) {
            if (index < 0) data.arrows.unshift(operation.arrow)
            else if (operation.action === 'migrate' && data.seedIds.includes(operation.id)) data.arrows[index] = operation.arrow
          }
        } else if (operation.action === 'update') {
          if (!operation.changes || Object.keys(operation.changes).some(key => !editable.has(key))) throw new Error('Invalid journal fields.')
          if (index >= 0) {
            const changed = { ...data.arrows[index], ...operation.changes }
            if (['direction', 'entryPrice', 'slPrice', 'tpPrice'].some(key => key in operation.changes)) Object.assign(changed, calculateMetrics(changed))
            if (!validArrow(changed) || changed.note.length > 32000) throw new Error('Invalid journal values.')
            data.arrows[index] = changed
          }
        } else if (operation.action === 'delete') {
          data.arrows = data.arrows.filter(item => item.id !== operation.id)
          if (!data.deletedIds.includes(operation.id)) data.deletedIds.push(operation.id)
        } else throw new Error('Unknown journal operation.')
        data.seedIds = data.seedIds.filter(id => id !== operation.id)
        data.history.push({ ...operation, at: new Date().toISOString() })
      }
      data.revision++
      const directory = path.dirname(filename); fs.mkdirSync(directory, { recursive: true })
      const temporary = path.join(directory, `.journal-${randomUUID()}.tmp`)
      try { fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); fs.renameSync(temporary, filename) }
      finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
      send(response, 200, snapshot(data))
    } catch (error) { send(response, 400, { error: error instanceof Error ? error.message : 'Could not save journal.' }) }
  }
  return { name: 'entry-trade-journal', configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) } }
}
