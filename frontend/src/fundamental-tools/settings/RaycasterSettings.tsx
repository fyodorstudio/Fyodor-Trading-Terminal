import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { useRaycasterFamilies, toggleRaycasterFamily } from '../../raycaster/storage/raycaster-family-settings'
import { useRelativePreferences } from '../../pair-context/storage/relative-preferences'
import { relativeContext } from '../../pair-context/core/relative-context'
import { RelativeContextDetails } from '../../pair-context/ui/RelativeContextDetails'
import { ContextInputTable } from '../../usd-context/ui/ContextInputTable'
import { ContextPolicyDetails } from '../../usd-context/ui/ContextPolicyDetails'
import { FreshNewsSummary } from '../../usd-context/sequences/ui/FreshNewsSummary'
import { useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { RaycasterNotes } from '../../raycaster/ui/RaycasterNotes'
import { raycasterLabel } from '../../raycaster/ui/raycaster-label'
import { inspectionSignature, type ToolInspection } from '../runtime/inspection-session'
import { usdContextPresentation, usdPresentationVersion } from '../../raycaster/core/usd-context-presentation'
import { UsdSupportDetails } from '../../raycaster/ui/UsdSupportDetails'

export function RaycasterSettings({ inspection, symbol, supported, relativeSupported, timeDisplay }: {
  inspection: ToolInspection | null; symbol: string; supported: boolean; relativeSupported: boolean; timeDisplay: TimeDisplayPreference
}) {
  const families = useRaycasterFamilies(), relative = useRelativePreferences(), sequences = useSequencePreferences()
  const ready = inspection?.signature === inspectionSignature(families, relative.mode, relative.families) ? inspection : null
  const point = ready?.usd, result = point?.result ?? null, loading = ready?.loading ?? false
  const combined = relativeSupported && relative.mode === 'relative' ? relativeContext(ready?.eur ?? null, point ?? null) : null
  const presentation = combined ? null : usdContextPresentation(symbol, result, ready?.cutoff ?? undefined)
  const label = raycasterLabel({ loading, message: ready?.message ?? null, cutoff: ready?.cutoff ?? null, relative: combined, result, symbol })
  return <div className="raycaster-details">
    <p>Remembers the latest eligible release from each enabled family and combines its bias at the inspected candle’s end. Forecasts are excluded.</p>
    <section className="raycaster-section"><h3>Accumulated context</h3><strong>{supported ? label : 'Unsupported pair'}</strong>
      <p>{ready?.message ?? combined?.explanation ?? (ready?.cutoff != null ? presentation?.explanation : null) ?? 'Enable Raycaster and hover a candle to inspect its breakdown. Settings remain available with all views hidden.'}</p>
      {!combined && !loading && !ready?.message && ready?.cutoff != null && presentation && <>
        <small>{usdPresentationVersion}{presentation.evidence ? ` · ${presentation.evidence} evidence` : ''}</small>
        <UsdSupportDetails presentation={presentation} />
      </>}
      {ready?.held && <p role="status">Showing the last inspected candle while you use this popover.</p>}
    </section>
    <section className="raycaster-section" aria-label="Raycaster inputs and contributions"><h3>Inputs and contributions</h3>
      <RelativeContextDetails eur={ready?.eur ?? null} usd={point ?? null} loading={loading} supported={relativeSupported} showSelector={false} />
      <ContextInputTable families={families} onToggleFamily={toggleRaycasterFamily} result={result} symbol={symbol} loading={loading}
        unavailable={!supported || !!ready?.message} cutoff={ready?.cutoff ?? null} timeDisplay={timeDisplay} summaryLabel={label}
        summaryEvidence={presentation?.evidence}
        presentationNote={!combined ? 'USD presentation v1 requires 60% usable configured coverage. Opposing retained family votes show Conflicted with the weighted leading side; a lead below one-third net/gross separation stays Weak. Exact balance and unchanged evidence assert no lead. Publication panels and EUR-vs-USD retain their existing direction gates.' : undefined} />
      <p>Use Advanced settings to change inputs shared with Candy and publication scoring. Inspector’s marker filters do not affect this tool. Inflation shares 40%, labor 40%, activity 20%. ISM resolves both sectors as one vote.</p>
    </section>
    <section className="raycaster-section"><h3>Active relationships</h3>
      {!loading && !ready?.message && <ContextPolicyDetails policy={result?.policy} />}
      {!result?.policy && <p>Inspect a candle with available history to see applicable conditions.</p>}
    </section>
    {sequences.fresh && <FreshNewsSummary point={loading || ready?.message ? null : ready?.fresh ?? null} symbol={symbol} />}
    <RaycasterNotes relative={!!combined} />
  </div>
}
