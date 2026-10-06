import fs from 'node:fs'

const [output] = process.argv.slice(2)
if (!output) throw new Error('Usage: node scripts/usd-context/capture-eur-inventory.mjs <output.json>')
const ids = ['999010003','999010006','999010007','999010015','999010024',
  '999030010','999030011','999030012','999030013','999030021','999030022','999030024','999030025','999030026','999030027',
  '276010020','276010021','276010022','276010023','999500001','999500002','999500003',
  '276500001','276500002','276500003','250500001','250500002','250500003',
  '999030016','999030017','999030001','999030002','999030020','999030028','999030009','999030023']
for (let attempt = 0; attempt < 3; attempt++) {
  const events = [], revisions = new Set(); let cursor = null
  do {
    const params = new URLSearchParams({ source_id: 'Elev8-Demo2', from_server_seconds: String(Date.UTC(2014,11,30)/1000),
      to_server_seconds: String(Date.UTC(2026,9,8)/1000), currency: 'EUR', time_basis: 'chart', event_ids: ids.join(','), limit: '5000' })
    if (cursor) { params.set('after_time', cursor.after_time); params.set('after_id', cursor.after_id) }
    const response = await fetch('http://127.0.0.1:8002/api/v1/calendar?' + params)
    if (!response.ok) throw new Error('Storage HTTP ' + response.status)
    const page = await response.json()
    revisions.add(page.revision); events.push(...page.events); cursor = page.next_cursor
  } while (cursor)
  if (revisions.size !== 1) continue
  const snapshot = { source_id: 'Elev8-Demo2', revision: [...revisions][0], events }
  fs.writeFileSync(output, JSON.stringify(snapshot) + '\n')
  console.log(JSON.stringify({ revision: snapshot.revision, rows: events.length, series: ids.map(id => {
    const rows = events.filter(e => e.event_id === id), observed = rows.filter(e => e.actual !== null)
    return { id, rows: rows.length, numeric: observed.length, latest: observed.at(-1) ?? rows.at(-1) }
  }) }, null, 2))
  process.exit(0)
}
throw new Error('Storage revision changed while paging; no snapshot written.')
