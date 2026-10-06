import type { InspectorRelease } from '../../../../../inspector-data'
import { nativeNumber } from '../../../../shared/core/historical-release-signals'
import { observedEur } from './eur-history'
export const ecbRateSeries = ['999010006','999010007','999010015']
export function assessEcbRateAction(release: InspectorRelease|null) {
  if(!release || release.familyId!=='ecb' || release.currency!=='EUR' || release.country!=='EU') return null
  const readings=ecbRateSeries.map(id=>{
    const rows=release.events.filter(e=>e.event_id===id),row=rows[0]
    const valid=rows.length===1 && !release.timingUncertain && release.releaseAt!==null && observedEur(row) && row.release_at===release.releaseAt && row.unit===1 && row.multiplier===0
    const actual=valid?nativeNumber(row):null, revised=row?.revised_previous!=null || row?.revised_previous_raw_scaled_1e6!=null
    const previous=valid?nativeNumber(row,revised?'revised_previous':'previous'):null
    const delta=actual===null || previous===null?null:Math.round((actual-previous)*100*1e9)/1e9
    return {id,label:id==='999010006'?'Deposit facility':id==='999010007'?'Refinancing rate':'Marginal lending',actual,previous,delta}
  })
  const anchor=readings[0], signs=new Set(readings.flatMap(r=>r.delta===null?[]:[Math.sign(r.delta)]))
  const usable=anchor.delta!==null && signs.size===1
  const direction=!usable || anchor.delta===0?'uncomputed':anchor.delta!>0?'long':'short'
  return {readings,direction,label:direction==='long'?'EURUSD Long':direction==='short'?'EURUSD Short':'Uncomputed',
    action:!usable?'Rate action unavailable / inconsistent':anchor.delta===0?'Rate hold':anchor.delta!>0?'Rate increase':'Rate reduction',
    explanation:!usable?'A usable deposit rate and consistent available rate actions are required.':anchor.delta===0?
      'Unchanged rates supply no directional action vote. The economic context is shown separately.':
      `The deposit-rate ${anchor.delta!>0?'increase supports':'reduction weighs on'} EUR under the numerical action rule; this does not establish guidance.`,
    strength:direction==='uncomputed'?null:'weak'}
}
