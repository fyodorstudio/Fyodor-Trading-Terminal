import type { IChartApi, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import type { MacroTextEvent } from './macro-data'

export function createMacroEventsRow(chart: IChartApi) {
  const element = document.createElement('div'); element.className = 'macro-events-row'; element.setAttribute('aria-label', 'MFDI non-numerical events')
  const label = document.createElement('span'); label.textContent = 'Events'; element.append(label)
  const tooltip = document.createElement('div'); tooltip.className = 'macro-events-tooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true
  chart.chartElement().append(element, tooltip)
  let events: readonly MacroTextEvent[] = [], bars: readonly OhlcBar[] = [], seconds = 3600, frame: number | null = null
  let top = 0, width = 0, signature = '', visible = false, pinned = false, format: (at: number) => string = String
  const buttons = new Map<string, HTMLButtonElement>()
  const hideTooltip = () => { pinned = false; tooltip.hidden = true }
  const showTooltip = (items: MacroTextEvent[], x: number, keepOpen = false) => {
    pinned = keepOpen
    tooltip.replaceChildren()
    if (pinned) { const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.onclick = hideTooltip; tooltip.append(close) }
    for (const item of items) {
      const title = document.createElement('strong'), time = document.createElement('small'), details = document.createElement('p')
      title.textContent = item.title; time.textContent = item.at === null ? 'Date only' : format(item.at); details.textContent = item.details
      tooltip.append(title, time, details)
    }
    tooltip.style.left = `${Math.max(8, Math.min(x + 10, width - 330))}px`
    const height = chart.chartElement().clientHeight || top + 24
    tooltip.style.maxHeight = `${Math.max(60, Math.min(260, height - 16))}px`
    tooltip.hidden = false
    tooltip.style.top = `${Math.max(6, Math.min(top - tooltip.offsetHeight - 8, height - tooltip.offsetHeight - 6))}px`
  }
  function draw() {
    frame = null
    element.hidden = !visible; element.style.top = `${top}px`; element.style.width = `${width}px`
    if (!visible) { hideTooltip(); return }
    const groups: { x: number; items: MacroTextEvent[] }[] = []
    const range = chart.timeScale().getVisibleRange()
    const from = typeof range?.from === 'number' ? range.from - seconds : -Infinity, through = typeof range?.to === 'number' ? range.to + seconds : Infinity
    let first = 0, end = events.length
    while (first < end) { const mid = (first + end) >>> 1; if (events[mid].time < from) first = mid + 1; else end = mid }
    for (let i = first; i < events.length && events[i].time <= through; i++) {
      const item = events[i]
      let lo = 0, hi = bars.length
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) <= item.time) lo = mid + 1; else hi = mid }
      const bar = bars[lo - 1]
      let anchor = bar && item.time < Number(bar.time) + seconds ? Number(bar.time) : null
      const last = bars.at(-1)
      if (anchor === null && last && item.time >= Number(last.time) + seconds) anchor = Number(last.time) + Math.floor((item.time - Number(last.time)) / seconds) * seconds
      if (anchor === null) continue
      const x = chart.timeScale().timeToCoordinate(anchor as Time)
      if (x === null || x < 48 || x > width - 8) continue
      const previous = groups.at(-1)
      if (previous && x - previous.x < 15) previous.items.push(item)
      else groups.push({ x, items: [item] })
    }
    const next = JSON.stringify(groups.map(group => [group.x, group.items.map(item => item.id)]))
    if (next === signature) return
    signature = next; hideTooltip()
    for (const button of buttons.values()) button.remove()
    buttons.clear()
    for (const group of groups) {
      const button = document.createElement('button'); button.type = 'button'; button.style.left = `${group.x}px`
      button.textContent = group.items.length > 1 ? String(group.items.length) : '●'
      button.setAttribute('aria-label', group.items.map(item => item.title).join('; '))
      button.title = 'Hover to read · Click to keep open'
      button.onmouseenter = button.onfocus = () => { if (!pinned) showTooltip(group.items, group.x) }
      button.onmouseleave = button.onblur = () => { if (!pinned) hideTooltip() }
      button.onclick = event => { event.stopPropagation(); showTooltip(group.items, group.x, true) }
      button.onpointerdown = event => event.stopPropagation()
      element.append(button); buttons.set(group.items[0].id, button)
    }
  }
  const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(draw) }
  const scale = chart.timeScale()
  const outside = (event: Event) => { if (!element.contains(event.target as Node) && !tooltip.contains(event.target as Node)) hideTooltip() }
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hideTooltip() }
  tooltip.onpointerdown = event => event.stopPropagation()
  tooltip.onwheel = event => event.stopPropagation()
  document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape)
  scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
  return {
    sync(items: readonly MacroTextEvent[], candles: readonly OhlcBar[], step: number, shown: boolean, formatter: (at: number) => string) {
      if (events !== items || bars !== candles || seconds !== step || visible !== shown || format !== formatter) signature = ''
      events = items; bars = candles; seconds = step; visible = shown; format = formatter; schedule()
    },
    position(nextTop: number, nextWidth: number) { if (top !== nextTop || width !== nextWidth) { top = nextTop; width = nextWidth; schedule() } },
    destroy() { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); element.remove(); tooltip.remove() },
  }
}
