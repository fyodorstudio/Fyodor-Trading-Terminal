import type { PriorContextBars, ResearchAuditData, ResearchEpisode, ResearchRule, ResearchSummary, ResearchTrial } from '../audit-data'
import type { BundleEpisode, BundleRule, BundleSnapshot, BundleSummary, BundleTrial } from '../cpi-bundle-data'
import type { AuditNote } from '../arrow-result/audit-notes'
import { BaselineCriterionPanel } from './BaselineCriterionPanel'
import { CpiBundleCriterionPanel } from './CpiBundleCriterionPanel'
import './criterion-panel.css'

export type CriterionStudyId = 'baseline' | 'bundle' | 'experimental'

export type CriterionPanelProps = {
  study: CriterionStudyId
  onStudyChange: (study: CriterionStudyId) => void
  priorContextBars: PriorContextBars
  onPriorContextChange: (bars: PriorContextBars) => void
  baselineData: ResearchAuditData | null
  baselineError: string | null
  baselineRule: ResearchRule
  baselineSummary: ResearchSummary | null
  selectedResearchEpisodeId: string | null
  savedAuditNotes: AuditNote[]
  onBaselineRuleChange: (rule: ResearchRule) => void
  onSelectResearchEpisode: (episode: ResearchEpisode, trial: ResearchTrial | null) => void
  bundleData: BundleSnapshot | null
  bundleError: string | null
  bundleRule: BundleRule
  bundleSummary: BundleSummary | null
  selectedBundleEpisodeId: string | null
  bundleNotes: AuditNote[]
  onBundleRuleChange: (rule: BundleRule) => void
  onSelectBundleEpisode: (episode: BundleEpisode, trial: BundleTrial | null) => void
}

export function CriterionPanel({
  study,
  onStudyChange,
  priorContextBars,
  onPriorContextChange,
  baselineData,
  baselineError,
  baselineRule,
  baselineSummary,
  selectedResearchEpisodeId,
  savedAuditNotes,
  onBaselineRuleChange,
  onSelectResearchEpisode,
  bundleData,
  bundleError,
  bundleRule,
  bundleSummary,
  selectedBundleEpisodeId,
  bundleNotes,
  onBundleRuleChange,
  onSelectBundleEpisode,
}: CriterionPanelProps) {
  return (
    <div className="criterion-study-container">
      <div className="criterion-study-switch">
        <label>
          Research snapshot
          <select value={study} onChange={(event) => onStudyChange(event.target.value as CriterionStudyId)}>
            <option value="baseline">CPI / NFP baseline V2</option>
            <option value="bundle">USD CPI bundle V3</option>
            <option value="experimental">USD CPI EXPERIMENTAL</option>
          </select>
        </label>
      </div>
      {study === 'baseline' ? (
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
