import { useMemo, useState } from 'react'
import { bundleAvailableTrials, bundleComparisons, bundleExclusion, bundleYoyOnlyDirection, type BundleEpisode,
  type BundleRule, type BundleSnapshot, type BundleSummary, type BundleTrial } from '../cpi-bundle-data'
import type { AuditNote } from '../arrow-result/audit-notes'
import type { PriorContextBars } from '../audit-data'
import bundleManifest from '../cpi-bundle-manifest.json'
import './criterion-panel.css'

type Props = {
  data: BundleSnapshot | null
  error: string | null
  rule: BundleRule
  summary: BundleSummary | null
  priorContextBars: PriorContextBars
  onPriorContextChange: (bars: PriorContextBars) => void
  selectedEpisodeId: string | null
  notes: AuditNote[]
  onRuleChange: (rule: BundleRule) => void
  onSelectEpisode: (episode: BundleEpisode, trial: BundleTrial | null) => void
}

const targets = Array.from({ length: 13 }, (_, index) => 1 + index * 0.25)

const comparisonShortLabels: Record<string, string> = {
  CANDIDATE_1_HEADLINE_MM: 'Headline m/m',
  CANDIDATE_2_CORE_MM_LED: 'Core m/m',
  CANDIDATE_3_CONCORDANT_MM: 'Headline+Core agree',
  CANDIDATE_4_CONFLICT_FILTERED_HEADLINE: 'Headline clean',
  CONFLICT_SUBSTUDY_A_HEADLINE: 'Confl: Headline',
  CONFLICT_SUBSTUDY_B_CORE: 'Confl: Core',
}

