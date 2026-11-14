import type { IChartApi, ISeriesApi, ISeriesPrimitive, Time } from 'lightweight-charts'

/** The native divider's nine-pixel grab area overlaps the price pane. */
export function isChartPaneDivider(chart: IChartApi, target: EventTarget | null) {
  const row = target instanceof HTMLElement ? target.closest('tr') : null
  return row !== null && chart.panes().some((pane, index) => index > 0 && pane.getHTMLElement()?.previousElementSibling === row)
}

/** Keep divider gestures out of price navigation, including deferred native paints. */
export function createChartPaneResize(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  const element = chart.chartElement()
  let snapshot: { dates: { from: number; to: number } | null; prices: { from: number; to: number } | null; auto: boolean } | undefined
  let frame: number | null = null, finishing = false
  let requestUpdate = () => {}
  const preserve = () => {
    if (!snapshot) return
    const dates = chart.timeScale().getVisibleLogicalRange(), prices = chart.priceScale('right').getVisibleRange()
    if (snapshot.dates && (!dates || Math.abs(dates.from - snapshot.dates.from) > 1e-8 || Math.abs(dates.to - snapshot.dates.to) > 1e-8))
      chart.timeScale().setVisibleLogicalRange(snapshot.dates)
    if (snapshot.prices && (!prices || prices.from !== snapshot.prices.from || prices.to !== snapshot.prices.to))
      chart.priceScale('right').setVisibleRange(snapshot.prices)
  }
  const schedule = () => {
    if (!snapshot || frame !== null) return
    frame = window.requestAnimationFrame(() => {
      frame = null; preserve()
      if (finishing && snapshot) {
        const auto = snapshot.auto; snapshot = undefined; finishing = false
        if (auto) chart.priceScale('right').setAutoScale(true)
        requestUpdate()
      }
    })
  }
  const removeEndListeners = () => {
    window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish)
    window.removeEventListener('mouseup', finish); window.removeEventListener('touchend', finish); window.removeEventListener('touchcancel', finish); window.removeEventListener('blur', finish)
  }
  const finish = () => {
    if (!snapshot) return
    finishing = true; schedule(); removeEndListeners()
  }
  const cancel = () => {
    removeEndListeners(); if (frame !== null) window.cancelAnimationFrame(frame)
    frame = null; finishing = false
    if (snapshot?.auto) chart.priceScale('right').setAutoScale(true)
    snapshot = undefined
  }
  const start = (event: Event) => {
    if (!isChartPaneDivider(chart, event.target) || snapshot || ('button' in event && event.button !== 0)) return
    snapshot = { dates: chart.timeScale().getVisibleLogicalRange(), prices: chart.priceScale('right').getVisibleRange(), auto: chart.priceScale('right').options().autoScale }
    if (snapshot.prices) chart.priceScale('right').setVisibleRange(snapshot.prices)
    for (const name of ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel', 'blur']) window.addEventListener(name, finish)
  }
  const primitive: ISeriesPrimitive<Time> = { attached: params => { requestUpdate = params.requestUpdate }, paneViews: () => [{ renderer: () => ({ draw: schedule }) }] }
  series.attachPrimitive(primitive)
  element.addEventListener('pointerdown', start, true); element.addEventListener('mousedown', start, true); element.addEventListener('touchstart', start, { capture: true, passive: true })
  return {
    cancel,
    get active() { return snapshot !== undefined },
    destroy() {
      cancel(); series.detachPrimitive(primitive)
      element.removeEventListener('pointerdown', start, true); element.removeEventListener('mousedown', start, true); element.removeEventListener('touchstart', start, true)
    },
  }
}
