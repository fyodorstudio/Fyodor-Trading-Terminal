import { macroLanes, macroLayout, moveMacroCategory, moveMacroRow, patchMacroLayout } from './macro-layout'
import type { MacroPreferences } from './macro-preferences'

type Row = { key: string; item: HTMLElement; axisButton: HTMLButtonElement }
export function createMacroLaneControls(element: HTMLElement, redraw: () => void, change: (value: MacroPreferences) => void) {
  const layer = document.createElement('div'); layer.className = 'macro-inline-layer'
  const content = document.createElement('div'); content.className = 'macro-inline-content'; layer.append(content)
  const scroll = document.createElement('div'); scroll.className = 'macro-lane-scroll'; scroll.setAttribute('aria-label', 'Scroll MFDI lanes'); scroll.tabIndex = 0
  const spacer = document.createElement('div'); scroll.append(spacer); element.append(layer, scroll)
  let rows: Row[] = [], preferences: MacroPreferences | undefined, geometry: ReturnType<typeof macroLanes> = { groups: [], height: 0 }
  let top = 0, available = 0, scrollY = 0
  let drag: { kind: 'row' | 'category'; id: string; start: number; delta: number; origin: HTMLElement | null } | null = null
  let cancelDrag = () => {}
  let suppressClick: HTMLElement | null = null
  const headers = new Map<string, HTMLElement>()
  const request = () => { positionRows(); redraw() }
  const delta = (key: string) => drag?.kind === 'row' ? drag.id === key ? drag.delta : 0
    : drag?.kind === 'category' && geometry.groups.find(group => group.id === drag!.id)?.keys.includes(key) ? drag.delta : 0
  const y = (key: string): number | null => {
    const row = geometry.groups.flatMap(group => group.rows).find(row => row.key === key)
    return row ? top + row.y - scrollY + delta(key) : null
  }
  function positionRows() {
    if (!preferences || !macroLayout(preferences).laneMode) return
    for (const row of rows) {
      const coordinate = y(row.key)
      row.item.style.display = coordinate === null ? 'none' : 'flex'
      if (coordinate !== null) row.item.style.top = `${coordinate - top - 11}px`
    }
    for (const group of geometry.groups) {
      const header = headers.get(group.id)
      if (header) header.style.top = `${group.top - scrollY + (drag?.kind === 'category' && drag.id === group.id ? drag.delta : 0)}px`
    }
  }
  const start = (event: PointerEvent, kind: 'row' | 'category', id: string) => {
    if (event.button !== 0 || !preferences || !macroLayout(preferences).laneMode) return
    event.stopPropagation(); cancelDrag()
    drag = { kind, id, start: event.clientY, delta: 0, origin: event.currentTarget instanceof HTMLElement ? event.currentTarget : null }
    const move = (event: PointerEvent) => { if (drag) { drag.delta = event.clientY - drag.start; request() } }
    const finish = (event: PointerEvent) => {
      const state = drag, current = preferences
      if (!state || !current) { cancelDrag(); return }
      const drop = event.clientY - layer.getBoundingClientRect().top + scrollY
      const moved = Math.abs(state.delta) > 3
      cancelDrag()
      if (!moved) return
      suppressClick = state.origin
      if (state.kind === 'category') {
        const before = geometry.groups.filter(group => group.id !== state.id).find(group => drop < (group.top + group.bottom) / 2)?.id
        change(moveMacroCategory(current, state.id, before))
      } else {
        const target = geometry.groups.find(group => drop < group.bottom) ?? geometry.groups.at(-1)
        if (target) change(moveMacroRow(current, state.id, target.id, target.rows.find(row => row.key !== state.id && row.y > drop)?.key))
      }
      request()
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelDrag() }
    cancelDrag = () => {
      drag = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); positionRows(); redraw()
    }
    const cancel = () => cancelDrag()
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key)
  }
  scroll.addEventListener('scroll', () => { scrollY = scroll.scrollTop; request() })
  layer.addEventListener('pointerdown', () => { suppressClick = null }, true)
  layer.addEventListener('keydown', () => { suppressClick = null }, true)
  layer.addEventListener('click', event => {
    if (!suppressClick) return
    const origin = suppressClick; suppressClick = null
    if (event.target instanceof Node && origin.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation() }
  }, true)
  for (const event of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) layer.addEventListener(event, event => event.stopPropagation())
  scroll.addEventListener('pointerdown', event => event.stopPropagation())
  layer.addEventListener('wheel', event => {
    if (!preferences || !macroLayout(preferences).laneMode || geometry.height <= available) return
    event.preventDefault(); event.stopPropagation(); scrollY = Math.max(0, Math.min(geometry.height - available, scrollY + event.deltaY))
    scroll.scrollTop = scrollY; request()
  }, { passive: false })
  return {
    y,
    setRows(next: Row[]) {
      rows = next
      for (const row of rows) {
        content.append(row.item); row.item.dataset.macroRow = row.key
        row.axisButton.addEventListener('pointerdown', event => start(event, 'row', row.key))
      }
    },
    position(next: MacroPreferences, anchors: Map<string, number>, width: number, height: number, inset: number, offset: number) {
      top = inset; available = Math.max(0, height - top)
      layer.style.top = `${offset + top}px`; layer.style.width = `${Math.max(0, width - 24)}px`; layer.style.height = `${available}px`
      scroll.style.top = layer.style.top; scroll.style.left = `${Math.max(0, width - 14)}px`; scroll.style.height = layer.style.height
      const lanes = macroLayout(next).laneMode
      if (preferences !== next) {
        preferences = next; geometry = macroLanes(next)
        for (const header of headers.values()) header.remove()
        headers.clear()
        for (const group of geometry.groups) {
          const header = document.createElement('div'); header.className = 'macro-category-header'; header.dataset.macroCategory = group.id
          const collapse = document.createElement('button'); collapse.type = 'button'; collapse.textContent = group.collapsed ? '▸' : '▾'
          collapse.setAttribute('aria-label', `${group.collapsed ? 'Expand' : 'Collapse'} ${group.label}`)
          collapse.setAttribute('aria-expanded', String(!group.collapsed))
          collapse.onclick = () => change(patchMacroLayout(next, { collapsed: group.collapsed
            ? macroLayout(next).collapsed.filter(id => id !== group.id) : [...macroLayout(next).collapsed, group.id] }))
          const label = document.createElement('button'); label.type = 'button'; label.textContent = `${group.label} (${group.keys.length})`
          label.setAttribute('aria-label', `Drag category ${group.label}`); label.onpointerdown = event => start(event, 'category', group.id)
          header.append(collapse, label); content.append(header); headers.set(group.id, header)
        }
      }
      for (const header of headers.values()) header.hidden = !lanes
      scroll.hidden = !lanes || geometry.height <= available; spacer.style.height = `${geometry.height}px`
      scrollY = Math.max(0, Math.min(scrollY, geometry.height - available)); scroll.scrollTop = scrollY
      if (lanes) positionRows()
      else {
        let last = -26
        for (const row of [...rows].sort((a, b) => (anchors.get(a.key) ?? top) - (anchors.get(b.key) ?? top))) {
          const coordinate = Math.max(last + 24, Math.max(0, Math.min((anchors.get(row.key) ?? top) - top - 11, available - 24)))
          row.item.style.display = 'flex'; row.item.style.top = `${coordinate}px`; last = coordinate
        }
      }
    },
    destroy() { cancelDrag(); layer.remove(); scroll.remove() },
  }
}
