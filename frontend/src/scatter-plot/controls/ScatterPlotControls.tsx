import type { ScatterOption } from '../contracts/scatter-plot-types'
import type { Ref } from 'react'

export function ScatterPlotControls({ scope, seriesId, onSeriesChange, zoom, onZoomChange, onLatest, appearanceOpen, onAppearance, appearanceButtonRef,
  familyOptions, onFamilyChange, sideOptions, onSideChange, magnitudeUndefined = false, allHistory = false, onHistoryChange, measure, onMeasureChange }: {
  scope: { pair: ScatterOption; side: ScatterOption; family: ScatterOption; series: readonly ScatterOption[] }
  seriesId: string; onSeriesChange: (id: string) => void
  zoom: boolean; onZoomChange: (zoom: boolean) => void; onLatest: () => void
  appearanceOpen: boolean; onAppearance: () => void; appearanceButtonRef?: Ref<HTMLButtonElement>
  sideOptions?: ScatterOption[]; onSideChange?: (side: string) => void
  familyOptions?: ScatterOption[]; onFamilyChange?: (family: string) => void; magnitudeUndefined?: boolean
  allHistory?: boolean; onHistoryChange?: () => void
  measure?: 'ap' | 'signal'; onMeasureChange?: (measure: 'ap' | 'signal') => void
}) {
  return <div className="scatter-plot-controls">
    {([['Pair', scope.pair], ['Base/Quote', scope.side], ['Family', scope.family]] as const).map(([label, option]) =>
      <label key={label}>{label}<select aria-label={`Scatter Plot ${label}`} value={option.id}
        onChange={(event) => { if (label === 'Family') onFamilyChange?.(event.target.value); else if (label === 'Base/Quote') onSideChange?.(event.target.value) }}>
        {(label === 'Family' && familyOptions ? familyOptions : label === 'Base/Quote' && sideOptions ? sideOptions : [option]).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>)}
    {onMeasureChange && <label>Measure<select aria-label="Scatter Plot Measure" value={measure} onChange={(event) => onMeasureChange(event.target.value as 'ap' | 'signal')}>
      <option value="ap">Actual − Previous</option><option value="signal">Scoring signal</option>
    </select></label>}
    <label>{measure === 'signal' ? 'Signal' : 'Series'}<select aria-label={measure === 'signal' ? 'Scatter Plot Signal' : 'Scatter Plot Series'} value={seriesId} onChange={(event) => onSeriesChange(event.target.value)}>
      {scope.series.map((series) => <option key={series.id} value={series.id}>{series.label}</option>)}
    </select></label>
    <div className="scatter-plot-actions">
      <button type="button" onClick={onLatest}>Latest release</button>
      {onHistoryChange && <button type="button" title={measure === 'signal' ? 'Date window only. Scoring calibration always uses only publications earlier than the inspected release.' : 'Date window only. Recent shows the selected release and up to 12 predecessors; calculation N always uses all history.'}
        onClick={onHistoryChange}>{allHistory ? 'Recent releases' : 'All history'}</button>}
      <button type="button" disabled={magnitudeUndefined} aria-pressed={zoom} onClick={() => onZoomChange(!zoom)}>{zoom ? 'Full range' : 'Boundary zoom'}</button>
      <button ref={appearanceButtonRef} type="button" aria-haspopup="dialog" aria-expanded={appearanceOpen} onClick={onAppearance}>Appearance</button>
    </div>
  </div>
}
