import { formatAppTimestamp, type TimeDisplayPreference } from '../../../../../../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { supportsIsmV2 } from '../assessment/ism-score-v2'
import { useIsmAnalysis, type IsmAnalysisProps } from '../runtime/useIsmAnalysis'
import { IsmContextSummary } from './components/IsmContextSummary'
import { IsmPublicationSnapshots } from './components/IsmPublicationSnapshots'
import { IsmComponentTable } from './components/IsmComponentTable'
import { IsmScoringNotes } from './components/IsmScoringNotes'

export type IsmScoreProps = IsmAnalysisProps & { timeDisplay?: TimeDisplayPreference; onOpenScatter?: (release: InspectorRelease) => void }
export function IsmScoreView({ version, timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter, ...props }: IsmScoreProps & { version: 2 | 3 }) {
  const { analysis, storage, loading, error } = useIsmAnalysis(props)
  if (!supportsIsmV2(props.release)) return null
  const timestamp = (at: number | null) => at === null ? 'Time unavailable' : formatAppTimestamp(at, timeDisplay)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-ism-v2" aria-label="ISM monthly context scoring system">
    <p aria-label="ISM context identity">{analysis?.latest?.contextId ?? props.release?.id ?? 'Reference month unavailable'}</p>
    <IsmContextSummary analysis={analysis} loading={loading} error={error} version={version} timestamp={timestamp} />
    {error && <p role="alert">{error}</p>}
    {storage.error && <p role="alert">ISM history: {storage.error}</p>}
    {analysis && <>
      {version === 2 && <IsmPublicationSnapshots snapshots={analysis.snapshots} loading={loading} timestamp={timestamp} />}
      <IsmComponentTable snapshots={analysis.snapshots} loading={loading} timestamp={timestamp} onOpenScatter={onOpenScatter} version={version} />
    </>}
    <IsmScoringNotes />
    {Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0) && <p>Partial calendar coverage; context and calibration use the available observations.</p>}
  </div>
}
