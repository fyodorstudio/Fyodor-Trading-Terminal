import type { PriorContextBars, ResearchAuditData, ResearchEpisode, ResearchRule, ResearchSummary, ResearchTrial } from '../audit-data'
import type { BundleEpisode, BundleRule, BundleSnapshot, BundleSummary, BundleTrial } from '../cpi-bundle-data'
import type { AuditNote } from '../arrow-result/audit-notes'
import type { CpiTimelineIndex } from '../timeline/cpi-event-timeline-data'
import { CpiEventTimelineCriterionPanel } from './CpiEventTimelineCriterionPanel'
import { BaselineCriterionPanel } from './BaselineCriterionPanel'
import { CpiBundleCriterionPanel } from './CpiBundleCriterionPanel'
import './criterion-panel.css'

export type CriterionStudyId = 'timeline' | 'baseline' | 'bundle' | 'experimental'

export type CriterionPanelProps = {
  study: CriterionStudyId
  onStudyChange: (study: CriterionStudyId) => void
  priorContextBars?: PriorContextBars
  onPriorContextChange?: (bars: PriorContextBars) => void
  baselineData?: ResearchAuditData | null
  baselineError?: string | null
  baselineRule?: ResearchRule
  baselineSummary?: ResearchSummary | null
  selectedResearchEpisodeId?: string | null
  savedAuditNotes?: AuditNote[]
  onBaselineRuleChange?: (rule: ResearchRule) => void
  onSelectResearchEpisode?: (episode: ResearchEpisode, trial: ResearchTrial | null) => void
  bundleData?: BundleSnapshot | null
  bundleError?: string | null
  bundleRule?: BundleRule
  bundleSummary?: BundleSummary | null
  selectedBundleEpisodeId?: string | null
  bundleNotes?: AuditNote[]
  onBundleRuleChange?: (rule: BundleRule) => void
  onSelectBundleEpisode?: (episode: BundleEpisode, trial: BundleTrial | null) => void
  timelineIndex?: CpiTimelineIndex | null
  isTimelineLoading?: boolean
  timelineError?: string | null
  onRetryTimeline?: () => void
  selectedTimelineEpisodeId?: string | null
  onSelectTimelineEpisode?: (episodeId: string) => void
}

export function CriterionPanel({
  study,
  onStudyChange,
  priorContextBars = 240,
  onPriorContextChange = () => {},
  baselineData = null,
  baselineError = null,
  baselineRule = {
    family: 'CPI',
    signal: 'af',
    panel: 'FULL_PANEL',
    cohort: 'ALL_ELIGIBLE',
    horizon: 60,
    stop: 1,
    target: 1,
  },
  baselineSummary = null,
  selectedResearchEpisodeId = null,
  savedAuditNotes = [],
  onBaselineRuleChange = () => {},
  onSelectResearchEpisode = () => {},
  bundleData = null,
  bundleError = null,
  bundleRule = {
    comparison: 'CANDIDATE_1_HEADLINE_MM',
    panel: 'FULL_PANEL',
    horizon: 60,
    stop: 1,
    target: 1,
  },
  bundleSummary = null,
  selectedBundleEpisodeId = null,
  bundleNotes = [],
  onBundleRuleChange = () => {},
  onSelectBundleEpisode = () => {},
  timelineIndex = null,
  isTimelineLoading = false,
  timelineError = null,
  onRetryTimeline,
  selectedTimelineEpisodeId = null,
  onSelectTimelineEpisode = () => {},
}: CriterionPanelProps) {
  return (
    <div className="criterion-study-container">
      <div className="criterion-study-switch">
        <label>
          Research snapshot
          <select value={study} onChange={(event) => onStudyChange(event.target.value as CriterionStudyId)}>
            <option value="timeline">CPI & Event Timeline</option>
          </select>
        </label>
      </div>
      {study === 'timeline' ? (
        <CpiEventTimelineCriterionPanel
          index={timelineIndex}
          isLoading={isTimelineLoading}
          error={timelineError}
          onRetry={onRetryTimeline}
          selectedEpisodeId={selectedTimelineEpisodeId}
          onSelectEpisode={onSelectTimelineEpisode}
          priorContextBars={priorContextBars}
          onPriorContextChange={onPriorContextChange}
          savedAuditNotes={savedAuditNotes}
        />
      ) : study === 'baseline' ? (
        <BaselineCriterionPanel
          data={baselineData}
          error={baselineError}
          rule={baselineRule}
          summary={baselineSummary}
          priorContextBars={priorContextBars}
          onPriorContextChange={onPriorContextChange}
          selectedEpisodeId={selectedResearchEpisodeId}
          savedAuditNotes={savedAuditNotes}
          onRuleChange={onBaselineRuleChange}
          onSelectEpisode={onSelectResearchEpisode}
        />
      ) : (
        <CpiBundleCriterionPanel
          data={bundleData}
          error={bundleError}
          rule={bundleRule}
          summary={bundleSummary}
          priorContextBars={priorContextBars}
          onPriorContextChange={onPriorContextChange}
          selectedEpisodeId={selectedBundleEpisodeId}
          notes={bundleNotes}
          onRuleChange={onBundleRuleChange}
          onSelectEpisode={onSelectBundleEpisode}
          isExperimental={study === 'experimental'}
        />
      )}
    </div>
  )
}