export function CpiBundleCriterionPanel({ data, error, rule, summary, priorContextBars, onPriorContextChange,
  selectedEpisodeId, notes, onRuleChange, onSelectEpisode }: Props) {
  const [controlsExpanded, setControlsExpanded] = useState(true)
  const change = (patch: Partial<BundleRule>) => onRuleChange({ ...rule, ...patch })
  const trials = useMemo(() => data ? bundleAvailableTrials(data, rule) : [], [data, rule])
  const trialByIndex = useMemo(() => new Map(trials.map((trial) => [trial[0], trial])), [trials])
  const notedIds = useMemo(() => new Set(notes.filter((note) => note.family === 'CPI_BUNDLE'
    && note.signal === rule.comparison).map((note) => note.episodeId)), [notes, rule.comparison])
  const rows = useMemo(() => data?.episodes.map((episode, index) => ({ episode, trial: trialByIndex.get(index) ?? null }))
    .sort((a, b) => b.episode.releaseTime - a.episode.releaseTime) ?? [], [data, trialByIndex])

  return <div className="criterion-panel" aria-label="USD CPI bundle historical audit dock">
    {error ? <p className="criterion-error" role="alert">{error}</p> : !data ?
      <p className="criterion-loading">Loading pinned CPI bundle episodes…</p> : <>
      {controlsExpanded ? (
        <>
          <div className="criterion-accordion-header">
            <div className="criterion-accordion-title">
              <strong>Parameters</strong>
              <span>v{bundleManifest.version} · unregistered</span>
            </div>
            <button
              type="button"
              className="criterion-accordion-toggle"
              onClick={() => setControlsExpanded(false)}
              aria-label="Collapse parameter controls"
            >
              Hide ▴
            </button>
          </div>
          <div className="criterion-controls">
            <div className="criterion-fields">
              <label>Bundle interpretation
                <select value={rule.comparison} onChange={(event) => change({ comparison: event.target.value as BundleRule['comparison'] })}>
                  {bundleComparisons.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            </div>
            <div className="criterion-fields two">
              <label>Co-release filter
                <select value={rule.panel} onChange={(event) => change({ panel: event.target.value as BundleRule['panel'] })}>
                  <option value="FULL_PANEL">Include Jobless Claims</option>
                  <option value="JOBLESS_CLAIMS_CLEAN">Exclude Jobless Claims</option>
                </select>
              </label>
              <label>Prior context
                <select value={priorContextBars} onChange={(event) => onPriorContextChange(Number(event.target.value) as PriorContextBars)}>
                  <option value={0}>None</option><option value={60}>60 H1 before</option>
                  <option value={120}>120 H1 before</option><option value={240}>240 H1 before</option>
                </select>
              </label>
            </div>
            <div className="criterion-fields three">
              <label>Expiry
                <select value={rule.horizon} onChange={(event) => change({ horizon: Number(event.target.value) as BundleRule['horizon'] })}>
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
          </div>
        </>
      ) : (
        <div className="criterion-accordion-collapsed">
          <div className="criterion-chips">
            <span className="criterion-chip" title="Bundle interpretation">{comparisonShortLabels[rule.comparison] ?? rule.comparison}</span>
            <span className="criterion-chip" title="Co-release filter">{rule.panel === 'FULL_PANEL' ? 'Claims incl' : 'Claims excl'}</span>
            <span className="criterion-chip" title="Expiry">H{rule.horizon}</span>
            <span className="criterion-chip" title="Stop loss">SL {rule.stop}</span>
            <span className="criterion-chip" title="Take profit">TP {rule.target}</span>
            {priorContextBars > 0 && <span className="criterion-chip" title="Prior context">+{priorContextBars}H</span>}
          </div>
          <button
            type="button"
            className="criterion-accordion-toggle"
            onClick={() => setControlsExpanded(true)}
            aria-label="Expand parameter controls"
          >
            Edit ▾
          </button>
        </div>
      )}
      {summary && (
        <div className="criterion-stats-bar" aria-label="Selected bundle result">
          <div className="criterion-stats-pills">
            <span><b>{summary.trades}</b> inc</span>
            <span><b>{summary.tp}</b> TP</span>
            <span><b>{summary.sl}</b> SL</span>
            <span><b>{summary.expiry}</b> exp</span>
            <span className="criterion-mean-r"><b>{summary.meanR >= 0 ? '+' : ''}{summary.meanR.toFixed(3)} R</b> gross mean</span>
            {summary.loyo && summary.loyo !== '0' && <span><b>{summary.loyo}</b> LOYO</span>}
          </div>
          <div className="criterion-meta-actions">
            <span
              className="criterion-caveat-tooltip"
              title="A−P only. All four CPI readings are shown per episode; the selected interpretation determines the arrow. Conflict interpretations are separate comparisons, not independent releases. A−P Previous may have been revised after publication."
              aria-label="Methodology caveat"
            >
              ⓘ
            </span>
          </div>
        </div>
      )}
      <div className="criterion-list-header"><strong>Episodes</strong><span>{summary?.trades ?? 0} included · {rows.length} in-cutoff releases</span></div>
      <div className="criterion-list" role="list" aria-label="CPI bundle episodes">
        {rows.map(({ episode, trial }) => {
          const exclusion = trial ? bundleExclusion(episode, rule) : 'not eligible for this interpretation'
          const yoyDirection = !trial ? bundleYoyOnlyDirection(episode) : null
          const direction = trial ? trial[1] > 0 ? '↑ Long' : '↓ Short'
            : yoyDirection ? `${yoyDirection === 'long' ? '↑' : '↓'} YoY context` : 'Outside rule'
          const noTrialReason = yoyDirection
            ? 'Monthly CPI readings absent; YoY direction shown for inspection only, not simulated'
            : 'No priced trial under this m/m interpretation'
          return <button key={episode.id} type="button" role="listitem"
            className={`criterion-episode${selectedEpisodeId === episode.id ? ' selected' : ''}`}
            disabled={!episode.entryTime}
            onClick={() => onSelectEpisode(episode, trial)}>
            <span className="criterion-episode-top"><b>{episode.releaseText}</b><em>{direction}</em></span>
            <span className="criterion-episode-result">
              {trial && <><b className={trial[2] === 0 ? 'tp' : trial[2] === 1 ? 'sl' : 'expiry'}>
                {trial[2] === 0 ? 'TP first' : trial[2] === 1 ? 'SL first' : 'Expiry'}</b>
                <span>· H{trial[3]} · {trial[4] >= 0 ? '+' : ''}{trial[4].toFixed(3)} gross R</span></>}
              {exclusion && <span className="criterion-excluded">{trial ? 'Excluded: ' : ''}{trial ? exclusion : noTrialReason}</span>}
              {episode.conflict && <span className="criterion-coverage">Headline/core conflict</span>}
              {notedIds.has(episode.id) && <span className="criterion-audited">Audited</span>}
            </span>
            <small>Headline m/m Δ {episode.readings[0]?.delta ?? '—'} · Core m/m Δ {episode.readings[1]?.delta ?? '—'}</small>
          </button>
        })}
      </div>
    </>}
  </div>
}
