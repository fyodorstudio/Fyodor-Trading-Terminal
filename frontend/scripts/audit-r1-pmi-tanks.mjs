import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import ts from 'typescript'
import {createServer} from 'vite'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..'),captureAt=Date.UTC(2026,9,11,6)
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false}})
try {
  const {allR1SeriesIds,allR1Families,r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const {r1DefaultSettings,eurR1DefaultSettings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
  const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
  const {createR1SnapshotReader,calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {calculateR1Timeline,r1TimelineAt}=await server.ssrLoadModule('./src/scoring-system/r1/timeline.ts')
  const {balance,multiplyLeaves}=await server.ssrLoadModule('./src/scoring-system/r1/arithmetic.ts')
  const {r1DirectionLabel}=await server.ssrLoadModule('./src/scoring-system/r1/presentation.ts')
  const {r1DisplayChangeParts}=await server.ssrLoadModule('./src/scoring-system/r1/changes.ts')
  const py=`import json,sys\nfrom pathlib import Path\nfrom storage.calendar_store import CalendarStore,HISTORY_START\nstore=CalendarStore(Path('storage/data/calendar.sqlite3'),readonly=True)\ntry:\n source=store.db.execute('SELECT source_id,count(*) n FROM events GROUP BY source_id ORDER BY n DESC').fetchone()[0]\n ids=json.loads(sys.argv[1]);at=int(sys.argv[2]);rows=[];schedules=[];cursor={}\n while True:\n  page=store.query(source,HISTORY_START,at//1000+172800,event_ids=ids,time_basis='chart',r1_as_of=at,limit=5000,**cursor);rows.extend(page['events'])\n  if not schedules:schedules=page.get('r1_schedules',[])\n  if not page['next_cursor']:break\n  cursor=page['next_cursor']\n print(json.dumps({'events':rows,'schedules':schedules,'source':source}))\nfinally:store.close()`
  const data=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-c',py,JSON.stringify(allR1SeriesIds),String(captureAt)],{cwd:repo,encoding:'utf8',maxBuffer:192*1024*1024}))
  const schedules=data.schedules.flatMap(s=>{const family=allR1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId));return family?[{...s,family}]:[]})
  const input={events:data.events,usdSettings:r1DefaultSettings,eurSettings:eurR1DefaultSettings,savedBands:{},schedules,end:captureAt}
  // Replay the preceding aggregator with exactly the same current assessments.
  const source=fs.readFileSync(path.join(root,'src/scoring-system/r1/eur-relationships.ts'),'utf8')
  const criterion="composite?.status==='current'&&composite.assessment?.reference===ref&&composite.assessment.leaves.some(l=>l.value!==null)"
  assert.ok(source.includes(criterion))
  const oldJs=ts.transpileModule(source.replace(criterion,'composite?.assessment?.reference===ref'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','')
  const oldCombine=Function('balance','multiplyLeaves',`${oldJs}\nreturn combineEurR1;`)(balance,multiplyLeaves)
  const reader=createR1SnapshotReader({...input,currency:'EUR',settings:eurR1DefaultSettings},true)
  const history=createR1History(data.events),changed=[]
  for(const release of history.releases.filter(r=>r.country==='EU'&&r.familyId==='euro-pmi'&&r.releaseAt<=captureAt)){
    const current=reader(release.releaseAt),before=oldCombine(current.slots,eurR1DefaultSettings.selected,release.releaseAt)
    assert.ok(Math.abs(current.leaves.reduce((n,l)=>n+l.budget,0)-100)<1e-8)
    if(current.net!==before.net||current.unavailable!==before.unavailable){
      assert.equal(current.slots.find(s=>s.family==='euro-pmi').assessment.direction,'insufficient')
      changed.push({at:new Date(release.releaseAt).toISOString(),before:before.net,after:current.net,unknownBefore:before.unavailable,unknownAfter:current.unavailable})
    }
  }
  const timeline=calculateR1Timeline(input),dates=[Date.UTC(2026,8,23,8),Date.UTC(2026,9,1,8),Date.UTC(2026,9,5,8)]
  const missing=dates.map(at=>{
    const release=history.releases.find(r=>r.country==='EU'&&r.familyId==='euro-pmi'&&r.releaseAt===at)
    const a=calculateR1({release,events:data.events,settings:eurR1DefaultSettings,savedBands:{},schedules})
    assert.equal(a.assessment.readings[0].actual,null);assert.equal(a.assessment.explanation,'MT5 Actual is unavailable.')
    const state=r1TimelineAt(timeline,at).EUR
    assert.deepEqual(state.missing,['PMI']);assert.equal(state.net,a.overall.net);assert.equal(state.unavailable,12)
    return {at:new Date(at).toISOString(),net:state.net,unknown:state.unavailable,interval:state.interval,label:r1DirectionLabel(state,'EUR')}
  })
  const batchAt=Date.UTC(2026,7,13,12,30),batchReleases=history.releases.filter(r=>r.country==='US'&&['claims','ppi'].includes(r.familyId)&&r.releaseAt===batchAt)
  assert.equal(batchReleases.length,2)
  const batchInput={release:batchReleases[0],events:data.events,settings:r1DefaultSettings,eurSettings:eurR1DefaultSettings,savedBands:{},schedules}
  const {calculateR1Pair}=await server.ssrLoadModule('./src/scoring-system/r1/pair.ts')
  const batch=calculateR1Pair(batchInput),batchParts=r1DisplayChangeParts(batch.transition)
  assert.deepEqual(calculateR1({...batchInput,release:batchReleases[1]}).transition.parts,batch.transition.parts)
  assert.deepEqual(r1TimelineAt(timeline,batchAt).USD.update.parts,batch.transition.parts)
  assert.equal(batchParts.reduce((n,p)=>n+Math.round(p.change*100),0),Math.round(batch.transition.change*100))
  async function builtWorker(name,input){
    const asset=fs.readdirSync(path.join(root,'dist/assets')).find(n=>n.startsWith(`${name}.worker-`)&&n.endsWith('.js'));assert.ok(asset,'Build before replay')
    const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
    const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(shim)),{type:'module'})
    try{return await new Promise((resolve,reject)=>{worker.once('message',reply=>reply.error?reject(new Error(reply.error)):resolve(reply.result));worker.once('error',reject);worker.postMessage({id:1,input})})}
    finally{await worker.terminate()}
  }
  assert.deepEqual(await builtWorker('timeline',input),timeline)
  assert.deepEqual(await builtWorker('pair',batchInput),batch)
  const report=`# PMI fallback and Raycaster tanks — 11 October 2026

Read-only replay: ${data.source}, ${data.events.length} versioned rows, ${timeline.points.length} timeline clocks. Default calibration/settings; browser overrides were not read. Late-captured history remains retrospective.

## Availability correction

${changed.length} historical euro-area PMI publication clocks now use available same-month sectors when the composite is missing. Their original sector weights are retained; missing selected sectors remain unknown. Fully usable composites, measured zero changes, national overlap and all standalone formulas retain their rules. The replay compares old/new aggregators on identical assessments and conserves the full 100-point budget.

| UTC publication | Old known net | New known net | Old unknown budget | New unknown budget |
| --- | ---: | ---: | ---: | ---: |
${changed.map(c=>`| ${c.at} | ${c.before} | ${c.after} | ${c.unknownBefore} | ${c.unknownAfter} |`).join('\n')}

## Named missing reports

The user confirmed blank Actuals in MT5. Stored backfill payloads from 11 October also contain null Actual/raw fields. The release exists; no web value, forecast or older-month reading was substituted.

${missing.map(m=>`- ${m.at}: known ${m.net}, missing ±${m.unknown}, interval ${m.interval.join(' to ')}; ${m.label}; Incomplete — PMI unavailable.`).join('\n')}

## Presentation and hygiene

Inspector and Raycaster show qualified available-evidence leads without changing the strict engine classification/interval. No usable inputs remain unavailable; partial zero does not invent a lead. The later accepted visual refinement uses bottom-filled tanks on a shared 0–100 magnitude scale, green/red liquid, prominent signed scores and previous-level markers. Missing inputs remain named without primary axes or hatching. Compact dated tables separate standalone points and overall changes and conserve displayed totals. Quiet candles retain the last update; hover does no scoring, fetching or worker dispatch.

Removed two unreachable workers (old R1 and Claims analysis); retained actual pair/history/timeline and Claims standalone workers and all retired views. The active objective is compacted with its full previous content archived, and navigation/settings descriptions name the current owners/rules.

## Simultaneous Claims/PPI contribution review

13 August 2026 at 12:30 UTC, default settings: ${batch.transition.before.net} → ${batch.overall.net}; combined change ${batch.transition.change}. Selecting either publication exposes identical parts; the production pair worker and Raycaster timeline agree. Browser overrides were not read.

| Contributor | Displayed overall change |
| --- | ---: |
${batchParts.map(p=>`| ${p.label} | ${p.change} |`).join('\n')}
| Total | ${Math.round(batch.transition.change*100)/100} |

Inspector displays these shared contribution rows directly beneath the combined summary. R1's frame is 780px high, still capped by the available chart height; changing between R1 and retired views reclamps its saved position. Small charts retain scrolling rather than hide details.

## Verification

Built production timeline worker matches the pure timeline exactly, including missing-input metadata. The production pair worker matches the August Claims/PPI Inspector result and contribution breakdown. Focused unit/mounted tests cover fallback availability, zero composite, stale/new-month/excluded sectors, missing-budget conservation, real corrections, bottom tank levels/crossings, compact-row totals and deterministic zero hover work.

Repository verification on 11 October: all 73 sequential frontend suites passed, including the assembled terminal responsiveness suite; lint and TypeScript/Vite production build passed. The import/export/dynamic import/worker/CSS graph reaches all 464 source files from bootstrap, with no unresolved relative references or unreachable files. Active navigation links and git diff whitespace checks passed. These checks do not prove absence of every possible dead branch. Browser layout/performance and rapid-hover appearance remain user review.

Reproduce: pnpm --dir frontend exec node scripts/audit-r1-pmi-tanks.mjs.
`
  fs.writeFileSync(path.join(repo,'reports/R1-PMI-tanks-audit.md'),report)
  console.log(JSON.stringify({source:data.source,rows:data.events.length,clocks:timeline.points.length,changed:changed.length,missing,batch:{before:batch.transition.before.net,after:batch.overall.net,change:batch.transition.change,parts:batchParts},workerParity:true}))
}finally{await server.close()}
