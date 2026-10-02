import { useState } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { MarketWatchPanel } from '../../market-data/market-watch/MarketWatchPanel'
import type { FeedStatus } from '../../market-data/mt5-feed/use-mt5-market-data'
import { CriterionPanel } from '../../criterion/criterion-dock/CriterionPanel'
import type { AuditNote } from '../../criterion/arrow-result/audit-notes'
import type { PriorContextBars, ResearchAuditData, ResearchEpisode, ResearchRule, ResearchSummary, ResearchTrial } from '../../criterion/audit-data'
import type { BundleEpisode, BundleRule, BundleSnapshot, BundleSummary, BundleTrial } from '../../criterion/cpi-bundle-data'
import type { LeftDockWindow } from './left-dock-window'
import './left-dock-panel.css'

type LeftDockPanelProps = {
  symbols: SymbolQuote[]
  selectedSymbol: string
  marketWatchStatus: FeedStatus
  marketWatchError: string | null
  onSelectSymbol: (symbol: string) => void
  activeWindow?: LeftDockWindow
  onSelectWindow?: (window: LeftDockWindow) => void
  criterionData: ResearchAuditData | null
  criterionStudy: 'baseline' | 'bundle'
  onCriterionStudyChange: (study: 'baseline' | 'bundle') => void
  criterionError: string | null
  criterionRule: ResearchRule
  criterionSummary: ResearchSummary | null
  priorContextBars: PriorContextBars
  onPriorContextChange: (bars: PriorContextBars) => void
  selectedResearchEpisodeId: string | null
  savedAuditNotes: AuditNote[]
  onCriterionRuleChange: (rule: ResearchRule) => void
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

export function LeftDockPanel({
  symbols,
  selectedSymbol,
  marketWatchStatus,
  marketWatchError,
  onSelectSymbol,
  activeWindow: controlledActiveWindow,
  onSelectWindow: controlledOnSelectWindow,
  criterionData,
  criterionStudy,
  onCriterionStudyChange,
  criterionError,
  criterionRule,
  criterionSummary,
  priorContextBars,
  onPriorContextChange,
  selectedResearchEpisodeId,
  savedAuditNotes,
  onCriterionRuleChange,
  onSelectResearchEpisode,
  bundleData,
  bundleError,
  bundleRule,
  bundleSummary,
  selectedBundleEpisodeId,
  bundleNotes,
  onBundleRuleChange,
  onSelectBundleEpisode,
}: LeftDockPanelProps) {
  const [internalActiveWindow, setInternalActiveWindow] = useState<LeftDockWindow>('market-watch')
  const activeWindow = controlledActiveWindow ?? internalActiveWindow
  const handleSelectWindow = controlledOnSelectWindow ?? setInternalActiveWindow

  return (
    <aside className="left-dock" aria-label="Left workspace dock">
      <header className="left-dock-tabs" role="tablist" aria-label="Left dock tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeWindow === 'market-watch'}
          className={activeWindow === 'market-watch' ? 'active' : ''}
          onClick={() => handleSelectWindow('market-watch')}
        >
          Market Watch <span>{symbols.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeWindow === 'criterion'}
          className={activeWindow === 'criterion' ? 'active' : ''}
          onClick={() => handleSelectWindow('criterion')}
        >
          Criterion
        </button>
      </header>
      <div className="left-dock-content">
        {activeWindow === 'market-watch' && (
          <MarketWatchPanel
            symbols={symbols}
            selectedSymbol={selectedSymbol}
            status={marketWatchStatus}
            error={marketWatchError}
            onSelect={onSelectSymbol}
          />
        )}
        {activeWindow === 'criterion' && (
          <CriterionPanel
            study={criterionStudy}
            onStudyChange={onCriterionStudyChange}
            priorContextBars={priorContextBars}
            onPriorContextChange={onPriorContextChange}
            baselineData={criterionData}
            baselineError={criterionError}
            baselineRule={criterionRule}
            baselineSummary={criterionSummary}
            selectedResearchEpisodeId={selectedResearchEpisodeId}
            savedAuditNotes={savedAuditNotes}
            onBaselineRuleChange={onCriterionRuleChange}
            onSelectResearchEpisode={onSelectResearchEpisode}
            bundleData={bundleData}
            bundleError={bundleError}
            bundleRule={bundleRule}
            bundleSummary={bundleSummary}
            selectedBundleEpisodeId={selectedBundleEpisodeId}
            bundleNotes={bundleNotes}
            onBundleRuleChange={onBundleRuleChange}
            onSelectBundleEpisode={onSelectBundleEpisode}
          />
        )}
      </div>
    </aside>
  )
}
