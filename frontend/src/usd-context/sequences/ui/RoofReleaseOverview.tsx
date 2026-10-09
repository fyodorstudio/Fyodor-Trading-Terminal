import { memo, useId, useLayoutEffect, useMemo, useRef } from 'react'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'
import type { ComboSnapshot, ComboSource, RoofComboGroup } from '../../../scoring-system/relationships/contracts'
import type { TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import { activationLabel } from '../../../scoring-system/relationships/combo-activation'
import { roofResultLabel, roofSupport } from '../../../scoring-system/relationships/relationship-support'
import { comboColumnSummary } from '../chart/combo-column-summary'
import { WeightedSupportBar } from '../../ui/WeightedSupportBar'
import { comboSummary } from './combo-summary'
import { roofEvidenceLabel } from './roof-evidence-label'
import { ComboReleaseTable } from './ComboReleaseTable'
import './roof-release-overview.css'

type Props = { group: RoofComboGroup; symbol: string; restoreScroll: () => number; rememberScroll: (position: number) => void;
  timeDisplay: TimeDisplayPreference; selectedId?: string; onViewDetails: (combo: ComboSnapshot) => void; onOpenRelease: (source: ComboSource) => void }

function OverviewBody({ group, symbol, timeDisplay, restoreScroll, rememberScroll, selectedId, onViewDetails, onOpenRelease, bodyId }: Props & { bodyId: string }) {
  const scroll = useRef<HTMLDivElement>(null)
  const clock = useDisplayClock()
  const rows = useMemo(() => group.combos.map(combo => {
    const support = roofSupport(combo)
    return { combo, support, result: roofResultLabel(combo), evidence: roofEvidenceLabel(combo, support), summary: comboSummary(combo) }
  }), [group])
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = restoreScroll() }, [group, restoreScroll])
  return <div className="roof-overview-scroll" id={bodyId} ref={scroll} onScroll={event => rememberScroll(event.currentTarget.scrollTop)}>
    <div className="roof-overview-columns" aria-hidden="true"><span>Relationship</span><span>EURUSD bias</span><span>Evidence</span><span>Weighted support</span><span /></div>
    <div role="list" aria-label="Release relationships">
      {rows.map(({ combo, support, result, evidence, summary }, index) => <article role="listitem" key={combo.id}
        className={`roof-overview-row${selectedId === combo.id ? ' selected' : ''}`} data-roof-id={combo.id} aria-labelledby={`${bodyId}-relationship-${index}`}>
        <div className="roof-overview-row-main">
          <div className="roof-overview-name"><h3 id={`${bodyId}-relationship-${index}`}>{combo.title}</h3>
            <span>{combo.kind === 'fresh-news' ? 'Changes in support' : 'Release support'}</span></div>
          <strong className={`roof-overview-bias ${support.direction ?? support.state}`}>{result}</strong>
          <span className="roof-overview-evidence">{evidence}</span>
          <WeightedSupportBar support={support} />
          <button type="button" aria-label={`View details for ${combo.title}`} onClick={() => onViewDetails(combo)}>View details →</button>
        </div>
        <p className="roof-overview-reason">{summary.why}</p>
        <div className="roof-overview-row-meta">
          <span>Available from {clock.chart(combo.chartAt)} ({clock.zone}) · {summary.cause.kind === 'publication' ? `New release: ${summary.activation}` : summary.activation}</span></div>
        <section className="roof-overview-releases" aria-label="Participating publications"><h4>Which releases are involved?</h4>
          <ComboReleaseTable combo={combo} symbol={symbol} timeDisplay={timeDisplay} onOpenRelease={onOpenRelease} />
        </section>
      </article>)}
    </div>
  </div>
}

export const RoofReleaseOverview = memo(function RoofReleaseOverview({ group, symbol, timeDisplay, restoreScroll, rememberScroll,
  selectedId, onViewDetails, onOpenRelease }: Props) {
  const bodyId = useId(), clock = useDisplayClock()
  const summary = useMemo(() => comboColumnSummary(group.combos), [group])
  const { counts } = summary
  return <section className="roof-release-overview" aria-label="Release combinations overview">
    <header className="roof-overview-header"><div><h2>Roofs · {group.combos.length} combinations</h2>
      <span>{symbol} · USD inputs · {clock.zone}</span></div>
    </header>
    <div className="roof-overview-anchor">
      {summary.updates.map(update => <div key={update.at}><strong>{update.kind === 'publication' ? update.releases.join(' + ') || 'Release update' : activationLabel(update.kind)}</strong>
        <span>{clock.chart(update.at)} ({clock.zone}) · {update.kind === 'publication' ? 'New release' : 'No new release'}</span></div>)}
      <div className="roof-overview-counts">Long leads: {counts.long} · Short leads: {counts.short}
        {counts.balanced > 0 && <> · Balanced: {counts.balanced}</>}{counts.unchanged > 0 && <> · Unchanged: {counts.unchanged}</>}
        {counts.insufficient > 0 && <> · Insufficient: {counts.insufficient}</>}
      </div>
    </div>
    <OverviewBody group={group} symbol={symbol} timeDisplay={timeDisplay} restoreScroll={restoreScroll} rememberScroll={rememberScroll}
      selectedId={selectedId} onViewDetails={onViewDetails} onOpenRelease={onOpenRelease} bodyId={bodyId} />
  </section>
})
