import {useMemo} from 'react'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { calendarAdmissionTime } from '../../inspector/storage/calendar-admission-time'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { calculateR1History } from '../../scoring-system/r1/history'
import { r1Family,r1Profiles } from '../../scoring-system/r1/profiles'
import { saveR1Limits,useR1Bands,useR1Settings } from '../../scoring-system/r1/settings'
import type {MagnitudeLimits} from '../../inspector/magnitude/magnitude-distribution'
import {R1BoundaryEditor} from '../settings/R1BoundaryEditor'
import type { ScatterPlotDockProps } from '../contracts/scatter-plot-types'
import type { ScatterFamilyBinding } from './FamilyScatterPanel'
import { useFamilyScatterData } from './useFamilyScatterData'
import { r1ScatterModel } from '../inspection/r1-scatter-model'
import { MagnitudeScatterPlot } from '../plot/MagnitudeScatterPlot'
import { MagnitudeCalculationDetails } from '../inspection/MagnitudeCalculationDetails'
import { useScatterAppearance } from '../settings/scatter-plot-appearance'
import { openFundamentalSettings } from '../../fundamental-tools/runtime/settings-navigation'
import { scatterRecentWindow } from '../plot/scatter-recent-window'
import { useRetainedScatterState } from '../plot/useRetainedScatterState'
const createWorker=()=>new Worker(new URL('../../scoring-system/r1/history.worker.ts',import.meta.url),{type:'module'})
const emptyHistory:ReturnType<typeof calculateR1History>=[]
export function R1ScatterPanel({brokerId,clockOffsetMs=0,target,binding,onMeasureChange,familyOptions,onFamilyChange,viewState}:ScatterPlotDockProps&{binding:ScatterFamilyBinding;onMeasureChange:(m:'ap'|'signal'|'r1')=>void;familyOptions:{id:string;label:string}[];onFamilyChange:(id:string)=>void;viewState:Map<string,unknown>}) {
  const family=r1Family(binding.family.familyId)!,profile=r1Profiles[family],now=useCalendarNow(clockOffsetMs)
  const storage=useFamilyScatterData(brokerId,now,binding.family,true),settings=useR1Settings(),savedBands=useR1Bands(),appearance=useScatterAppearance()
  const [component,setComponent]=useRetainedScatterState(viewState,'r1-component',profile.components[0].id),[selected,setSelected]=useRetainedScatterState<string|null>(viewState,'r1-selection',target?.releaseId??null),[all,setAll]=useRetainedScatterState(viewState,'r1-history',false),[zoom,setZoom]=useRetainedScatterState(viewState,'r1-zoom',false)
  const at=calendarAdmissionTime(storage.events,now)
  const input=useMemo(()=>!storage.loading?{family,events:storage.events,at,calibration:settings.calibration,savedBands}:null,[family,storage.loading,storage.events,at,settings.calibration,savedBands])
  const result=useBackgroundCalculation(input,calculateR1History,createWorker),history=result.result??emptyHistory
  const savedModel=useMemo(()=>r1ScatterModel(history,component,selected),[history,component,selected])
  const chosen=history.find(a=>a.releaseId===savedModel.inspection?.releaseId),r=chosen?.readings.find(r=>r.id===component)
  const calibrationKey=`${family}/${component}${chosen?.stage==='revision'?'/revision':''}`,manual=settings.calibration.limits[calibrationKey]
  const scope=`${calibrationKey}/${JSON.stringify(settings.calibration)}/${JSON.stringify(savedBands[family])}`
  const [draft,setDraft]=useRetainedScatterState<{scope:string;limits:MagnitudeLimits|null}>(viewState,'r1-preview',{scope:'',limits:null})
  const preview=draft.scope===scope?draft.limits:null
  const model=useMemo(()=>preview?r1ScatterModel(history,component,selected,preview):savedModel,[history,component,selected,preview,savedModel])
  const apply=(limits:MagnitudeLimits|null)=>{saveR1Limits(calibrationKey,limits);setDraft({scope:'',limits:null})}
  const dateWindow=useMemo(()=>all||!model.inspection?undefined:scatterRecentWindow(model.points,model.inspection.at),[all,model])
  const previewPoints=model.inspection?.signal?.points
  const evidence=preview?(previewPoints==null||!r?null:previewPoints*r.weight):r?.contribution
  return <section className="scatter-plot-dock" aria-label="Scatter Plot"><div className="scatter-plot-controls">
    <label>Family<select aria-label="Scatter Plot Family" value={binding.scope.family.id} onChange={e=>onFamilyChange(e.target.value)}>{familyOptions.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
    <label>Calculation<select aria-label="Scatter Plot Calculation" value="r1" onChange={e=>onMeasureChange(e.target.value as 'ap'|'signal'|'r1')}><option value="ap">Raw change · Actual − Previous</option><option value="signal">Scorer comparison</option><option value="r1">USD R1 comparison</option></select></label>
    <label>Input<select aria-label="R1 Scatter input" value={component} onChange={e=>setComponent(e.target.value)}>{profile.components.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <button type="button" onClick={()=>setSelected(null)}>Latest release</button><button type="button" onClick={()=>setAll(!all)}>{all?'Recent releases':'All history'}</button><button type="button" onClick={()=>setZoom(!zoom)} disabled={!model.inspection?.distribution}>{zoom?'Full range':'Boundary zoom'}</button><button type="button" onClick={()=>openFundamentalSettings(family,'r1')}>Scoring settings</button>
  </div>{storage.message||result.loading||result.error?<p role="status">{storage.message??result.error??'Calculating R1 history…'}</p>:!model.inspection?<p role="status">Requested publication unavailable.</p>:<div className="scatter-plot-body"><MagnitudeScatterPlot model={model} zoom={zoom} appearance={appearance} dateWindow={dateWindow} dateResetKey={String(all)} viewState={viewState} viewStateKey="r1-viewport" viewKey={`r1/${brokerId}/${family}/${component}`} onInspect={setSelected}/><MagnitudeCalculationDetails r1 preview={!!preview} model={model} seriesLabel={r?.label??component}>
    <p>{preview?'Preview evidence':'R1 evidence'}: {evidence==null?'Unavailable':evidence.toLocaleString(undefined,{maximumFractionDigits:2})}.</p>
    {family==='claims'&&<p>Magnitude points: {previewPoints==null?'Unavailable':Math.abs(previewPoints).toLocaleString(undefined,{maximumFractionDigits:2})}.</p>}
    {r?.reason&&!(preview&&r.delta!==null)&&<p role="status">{r.reason}</p>}
    {r?.period==='action'?<p>25 bp per point, capped at four.</p>:r&&<R1BoundaryEditor key={scope} limits={r.limits} preview={preview} manual={!!manual} unit={r.unit} onPreview={limits=>setDraft({scope,limits})} onApply={apply} onReset={()=>apply(null)}/>}
    <details><summary>Input audit</summary><p>{chosen?.version} · {r?.calibration} · {r?.vintage?.replaceAll('-',' ')??'unavailable'}</p></details>
  </MagnitudeCalculationDetails></div>}</section>
}
