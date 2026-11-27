import { formatChartCrosshairTime } from '../../appearance/time-display/time-display-preference'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import type { OhlcBar } from '../contracts/OhlcBar'
import { replaySpeeds, type useChartReplay } from './use-chart-replay'
import './chart-replay.css'

type Props = {
  source: OhlcBar[]
  replay: ReturnType<typeof useChartReplay>
  historyLoading: boolean
  hasEarlier: boolean
  loadEarlier: () => void
}

export function ChartReplayDock({ source, replay, historyLoading, hasEarlier, loadEarlier }: Props) {
  const clock = useDisplayClock()
  const current = replay.index < 0 ? null : source[replay.index]
  const label = (bar: OhlcBar) => formatChartCrosshairTime(bar.time, clock.preference, clock.scope)
  return <section className="chart-replay" aria-label="Chart replay">
    <header className="chart-replay-controls">
      <button type="button" disabled={!current} aria-label="Previous candle" onClick={() => replay.seek(replay.index - 1)}>◀</button>
      <button type="button" disabled={replay.latest < 1} onClick={replay.togglePlay}>{replay.playing ? 'Pause' : 'Play'}</button>
      <button type="button" disabled={replay.end === null || replay.index >= replay.latest} aria-label="Next candle"
        onClick={() => replay.seek(replay.index + 1)}>▶</button>
      <label>Speed <select value={replay.speed} onChange={event => {
        const speed = replaySpeeds.find(value => value === Number(event.target.value))
        if (speed !== undefined) replay.setSpeed(speed)
      }}>{replaySpeeds.map(speed => <option key={speed} value={speed}>{speed.toFixed(speed === 1 || speed === 2 ? 0 : 2)}×</option>)}</select></label>
      <output>{replay.end !== null && current ? label(current) : 'Live'}</output>
      <button type="button" disabled={replay.end === null} onClick={replay.returnToLive}>Return to live</button>
      {hasEarlier && <button type="button" disabled={historyLoading} onClick={loadEarlier}>
        {historyLoading ? 'Loading earlier candles…' : 'Load earlier candles'}
      </button>}
    </header>
    <div className="chart-replay-ruler">
      <input type="range" aria-label="Replay playhead" aria-valuetext={current ? label(current) : 'No completed candles loaded'}
        min={0} max={Math.max(1, replay.latest)} value={Math.max(0, replay.index)} disabled={replay.latest < 1}
        onChange={event => replay.seek(event.target.valueAsNumber)} />
      {replay.latest >= 0 && <div className="chart-replay-endpoints"><span>{label(source[0])}</span><span>{label(source[replay.latest])}</span></div>}
    </div>
  </section>
}
