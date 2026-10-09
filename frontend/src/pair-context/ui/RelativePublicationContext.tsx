import type { InspectorRelease, InspectorEvent } from '../../inspector/inspector-data'
import type { ReactNode } from 'react'
type RelativeProps = { release: InspectorRelease | null; brokerId?: string | null; events?: readonly InspectorEvent[]; now?: number; controls?: ReactNode }
import { useRelativePreferences } from '../storage/relative-preferences'
import { useEurContextTimeline } from '../runtime/useEurContextTimeline'
import { usePublicationContext } from '../../usd-context/runtime/usePublicationContext'
import { relativeContext, eurContextAt } from '../core/relative-context'
import { RelativeContextDetails } from './RelativeContextDetails'
export function RelativePublicationContext(props:RelativeProps){
  const preferences=useRelativePreferences()
  return preferences.mode==='relative' && props.release ? <RelativePublication {...props}/> : null
}
function RelativePublication(props:RelativeProps){
  const preferences=useRelativePreferences(), usd=usePublicationContext(props.release!,props.brokerId,props.events,props.now)
  const eur=useEurContextTimeline(props.brokerId??null,preferences.families,props.now??0,true,props.events)
  const point=usd.at===null || !eur.result?null:eurContextAt(eur.result,usd.at)
  const result=relativeContext(point,usd.after),loading=usd.context.loading || eur.loading
  const error=usd.context.error ?? eur.error, ready=usd.eligible && !loading && !error
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Relative context at publication">
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${ready?result.direction:'uncomputed'}`}>{ready?result.label:'Uncomputed'}</strong>{ready && result.strength && <span>{result.strength} relative context evidence</span>}</div>
    {props.controls}
    <h3>Relative EUR / USD context at publication</h3>
    <p>{loading?'Calculating relative context…':error ?? (!usd.eligible?'A verified, already published chart time is required.':result.explanation)}</p>
    {(eur.storage.error || usd.context.storage.error) && <p role="alert">{eur.storage.error ?? usd.context.storage.error}</p>}
    <RelativeContextDetails eur={ready?point:null} usd={ready?usd.after:null} loading={loading} supported showSelector={!props.controls}/>
  </section>
}
