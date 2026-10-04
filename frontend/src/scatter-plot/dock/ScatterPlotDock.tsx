import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScatterPlotControls } from '../controls/ScatterPlotControls'
import { MagnitudeScatterPlot } from '../plot/MagnitudeScatterPlot'
import { MagnitudeCalculationDetails } from '../inspection/MagnitudeCalculationDetails'
import { nfpScatterScope } from '../PAIR/EURUSD/USD/NFP/nfp-scatter-config'
import { nfpScatterModel } from '../PAIR/EURUSD/USD/NFP/nfp-scatter-adapter'
import { useNfpScatterData } from '../PAIR/EURUSD/USD/NFP/useNfpScatterData'
import { ScatterPlotAppearanceSettings } from '../settings/ScatterPlotAppearanceSettings'
import { readScatterAppearance, saveScatterAppearance, type ScatterAppearance } from '../settings/scatter-plot-appearance'
import './scatter-plot-dock.css'

export function ScatterPlotDock({ brokerId, clockOffsetMs = 0 }: { brokerId: string | null; clockOffsetMs?: number }) {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  useEffect(() => {
    const update = () => setNow(Date.now() + clockOffsetMs)
    update()
    const timer = window.setInterval(update, 10000)
    return () => window.clearInterval(timer)
  }, [clockOffsetMs])
  const [seriesId, setSeriesId] = useState(nfpScatterScope.series[0].id)
  const [selection, setSelection] = useState<{ broker: string | null; releaseId: string | null }>({ broker: brokerId, releaseId: null })
  // Reset with the source change, including a return to a previously inspected broker.
  if (selection.broker !== brokerId) setSelection({ broker: brokerId, releaseId: null })
  const [zoom, setZoom] = useState(false)
  const [appearance, setAppearance] = useState(readScatterAppearance)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const appearanceButton = useRef<HTMLButtonElement>(null)
  const closeAppearance = useCallback(() => { setAppearanceOpen(false); appearanceButton.current?.focus() }, [])
  const changeAppearance = useCallback((next: ScatterAppearance) => { setAppearance(next); saveScatterAppearance(next) }, [])
  const storage = useNfpScatterData(brokerId, now)
  const selectedReleaseId = selection.broker === brokerId ? selection.releaseId : null
  const model = useMemo(() => nfpScatterModel(storage.events, now, seriesId, selectedReleaseId), [storage.events, now, seriesId, selectedReleaseId])
  const message = storage.message ?? (!model.inspection ? 'No completed NFP release available' : null)
  return <section className="scatter-plot-dock" aria-label="Scatter Plot">
    <ScatterPlotControls scope={nfpScatterScope} seriesId={seriesId} onSeriesChange={setSeriesId} zoom={zoom}
      onZoomChange={setZoom} onLatest={() => setSelection({ broker: brokerId, releaseId: null })}
      appearanceOpen={appearanceOpen} onAppearance={() => setAppearanceOpen((open) => !open)} appearanceButtonRef={appearanceButton} />
    {appearanceOpen && <ScatterPlotAppearanceSettings appearance={appearance} onChange={changeAppearance} onClose={closeAppearance} />}
    {message ? <p className="scatter-plot-status" role="status" title={storage.error ?? undefined}>{message}</p> : <>
      {storage.partial && <span className="scatter-plot-coverage" role="status">Partial history</span>}
      <div className="scatter-plot-body">
        <MagnitudeScatterPlot model={model} zoom={zoom} appearance={appearance} viewKey={`${brokerId}/${seriesId}`} onInspect={(releaseId) => setSelection({ broker: brokerId, releaseId })} />
        <MagnitudeCalculationDetails model={model} seriesLabel={nfpScatterScope.series.find((series) => series.id === seriesId)!.label} />
      </div>
    </>}
  </section>
}
