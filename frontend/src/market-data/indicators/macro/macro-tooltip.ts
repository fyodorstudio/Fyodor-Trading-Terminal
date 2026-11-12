import { macroCatalog } from './macro-catalog'
import { macroValue, type MacroReading } from './macro-data'

export function createMacroTooltip(container: HTMLElement) {
  const element = document.createElement('div'); element.className = 'macro-release-tooltip'; element.hidden = true
  element.setAttribute('role', 'tooltip'); element.setAttribute('aria-label', 'MFDI release details')
  const connector = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); connector.classList.add('macro-tooltip-connector')
  connector.setAttribute('aria-hidden', 'true'); connector.style.display = 'none'
  const path = document.createElementNS(connector.namespaceURI, 'path'); connector.append(path); container.append(connector, element)
  return {
    element,
    hide() { element.hidden = true; connector.style.display = 'none' },
    show(key: string, reading: MacroReading, forecast: number | null | undefined, format: (time: number) => string) {
      element.replaceChildren()
      const title = document.createElement('strong'); title.textContent = macroCatalog[key].controlLabel
      const table = document.createElement('table'), head = document.createElement('tr'), values = document.createElement('tr')
      for (const [field, value] of [['Actual', reading.value], ['Forecast', forecast], ['Previous', reading.previous]] as const) {
        const th = document.createElement('th'); th.scope = 'col'; th.textContent = field
        const td = document.createElement('td'); td.dataset.macroTooltipField = field.toLowerCase()
        td.textContent = typeof value === 'number' && Number.isFinite(value) ? macroValue(key, value, reading) : '—'
        if (field === 'Actual' && (reading.impact === 'positive' || reading.impact === 'negative')) td.style.color = `var(--${reading.impact})`
        head.append(th); values.append(td)
      }
      const thead = document.createElement('thead'), tbody = document.createElement('tbody'); thead.append(head); tbody.append(values); table.append(thead, tbody)
      const time = document.createElement('time'); time.dateTime = new Date(reading.releasedAt).toISOString(); time.textContent = format(reading.releasedAt)
      element.append(title, table, time); element.hidden = false
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
