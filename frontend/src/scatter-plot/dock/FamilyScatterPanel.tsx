import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScatterPlotControls } from '../controls/ScatterPlotControls'
import { MagnitudeScatterPlot } from '../plot/MagnitudeScatterPlot'
import { MagnitudeCalculationDetails } from '../inspection/MagnitudeCalculationDetails'
import { useFamilyScatterData } from './useFamilyScatterData'
import { ScatterPlotAppearanceSettings } from '../settings/ScatterPlotAppearanceSettings'
import { readScatterAppearance, saveScatterAppearance, magnitudeBandGuideStyles, withMagnitudeBandColor, type ScatterAppearance } from '../settings/scatter-plot-appearance'
import { MagnitudeBoundaryEditor } from '../settings/MagnitudeBoundaryEditor'
import { magnitudeConfiguration, useMagnitudeSettings, type MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import type { ScatterPlotDockProps, ScatterModel, ScatterOption } from '../contracts/scatter-plot-types'
import type { MagnitudeFamily } from '../../inspector/magnitude/magnitude-families'
import type { StoredCalendarEvent } from '../../inspector/useStoredCalendar'

export type ScatterFamilyBinding = {
  family: MagnitudeFamily
  scope: { pair: ScatterOption; side: ScatterOption; family: ScatterOption; series: ScatterOption[] }
  model: (events: StoredCalendarEvent[], now: number, seriesId: string, releaseId: string | null, settings: MagnitudeSettings) => ScatterModel
}

export function FamilyScatterPanel({ brokerId, clockOffsetMs = 0, binding, familyOptions, onFamilyChange }:
  ScatterPlotDockProps & { binding: ScatterFamilyBinding; familyOptions: ScatterOption[]; onFamilyChange: (id: string) => void }) {
  const { scope, family } = binding
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  useEffect(() => {
    const update = () => setNow(Date.now() + clockOffsetMs)
    update()
    const timer = window.setInterval(update, 10000)
    return () => window.clearInterval(timer)
  }, [clockOffsetMs])
  const [seriesId, setSeriesId] = useState(scope.series[0].id)
  const [selection, setSelection] = useState<{ broker: string | null; releaseId: string | null }>({ broker: brokerId, releaseId: null })
  // Reset with the source change, including a return to a previously inspected broker.
  if (selection.broker !== brokerId) setSelection({ broker: brokerId, releaseId: null })
  const [zoom, setZoom] = useState(false)
  const [appearance, setAppearance] = useState(readScatterAppearance)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const appearanceButton = useRef<HTMLButtonElement>(null)
  const closeAppearance = useCallback(() => { setAppearanceOpen(false); appearanceButton.current?.focus() }, [])
  const changeAppearance = useCallback((next: ScatterAppearance) => { setAppearance(next); saveScatterAppearance(next) }, [])
  const storage = useFamilyScatterData(brokerId, now, family)
  const magnitudeSettings = useMagnitudeSettings(family.settings)
  const selectedReleaseId = selection.broker === brokerId ? selection.releaseId : null
  const model = useMemo(() => binding.model(storage.events, now, seriesId, selectedReleaseId, magnitudeSettings), [storage.events, now, seriesId, selectedReleaseId, magnitudeSettings, binding])
  const config = magnitudeConfiguration(magnitudeSettings, seriesId)
  const customLimits = config.limits
  const message = storage.message ?? (!model.inspection ? `No completed ${family.label} release available` : null)
  return <section className="scatter-plot-dock" aria-label="Scatter Plot">
    <ScatterPlotControls scope={scope} seriesId={seriesId} onSeriesChange={(id) => { setSeriesId(id); setZoom(false) }} zoom={zoom && config.mode !== 'undefined'}
      onZoomChange={setZoom} onLatest={() => setSelection({ broker: brokerId, releaseId: null })}
      familyOptions={familyOptions} onFamilyChange={onFamilyChange} magnitudeUndefined={config.mode === 'undefined'}
      customMagnitude={!!customLimits} appearanceOpen={appearanceOpen} onAppearance={() => setAppearanceOpen((open) => !open)} appearanceButtonRef={appearanceButton} />
    {appearanceOpen && <ScatterPlotAppearanceSettings appearance={appearance} customLimits={customLimits} onChange={changeAppearance} onClose={closeAppearance} />}
    {message ? <p className="scatter-plot-status" role="status" title={storage.error ?? undefined}>{message}</p> : <>
      {storage.partial && <span className="scatter-plot-coverage" role="status">Partial history</span>}
      <div className="scatter-plot-body">
        <MagnitudeScatterPlot model={model} zoom={zoom && config.mode !== 'undefined'} appearance={appearance} viewKey={JSON.stringify([scope.pair.id, scope.side.id, scope.family.id, brokerId, seriesId, config.mode])} onInspect={(releaseId) => setSelection({ broker: brokerId, releaseId })} />
        <MagnitudeCalculationDetails model={model} seriesLabel={scope.series.find((series) => series.id === seriesId)!.label}>
          <MagnitudeBoundaryEditor key={JSON.stringify([brokerId, seriesId, model.inspection?.releaseId, config.mode, customLimits])}
            limits={customLimits ?? model.inspection?.distribution?.limits ?? null} custom={!!customLimits}
            unit={model.deltaUnit}
            bandColors={magnitudeBandGuideStyles(appearance, !!customLimits).map((level) => level.color)}
            onBandColorChange={(index, color) => changeAppearance(withMagnitudeBandColor(appearance, index, color, !!customLimits))}
            mode={config.mode} onModeChange={(mode) => { family.settings.save(seriesId, mode === 'undefined' ? null : 'p95'); setZoom(false) }}
            onApply={(limits) => family.settings.save(seriesId, limits)} onReset={() => { family.settings.save(seriesId, null); setZoom(false) }} />
        </MagnitudeCalculationDetails>
      </div>
    </>}
  </section>
}
