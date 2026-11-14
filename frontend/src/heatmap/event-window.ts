import { majorCurrencies } from '../economic-calendar/forex/currencies'
import { majorForexPairs } from '../economic-calendar/forex/pairs'
import { heatmapPairs, heatmapGroup, heatmapDate, validHeatmapRecords, formatHeatmapOHLC, orderHeatmapGroups,
  type HeatmapHistory, type HeatmapInstrument, type HeatmapPoint, type HeatmapRow, type HeatmapPeriod, type HeatmapField } from './heatmap-model'

export type EventWindow = { from: number; through: number; anchor: number; minutes: number }
export type IntradayHistory = { schema: 1; source_id: string; generation: number; from_utc: number; through_utc: number;
  observed_at: number; revision: string; pending: number; symbols: HeatmapHistory['symbols'] }
export const jakartaInput = (at: number) => new Date(at + 7 * 3600000).toISOString().slice(0, 16)
export const jakartaTime = (at: number) => new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Jakarta',month:'short',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(at) + ' WIB'
export const parseJakarta = (value: string) => Date.parse(value + ':00+07:00')
export function validEventWindow(window: EventWindow, now = Date.now()) {
  return [window.from,window.through,window.anchor].every(t=>Number.isFinite(t)&&t%60000===0)
    && window.from>=Date.UTC(2015,0,1) && window.from<=now && window.through>window.from && window.through-window.from<=72*3600000
    && window.anchor>=window.from && window.anchor<=window.through && [1,5,15,30,60,240,1440].includes(window.minutes)
}
export function validIntraday(value: unknown, broker: string, generation: number, window: EventWindow): value is IntradayHistory {
  if (!value || typeof value!=='object') return false
  const data=value as IntradayHistory
  return data.from_utc===window.from/1000 && data.through_utc===window.through/1000
    && data.schema===1 && data.source_id===broker && data.generation===generation
    && Number.isFinite(data.observed_at) && /^[a-f0-9]{64}$/.test(data.revision)
    && Number.isInteger(data.pending) && data.pending>=0 && data.pending<=128
    && validHeatmapRecords(data.symbols,10080)
    && Object.values(data.symbols).every(r=>r.bars.every(b=>b.time%60===0 && b.time>=data.from_utc-3*86400 && b.time<data.through_utc && b.time<=data.observed_at))
}
export function eventPeriods(window: EventWindow, now: number): HeatmapPeriod[] {
  const period=(from: number, through: number, summary=false): HeatmapPeriod=>({day:summary?'window':new Date(from).toISOString(),end:new Date(through).toISOString(),
    label:summary?'Window summary':new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:true}).format(from),
    caption:summary?`${jakartaTime(from)} → ${jakartaTime(through)}`:`${heatmapDate(from+7*3600000)}${through>now?' · In progress':''}`,
    partial:through>now,future:from>now})
  const periods=[period(window.from,window.through,true)]
  for(let at=window.from;at<window.through;at+=window.minutes*60000) periods.push(period(at,Math.min(window.through,at+window.minutes*60000)))
  return periods
}
const empty=(reason:string):HeatmapPoint=>({value:null,relative:null,coverage:0,from:null,through:null,start:null,open:null,close:null,high:null,low:null,checkedAt:null,reason})
export function eventRows(ids:string[],catalog:HeatmapInstrument[],broker:string|null,data:IntradayHistory|null,window:EventWindow):HeatmapRow[] {
  const periods=eventPeriods(window,data?data.observed_at*1000:Date.now()),pairs=heatmapPairs(catalog)
  const projections=new Map<string,Map<string,HeatmapPoint>>()
  for(const [name,record] of Object.entries(data?.symbols??{})) {
    const baseline=window.anchor>data!.observed_at*1000?undefined:record.bars.findLast(b=>(b.time+60)*1000<=Math.min(window.anchor,data!.observed_at*1000))
    const points=new Map<string,HeatmapPoint>()
    const windowBars:typeof record.bars=[], grouped=new Map<string,typeof record.bars>()
    // One pass through minute history, regardless of the number of displayed candles.
    for(const bar of record.bars) {
      const at=bar.time*1000
      if(at<window.from||at>=window.through)continue
      windowBars.push(bar)
      const key=new Date(window.from+Math.floor((at-window.from)/(window.minutes*60000))*window.minutes*60000).toISOString()
      const group=grouped.get(key)??[];group.push(bar);grouped.set(key,group)
    }
    for(const period of periods) {
      const from=period.day==='window'?window.from:Date.parse(period.day),through=Date.parse(period.end)
      const bars=period.day==='window'?windowBars:grouped.get(period.day)??[]
      const last=bars.at(-1)
      if(!baseline||!last){points.set(period.day,empty(!baseline?window.anchor>data!.observed_at*1000?'Anchor has not occurred; baseline unavailable':'Pre-anchor completed minute unavailable':'No minute candles in this interval'));continue}
      const expected=Math.max(1,Math.ceil((Math.min(through,data!.observed_at*1000)-from)/60000))
      points.set(period.day,{value:(last.close/baseline.close-1)*100,relative:null,coverage:1,
        from:new Date((baseline.time+60)*1000).toISOString(),through:new Date(Math.min((last.time+60)*1000,data!.observed_at*1000)).toISOString(),
        start:baseline.close,open:bars[0].open,high:Math.max(...bars.map(b=>b.high)),low:Math.min(...bars.map(b=>b.low)),close:last.close,checkedAt:record.checked_at,
        reason:[record.availability==='unavailable'?'Retained history; refresh failed':'',bars.length<expected?`${bars.length}/${expected} minute candles; coverage gaps or market closure`:''].filter(Boolean).join(' · ')})
    }
    projections.set(name,points)
  }
  return ids.map(id=>{
    const group=heatmapGroup(id,broker)
    if(id.startsWith('symbol:')) {const name=id.slice(7);return {id,label:name,group,checkedAt:data?.symbols[name]?.checked_at??null,points:projections.get(name)??new Map()}}
    const currency=id.slice(7),points=new Map<string,HeatmapPoint>()
    if(!majorCurrencies.some(c=>c===currency))return {id,label:currency,group,checkedAt:null,points}
    for(const period of periods){
      const counterparts=majorForexPairs.filter(p=>p.includes(currency)).map(pair=>({pair,point:projections.get(pairs.get(pair)??'')?.get(period.day)}))
      const available=counterparts.filter(c=>c.point?.value!=null),first=available[0]?.point
      if(available.length!==7||!first||available.some(c=>c.point!.from!==first.from||c.point!.through!==first.through)){
        points.set(period.day,{...empty('All seven matching baseline/end instants required'),coverage:available.length});continue
      }
      const log=available.reduce((sum,c)=>sum+Math.log1p(c.point!.value!/100)*(c.pair.startsWith(currency)?1:-1),0)/7
      points.set(period.day,{...empty(available.some(c=>c.point!.reason)?'One or more counterparts have gaps or retained readings':''),value:Math.expm1(log)*100,coverage:7,
        from:first.from,through:first.through,checkedAt:Math.min(...available.map(c=>c.point!.checkedAt!))})
    }
    const checks=[...points.values()].flatMap(p=>p.checkedAt==null?[]:[p.checkedAt])
    return {id,label:`${currency} basket`,group,checkedAt:checks.length?Math.min(...checks):null,points}
  })
}
export function eventChangesText(rows:HeatmapRow[], window:EventWindow, fields:readonly HeatmapField[], format:'summary'|'candles',groupOrder:string[],observedAt:number) {
  const periods=eventPeriods(window,observedAt*1000).filter(p=>!p.future&&(format==='summary'?p.day==='window':p.day!=='window'))
  const sections=periods.flatMap(period=>{
    const groups=orderHeatmapGroups(rows.map(r=>r.group),groupOrder).flatMap(group=>{
      const entries=rows.filter(r=>r.group===group&&r.points.get(period.day)?.value!=null).sort((a,b)=>b.points.get(period.day)!.value!-a.points.get(period.day)!.value!)
      return entries.length?[group+'\n'+entries.map(row=>{const point=row.points.get(period.day)!;return `${row.label} ${formatHeatmapOHLC(point,fields)} · Baseline ${jakartaTime(Date.parse(point.from!))} · Through ${jakartaTime(Date.parse(point.through!))}${point.reason?' · '+point.reason:''}`}).join('\n')]:[]
    })
    return groups.length?[`${period.day==='window'?'Window summary':jakartaTime(Date.parse(period.day))+' → '+jakartaTime(Date.parse(period.end))}${period.partial?' · In progress':''}\n\n${groups.join('\n\n')}`]:[]
  })
  return sections.length?[`Event-window market behaviour · ${jakartaTime(window.from)} → ${jakartaTime(window.through)} · ${window.minutes}-minute candles`,
    `Common anchor ${jakartaTime(window.anchor)}. Each instrument uses its last completed M1 close at or before the anchor; actual baseline/end times are listed. All O/H/L/C percentages use that same instrument baseline throughout the window. Candles aggregate broker M1 prices in intervals anchored to From; Through is exclusive. Gaps are disclosed. Synthetic baskets have C only and require seven matching endpoints.`,
    `History response checked ${jakartaTime(observedAt*1000)}; this is not a last-tick timestamp. Historical reaction data does not establish a current opportunity.`,...sections].join('\n\n'):''
}
