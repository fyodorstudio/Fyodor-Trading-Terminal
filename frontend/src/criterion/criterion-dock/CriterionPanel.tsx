import {
  availableTrials, cleanPanel, exitLabel, trialExclusionReason,
  type ResearchAuditData, type ResearchEpisode, type ResearchRule, type ResearchSummary, type ResearchTrial,
} from '../audit-data'
import type { AuditNote } from '../arrow-result/audit-notes'
import reportManifest from '../report-manifest.json'
import './criterion-panel.css'

type Props = {
  data: ResearchAuditData | null
  error: string | null
  rule: ResearchRule
  summary: ResearchSummary | null
  selectedEpisodeId: string | null
  savedAuditNotes: AuditNote[]
  onRuleChange: (rule: ResearchRule) => void
  onSelectEpisode: (episode: ResearchEpisode, trial: ResearchTrial | null) => void
}

const targets = Array.from({ length: 13 }, (_, index) => 1 + index * 0.25)

export function CriterionPanel({ data, error, rule, summary, selectedEpisodeId, savedAuditNotes, onRuleChange, onSelectEpisode }: Props) {
  const episodes = data?.families[rule.family].episodes ?? []
  const notedEpisodeIds = new Set(savedAuditNotes
    .filter((note) => note.family === rule.family && note.signal === rule.signal)
    .map((note) => note.episodeId))
  const rows: { trial: ResearchTrial | null; episode: ResearchEpisode }[] = data
    ? availableTrials(data, rule).map((trial) => ({ trial, episode: episodes[trial[0]] }))
      .filter((row) => Boolean(row.episode))
    : []
  for (const episode of episodes) {
    if ((episode.id === selectedEpisodeId || notedEpisodeIds.has(episode.id))
        && !rows.some((row) => row.episode.id === episode.id)) rows.push({ episode, trial: null })
  }
  rows.sort((a, b) => b.episode.releaseTime - a.episode.releaseTime)
  const excludedCount = rows.filter(({ episode, trial }) => !trial || Boolean(trialExclusionReason(episode, trial, rule))).length
  const change = (patch: Partial<ResearchRule>) => onRuleChange({ ...rule, ...patch })

  return (
    <div className="criterion-panel" aria-label="Historical Criterion audit dock">
      <header className="criterion-head">
        <strong>Historical Criterion</strong>
        <span>EURUSD only · research, not registered · report v{reportManifest.version}</span>
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
              <label>Co-release filter
                <select value={rule.panel} disabled={rule.family === 'NFP'}
                  title={rule.family === 'CPI' ? 'Whether to include CPI releases coinciding with US Initial Jobless Claims' : 'NFP EURUSD has no co-release exclusions in this research'}
                  onChange={(event) => change({ panel: event.target.value as ResearchRule['panel'] })}>
                  {rule.family === 'CPI' ? <>
                    <option value="JOBLESS_CLAIMS_CLEAN">Exclude Jobless Claims</option>
                    <option value="FULL_PANEL">Include Jobless Claims</option>
                  </> : <option value="PRIMARY_PANEL">No EURUSD exclusions</option>}
                </select>
              </label>
              <label>Sample coverage
                <select value={rule.cohort} onChange={(event) => change({ cohort: event.target.value as ResearchRule['cohort'] })}>
                  <option value="ALL_ELIGIBLE">Eligible at selected H</option><option value="COMMON_H240">Same events through H240</option>
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
              <span><b>{summary.trades}</b> included episodes</span>
              <span><b>{summary.tp}</b> TP</span><span><b>{summary.sl}</b> SL</span>
              <span><b>{summary.expiry}</b> expiry</span>
              <span><b>{Number(summary.meanR).toFixed(3)} R</b> gross mean/trade</span>
            </div>}
            <a className="criterion-report-link" href={reportManifest.reportPath} target="_blank" rel="noopener noreferrer">
              Open full research report v{reportManifest.version} · 7 pairs ↗
            </a>
            {rule.family === 'NFP' && <p className="criterion-caveat">The NFP co-release filter is inactive on EURUSD; its CAD-jobs exclusion applies to USDCAD only.</p>}
            <p className="criterion-caveat">Arrows show archived-rule directions, not hindsight winners or live signals. A−P uses exported Previous; its point-in-time revision status is not proven. Outcomes are historical, gross and cost-excluded.</p>
          </div>
          <div className="criterion-list-header"><strong>Episodes</strong><span>{rows.length - excludedCount} included · {excludedCount} excluded shown</span></div>
          <div className="criterion-list" role="list" aria-label="Historical episodes for selected rule">
            {rows.length === 0 && <p className="criterion-empty">No priced EURUSD episodes for this direction rule and expiry.</p>}
            {rows.map(({ episode, trial }) => {
              const direction = episode[rule.signal].direction
              const directionLabel = !trial ? 'No trade' : direction > 0 ? '↑ Long' : '↓ Short'
              const exclusion = trial ? trialExclusionReason(episode, trial, rule) : 'no eligible trade for this rule'
              return <button key={episode.id} type="button" role="listitem"
                className={`criterion-episode${selectedEpisodeId === episode.id ? ' selected' : ''}`}
                onClick={() => onSelectEpisode(episode, trial)}>
                <span className="criterion-episode-top"><b>{episode.releaseText}</b><em>{directionLabel}</em></span>
                <span className="criterion-episode-result">
                  {trial && <>
                    <b className={trial[1] === 0 ? 'tp' : trial[1] === 1 ? 'sl' : 'expiry'}>{exitLabel(trial[1])}</b>
                    <span>· H{trial[2]} · {Number(trial[3]).toFixed(2)} gross R</span>
                  </>}
                  {exclusion && <span className="criterion-excluded" title="Not counted in the selected summary">Excluded: {exclusion}</span>}
                  {notedEpisodeIds.has(episode.id) && <span className="criterion-audited" title="Personal audit note saved; not research approval">Audited</span>}
                </span>
                <small>A {episode.actual || '—'} · F {episode.forecast || '—'} · P {episode.previous || '—'}</small>
              </button>
            })}
          </div>
        </>
      )}
    </div>
  )
}
