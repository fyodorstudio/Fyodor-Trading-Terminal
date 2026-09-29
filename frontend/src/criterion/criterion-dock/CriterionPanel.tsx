import {
  cleanPanel, exitLabel,
  type ResearchAuditData, type ResearchEpisode, type ResearchRule, type ResearchSummary, type ResearchTrial,
} from '../audit-data'
import './criterion-panel.css'

type Props = {
  data: ResearchAuditData | null
  error: string | null
  rule: ResearchRule
  summary: ResearchSummary | null
  trials: ResearchTrial[]
  selectedEpisodeId: string | null
  onRuleChange: (rule: ResearchRule) => void
  onSelectEpisode: (episode: ResearchEpisode, trial: ResearchTrial) => void
}

const targets = Array.from({ length: 13 }, (_, index) => 1 + index * 0.25)

export function CriterionPanel({ data, error, rule, summary, trials, selectedEpisodeId, onRuleChange, onSelectEpisode }: Props) {
  const episodes = data?.families[rule.family].episodes ?? []
  const rows = trials.map((trial) => ({ trial, episode: episodes[trial[0]] }))
    .filter((row) => Boolean(row.episode)).reverse()
  const change = (patch: Partial<ResearchRule>) => onRuleChange({ ...rule, ...patch })

  return (
    <div className="criterion-panel" aria-label="Historical Criterion audit dock">
      <header className="criterion-head">
        <strong>Historical Criterion</strong>
        <span>EURUSD only · research, not registered</span>
      </header>
      {error ? <p className="criterion-error" role="alert">{error}</p> : !data ? <p className="criterion-loading">Loading pinned CPI/NFP research…</p> : (
        <>
          <div className="criterion-controls">
            <div className="criterion-fields two">
              <label>Event family
                <select value={rule.family} onChange={(event) => {
                  const family = event.target.value as ResearchRule['family']
                  change({ family, panel: cleanPanel(family) })
                }}>
                  <option value="CPI">US CPI</option><option value="NFP">US Nonfarm Payrolls</option>
                </select>
              </label>
              <label>Direction rule
                <select value={rule.signal} onChange={(event) => change({ signal: event.target.value as ResearchRule['signal'] })}>
                  <option value="af">Actual − Forecast</option><option value="ap">Actual − Previous</option>
                </select>
              </label>
            </div>
            <div className="criterion-fields two">
              <label>Collision panel
                <select value={rule.panel} onChange={(event) => change({ panel: event.target.value as ResearchRule['panel'] })}>
                  <option value={cleanPanel(rule.family)}>Clean panel</option>
                  <option value="FULL_PANEL">All eligible</option>
                </select>
              </label>
              <label>Cohort
                <select value={rule.cohort} onChange={(event) => change({ cohort: event.target.value as ResearchRule['cohort'] })}>
                  <option value="ALL_ELIGIBLE">All eligible</option><option value="COMMON_H240">H240 complete</option>
                </select>
              </label>
            </div>
            <div className="criterion-fields three">
              <label>Expiry
                <select value={rule.horizon} onChange={(event) => change({ horizon: Number(event.target.value) })}>
                  <option value={60}>H60</option><option value={120}>H120</option><option value={240}>H240</option>
                </select>
              </label>
              <label>SL ATR
                <select value={rule.stop} onChange={(event) => change({ stop: Number(event.target.value) })}>
                  {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>TP ATR
                <select value={rule.target} onChange={(event) => change({ target: Number(event.target.value) })}>
                  {targets.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
            {summary && <div className="criterion-stats" aria-label="Selected historical result">
              <span><b>{summary.trades}</b> episodes</span>
              <span><b>{summary.tp}</b> TP</span><span><b>{summary.sl}</b> SL</span>
              <span><b>{summary.expiry}</b> expiry</span>
              <span><b>{Number(summary.meanR).toFixed(3)} R</b> gross mean/trade</span>
            </div>}
            <a className="criterion-report-link" href="/criterion/research_report.html" target="_blank" rel="noopener noreferrer">
              Open full research report ↗
            </a>
            {rule.family === 'NFP' && <p className="criterion-caveat">For EURUSD, the NFP clean and all-eligible panels coincide; the CAD-jobs collision filter changes USDCAD, not EURUSD.</p>}
            <p className="criterion-caveat">Arrows show archived-rule directions, not hindsight winners or live signals. A−P uses exported Previous; its point-in-time revision status is not proven. Outcomes are historical, gross and cost-excluded.</p>
          </div>
          <div className="criterion-list" role="list" aria-label="Historical episodes for selected rule">
            {rows.length === 0 && <p className="criterion-empty">No eligible EURUSD episodes under these filters.</p>}
            {rows.map(({ episode, trial }) => {
              const direction = episode[rule.signal].direction
              return <button key={episode.id} type="button" role="listitem"
                className={`criterion-episode${selectedEpisodeId === episode.id ? ' selected' : ''}`}
                onClick={() => onSelectEpisode(episode, trial)}>
                <span className="criterion-episode-top"><b>{episode.releaseText}</b><em>{direction > 0 ? '↑ Long' : '↓ Short'}</em></span>
                <span>{exitLabel(trial[1])} · H{trial[2]} · {Number(trial[3]).toFixed(2)} gross R</span>
                <small>A {episode.actual || '—'} · F {episode.forecast || '—'} · P {episode.previous || '—'}</small>
              </button>
            })}
          </div>
        </>
      )}
    </div>
  )
}
