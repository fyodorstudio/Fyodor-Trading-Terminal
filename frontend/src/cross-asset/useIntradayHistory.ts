import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { validIntraday, type EventWindow, type IntradayHistory } from './event-window'

export function useIntradayHistory(broker:string|null,generation:number,names:string,window:EventWindow|null,attempt:number,enabled:boolean) {
  const key=window?`${broker}:${generation}:${window.from}:${window.through}`:''
  const cache=useRef(new Map<string,IntradayHistory>())
  const [state,setState]=useState<{key:string;data:IntradayHistory|null;error:string|null}>({key:'',data:null,error:null})
  const retry=useRef(attempt)
  useLayoutEffect(()=>{setState(old=>old.key===key?old:{key,data:cache.current.get(key)??null,error:null})},[key])
  useEffect(()=>{
    if(!enabled||!window||!names||broker!=='Pepperstone-Demo')return
    const selected=names.split('\0'),from=window.from,through=window.through
    let disposed=false,timer=0,timeout=0,controller:AbortController|undefined,current=cache.current.get(key)??null,force=retry.current!==attempt
    retry.current=attempt
    async function pollIntraday(){
      controller=new AbortController();timeout=globalThis.window.setTimeout(()=>controller?.abort(),22000)
      try{
        const missing=selected.filter(s=>!current?.symbols[s]),requested=force||!missing.length?selected:missing
        const response=await fetch('/storage-api/cross-asset/intraday',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
          body:JSON.stringify({source_id:broker,generation,symbols:requested,from_utc:from/1000,through_utc:through/1000,retry:force})})
        force=false
        if(!response.ok)throw new Error(`Intraday history unavailable (HTTP ${response.status}). Check the connection and retry.`)
        const data:unknown=await response.json()
        if(controller.signal.aborted)throw new Error('Intraday history request timed out.')
        if(!validIntraday(data,broker!,generation,window!))throw new Error('Intraday response does not match this source/window.')
        if(disposed)return
        current={...data,symbols:{...current?.symbols,...data.symbols}}
        current.symbols=Object.fromEntries(selected.flatMap(s=>current!.symbols[s]?[[s,current!.symbols[s]]]:[]))
        cache.current.delete(key);cache.current.set(key,current)
        while(cache.current.size>4)cache.current.delete(cache.current.keys().next().value!)
        setState({key,data:current,error:null})
        timer=globalThis.window.setTimeout(pollIntraday,data.pending||selected.some(s=>!current?.symbols[s])?1000:20000)
      }catch(error){if(!disposed){setState({key,data:current,error:error instanceof Error?error.message:'Intraday history unavailable'});timer=globalThis.window.setTimeout(pollIntraday,20000)}}
      finally{globalThis.window.clearTimeout(timeout)}
    }
    void pollIntraday()
    return()=>{disposed=true;controller?.abort();globalThis.window.clearTimeout(timer);globalThis.window.clearTimeout(timeout)}
  },[broker,generation,names,key,window,attempt,enabled])
  return state.key===key?state:{key,data:null,error:null}
}
