import type { ScatterOption } from '../contracts/scatter-plot-types'
import type { Ref } from 'react'

export function ScatterPlotControls({ scope, seriesId, onSeriesChange, zoom, onZoomChange, onLatest, appearanceOpen, onAppearance, appearanceButtonRef,
  familyOptions, onFamilyChange, magnitudeUndefined = false, allHistory = false, onHistoryChange }: {
  scope: { pair: ScatterOption; side: ScatterOption; family: ScatterOption; series: ScatterOption[] }
  seriesId: string; onSeriesChange: (id: string) => void
  zoom: boolean; onZoomChange: (zoom: boolean) => void; onLatest: () => void
  appearanceOpen: boolean; onAppearance: () => void; appearanceButtonRef?: Ref<HTMLButtonElement>
  familyOptions?: ScatterOption[]; onFamilyChange?: (family: string) => void; magnitudeUndefined?: boolean
  allHistory?: boolean; onHistoryChange?: () => void
}) {
  return <div className="scatter-plot-controls">
    {([['Pair', scope.pair], ['Base/Quote', scope.side], ['Family', scope.family]] as const).map(([label, option]) =>
      <label key={label}>{label}<select aria-label={`Scatter Plot ${label}`} value={option.id}
        onChange={(event) => { if (label === 'Family') onFamilyChange?.(event.target.value) }}>
        {(label === 'Family' && familyOptions ? familyOptions : [option]).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>)}
    <label>Series<select aria-label="Scatter Plot Series" value={seriesId} onChange={(event) => onSeriesChange(event.target.value)}>
      {scope.series.map((series) => <option key={series.id} value={series.id}>{series.label}</option>)}
    </select></label>
    <div className="scatter-plot-actions">
      <button type="button" onClick={onLatest}>Latest release</button>
      {onHistoryChange && <button type="button" title="Date window only. Recent shows the selected release and up to 12 predecessors; calculation N always uses all history."
        onClick={onHistoryChange}>{allHistory ? 'Recent releases' : 'All history'}</button>}
      <button type="button" disabled={magnitudeUndefined} aria-pressed={zoom} onClick={() => onZoomChange(!zoom)}>{zoom ? 'Full range' : 'Boundary zoom'}</button>
      <button ref={appearanceButtonRef} type="button" aria-haspopup="dialog" aria-expanded={appearanceOpen} onClick={onAppearance}>Appearance</button>
    </div>
  </div>
}
