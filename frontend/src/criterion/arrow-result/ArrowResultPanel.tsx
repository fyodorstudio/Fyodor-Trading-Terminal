import { exitLabel, type ResearchEpisode, type ResearchRule, type ResearchTrial } from '../audit-data'
import './arrow-result-panel.css'

type Props = { episode: ResearchEpisode | null; trial: ResearchTrial | null; rule: ResearchRule; onReturnLive: () => void }

export function ArrowResultPanel({ episode, trial, rule, onReturnLive }: Props) {
  if (!episode || !trial) return <div className="arrow-result-panel">Select a historical episode or chart arrow to inspect its result.</div>
  const direction = episode[rule.signal].direction
  const entry = episode.entryPrice
  const stop = entry - direction * rule.stop * episode.atr
  const target = entry + direction * rule.target * episode.atr
  const collision = rule.family === 'CPI' && episode.joblessCollision
  return (
    <section className="arrow-result-panel" aria-label="Historical arrow result">
      <div className="arrow-result-head">
        <div><strong>{rule.family} · EURUSD · {direction > 0 ? '↑ Long' : '↓ Short'}</strong>
          <span>{episode.releaseText} release · {episode.entryText} research entry · server timestamps</span></div>
        <button type="button" onClick={onReturnLive}>Return to live chart</button>
      </div>
      <div className="arrow-result-grid">
        <div><small>Archived calendar A/F/P</small><b>A {episode.actual || '—'} · F {episode.forecast || '—'} · P {episode.previous || '—'}</b></div>
        <div><small>Direction rule</small><b>{rule.signal === 'af' ? 'Actual − Forecast' : 'Actual − Previous'}</b></div>
        <div><small>Exploratory rule</small><b>SL {rule.stop} ATR · TP {rule.target} ATR · H{rule.horizon}</b></div>
        <div><small>Historical result</small><b>{exitLabel(trial[1])} at H{trial[2]} · {Number(trial[3]).toFixed(3)} gross R</b></div>
        <div><small>Entry / nominal SL / nominal TP</small><b>{entry.toFixed(5)} / {stop.toFixed(5)} / {target.toFixed(5)}</b></div>
        <div><small>Evidence flags</small><b>{trial[4] ? 'Dual-touch · ' : ''}{trial[6] ? 'Opening gap · ' : ''}{collision ? 'Jobless-claims collision' : 'No selected collision'}</b></div>
      </div>
      <p>Historical OHLC simulation only: same-bar dual touches are stop-first, prices are gross and omit trading costs. An arrow records an archived-rule direction, not a registered setup or a live recommendation. The exported Previous value is not proven to be the value known at release time. Source episode: {episode.id}.</p>
    </section>
  )
}
