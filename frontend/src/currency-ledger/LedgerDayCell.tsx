import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import type { DetailReading } from '../currency-details/detail-model'
import type { LedgerOccurrence } from './ledger-events'
import type { LedgerViewMemory } from './ledger-model'
import { LedgerValues } from './LedgerValues'

const stride=104,overscan=2
export const LedgerDayCell=memo(function LedgerDayCell({items,cellKey,broker,selected,position,memory,onInspect,now}:{
  items:readonly LedgerOccurrence[];cellKey:string;broker:string;selected:boolean;position:CSSProperties;memory:RefObject<LedgerViewMemory>
  onInspect:(reading:DetailReading,currency:string)=>void;now:number
}){
  const clock=useDisplayClock(),element=useRef<HTMLDivElement>(null),frame=useRef(0)
  const key=`${broker}:${cellKey}`
  const [range,setRange]=useState({first:0,last:6})
  const update=useCallback(()=>{
    const node=element.current;if(!node)return
    memory.current.cells.set(key,node.scrollTop)
    const first=Math.max(0,Math.floor(node.scrollTop/stride)-overscan)
    const last=Math.min(items.length,Math.ceil((node.scrollTop+(node.clientHeight||180))/stride)+overscan)
    setRange(old=>old.first===first&&old.last===last?old:{first,last})
  },[memory,key,items.length])
  const queue=useCallback(()=>{if(!frame.current)frame.current=window.requestAnimationFrame(()=>{frame.current=0;update()})},[update])
  useEffect(()=>{
    const node=element.current;if(!node)return
    let height=node.clientHeight
    const observer=new ResizeObserver(()=>{if(height!==node.clientHeight){height=node.clientHeight;queue()}})
    observer.observe(node)
    return()=>{observer.disconnect();window.cancelAnimationFrame(frame.current);frame.current=0}
  },[queue])
  useLayoutEffect(()=>{
    const node=element.current;if(!node)return
    node.scrollTop=memory.current.cells.get(key)??0;update()
    const store=memory.current
    return()=>{store.cells.set(key,node.scrollTop);window.cancelAnimationFrame(frame.current);frame.current=0}
  },[memory,key,update])
  return <div ref={element} data-ledger-cell={cellKey} className={`ledger-day-cell${selected?' selected':''}`} style={position}
    tabIndex={items.length?0:undefined} aria-label={`${cellKey} · ${items.length} events`}
    onScroll={queue}>
    <div className="ledger-event-stack" style={{height:Math.max(0,items.length*stride-4)}}>
      {items.slice(range.first,range.last).map(({metric,entry,revision,eventAt},offset)=><button type="button" key={metric.id+entry.value_id+entry.known_at+String(revision)}
        className="ledger-event" data-ledger-event={entry.value_id} style={{top:(range.first+offset)*stride}}
        title={`${entry.name} · ${metric.country??''} · ${metric.definition}${entry.value===null&&eventAt>now?' · Scheduled':''}`}
        onClick={()=>onInspect(entry,metric.currency)}>
        <span>{revision?'Captured correction':entry.at===null?'Date only':clock.utc(entry.at)}</span>
        <strong>{metric.id==='usd.rate'?'Fed target upper bound':metric.canonical===false?entry.name:metric.label}</strong>
        <LedgerValues entry={entry} unit={metric.unit}/>
      </button>)}
    </div>
  </div>
})
