import { formatAppTimestamp, type TimeDisplayPreference } from '../../../../../../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { supportsIsmScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-monthly-context'
import { useIsmAnalysis, type IsmAnalysisProps } from '../runtime/useIsmAnalysis'
import { IsmContextSummary } from './components/IsmContextSummary'
import { IsmComponentTable } from './components/IsmComponentTable'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'

export type IsmScoreProps = IsmAnalysisProps & { timeDisplay?: TimeDisplayPreference; onOpenScatter?: (release: InspectorRelease) => void }
export function IsmScoreView({ timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter, ...props }: IsmScoreProps) {
  const { analysis, storage, loading, error } = useIsmAnalysis(props)
  if (!supportsIsmScore(props.release)) return null
  const timestamp = (at: number | null) => at === null ? 'Time unavailable' : formatAppTimestamp(at, timeDisplay)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-ism-v3" aria-label="ISM monthly context scoring system" data-context-id={analysis?.latest?.contextId ?? props.release?.id}>
    <IsmContextSummary analysis={analysis} loading={loading} error={error} timestamp={timestamp} />
    {error && <p role="alert">{error}</p>}
    {storage.error && <p role="alert">ISM history: {storage.error}</p>}
    {analysis && <ScoringSection title="What drove the result"><IsmComponentTable snapshots={analysis.snapshots} loading={loading} timestamp={timestamp} onOpenScatter={onOpenScatter} /></ScoringSection>}
    {Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0) && <p>Partial calendar coverage; context and calibration use the available observations.</p>}
  </div>
}
