import type { R1Analysis, R1Assessment, R1Family, R1Input, R1Schedule } from './contracts'
import { r1Family, r1Families, r1Profiles } from './profiles'
import { createR1History, reference } from './features'
import { assessR1, prepareR1Features, readingVariants } from './assessment'
import { aggregateSensitivity, combineR1, r1Freshness } from './relationships'
import { r1Observation } from './vintages'

export function calculateR1(input:R1Input):R1Analysis {
  const family=r1Family(input.release.familyId)
  if(!family||input.release.currency!=='USD'||input.release.country!=='US')throw new Error('R1 supports numeric US/USD families only.')
  const history=createR1History(input.events),at=input.asOf??input.release.releaseAt??0
  const prepared=new Map(r1Families.map(f=>[f,prepareR1Features(history,r1Profiles[f])]))
  const originalRelease=history.releases.find(r=>r.id===input.release.id)??input.release
  const assessment=assessR1(originalRelease,r1Profiles[family],history,input.settings.calibration,input.savedBands,false,prepared.get(family))
  const assessments=new Map<R1Family,R1Assessment>()
  for(const f of input.settings.selected){
    const candidates=prepared.get(f)!.filter(e=>e.release.releaseAt!<=at)
    // Choose the newest declared period before inspecting completeness or sign.
    const period=(e:typeof candidates[number])=>Math.max(-Infinity,...r1Profiles[f].components.flatMap(c=>e.release.events.filter(row=>row.event_id===c.seriesId).map(row=>reference(r1Observation(row,at).row??row,c.period)??-Infinity)))
    const entry=candidates.sort((a,b)=>period(b)-period(a)||b.release.releaseAt!-a.release.releaseAt!)[0]
    if(!entry)continue
    const momentum=f==='gdp'
    assessments.set(f,entry.release.id===input.release.id&&!momentum&&at===input.release.releaseAt?assessment:assessR1(entry.release,r1Profiles[f],history,input.settings.calibration,input.savedBands,momentum,momentum?undefined:prepared.get(f),at))
  }
  const schedules:R1Schedule[]=[...(input.schedules??[])]
  const slots=input.settings.selected.map(f=>r1Freshness(f,assessments.get(f)??null,at,schedules))
  const alternatives=Object.fromEntries([...assessments].map(([f,a])=>[f,readingVariants(a,r1Profiles[f])]))
  const overall=aggregateSensitivity(combineR1(slots,input.settings.selected,at),input.settings,alternatives)
  overall.timingSensitive=[0,72].some(grace=>combineR1(input.settings.selected.map(f=>r1Freshness(f,assessments.get(f)??null,at,schedules,grace)),input.settings.selected,at).direction!==overall.direction)
  return{assessment,overall}
}
