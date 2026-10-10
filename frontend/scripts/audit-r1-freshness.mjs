import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import {createServer} from 'vite'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..')
const at=Date.UTC(2026,9,10,12),day=86400000
const capture=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-m','storage.r1_audit_snapshot','--database','storage/data/calendar.sqlite3','--as-of',String(at)],{cwd:repo,encoding:'utf8',maxBuffer:128*1024*1024}))
const server=await createServer({root,server:{middlewareMode:true,hmr:false}})
try{
  const {r1Families,r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {r1Freshness,r1DefaultFreshness,r1FreshnessVersion}=await server.ssrLoadModule('./src/scoring-system/r1/freshness.ts')
  const releases=createR1History(capture.events).releases.filter(r=>r1Families.includes(r.familyId)&&r.releaseAt<=at)
  const gaps=r1Families.map(family=>{
    const dates=[...new Set(releases.filter(r=>r.familyId===family).map(r=>r.releaseAt))].sort((a,b)=>a-b)
    const intervals=dates.slice(1).map((d,i)=>(d-dates[i])/day).sort((a,b)=>a-b),q=p=>intervals[Math.ceil(intervals.length*p)-1]??0
    const fallback=r1DefaultFreshness.fallbackDays[family]
    return{family,n:dates.length,p50:q(.5),p95:q(.95),p99:q(.99),max:intervals.at(-1)??0,fallback,covered:intervals.filter(d=>d<=fallback).length,total:intervals.length}
  })
  const schedules=(capture.schedules??[]).flatMap(s=>{
    const family=r1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId))
    return family?[{...s,family}]:[]
  })
  const settings={version:1,calibration:{mode:'automatic',limits:{}},selected:r1Families,freshness:r1DefaultFreshness}
  const clocks=[Date.UTC(2026,8,11,12,30),Date.UTC(2026,9,1,12,30),Date.UTC(2026,9,7,12,30),Date.UTC(2026,9,8,12,30)]
  const snapshots=clocks.map(asOf=>{
    const release=releases.filter(r=>r.releaseAt<=asOf).at(-1),input={release,events:capture.events,asOf,schedules,settings,savedBands:{}}
    const result=calculateR1(input)
    const trimmed=calculateR1({...input,events:capture.events.filter(e=>e.release_at<=asOf),schedules:schedules.filter(s=>s.knownAt<=asOf)})
    assert.deepEqual(result,trimmed,'future publications/schedule captures cannot change the snapshot')
    const variants=[.8,1.2].map(factor=>calculateR1({...input,settings:{...settings,freshness:{...r1DefaultFreshness,fallbackDays:Object.fromEntries(r1Families.map(f=>[f,Math.max(1,Math.round(r1DefaultFreshness.fallbackDays[f]*factor))]))}}}))
    for(const slot of result.overall.slots){
      assert.ok(slot.method!=='age-based'||slot.nextDue===null)
      assert.ok(slot.status!=='current'||slot.expiresAt>=asOf)
      assert.ok(!slot.assessment||slot.assessment.publishedAt<=asOf)
      if(slot.method==='age-based')assert.equal(slot.expiresAt,slot.assessment.publishedAt+slot.fallbackDays*day)
    }
    return{input,result,variants}
  })
  // Continuous-age checks on every captured publication, independent of scorer
  // calibration: expiry is finite, inclusive and never a fabricated schedule.
  for(const release of releases){
    const a={publishedAt:release.releaseAt},slot=r1Freshness(release.familyId,a,release.releaseAt,[])
    assert.equal(slot.status,'current');assert.equal(slot.nextDue,null)
    assert.equal(r1Freshness(release.familyId,a,slot.expiresAt,[]).status,'current')
    assert.equal(r1Freshness(release.familyId,a,slot.expiresAt+1,[]).status,'stale')
  }
  const asset=fs.readdirSync(path.join(root,'dist/assets')).find(name=>/^r1\.worker-.*\.js$/.test(name))
  assert.ok(asset,'Build before replay')
  const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
  try{for(const s of snapshots){const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input:s.input})});assert.deepEqual(reply.result,s.result)}}finally{await worker.terminate()}
  const sep=snapshots[0].result.overall,cpi=sep.slots.find(s=>s.family==='us-cpi')
  const plannedCpi=schedules.filter(s=>s.family==='us-cpi').sort((a,b)=>a.knownAt-b.knownAt)[0]
  assert.equal(cpi.method,'age-based');assert.equal(cpi.status,'current')
  assert.equal(cpi.expiresAt,Date.UTC(2026,9,26,12,30))
  const fmt=n=>n.toFixed(2),timestamp=n=>new Date(n).toISOString()
  const report=`# USD R1 freshness refinement replay\n\nRun: 10 October 2026. Source: ${capture.source}, read-only SQLite export through ${timestamp(at)}. Policy: ${r1FreshnessVersion}. Automatic magnitude fallback; browser manual settings were not read or changed.\n\n## Why September 11 showed unknown schedules\n\nNo mapped schedule was captured by ${timestamp(clocks[0])}. The earliest captured October CPI schedule is ${timestamp(plannedCpi.knownAt)}; its projected due time is ${timestamp(plannedCpi.dueAt)}. It cannot supply historical schedule knowledge on September 11. CPI now uses its 45-day age rule and expires ${timestamp(cpi.expiresAt)}. This is a fallback expiry, not an invented publisher date.\n\n## Default age windows and stored release gaps\n\n| Family | Publications | Median days | P95 days | P99 days | Maximum days | Fallback days | Gaps within fallback |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${gaps.map(g=>`| ${g.family} | ${g.n} | ${fmt(g.p50)} | ${fmt(g.p95)} | ${fmt(g.p99)} | ${fmt(g.max)} | ${g.fallback} | ${g.covered}/${g.total} |`).join('\n')}\n\nDefaults are fixed operational policies informed by these gaps, not runtime estimates of the next release. Claims gets 10 days (P99 8); monthly families and GDP estimates get 45 (P95 up to 39); Fed decisions get 70 (P95/P99 56). GDP estimates publish repeatedly within a quarter, so a quarterly 120-day lifetime would be too permissive for this feed. Large archive gaps do not stretch the windows indefinitely. The configured policy can be applied to historical reviews; this does not claim it was deployed in 2015. Known schedules still take precedence and expire after their configured allowance. Storage corrections do not restart publication age.\n\n## Aggregate replay and sensitivity\n\n| As of UTC | Direction | Net | Coverage | Current slots | Age-based slots | Direction with 80% / 120% age windows | Timing sensitive |\n| --- | --- | ---: | ---: | ---: | ---: | --- | --- |\n${snapshots.map(s=>{const o=s.result.overall;return`| ${timestamp(o.at)} | ${o.direction} | ${o.net} | ${fmt(o.coverage*100)}% | ${o.slots.filter(x=>x.status==='current').length} | ${o.slots.filter(x=>x.method==='age-based').length} | ${s.variants.map(v=>v.overall.direction).join(' / ')} | ${o.timingSensitive} |`}).join('\n')}\n\nEvery snapshot matches after removing future publications and later-known schedules, and matches the production-built R1 worker. Inclusive expiry and one-millisecond-after expiry were checked for all ${releases.length} captured publications. Missing numerical inputs, manufacturing Production, mismatched PPI months, and source vintage uncertainty retain their independent treatment. Grace alternatives 0/72 hours and fallback windows 80%/120% are sensitivity checks, never silent substitutions for saved settings.\n\nThis replay supports bounded retention and chronology, not uniquely optimal day limits. The original strict-schedule audit remains historical evidence. Browser visual review remains with the user.\n`
  fs.writeFileSync(path.join(repo,'reports/USD-R1-freshness-audit.md'),report)
  console.log(gaps)
  console.log(snapshots.map(s=>({at:timestamp(s.result.overall.at),direction:s.result.overall.direction,net:s.result.overall.net,coverage:s.result.overall.coverage,current:s.result.overall.slots.filter(x=>x.status==='current').length})))
  console.log('Freshness replay, expiry boundaries, chronology and built-worker parity passed.')
}finally{await server.close()}
