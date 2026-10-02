import { useMemo, useState } from 'react'
import {
  availableTrials, cleanPanel, exitLabel, trialExclusionReason,
  type PriorContextBars, type ResearchAuditData, type ResearchEpisode, type ResearchRule, type ResearchSummary, type ResearchTrial,
} from '../audit-data'
import type { AuditNote } from '../arrow-result/audit-notes'
import reportManifest from '../report-manifest.json'
import './criterion-panel.css'

export type BaselineCriterionPanelProps = {
  data: ResearchAuditData | null
  error: string | null
  rule: ResearchRule
  summary: ResearchSummary | null
  priorContextBars: PriorContextBars
  onPriorContextChange: (bars: PriorContextBars) => void
  selectedEpisodeId: string | null
  savedAuditNotes: AuditNote[]
  onRuleChange: (rule: ResearchRule) => void
  onSelectEpisode: (episode: ResearchEpisode, trial: ResearchTrial | null) => void
}

const targets = Array.from({ length: 13 }, (_, index) => 1 + index * 0.25)

export function BaselineCriterionPanel({
  data,
  error,
  rule,
  summary,
  priorContextBars,
  onPriorContextChange,
  selectedEpisodeId,
  savedAuditNotes,
  onRuleChange,
  onSelectEpisode,
}: BaselineCriterionPanelProps) {
  const [controlsExpanded, setControlsExpanded] = useState(true)
  const episodes = useMemo(() => data?.families[rule.family].episodes ?? [], [data, rule.family])
  const notedEpisodeIds = useMemo(
    () => new Set(
      savedAuditNotes
        .filter((note) => note.family === rule.family && note.signal === rule.signal)
        .map((note) => note.episodeId),
    ),
    [savedAuditNotes, rule.family, rule.signal],
  )
  const rows: { trial: ResearchTrial | null; episode: ResearchEpisode }[] = useMemo(() => {
    if (!data) return []
    const result: { trial: ResearchTrial | null; episode: ResearchEpisode }[] = availableTrials(data, rule)
      .map((trial) => ({ trial: trial as ResearchTrial | null, episode: episodes[trial[0]] }))
      .filter((row) => Boolean(row.episode))

    const existingIds = new Set(result.map((row) => row.episode.id))
    for (const episode of episodes) {
      if (
        (episode.id === selectedEpisodeId || notedEpisodeIds.has(episode.id) || !episode.commonH240) &&
        !existingIds.has(episode.id)
      ) {
        result.push({ episode, trial: null })
        existingIds.add(episode.id)
      }
    }
    result.sort((a, b) => b.episode.releaseTime - a.episode.releaseTime)
    return result
  }, [data, rule, episodes, selectedEpisodeId, notedEpisodeIds])

  const excludedCount = useMemo(
    () => rows.filter(({ episode, trial }) => !trial || Boolean(trialExclusionReason(episode, trial, rule))).length,
    [rows, rule],
  )
  const change = (patch: Partial<ResearchRule>) => onRuleChange({ ...rule, ...patch })

  return (
    <div className="criterion-panel" aria-label="Historical Criterion audit dock">
      {error ? (
        <p className="criterion-error" role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className="criterion-loading">Loading pinned CPI/NFP research…</p>
      ) : (
        <>
          <div
            className="criterion-accordion-header"
            onClick={() => setControlsExpanded((prev) => !prev)}
            role="button"
            tabIndex={0}
            aria-expanded={controlsExpanded}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setControlsExpanded((prev) => !prev)
              }
            }}
          >
            <div className="criterion-accordion-title">
              <span className="criterion-accordion-chevron" aria-hidden="true">
                {controlsExpanded ? '▾' : '▸'}
              </span>
              <strong>Parameters</strong>
              <span>v{reportManifest.version} · exploratory</span>
            </div>
          </div>

          {controlsExpanded ? (
            <div className="criterion-controls">
              <div className="criterion-fields two">
                <label>
                  Event family
                  <select
                    value={rule.family}
                    onChange={(event) => {
                      const family = event.target.value as ResearchRule['family']
                      change({ family, panel: cleanPanel(family) })
                    }}
                  >
                    <option value="CPI">US CPI</option>
                    <option value="NFP">US Nonfarm Payrolls</option>
                  </select>
                </label>
                <label>
                  Direction rule
                  <select
                    value={rule.signal}
                    onChange={(event) => change({ signal: event.target.value as ResearchRule['signal'] })}
                  >
                    <option value="af">Actual − Forecast</option>
                    <option value="ap">Actual − Previous</option>
                  </select>
                </label>
              </div>
              <div className="criterion-fields two">
                <label>
                  Co-release filter
                  <select
                    value={rule.panel}
                    disabled={rule.family === 'NFP'}
                    title={
                      rule.family === 'CPI'
                        ? 'Whether to include CPI releases coinciding with US Initial Jobless Claims'
                        : 'NFP EURUSD has no co-release exclusions in this research'
                    }
                    onChange={(event) => change({ panel: event.target.value as ResearchRule['panel'] })}
                  >
                    {rule.family === 'CPI' ? (
                      <>
                        <option value="JOBLESS_CLAIMS_CLEAN">Exclude Jobless Claims</option>
                        <option value="FULL_PANEL">Include Jobless Claims</option>
                      </>
                    ) : (
                      <option value="PRIMARY_PANEL">No EURUSD exclusions</option>
                    )}
                  </select>
                </label>
                <label>
                  Prior context
                  <select
                    value={priorContextBars}
                    title="Chart display only: observed H1 candles before the entry candle"
                    onChange={(event) => onPriorContextChange(Number(event.target.value) as PriorContextBars)}
                  >
                    <option value={0}>None</option>
                    <option value={60}>60 H1 before</option>
                    <option value={120}>120 H1 before</option>
                    <option value={240}>240 H1 before</option>
                  </select>
                </label>
              </div>
              <div className="criterion-fields three">
                <label>
                  Expiry
                  <select
                    value={rule.horizon}
                    onChange={(event) => change({ horizon: Number(event.target.value) })}
                  >
                    <option value={60}>H60</option>
                    <option value={120}>H120</option>
                    <option value={240}>H240</option>
                  </select>
                </label>
                <label>
                  SL ATR
                  <select value={rule.stop} onChange={(event) => change({ stop: Number(event.target.value) })}>
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  TP ATR
                  <select
                    value={rule.target}
                    onChange={(event) => change({ target: Number(event.target.value) })}
                  >
                    {targets.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : (
            <div
              className="criterion-readout-strip"
              onClick={() => setControlsExpanded(true)}
              role="button"
              tabIndex={0}
              title="Click to edit parameters"
              aria-label="Active parameters summary: click to expand"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setControlsExpanded(true)
                }
              }}
            >
              <div className="criterion-readout-item" title="Event family">
                {rule.family === 'CPI' ? 'US CPI' : 'US NFP'}
              </div>
              <div className="criterion-readout-item" title="Direction rule">
                {rule.signal === 'af' ? 'A−F' : 'A−P'}
              </div>
              {rule.family === 'CPI' && (
                <div className="criterion-readout-item" title="Co-release filter">
                  {rule.panel === 'JOBLESS_CLAIMS_CLEAN' ? 'Claims excl' : 'Claims incl'}
                </div>
              )}
              <div className="criterion-readout-item" title="Expiry">
                H{rule.horizon}
              </div>
              <div className="criterion-readout-item" title="Stop loss">
                SL {rule.stop}
              </div>
              <div className="criterion-readout-item" title="Take profit">
                TP {rule.target}
              </div>
              {priorContextBars > 0 && (
                <div className="criterion-readout-item" title="Prior context">
                  +{priorContextBars}H
                </div>
              )}
            </div>
          )}
          {summary && (
            <div className="criterion-stats-bar" aria-label="Selected historical result">
              <div className="criterion-stats-pills">
                <span>
                  <b>{summary.trades}</b> inc
                </span>
                <span>
                  <b>{summary.tp}</b> TP
                </span>
                <span>
                  <b>{summary.sl}</b> SL
                </span>
                <span>
                  <b>{summary.expiry}</b> exp
                </span>
                <span className="criterion-mean-r">
                  <b>{Number(summary.meanR).toFixed(3)} R</b> gross mean
                </span>
              </div>
              <div className="criterion-meta-actions">
                <span
                  className="criterion-caveat-tooltip"
                  title={`${rule.family === 'NFP' ? 'The NFP co-release filter is inactive on EURUSD; its CAD-jobs exclusion applies to USDCAD only. ' : ''}Arrows show archived-rule directions, not hindsight winners or live signals. A−P uses exported Previous; its point-in-time revision status is not proven. Outcomes are historical, gross and cost-excluded.`}
                  aria-label="Methodology caveat"
                >
                  ⓘ
                </span>
                <a
                  className="criterion-report-link"
                  href={reportManifest.reportPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open full research report"
                >
                  Report ↗
                </a>
              </div>
            </div>
          )}
          <div className="criterion-list-header">
            <strong>Episodes</strong>
            <span>
              {rows.length - excludedCount} included · {excludedCount} excluded shown
            </span>
          </div>
          <div className="criterion-list" role="list" aria-label="Historical episodes for selected rule">
            {rows.length === 0 && (
              <p className="criterion-empty">No priced EURUSD episodes for this direction rule and expiry.</p>
            )}
            {rows.map(({ episode, trial }) => {
              const direction = episode[rule.signal].direction
              const directionLabel = !trial ? 'No trade' : direction > 0 ? '↑ Long' : '↓ Short'
              const exclusion = trial
                ? trialExclusionReason(episode, trial, rule)
                : !episode.commonH240 && rule.horizon === 240
                  ? null
                  : 'no eligible trade for this rule'
              return (
                <button
                  key={episode.id}
                  type="button"
                  role="listitem"
                  className={`criterion-episode${selectedEpisodeId === episode.id ? ' selected' : ''}`}
                  disabled={!trial && !episode.commonH240 && rule.horizon === 240}
                  onClick={() => onSelectEpisode(episode, trial)}
                >
                  <span className="criterion-episode-top">
                    <b>{episode.releaseText}</b>
                    <em>{directionLabel}</em>
                  </span>
                  <span className="criterion-episode-result">
                    {trial && (
                      <>
                        <b className={trial[1] === 0 ? 'tp' : trial[1] === 1 ? 'sl' : 'expiry'}>
                          {exitLabel(trial[1])}
                        </b>
                        <span>
                          · H{trial[2]} · {Number(trial[3]).toFixed(2)} gross R
                        </span>
                      </>
                    )}
                    {exclusion && (
                      <span className="criterion-excluded" title="Not counted in the selected summary">
                        Excluded: {exclusion}
                      </span>
                    )}
                    {!episode.commonH240 && (
                      <span className="criterion-coverage" title="The H240 candle path is incomplete for this episode">
                        H240 path incomplete
                      </span>
                    )}
                    {notedEpisodeIds.has(episode.id) && (
                      <span
                        className="criterion-audited"
                        title="Personal audit note saved; not research approval"
                      >
                        Audited
                      </span>
                    )}
                  </span>
                  <small>
                    A {episode.actual || '—'} · F {episode.forecast || '—'} · P {episode.previous || '—'}
                  </small>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
