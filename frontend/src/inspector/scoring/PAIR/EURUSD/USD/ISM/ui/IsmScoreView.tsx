import { formatAppTimestamp, type TimeDisplayPreference } from '../../../../../../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { supportsIsmScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-monthly-context'
import { useIsmAnalysis, type IsmAnalysisProps } from '../runtime/useIsmAnalysis'
import { IsmContextSummary } from './components/IsmContextSummary'
import { IsmComponentTable } from './components/IsmComponentTable'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'
import { useContext } from 'react'
import { ScoringSurface } from '../../../../../shared/ui/scoring-surface'
import { StandaloneScoreTable } from '../../../../../shared/ui/StandaloneScoreTable'
import { sectorLabel } from './presentation'
import { ismCalendarSource } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-publication-check'

export type IsmScoreProps = IsmAnalysisProps & { timeDisplay?: TimeDisplayPreference; onOpenScatter?: (release: InspectorRelease) => void }
export function IsmScoreView({ timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter, ...props }: IsmScoreProps) {
  const { analysis, storage, loading, error } = useIsmAnalysis(props)
  const plain = useContext(ScoringSurface) === 'standalone'
  if (!supportsIsmScore(props.release)) return null
  const timestamp = (at: number | null) => at === null ? 'Time unavailable' : formatAppTimestamp(at, timeDisplay)
  if (plain) return <StandaloneScoreTable assessment={analysis?.resolution ?? null} loading={loading} error={error}
    historyError={storage.error} partial={Object.values(storage.coverage).some(c => c.missing.length > 0)}
    label="ISM v3 components" directionLabel="ISM v3 final pair direction" tones={['Above comparison pace', 'Below comparison pace']}
    groups={analysis?.snapshots.map(({ sector, source, member }) => ({ id: sector,
      label: `${sectorLabel(sector)} · ${sector === 'services' ? 70 : 30}% of context`,
      note: <>{source ? timestamp(source.releaseAt) : 'Pending / unavailable'} · {member?.status ?? 'Pending'}
        {member?.issue && <span role="alert"> · {member.issue} <a href={ismCalendarSource} target="_blank" rel="noreferrer">Official ISM calendar</a></span>}
        {source && onOpenScatter && <button type="button" onClick={() => onOpenScatter(source)}>Inspect {sectorLabel(sector)} signals</button>}</>,
      rows: member?.assessment?.readings.map(row => {
        const combined = member.readings.find(r => r.id === `${sector}:${row.id}`)!
        return { ...row, id: combined.id, weight: combined.weight / 100, contribution: combined.contribution }
      }) ?? []
    }))} supporting={analysis?.snapshots.flatMap(({ sector, member }) => member?.assessment ? [{ id: sector, label: `${sectorLabel(sector)} headline`, text: member.assessment.headlineContext }] : [])} />
  return <div className="inspector-detail-overview inspector-scoring-view inspector-ism-v3" aria-label="ISM monthly context scoring system" data-context-id={analysis?.latest?.contextId ?? props.release?.id}>
    <IsmContextSummary analysis={analysis} loading={loading} error={error} timestamp={timestamp} />
    {error && <p role="alert">{error}</p>}
    {storage.error && <p role="alert">ISM history: {storage.error}</p>}
    {analysis && <ScoringSection title="What drove the result"><IsmComponentTable snapshots={analysis.snapshots} loading={loading} timestamp={timestamp} onOpenScatter={onOpenScatter} /></ScoringSection>}
    {Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0) && <p>Partial calendar coverage; context and calibration use the available observations.</p>}
  </div>
}
