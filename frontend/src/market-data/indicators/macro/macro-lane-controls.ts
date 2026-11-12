import { macroLanes, macroLayout, macroSelection, moveMacroCategory, moveMacroRow, patchMacroLayout } from './macro-layout'
import { macroMetricVisible, toggleMacroAll, type MacroPreferences } from './macro-preferences'

type Row = { key: string; item: HTMLElement; axisButton: HTMLButtonElement }
let drawerSequence = 0
export function createMacroLaneControls(element: HTMLElement, redraw: () => void, change: (value: MacroPreferences) => void, options: { drawerChanged?: (open: boolean) => void } = {}) {
  const layer = document.createElement('div'); layer.className = 'macro-inline-layer'
  const scroll = document.createElement('div'); scroll.className = 'macro-lane-scroll'; scroll.setAttribute('aria-label', 'Scroll MFDI lanes'); scroll.tabIndex = 0
  const drawer = document.createElement('section'); drawer.className = 'macro-series-drawer'; drawer.hidden = true
  drawer.id = `mfdi-series-${++drawerSequence}`
  drawer.setAttribute('aria-label', 'MFDI series drawer')
  const drawerHeader = document.createElement('div'); drawerHeader.className = 'macro-drawer-header'
  const title = document.createElement('button'); title.type = 'button'; title.textContent = 'Series'; title.className = 'macro-drawer-title'
  title.setAttribute('aria-label', 'Move MFDI series window'); title.title = 'Drag to move this window; arrow keys also move it'
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close MFDI series drawer')
  const fit = document.createElement('button'); fit.type = 'button'; fit.textContent = 'Fit all lanes'; fit.setAttribute('aria-label', 'Fit all MFDI lanes')
  const spacing = document.createElement('input'); spacing.type = 'range'; spacing.min = '6'; spacing.max = '120'; spacing.step = '1'; spacing.setAttribute('aria-label', 'MFDI lane spacing')
  const spacingLabel = document.createElement('label'); spacingLabel.className = 'macro-drawer-spacing'; spacingLabel.append('Lane spacing', spacing)
  const drawerBody = document.createElement('div'); drawerBody.className = 'macro-drawer-body'
  drawerHeader.append(title, fit, close); drawer.append(drawerHeader, spacingLabel, drawerBody); element.append(drawer)
  const universal = document.createElement('div'); universal.className = 'macro-drawer-universal macro-metric-control'
  const allButtons: { button: HTMLButtonElement; field: 'visible' | 'forecastVisible' | 'numbersVisible'; noun: string }[] = []
  const drawerGroups = new Map<string, HTMLElement>()
  const spacer = document.createElement('div'); scroll.append(spacer); element.append(layer, scroll)
  let rows: Row[] = [], preferences: MacroPreferences | undefined, geometry: ReturnType<typeof macroLanes> = { groups: [], height: 0 }
  let top = 0, available = 0, scrollY = 0, open = false
  let drag: { kind: 'row' | 'category' | 'all' | 'selected'; id: string; keys: string[]; start: number; delta: number; origin: HTMLElement | null } | null = null
  let cancelDrag = () => {}
  let suppressClick: HTMLElement | null = null
  let windowPoint: { x: number; y: number } | null = null, windowDragging = false
  let viewportWidth = 0, viewportHeight = 0, drawerWidth = 0, defaultLeft = 0, defaultTop = 0
  let cancelWindowDrag = () => {}
  const placeWindow = () => {
    const point = windowPoint ?? { x: defaultLeft, y: defaultTop }
    const x = Math.max(0, Math.min(point.x, viewportWidth - drawerWidth))
    const y = Math.max(0, Math.min(point.y, viewportHeight - Math.min(drawer.offsetHeight || 40, viewportHeight)))
    drawer.style.left = `${x}px`; drawer.style.top = `${y}px`
    if (windowPoint) windowPoint = { x, y }
  }
  const request = () => { positionRows(); redraw() }
  const delta = (key: string) => drag?.kind === 'all' ? drag.delta : drag?.kind === 'row' || drag?.kind === 'selected' ? drag.keys.includes(key) ? drag.delta : 0
    : drag?.kind === 'category' && geometry.groups.find(group => group.id === drag!.id)?.keys.includes(key) ? drag.delta : 0
  const y = (key: string): number | null => {
    const row = geometry.groups.flatMap(group => group.rows).find(row => row.key === key)
    const layout = preferences && macroLayout(preferences)
    return row ? top + (layout?.laneOffset ?? 0) + row.y + (layout?.rowOffsets?.[key] ?? 0) - scrollY + delta(key) : null
  }
  function positionRows() {
    if (!preferences) return
    for (const row of rows) row.item.style.display = geometry.groups.some(group => group.collapsed && group.keys.includes(row.key)) ? 'none' : 'flex'

  }
  const start = (event: PointerEvent, kind: 'row' | 'category' | 'all' | 'selected', id: string, keys = [id]) => {
    if (event.button !== 0 || !preferences || !macroLayout(preferences).laneMode) return
    if (kind === 'row' || kind === 'category') event.stopPropagation()
    cancelDrag()
    drag = { kind, id, keys, start: event.clientY, delta: 0, origin: event.currentTarget instanceof HTMLElement ? event.currentTarget : null }
    const move = (event: PointerEvent) => { if (drag) { drag.delta = event.clientY - drag.start; request() } }
    const finish = (event: PointerEvent) => {
      const state = drag, current = preferences
      if (!state || !current) { cancelDrag(); return }
      const drop = event.clientY - layer.getBoundingClientRect().top + scrollY - (macroLayout(current).laneOffset ?? 0)
      const moved = Math.abs(state.delta) > 3
      cancelDrag()
      if (!moved) return
      suppressClick = state.kind === 'all' || state.kind === 'selected' ? null : state.origin
      const bounds = drawer.getBoundingClientRect()
      const inDrawer = open && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom && bounds.width > 0
      if (state.kind === 'all') { change(patchMacroLayout(current, { laneOffset: (macroLayout(current).laneOffset ?? 0) + state.delta })) }
      else if (state.kind === 'selected') {
        const offsets = { ...macroLayout(current).rowOffsets }
        for (const key of state.keys) offsets[key] = (offsets[key] ?? 0) + state.delta
        change(patchMacroLayout(current, { rowOffsets: offsets }))
      }
      else if (state.kind === 'category') {
        const before = geometry.groups.filter(group => group.id !== state.id).find(group => {
          const rect = drawerGroups.get(group.id)?.getBoundingClientRect()
          return inDrawer && rect ? event.clientY < (rect.top + rect.bottom) / 2 : drop < (group.top + group.bottom) / 2
        })?.id
        change(moveMacroCategory(current, state.id, before))
      } else {
        const target = geometry.groups.find(group => inDrawer ? event.clientY < (drawerGroups.get(group.id)?.getBoundingClientRect().bottom ?? 0) : drop < group.bottom) ?? geometry.groups.at(-1)
        const before = target?.rows.find(row => {
          if (row.key === state.id) return false
          const rect = rows.find(item => item.key === row.key)?.item.getBoundingClientRect()
          return inDrawer && rect ? event.clientY < (rect.top + rect.bottom) / 2 : row.y > drop
        })?.key
        if (target) change(moveMacroRow(current, state.id, target.id, before))
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
  drawer.addEventListener('wheel', event => {
    event.stopPropagation(); event.preventDefault()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? drawerBody.clientHeight : 1
    drawerBody.scrollTop = Math.max(0, Math.min(drawerBody.scrollHeight - drawerBody.clientHeight, drawerBody.scrollTop + event.deltaY * unit))
  }, { passive: false })
  title.onpointerdown = event => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); cancelDrag(); cancelWindowDrag()
    const original = windowPoint, x = parseFloat(drawer.style.left), y = parseFloat(drawer.style.top)
    windowDragging = true
    const move = (next: PointerEvent) => { windowPoint = { x: x + next.clientX - event.clientX, y: y + next.clientY - event.clientY }; placeWindow() }
    const finish = () => cleanup()
    const cancel = () => { windowPoint = original; cleanup(); placeWindow() }
    const key = (next: KeyboardEvent) => { if (next.key === 'Escape') cancel() }
    const cleanup = () => {
      windowDragging = false; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); cancelWindowDrag = () => {}
    }
    cancelWindowDrag = cancel
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key)
  }
  title.onkeydown = event => {
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key]
    if (!direction) return
    event.preventDefault(); event.stopPropagation()
    windowPoint = { x: parseFloat(drawer.style.left) + direction[0] * 10, y: parseFloat(drawer.style.top) + direction[1] * 10 }; placeWindow()
  }
  for (const root of [layer, drawer]) {
    root.addEventListener('pointerdown', () => { suppressClick = null }, true)
    root.addEventListener('keydown', () => { suppressClick = null }, true)
    root.addEventListener('click', event => { const origin = suppressClick; suppressClick = null; if (origin && event.target instanceof Node && origin.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation() } }, true)
    for (const event of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) root.addEventListener(event, event => event.stopPropagation())
  }
  scroll.addEventListener('pointerdown', event => event.stopPropagation())
  layer.addEventListener('wheel', event => {
    if (!preferences || !macroLayout(preferences).laneMode || geometry.height <= available) return
    event.preventDefault(); event.stopPropagation(); scrollY = Math.max(0, Math.min(geometry.height - available, scrollY + event.deltaY))
    scroll.scrollTop = scrollY; request()
  }, { passive: false })
  const toggleDrawer = (value = !open) => {
    if (!value) cancelWindowDrag()
    open = value; drawer.hidden = !open; options.drawerChanged?.(open)
    if (open) { placeWindow(); close.focus() }
  }
  close.onclick = () => toggleDrawer(false)
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    if (windowDragging) cancelWindowDrag()
    else if (drag) cancelDrag()
    else toggleDrawer(false)
  }
  element.addEventListener('keydown', escape)
  const fitAll = () => {
    if (!preferences || !macroLayout(preferences).laneMode || !geometry.height) return
    const unit = geometry.height / (macroLayout(preferences).laneSpacing ?? 28)
    scrollY = 0; scroll.scrollTop = 0
    change(patchMacroLayout(preferences, { laneOffset: 0, rowOffsets: {}, laneSpacing: Math.max(0.1, Math.min(120, (available - 8) / unit)) }))
  }
  fit.onclick = fitAll
  spacing.oninput = () => { if (preferences) change(patchMacroLayout(preferences, { laneSpacing: Number(spacing.value) })) }
  return {
    y, toggleDrawer, fitAll, drawerId: drawer.id,
    startPlotDrag(event: PointerEvent, linked: boolean) {
      if (!preferences) return
      const keys = macroSelection(preferences)
      if (linked) start(event, 'all', 'all')
      else if (keys.some(key => macroMetricVisible(preferences!, key))) start(event, 'selected', keys[0], keys)
    },
    zoomAll(event: WheelEvent) {
      if (!preferences || !macroLayout(preferences).laneMode) return
      event.preventDefault(); event.stopPropagation()
      const layout = macroLayout(preferences), old = layout.laneSpacing ?? 28
      const next = Math.max(0.1, Math.min(120, old * Math.exp(-event.deltaY * 0.002)))
      const pointer = Number.isFinite(event.clientY) ? event.clientY - layer.getBoundingClientRect().top : available / 2
      const anchor = pointer + scrollY
      change(patchMacroLayout(preferences, { laneSpacing: next, laneOffset: anchor - (anchor - (layout.laneOffset ?? 0)) * next / old,
        rowOffsets: Object.fromEntries(Object.entries(layout.rowOffsets ?? {}).map(([key, value]) => [key, value * next / old])) }))
    },
    setRows(next: Row[]) {
      rows = next
      universal.replaceChildren(); allButtons.length = 0
      const allName = document.createElement('strong'); allName.textContent = 'All series'; universal.append(allName)
      for (const [kind, field, noun] of [['visibility', 'visible', 'series'], ['forecast', 'forecastVisible', 'forecasts'], ['numbers', 'numbersVisible', 'numbers']] as const) {
        const sample = rows[0]?.item.querySelector<HTMLButtonElement>(`[data-macro-${kind}]`)
        const button = sample ? sample.cloneNode(true) as HTMLButtonElement : document.createElement('button')
        button.type = 'button'; button.removeAttribute(`data-macro-${kind}`); button.dataset.macroAll = kind
        if (!sample) button.textContent = kind === 'visibility' ? '◉' : kind === 'forecast' ? 'F' : 'N'
        button.onclick = () => { if (preferences) change(toggleMacroAll(preferences, field)) }
        allButtons.push({ button, field, noun }); universal.append(button)
      }
      const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); universal.append(blank)
      for (const row of rows) {
        drawerBody.append(row.item); row.item.dataset.macroRow = row.key
        row.axisButton.addEventListener('pointerdown', event => start(event, 'row', row.key))

      }
    },
    position(next: MacroPreferences, width: number, height: number, inset: number, offset: number) {
      top = inset; available = Math.max(0, height - top)
      layer.style.top = `${offset + top}px`; layer.style.width = `${Math.max(0, width - 24)}px`; layer.style.height = `${available}px`
      scroll.style.top = layer.style.top; scroll.style.left = `${Math.max(0, width - 14)}px`; scroll.style.height = layer.style.height
      viewportWidth = element.clientWidth || width; viewportHeight = element.clientHeight || offset + height
      drawerWidth = Math.max(0, Math.min(400, viewportWidth - 20)); defaultLeft = Math.max(8, width - drawerWidth); defaultTop = offset + 4
      drawer.style.width = `${drawerWidth}px`; drawer.style.maxHeight = `${Math.max(40, Math.min(height, viewportHeight) - 8)}px`; placeWindow()
      spacingLabel.hidden = !macroLayout(next).laneMode; fit.disabled = !macroLayout(next).laneMode
      spacing.value = String(macroLayout(next).laneSpacing ?? 28)
      const lanes = macroLayout(next).laneMode
      for (const { button, field, noun } of allButtons) {
        const enabled = rows.filter(row => next.series[row.key]?.[field]).length
        const state = enabled === 0 ? 'false' : enabled === rows.length ? 'true' : 'mixed'
        button.disabled = rows.length === 0; button.setAttribute('aria-pressed', state)
        button.setAttribute('aria-label', `${enabled ? 'Hide' : 'Show'} all MFDI ${noun}`); button.title = button.getAttribute('aria-label')!
        for (const slash of button.querySelectorAll('[data-eye-slash], [data-forecast-slash], [data-numbers-slash]')) slash.setAttribute('visibility', enabled ? 'hidden' : 'visible')
      }
      if (preferences !== next) {
        preferences = next; geometry = macroLanes(next)
        const drawerScroll = drawerBody.scrollTop, focus = document.activeElement
        const restoreFocus = focus instanceof HTMLElement && drawerBody.contains(focus)
        drawerBody.replaceChildren(universal)
        drawerGroups.clear()
        for (const group of geometry.groups) {
          const collapse = document.createElement('button'); collapse.type = 'button'
          const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = group.collapsed ? '▸' : '▾'
          const label = document.createElement('span'); label.textContent = `${group.label} (${group.keys.length})`; collapse.append(arrow, label)
          collapse.setAttribute('aria-label', `${group.collapsed ? 'Expand' : 'Collapse'} ${group.label}`)
          collapse.setAttribute('aria-expanded', String(!group.collapsed))
          collapse.setAttribute('aria-pressed', String(macroLayout(next).categoryTarget === group.id))
          collapse.onclick = () => change(patchMacroLayout({ ...next,
            axisTarget: group.keys.find(key => macroMetricVisible(next, key)) ?? group.keys[0] ?? next.axisTarget }, {
            categoryTarget: group.id, collapsed: group.collapsed
              ? macroLayout(next).collapsed.filter(id => id !== group.id) : [...macroLayout(next).collapsed, group.id] }))
          collapse.title = 'Click to select every child and fold or expand this list; drag the plot to move the category, or drag this header to reorder it'
          collapse.onpointerdown = event => start(event, 'category', group.id)
          const section = document.createElement('section'); section.dataset.macroDrawerCategory = group.id
          const drawerHeading = document.createElement('div'); drawerHeading.className = 'macro-drawer-category'
          drawerHeading.append(collapse); section.append(drawerHeading)
          for (const key of group.keys) { const row = rows.find(row => row.key === key); if (row) section.append(row.item) }
          drawerBody.append(section); drawerGroups.set(group.id, section)
        }
        if (!geometry.groups.length) { const empty = document.createElement('p'); empty.textContent = 'No events selected. Add events in MFDI settings.'; drawerBody.append(empty) }
        drawerBody.scrollTop = drawerScroll
        if (restoreFocus && focus.isConnected) focus.focus({ preventScroll: true })
      }
      scroll.hidden = !lanes || geometry.height <= available; spacer.style.height = `${geometry.height}px`
      scrollY = Math.max(0, Math.min(scrollY, geometry.height - available)); scroll.scrollTop = scrollY
      positionRows()
    },
    destroy() { cancelWindowDrag(); cancelDrag(); element.removeEventListener('keydown', escape); layer.remove(); scroll.remove(); drawer.remove() },
  }
}
