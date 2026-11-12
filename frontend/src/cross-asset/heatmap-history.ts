import type { HeatmapBar, HeatmapHistory } from './heatmap-model'

function sameBars(left: HeatmapBar[], right: HeatmapBar[]) {
  return left.length === right.length && left.every((b, i) => b.time === right[i].time && b.open === right[i].open
    && b.high === right[i].high && b.low === right[i].low && b.close === right[i].close)
}

// Retain unchanged candle identities so adding one instrument does only its work.
export function mergeHeatmapHistory(previous: HeatmapHistory | null, next: HeatmapHistory, selected: string[]): HeatmapHistory {
  const current = previous?.source_id === next.source_id && previous.generation === next.generation && previous.year === next.year ? previous : null
  const symbols = { ...current?.symbols }
  let changed = !current || current.today !== next.today || current.pending !== next.pending
  for (const [name, incoming] of Object.entries(next.symbols)) {
    const old = symbols[name]
    const bars = old && sameBars(old.bars, incoming.bars) ? old.bars : incoming.bars
    const record = old && old.bars === bars && old.checked_at === incoming.checked_at && old.availability === incoming.availability
      ? old : { ...incoming, bars }
    changed ||= record !== old
    symbols[name] = record
  }
  const wanted = new Set(selected)
  let size = Object.keys(symbols).length
  for (const name of Object.keys(symbols)) {
    if (size <= 128) break
    if (!wanted.has(name)) { delete symbols[name]; changed = true; size-- }
  }
  return !changed && current ? current : { ...next, symbols }
}
