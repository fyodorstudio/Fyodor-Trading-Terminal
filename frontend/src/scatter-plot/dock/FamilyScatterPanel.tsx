import { useCallback, useMemo, useRef, useState } from 'react'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { ScatterPlotControls } from '../controls/ScatterPlotControls'
import { MagnitudeScatterPlot } from '../plot/MagnitudeScatterPlot'
import { MagnitudeCalculationDetails } from '../inspection/MagnitudeCalculationDetails'
import { useFamilyScatterData } from './useFamilyScatterData'
import { ScatterPlotAppearanceSettings } from '../settings/ScatterPlotAppearanceSettings'
import { useScatterAppearance, saveScatterAppearance, magnitudeBandGuideStyles, withMagnitudeBandColor } from '../settings/scatter-plot-appearance'
import { MagnitudeBoundaryEditor } from '../settings/MagnitudeBoundaryEditor'
import { magnitudeConfiguration, useMagnitudeSettings, type MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import type { ScatterPlotDockProps, ScatterModel, ScatterOption } from '../contracts/scatter-plot-types'
import type { MagnitudeFamily } from '../../inspector/magnitude/magnitude-families'
import type { StoredCalendarEvent } from '../../inspector/useStoredCalendar'
import { magnitudeDistribution, type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'

export type ScatterFamilyBinding = {
  family: MagnitudeFamily
  scope: { pair: ScatterOption; side: ScatterOption; family: ScatterOption; series: ScatterOption[] }
  model: (events: StoredCalendarEvent[], now: number, seriesId: string, releaseId: string | null, settings: MagnitudeSettings) => ScatterModel
}

export function FamilyScatterPanel({ brokerId, clockOffsetMs = 0, binding, familyOptions, onFamilyChange }:
  ScatterPlotDockProps & { binding: ScatterFamilyBinding; familyOptions: ScatterOption[]; onFamilyChange: (id: string) => void }) {
  const { scope, family } = binding
  const now = useCalendarNow(clockOffsetMs)
  const [seriesId, setSeriesId] = useState(scope.series[0].id)
  const [selection, setSelection] = useState<{ broker: string | null; releaseId: string | null }>({ broker: brokerId, releaseId: null })
  // Reset with the source change, including a return to a previously inspected broker.
  if (selection.broker !== brokerId) setSelection({ broker: brokerId, releaseId: null })
  const [zoom, setZoom] = useState(true)
  const [preview, setPreview] = useState<{ scope: string; limits: MagnitudeLimits | null }>({ scope: '', limits: null })
  const appearance = useScatterAppearance()
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const appearanceButton = useRef<HTMLButtonElement>(null)
  const closeAppearance = useCallback(() => { setAppearanceOpen(false); appearanceButton.current?.focus() }, [])
  const changeAppearance = saveScatterAppearance
  const storage = useFamilyScatterData(brokerId, now, family)
  const magnitudeSettings = useMagnitudeSettings(family.settings)
  const selectedReleaseId = selection.broker === brokerId ? selection.releaseId : null
  const savedModel = useMemo(() => binding.model(storage.events, now, seriesId, selectedReleaseId, magnitudeSettings), [storage.events, now, seriesId, selectedReleaseId, magnitudeSettings, binding])
  const config = magnitudeConfiguration(magnitudeSettings, seriesId)
  const editorScope = JSON.stringify([brokerId, seriesId, savedModel.inspection?.releaseId, config.mode, config.limits])
  // Scope changes discard a preview, including a return to a previously edited
  // series/release. New sample data in the same scope preserves the draft.
  if (preview.scope !== editorScope) setPreview({ scope: editorScope, limits: null })
  const previewLimits = preview.scope === editorScope ? preview.limits : null
  const customLimits = previewLimits ?? config.limits
  const model = useMemo(() => !previewLimits || !savedModel.inspection ? savedModel : {
    ...savedModel, inspection: { ...savedModel.inspection, magnitudeMode: 'custom' as const,
      distribution: magnitudeDistribution(savedModel.inspection.samples.map((point) => point.delta), savedModel.inspection.delta, previewLimits) },
  }, [savedModel, previewLimits])
  const magnitudeUndefined = !customLimits
  const clearPreview = () => setPreview({ scope: editorScope, limits: null })
  const message = storage.message ?? (!model.inspection ? `No completed ${family.label} release available` : null)
  return <section className="scatter-plot-dock" aria-label="Scatter Plot">
    <ScatterPlotControls scope={scope} seriesId={seriesId} onSeriesChange={(id) => { setSeriesId(id); setZoom(true) }} zoom={zoom && !magnitudeUndefined}
      onZoomChange={setZoom} onLatest={() => setSelection({ broker: brokerId, releaseId: null })}
      familyOptions={familyOptions} onFamilyChange={onFamilyChange} magnitudeUndefined={magnitudeUndefined}
      appearanceOpen={appearanceOpen} onAppearance={() => setAppearanceOpen((open) => !open)} appearanceButtonRef={appearanceButton} />
    {appearanceOpen && <ScatterPlotAppearanceSettings appearance={appearance} customLimits={customLimits} onChange={changeAppearance} onClose={closeAppearance} />}
    {message ? <p className="scatter-plot-status" role="status" title={storage.error ?? undefined}>{message}</p> : <>
      {storage.partial && <span className="scatter-plot-coverage" role="status">Partial history</span>}
      <div className="scatter-plot-body">
        <MagnitudeScatterPlot model={model} zoom={zoom && !magnitudeUndefined} appearance={appearance} viewKey={JSON.stringify([scope.pair.id, scope.side.id, scope.family.id, brokerId, seriesId, magnitudeUndefined])} onInspect={(releaseId) => setSelection({ broker: brokerId, releaseId })} />
        <MagnitudeCalculationDetails model={model} preview={!!previewLimits} seriesLabel={scope.series.find((series) => series.id === seriesId)!.label}>
          <MagnitudeBoundaryEditor key={editorScope}
            limits={config.limits ?? null} custom={!!config.limits}
            unit={model.deltaUnit}
            bandColors={magnitudeBandGuideStyles(appearance, true).map((level) => level.color)}
            onBandColorChange={(index, color) => changeAppearance(withMagnitudeBandColor(appearance, index, color, true))}
            onPreview={(limits) => setPreview({ scope: editorScope, limits })}
            mode={config.mode} onModeChange={() => { clearPreview(); family.settings.save(seriesId, null); setZoom(true) }}
            onApply={(limits) => { family.settings.save(seriesId, limits); clearPreview() }}
            onReset={() => { clearPreview(); family.settings.save(seriesId, null); setZoom(true) }} />
        </MagnitudeCalculationDetails>
      </div>
    </>}
  </section>
}
