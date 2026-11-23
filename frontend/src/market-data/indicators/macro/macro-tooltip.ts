import { macroCatalog } from './macro-catalog'
import { macroActualDelta, macroValue, type MacroPendingDetails, type MacroReading } from './macro-data'

function formatDelta(key: string, reading: MacroReading, delta: number | null) {
  if (delta === null) return '—'
  const absolute = macroValue(key, Math.abs(delta), reading)
  const value = absolute.endsWith('%') ? absolute.replace(/%$/, ' pp') : absolute
  return `${delta < 0 ? '−' : delta > 0 ? '+' : ''}${value}`
}

const euroInflation = new Set(['999030011', '999030012', '999030013'])

export function createMacroTooltip(container: HTMLElement) {
  const element = document.createElement('div'); element.className = 'macro-release-tooltip'; element.hidden = true
  element.setAttribute('role', 'tooltip'); element.setAttribute('aria-label', 'MFDI release details')
  const connector = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); connector.classList.add('macro-tooltip-connector')
  connector.setAttribute('aria-hidden', 'true'); connector.style.display = 'none'
  const path = document.createElementNS(connector.namespaceURI, 'path'); connector.append(path); container.append(connector, element)
  return {
    element,
    hide() { element.hidden = true; connector.style.display = 'none' },
    show(key: string, reading: MacroReading, forecast: number | null | undefined, format: (time: number) => string, showDelta = false) {
      element.replaceChildren()
      const definition = macroCatalog[key], title = document.createElement('strong')
      const stage = reading.stage ?? (euroInflation.has(definition.eventId)
        ? ({ 1: 'Flash', 3: 'Final' } as Record<number, string>)[reading.revision ?? 0]
        : undefined)
      title.textContent = stage ? `${definition.controlLabel} · ${stage}` : definition.controlLabel
      const table = document.createElement('table'), head = document.createElement('tr'), values = document.createElement('tr')
      for (const [field, value] of [['Actual', reading.value], ['Forecast', forecast], ['Previous', reading.previous]] as const) {
        const th = document.createElement('th'); th.scope = 'col'; th.textContent = field
        const td = document.createElement('td'); td.dataset.macroTooltipField = field.toLowerCase()
        td.textContent = typeof value === 'number' && Number.isFinite(value) ? macroValue(key, value, reading) : '—'
        if (!showDelta && field === 'Actual' && (reading.impact === 'positive' || reading.impact === 'negative')) td.style.color = `var(--${reading.impact})`
        head.append(th); values.append(td)
      }
      if (showDelta) {
        const deltaHeader = document.createElement('th'), deltaValue = document.createElement('td')
        deltaHeader.scope = 'col'; deltaHeader.textContent = 'A-P Delta'
        deltaValue.dataset.macroTooltipField = 'delta'; deltaValue.textContent = formatDelta(key, reading, macroActualDelta(reading))
        head.append(deltaHeader); values.append(deltaValue)
      }
      const thead = document.createElement('thead'), tbody = document.createElement('tbody'); thead.append(head); tbody.append(values); table.append(thead, tbody)
      const time = document.createElement('time'); time.dateTime = new Date(reading.releasedAt).toISOString(); time.textContent = format(reading.releasedAt)
      element.append(title, table, time); element.hidden = false
      if (reading.actualSource || reading.actualEvidence) {
        const source = document.createElement('small')
        source.textContent = reading.actualEvidence ? `Actual · ${reading.actualEvidence.name}` : 'Actual from official release'
        source.title = reading.actualEvidence?.url ?? reading.actualSource ?? ''
        element.append(source)
      }
      const forecastDetails = document.createElement('small')
      const surprise = forecast != null && Number.isFinite(forecast) ? reading.value - forecast : null
      forecastDetails.textContent = `${surprise === null ? '' : `Forecast · ${reading.forecastSource?.name ?? 'MT5'} · `}Surprise · ${formatDelta(key, reading, surprise)}`
      forecastDetails.title = reading.forecastSource?.url ?? ''
      element.append(forecastDetails)
    },
    showScheduled(items: MacroPendingDetails[], format: (time: number) => string) {
      element.replaceChildren()
      for (const item of items) {
        const title = document.createElement('strong'), forecast = document.createElement('p'), time = document.createElement('time')
        title.textContent = macroCatalog[item.key].controlLabel
        forecast.textContent = `${item.missing ? 'Actual unavailable · ' : ''}Forecast: ${item.forecast === undefined ? '—' : macroValue(item.key, item.forecast, item.format)}`
          + (item.forecast === undefined ? '' : ` · ${item.forecastSource?.name ?? 'MT5'}`)
        forecast.title = item.forecastSource?.url ?? ''
        time.dateTime = new Date(item.releasedAt).toISOString()
        time.textContent = (item.missing?.lastKnown ? 'Last known schedule · ' : '')
          + (item.missing?.dateOnly ? `${time.dateTime.slice(0, 10)} · Date only` : format(item.releasedAt))
        element.append(title, forecast, time)
      }
      element.hidden = false
    },
    position(x: number, y: number, offset: number, width: number, height: number) {
      element.style.maxWidth = `${Math.max(100, Math.min(440, width - 16))}px`
      const cardWidth = element.offsetWidth, cardHeight = element.offsetHeight
      const left = Math.max(6, Math.min(x + 14, width - cardWidth - 6))
      const top = Math.max(6, Math.min(offset + y - cardHeight - 18, height - cardHeight - 6))
      element.style.left = `${left}px`; element.style.top = `${top}px`
      connector.setAttribute('width', String(width)); connector.setAttribute('height', String(height)); connector.style.display = ''
      const endX = Math.max(left, Math.min(x, left + cardWidth)), endY = Math.max(top, Math.min(offset + y, top + cardHeight))
      path.setAttribute('d', `M${x} ${offset + y} L${endX} ${endY}`)
    },
    destroy() { element.remove(); connector.remove() },
  }
}
