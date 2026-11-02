import { useEffect, useState } from 'react'

export function CheckpointBell({ currency, at }: { currency: string; at: string | null }) {
  const key=currency+':'+at
  const [now,setNow]=useState(Date.now)
  const [result,setResult]=useState({key:'',label:'Checking bell…',detail:''})
  useEffect(() => {
    if (!at || Date.parse(at)<=Date.now()) return
    const controller=new AbortController()
    let busy=false
    const poll=async () => {
      if(busy)return
      busy=true
      setNow(Date.now())
      try {
        const response=await fetch('/alarm-api/alarms/checkpoint?'+new URLSearchParams({currency,at:String(Date.parse(at))}),{signal:controller.signal})
        if(!response.ok)throw Error('Alarm worker unavailable')
        const data=await response.json()
        if(typeof data.available!=='boolean' || typeof data.sound_enabled!=='boolean' || !Array.isArray(data.events)
          || !data.events.every((e: {title?: unknown;armed?: unknown;selected?: unknown})=>typeof e.title==='string' && typeof e.armed==='boolean' && typeof e.selected==='boolean'))throw Error('Invalid reminder status')
        if(controller.signal.aborted)return
        const armed=data.events.filter((e: {armed: boolean})=>e.armed)
        const label=Date.parse(at)<=Date.now() ? 'Past anchor' : !data.available ? 'Bell unavailable' : armed.length ? 'Bell armed'+(data.sound_enabled ? '' : ' · sound off') : 'Silent'
        const detail=armed.length ? 'Armed reminder at this currency/time: '+armed.map((e: {title: string})=>e.title).join('; ')
          : 'No armed reminder at this currency and publication time. A Thesis checkpoint alone does not arm a bell.'
        setResult(old=>old.key===key && old.label===label && old.detail===detail ? old : {key,label,detail})
      } catch {
        if(!controller.signal.aborted)setResult({key,label:'Bell unavailable',detail:'Could not verify reminder delivery. Check Alarm Settings.'})
      } finally {busy=false}
    }
    void poll()
    const timer=window.setInterval(()=>void poll(),10000)
    return ()=>{controller.abort();window.clearInterval(timer)}
  },[at,currency,key])
  const label=!at ? 'Silent · hour unknown' : Date.parse(at)<=now ? 'Past anchor' : result.key===key ? result.label : 'Checking bell…'
  return <span className="thesis-bell-status" role="status" title={result.key===key ? result.detail : 'Publication time and reminder status are separate from the research checkpoint.'}>{label}</span>
}
