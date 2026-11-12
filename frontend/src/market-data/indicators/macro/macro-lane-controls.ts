import { macroLanes, macroLayout, moveMacroCategory, moveMacroRow, patchMacroLayout } from './macro-layout'
import { toggleMacroAll, type MacroPreferences } from './macro-preferences'

type Row = { key: string; item: HTMLElement; axisButton: HTMLButtonElement }
let drawerSequence = 0
export function createMacroLaneControls(element: HTMLElement, redraw: () => void, change: (value: MacroPreferences) => void, options: { drawerChanged?: (open: boolean) => void } = {}) {
  const layer = document.createElement('div'); layer.className = 'macro-inline-layer'
  const scroll = document.createElement('div'); scroll.className = 'macro-lane-scroll'; scroll.setAttribute('aria-label', 'Scroll MFDI lanes'); scroll.tabIndex = 0
  const drawer = document.createElement('section'); drawer.className = 'macro-series-drawer'; drawer.hidden = true
  drawer.id = `mfdi-series-${++drawerSequence}`
  drawer.setAttribute('aria-label', 'MFDI series drawer')
  const drawerHeader = document.createElement('div'); drawerHeader.className = 'macro-drawer-header'
  const title = document.createElement('strong'); title.textContent = 'Series'
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
  let drag: { kind: 'row' | 'category' | 'all'; id: string; start: number; delta: number; origin: HTMLElement | null } | null = null
  let cancelDrag = () => {}
  let suppressClick: HTMLElement | null = null
  const request = () => { positionRows(); redraw() }
  const delta = (key: string) => drag?.kind === 'all' ? drag.delta : drag?.kind === 'row' ? drag.id === key ? drag.delta : 0
    : drag?.kind === 'category' && geometry.groups.find(group => group.id === drag!.id)?.keys.includes(key) ? drag.delta : 0
  const y = (key: string): number | null => {
    const row = geometry.groups.flatMap(group => group.rows).find(row => row.key === key)
    return row ? top + (macroLayout(preferences!).laneOffset ?? 0) + row.y - scrollY + delta(key) : null
  }
  function positionRows() {
    if (!preferences || !macroLayout(preferences).laneMode) return
    for (const row of rows) row.item.style.display = y(row.key) === null ? 'none' : 'flex'

  }
  const start = (event: PointerEvent, kind: 'row' | 'category' | 'all', id: string) => {
    if (event.button !== 0 || !preferences || !macroLayout(preferences).laneMode) return
    if (kind !== 'all') event.stopPropagation()
    cancelDrag()
    drag = { kind, id, start: event.clientY, delta: 0, origin: event.currentTarget instanceof HTMLElement ? event.currentTarget : null }
    const move = (event: PointerEvent) => { if (drag) { drag.delta = event.clientY - drag.start; request() } }
    const finish = (event: PointerEvent) => {
      const state = drag, current = preferences
      if (!state || !current) { cancelDrag(); return }
      const drop = event.clientY - layer.getBoundingClientRect().top + scrollY - (macroLayout(current).laneOffset ?? 0)
      const moved = Math.abs(state.delta) > 3
      cancelDrag()
      if (!moved) return
      suppressClick = state.kind === 'all' ? null : state.origin
      const bounds = drawer.getBoundingClientRect()
      const inDrawer = open && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom && bounds.width > 0
      if (state.kind === 'all') { change(patchMacroLayout(current, { laneOffset: (macroLayout(current).laneOffset ?? 0) + state.delta })) }
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
    open = value; drawer.hidden = !open; options.drawerChanged?.(open)
    if (open) close.focus()
  }
  close.onclick = () => toggleDrawer(false)
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    if (drag) cancelDrag()
    else toggleDrawer(false)
  }
  element.addEventListener('keydown', escape)
  const fitAll = () => {
    if (!preferences || !macroLayout(preferences).laneMode || !geometry.height) return
    const unit = geometry.height / (macroLayout(preferences).laneSpacing ?? 28)
    scrollY = 0; scroll.scrollTop = 0
    change(patchMacroLayout(preferences, { laneOffset: 0, laneSpacing: Math.max(0.1, Math.min(120, (available - 8) / unit)) }))
  }
  fit.onclick = fitAll
  spacing.oninput = () => { if (preferences) change(patchMacroLayout(preferences, { laneSpacing: Number(spacing.value) })) }
  return {
    y, toggleDrawer, fitAll, drawerId: drawer.id,
    startGroupDrag: (event: PointerEvent) => start(event, 'all', 'all'),
    zoomAll(event: WheelEvent) {
      if (!preferences || !macroLayout(preferences).laneMode) return
      event.preventDefault(); event.stopPropagation()
      const layout = macroLayout(preferences), old = layout.laneSpacing ?? 28
      const next = Math.max(0.1, Math.min(120, old * Math.exp(-event.deltaY * 0.002)))
      const pointer = Number.isFinite(event.clientY) ? event.clientY - layer.getBoundingClientRect().top : available / 2
      const anchor = pointer + scrollY
      change(patchMacroLayout(preferences, { laneSpacing: next, laneOffset: anchor - (anchor - (layout.laneOffset ?? 0)) * next / old }))
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
      const drawerWidth = Math.max(0, Math.min(400, width - 20))
      drawer.style.top = `${offset + 4}px`; drawer.style.left = `${Math.max(8, width - drawerWidth)}px`; drawer.style.width = `${drawerWidth}px`; drawer.style.maxHeight = `${Math.max(40, height - 8)}px`
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
          const collapse = document.createElement('button'); collapse.type = 'button'; collapse.textContent = group.collapsed ? '▸' : '▾'
          collapse.setAttribute('aria-label', `${group.collapsed ? 'Expand' : 'Collapse'} ${group.label}`)
          collapse.setAttribute('aria-expanded', String(!group.collapsed))
          collapse.onclick = () => change(patchMacroLayout(next, { collapsed: group.collapsed
            ? macroLayout(next).collapsed.filter(id => id !== group.id) : [...macroLayout(next).collapsed, group.id] }))
          const label = document.createElement('button'); label.type = 'button'; label.textContent = `${group.label} (${group.keys.length})`
          label.setAttribute('aria-label', `Drag category ${group.label}`); label.onpointerdown = event => start(event, 'category', group.id)
          const section = document.createElement('section'); section.dataset.macroDrawerCategory = group.id
          const drawerHeading = document.createElement('div'); drawerHeading.className = 'macro-drawer-category'
          drawerHeading.append(collapse, label); section.append(drawerHeading)
          for (const key of group.keys) { const row = rows.find(row => row.key === key); if (row) section.append(row.item) }
          drawerBody.append(section); drawerGroups.set(group.id, section)
        }
        if (!geometry.groups.length) { const empty = document.createElement('p'); empty.textContent = 'No events selected. Add events in MFDI settings.'; drawerBody.append(empty) }
        drawerBody.scrollTop = drawerScroll
        if (restoreFocus && focus.isConnected) focus.focus({ preventScroll: true })
      }
      scroll.hidden = !lanes || geometry.height <= available; spacer.style.height = `${geometry.height}px`
      scrollY = Math.max(0, Math.min(scrollY, geometry.height - available)); scroll.scrollTop = scrollY
      if (lanes) positionRows()
      else for (const row of rows) row.item.style.display = 'flex'
    },
    destroy() { cancelDrag(); element.removeEventListener('keydown', escape); layer.remove(); scroll.remove(); drawer.remove() },
  }
}
