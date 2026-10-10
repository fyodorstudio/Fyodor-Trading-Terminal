import {useEffect,useState} from 'react'

// Keep view choices while calculations unmount; inactive modes do no chart work.
export function useRetainedScatterState<T>(cache:Map<string,unknown>|undefined,key:string,initial:T) {
  const [value,setValue]=useState<T>(()=>cache?.has(key)?cache.get(key) as T:initial)
  useEffect(()=>{cache?.set(key,value)},[cache,key,value])
  return [value,setValue] as const
}
