import { macroEventRowKey } from './macro-event-key'
import { createMacroEventPicker, createMacroCategoryForm } from './macro-series-editor'
import { macroCategoryColor, setMacroCategoryColor } from './macro-essentials'
import { defaultMacroCategories, deleteMacroCategory, macroLanes, macroLayout, moveMacroCategory, moveMacroRow, patchMacroLayout, toggleMacroCategory } from './macro-layout'
import { macroMetricVisible, toggleMacroAll, type MacroPreferences } from './macro-preferences'

type Row = { key: string; item: HTMLElement; dragButton: HTMLButtonElement }
let drawerSequence = 0
export function createMacroLaneControls(element: HTMLElement, redraw: () => void, change: (value: MacroPreferences) => void, options: { drawerChanged?: (open: boolean) => void; categorySelected?: () => void } = {}) {
  const makeButton = (label: string, text: string, action: () => void) => {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', label); button.title = label; button.textContent = text; button.onclick = action; return button
  }
  const layer = document.createElement('div'); layer.className = 'macro-inline-layer'
  const scroll = document.createElement('div'); scroll.className = 'macro-lane-scroll'; scroll.setAttribute('aria-label', 'Scroll MFDI lanes'); scroll.tabIndex = 0
  const drawer = document.createElement('section'); drawer.className = 'macro-series-drawer'; drawer.hidden = true
  drawer.id = `mfdi-series-${++drawerSequence}`; drawer.setAttribute('aria-label', 'MFDI series drawer'); drawer.dataset.macroLinked = 'false'
  const drawerHeader = document.createElement('div'); drawerHeader.className = 'macro-drawer-header'
  const title = makeButton('Move MFDI series window', 'Series', () => {}); title.className = 'macro-drawer-title'; title.title = 'Drag to move; arrow keys also move the window'
  const close = makeButton('Close MFDI series drawer', '×', () => toggleDrawer(false))
  const fit = makeButton('Fit all MFDI lanes', 'Fit lanes', () => fitAll())
  const addEvents = makeButton('Add MFDI events', '+ Events', () => picker.toggle()); addEvents.dataset.macroAddEvents = 'true'
  const spacing = document.createElement('input'); spacing.type = 'range'; spacing.min = '16'; spacing.max = '120'; spacing.step = '1'; spacing.setAttribute('aria-label', 'MFDI lane spacing')
  const spacingLabel = document.createElement('label'); spacingLabel.className = 'macro-drawer-spacing'; spacingLabel.append('Lane spacing', spacing)
  const drawerBody = document.createElement('div'); drawerBody.className = 'macro-drawer-body'
  const resize = makeButton('Resize MFDI series window', '◢', () => {}); resize.className = 'macro-drawer-resize'; resize.title = 'Drag to resize; arrow keys also resize'
  const picker = createMacroEventPicker(commit)
  const footer = document.createElement('div'); footer.className = 'macro-drawer-footer'
  const newCategory = makeButton('Add MFDI category', '+ Category', () => {
    if (footer.querySelector('.macro-category-form')) return
    const form = createMacroCategoryForm(() => preferences, next => {
      revealedCategory = next.categories?.find(category => !geometry.groups.some(group => group.id === category.id))?.id
      commit(next)
    }); footer.append(form.element); form.focus()
  })
  const emptyLabel = document.createElement('label'), empty = document.createElement('input'); empty.type = 'checkbox'; empty.setAttribute('aria-label', 'Show empty MFDI categories'); emptyLabel.append(empty, 'Empty groups')
  empty.onchange = () => { structure = ''; redraw() }
  footer.append(newCategory, emptyLabel)
  drawerHeader.append(title, addEvents, fit, close); drawer.append(drawerHeader, picker.element, spacingLabel, drawerBody, footer, resize); element.append(drawer)
  const universal = document.createElement('div'); universal.className = 'macro-drawer-universal macro-metric-control'
  const allButtons: { button: HTMLButtonElement; field: 'visible' | 'forecastVisible' | 'numbersVisible'; noun: string }[] = []
  const drawerGroups = new Map<string, HTMLElement>()
  let structure = '', revealedCategory: string | undefined
  const spacer = document.createElement('div'); scroll.append(spacer); element.append(layer, scroll)
  let rows: Row[] = [], preferences: MacroPreferences | undefined, geometry: ReturnType<typeof macroLanes> = { groups: [], height: 0 }
  let top = 0, available = 0, scrollY = 0, open = false, linked = false
  let drag: { kind: 'row' | 'category' | 'all'; id: string; start: number; delta: number; origin: HTMLElement | null } | null = null
  let cancelDrag = () => {}, suppressClick: HTMLElement | null = null
  let windowPoint: { x: number; y: number } | null = null, windowDragging = false, windowSize: { width: number; height: number } | null = null
  let viewportWidth = 0, viewportHeight = 0, drawerWidth = 0, defaultLeft = 0, defaultTop = 0, defaultHeight = 0
  let cancelWindowDrag = () => {}, scrollTimer: number | null = null
  const placeWindow = () => {
    drawerWidth = Math.max(0, Math.min(windowSize?.width ?? 560, viewportWidth - 8))
    const point = windowPoint ?? { x: defaultLeft, y: defaultTop }, requestedHeight = Math.max(0, windowSize?.height ?? defaultHeight)
    const minimumHeight = Math.min(120, requestedHeight, Math.max(0, viewportHeight - 8))
    const x = Math.max(0, Math.min(point.x, viewportWidth - drawerWidth)), y = Math.max(0, Math.min(point.y, viewportHeight - minimumHeight - 4))
    const height = Math.min(requestedHeight, Math.max(0, viewportHeight - y - 4))
    drawer.style.width = `${drawerWidth}px`; drawer.style.height = `${height}px`; drawer.style.maxHeight = `${height}px`; drawer.style.left = `${x}px`; drawer.style.top = `${y}px`
  }
  const resizeWindow = (width: number, height: number, x = parseFloat(drawer.style.left), y = parseFloat(drawer.style.top)) => {
    windowPoint = { x, y }; windowSize = { width: Math.min(Math.max(280, width), Math.max(0, viewportWidth - x - 4)), height: Math.min(Math.max(120, height), Math.max(0, viewportHeight - y - 4)) }; placeWindow()
  }
  const y = (key: string): number | null => {
    const row = geometry.groups.flatMap(group => group.rows).find(row => row.key === key)
    return row ? top + (preferences ? macroLayout(preferences).laneOffset ?? 0 : 0) + row.y - scrollY + (drag?.kind === 'all' ? drag.delta : 0) : null
  }
  function positionRows() {
    for (const row of rows) row.item.style.display = geometry.groups.some(group => group.collapsed && group.keys.includes(row.key)) ? 'none' : 'flex'
  }
  const request = () => { positionRows(); redraw() }
  function commit(next: MacroPreferences) { preferences = next; geometry = macroLanes(next); picker.sync(next); change(next); request() }
  const drawerDropGroup = (event: PointerEvent) => {
    const bounds = drawer.getBoundingClientRect(), body = drawerBody.getBoundingClientRect()
    const contains = (rect: DOMRect) => rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    if (!open || !contains(bounds) || !contains(body)) return
    return geometry.groups.find(group => { const rect = drawerGroups.get(group.id)?.getBoundingClientRect(); return rect && contains(rect) })
  }
  const highlightDrop = (id?: string) => {
    for (const [key, section] of drawerGroups) { if (key === id) section.setAttribute('data-macro-drop-target', 'true'); else section.removeAttribute('data-macro-drop-target') }
  }
  const start = (event: PointerEvent, kind: 'row' | 'category' | 'all', id: string) => {
    if (event.button !== 0 || !preferences || (kind === 'all' && !macroLayout(preferences).laneMode)) return
    if (kind !== 'all') { event.stopPropagation(); event.preventDefault() }
    cancelDrag(); drag = { kind, id, start: event.clientY, delta: 0, origin: event.currentTarget instanceof HTMLElement ? event.currentTarget : null }
    const move = (event: PointerEvent) => { if (!drag) return; drag.delta = event.clientY - drag.start; if (kind === 'all') request(); else highlightDrop(drawerDropGroup(event)?.id) }
    const finish = (event: PointerEvent) => {
      const state = drag, current = preferences, target = kind !== 'all' ? drawerDropGroup(event) : undefined
      if (!state || !current) { cancelDrag(); return }
      const moved = Math.abs(state.delta) > 3; cancelDrag(); if (!moved) return
      suppressClick = kind === 'all' ? null : state.origin
      if (kind === 'all') commit(patchMacroLayout(current, { laneOffset: (macroLayout(current).laneOffset ?? 0) + state.delta }))
      else if (target && kind === 'row') {
        const before = target.keys.find(key => { const rect = rows.find(row => row.key === key)?.item.getBoundingClientRect(); return key !== id && !target.collapsed && rect && rect.height > 0 && event.clientY < (rect.top + rect.bottom) / 2 })
        commit(moveMacroRow(current, id, target.id, before))
      } else if (target && target.id !== id) {
        const rect = drawerGroups.get(target.id)!.getBoundingClientRect(), index = geometry.groups.findIndex(group => group.id === target.id)
        commit(moveMacroCategory(current, id, event.clientY < (rect.top + rect.bottom) / 2 ? target.id : geometry.groups[index + 1]?.id))
      }
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelDrag() }
    const cancel = () => cancelDrag()
    cancelDrag = () => { drag = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); highlightDrop(); request() }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key)
  }
  const flushScroll = () => {
    if (scrollTimer === null) return
    window.clearTimeout(scrollTimer); scrollTimer = null
    if (preferences && scrollY !== (macroLayout(preferences).laneScroll ?? 0)) commit(patchMacroLayout(preferences, { laneScroll: scrollY }))
  }
  const saveScroll = () => { if (scrollTimer !== null) window.clearTimeout(scrollTimer); scrollTimer = window.setTimeout(flushScroll, 120) }
  window.addEventListener('pagehide', flushScroll)
  scroll.addEventListener('scroll', () => { if (!scroll.hidden && scrollY !== scroll.scrollTop) { scrollY = scroll.scrollTop; request(); saveScroll() } })
  drawer.addEventListener('wheel', event => {
    if ((event.target as HTMLElement)?.closest('.macro-picker-results')) { event.stopPropagation(); return }
    event.stopPropagation(); event.preventDefault()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? drawerBody.clientHeight : 1
    drawerBody.scrollTop = Math.max(0, Math.min(drawerBody.scrollHeight - drawerBody.clientHeight, drawerBody.scrollTop + event.deltaY * unit))
  }, { passive: false })
  const startWindowGesture = (event: PointerEvent, resizing: boolean) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); cancelDrag(); cancelWindowDrag()
    const original = windowPoint, originalSize = windowSize, x = parseFloat(drawer.style.left), y = parseFloat(drawer.style.top)
    const width = drawerWidth, height = windowSize?.height ?? (drawer.offsetHeight || defaultHeight)
    windowDragging = true
    const move = (next: PointerEvent) => {
      const dx = next.clientX - event.clientX, dy = next.clientY - event.clientY
      if (resizing) resizeWindow(width + dx, height + dy, x, y)
      else { windowPoint = { x: x + dx, y: y + dy }; placeWindow() }
    }
    const finish = () => { windowPoint = { x: parseFloat(drawer.style.left), y: parseFloat(drawer.style.top) }; cleanup() }
    const cancel = () => { windowPoint = original; windowSize = originalSize; cleanup(); placeWindow() }
    const key = (next: KeyboardEvent) => { if (next.key === 'Escape') cancel() }
    const cleanup = () => {
      windowDragging = false; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); cancelWindowDrag = () => {}
    }
    cancelWindowDrag = cancel
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key)
  }
  title.onpointerdown = event => startWindowGesture(event, false)
  resize.onpointerdown = event => startWindowGesture(event, true)
  title.onkeydown = event => {
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key]
    if (!direction) return
    event.preventDefault(); event.stopPropagation()
    windowPoint = { x: parseFloat(drawer.style.left) + direction[0] * 10, y: parseFloat(drawer.style.top) + direction[1] * 10 }; placeWindow()
    windowPoint = { x: parseFloat(drawer.style.left), y: parseFloat(drawer.style.top) }
  }
  resize.onkeydown = event => {
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key]
    if (!direction) return
    event.preventDefault(); event.stopPropagation()
    resizeWindow(drawerWidth + direction[0] * 10, (windowSize?.height ?? (drawer.offsetHeight || defaultHeight)) + direction[1] * 10)
  }
  for (const root of [layer, drawer]) {
    root.addEventListener('pointerdown', () => { suppressClick = null }, true)
    root.addEventListener('click', event => { const origin = suppressClick; suppressClick = null; if (origin && event.target instanceof Node && origin.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation() } }, true)
    for (const event of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) root.addEventListener(event, event => event.stopPropagation())
  }
  scroll.addEventListener('pointerdown', event => event.stopPropagation())
  const scrollLanes = (event: WheelEvent) => {
    if (!preferences || !macroLayout(preferences).laneMode) return
    event.preventDefault(); event.stopPropagation()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? available : 1
    scrollY = Math.max(0, Math.min(Math.max(0, geometry.height - available), scrollY + event.deltaY * unit))
    scroll.scrollTop = scrollY; request(); saveScroll()
  }
  for (const target of [layer, scroll]) target.addEventListener('wheel', scrollLanes, { passive: false })
  const toggleDrawer = (value = !open) => { if (!value) cancelWindowDrag(); open = value; drawer.hidden = !open; options.drawerChanged?.(open); if (open) { placeWindow(); close.focus() } }
  const escape = (event: KeyboardEvent) => { if (event.key !== 'Escape' || !open) return; event.stopPropagation(); if (windowDragging) cancelWindowDrag(); else if (drag) cancelDrag(); else toggleDrawer(false) }
  element.addEventListener('keydown', escape)
  const fitAll = () => {
    if (!preferences || !macroLayout(preferences).laneMode || !geometry.height) return
    const count = geometry.groups.reduce((sum, group) => sum + group.rows.length, 0)
    scrollY = 0; scroll.scrollTop = 0
    commit(patchMacroLayout(preferences, { laneOffset: 0, laneScroll: 0, laneSpacing: Math.max(16, Math.min(120, (available - 8) / count)) }))
  }
  spacing.oninput = () => { if (preferences) commit(patchMacroLayout(preferences, { laneSpacing: Number(spacing.value) })) }
  const updateCategorySelection = () => {
    for (const [id, section] of drawerGroups) section.querySelector('[data-macro-category-select]')?.setAttribute('aria-pressed', String(!linked && preferences && macroLayout(preferences).categoryTarget === id))
  }
  const rebuild = () => {
    if (!preferences) return
    const focus = document.activeElement, previousScroll = drawerBody.scrollTop
    drawerBody.replaceChildren(universal); drawerGroups.clear()
    for (const group of geometry.groups) {
      if (!group.keys.length && !empty.checked && group.id !== revealedCategory) continue
      const section = document.createElement('section'); section.dataset.macroDrawerCategory = group.id
      const heading = document.createElement('div'); heading.className = 'macro-drawer-category'
      const dragHandle = makeButton(`Move category ${group.label}`, '✥', () => {}); dragHandle.className = 'macro-row-drag'
      dragHandle.onpointerdown = event => start(event, 'category', group.id)
      dragHandle.onkeydown = event => {
        if (!preferences || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault(); event.stopPropagation(); const categories = geometry.groups, index = categories.findIndex(item => item.id === group.id)
        if (event.key === 'ArrowUp' && index > 0) commit(moveMacroCategory(preferences, group.id, categories[index - 1].id))
        if (event.key === 'ArrowDown' && index < categories.length - 1) commit(moveMacroCategory(preferences, group.id, categories[index + 2]?.id))
      }
      const collapse = makeButton(`Collapse ${group.label}`, '▾', () => {
        if (!preferences) return
        const folded = macroLayout(preferences).collapsed
        commit(patchMacroLayout(preferences, { collapsed: folded.includes(group.id) ? folded.filter(id => id !== group.id) : [...folded, group.id] }))
      }); collapse.dataset.macroCategoryFold = group.id
      const select = makeButton(`Select category ${group.label}`, `${group.label} (${group.keys.length})`, () => {
        if (!preferences) return
        options.categorySelected?.()
        commit(patchMacroLayout(preferences, { linked: false, categoryTarget: group.id, rowTarget: undefined }))
      }); select.dataset.macroCategorySelect = group.id
      const eye = makeButton(`Hide category ${group.label}`, '◉', () => { if (preferences) commit(toggleMacroCategory(preferences, group.id)) }); eye.dataset.macroCategoryVisibility = group.id
      const color = document.createElement('input'); color.type = 'color'; color.className = 'macro-color-button'; color.setAttribute('aria-label', `${group.label} category colour`); color.title = 'Category colour · all currencies'
      color.onchange = () => { if (preferences) commit(setMacroCategoryColor(preferences, group.id, color.value)) }
      heading.append(dragHandle, collapse, select, eye, color)
      if (!defaultMacroCategories.some(category => category.id === group.id)) {
        const edit = makeButton(`Edit category ${group.label}`, '⋯', () => {
          if (section.querySelector('.macro-category-form')) return
          const form = createMacroCategoryForm(() => preferences, commit, group.id)
          const remove = makeButton(`Delete category ${group.label}`, 'Delete category', () => { if (preferences) commit(deleteMacroCategory(preferences, group.id)) })
          form.element.append(remove); heading.after(form.element); form.focus()
        }); heading.append(edit)
      }
      section.append(heading)
      for (const key of group.keys) { const row = rows.find(row => row.key === key); if (row) section.append(row.item) }
      drawerBody.append(section); drawerGroups.set(group.id, section)
    }
    drawerBody.scrollTop = previousScroll
    if (focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true })
  }
  return {
    y, toggleDrawer, fitAll, scrollLanes, drawerId: drawer.id,
    setLinked(value: boolean) { linked = value; drawer.dataset.macroLinked = String(value); updateCategorySelection() },
    startPlotDrag(event: PointerEvent, _linked: boolean) { start(event, 'all', 'all') },
    setRows(next: Row[]) {
      rows = next; structure = ''; universal.replaceChildren(); allButtons.length = 0
      const name = document.createElement('strong'); name.textContent = 'All series'; universal.append(name, document.createElement('span'))
      for (const [kind, field, noun] of [['visibility', 'visible', 'series'], ['forecast', 'forecastVisible', 'forecasts'], ['numbers', 'numbersVisible', 'numbers']] as const) {
        const sample = rows.find(row => row.key !== macroEventRowKey)?.item.querySelector<HTMLButtonElement>(`[data-macro-${kind}]`)
        const button = sample ? sample.cloneNode(true) as HTMLButtonElement : makeButton('', kind === 'visibility' ? '◉' : kind === 'forecast' ? 'F' : 'N', () => {})
        button.removeAttribute(`data-macro-${kind}`); button.dataset.macroAll = kind
        button.onclick = () => { if (preferences) commit(toggleMacroAll(preferences, field)) }; allButtons.push({ button, field, noun }); universal.append(button)
      }
      universal.append(document.createElement('span'), document.createElement('span'))
      for (const row of rows) {
        row.item.dataset.macroRow = row.key; row.dragButton.onpointerdown = event => start(event, 'row', row.key)
        row.dragButton.onkeydown = event => {
          if (!preferences || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
          event.preventDefault(); event.stopPropagation(); const group = geometry.groups.find(group => group.keys.includes(row.key)); if (!group) return
          const index = group.keys.indexOf(row.key)
          if (event.key === 'ArrowUp' && index > 0) commit(moveMacroRow(preferences, row.key, group.id, group.keys[index - 1]))
          if (event.key === 'ArrowDown' && index < group.keys.length - 1) commit(moveMacroRow(preferences, row.key, group.id, group.keys[index + 2]))
        }
      }
    },
    position(next: MacroPreferences, width: number, height: number, inset: number, offset: number) {
      if (preferences?.activeCurrency !== next.activeCurrency) { cancelDrag(); if (scrollTimer !== null) window.clearTimeout(scrollTimer); scrollTimer = null; picker.element.hidden = true; revealedCategory = undefined }
      preferences = next; geometry = macroLanes(next); picker.sync(next); title.textContent = `${next.activeCurrency ?? next.currencies?.[0] ?? 'USD'} · Series`
      top = inset; available = Math.max(0, height - top)
      layer.style.top = `${offset + top}px`; layer.style.width = `${Math.max(0, width - 24)}px`; layer.style.height = `${available}px`
      scroll.style.top = layer.style.top; scroll.style.left = `${Math.max(0, width - 14)}px`; scroll.style.height = layer.style.height
      viewportWidth = element.clientWidth || width; viewportHeight = element.clientHeight || offset + height
      defaultHeight = Math.min(Math.max(height, 380), viewportHeight) - 8
      defaultLeft = Math.max(8, width - Math.min(560, viewportWidth - 8)); defaultTop = Math.max(4, Math.min(offset + 4, viewportHeight - defaultHeight - 4)); placeWindow()
      spacingLabel.hidden = !macroLayout(next).laneMode; fit.disabled = !macroLayout(next).laneMode; spacing.value = String(macroLayout(next).laneSpacing ?? 24)
      const numericRows = rows.filter(row => next.series[row.key])
      for (const { button, field, noun } of allButtons) {
        const states = numericRows.map(row => field === 'visible' ? macroMetricVisible(next, row.key) : next.series[row.key][field])
        if (field === 'visible') states.push(next.showEventRow !== false && !macroLayout(next).hiddenCategories?.includes(geometry.groups.find(group => group.keys.includes(macroEventRowKey))?.id ?? 'uncategorized'))
        const enabled = states.filter(Boolean).length
        button.disabled = states.length === 0; button.setAttribute('aria-pressed', enabled === 0 ? 'false' : enabled === states.length ? 'true' : 'mixed')
        button.setAttribute('aria-label', `${enabled ? 'Hide' : 'Show'} all MFDI ${noun}`); button.title = button.getAttribute('aria-label')!
        for (const slash of button.querySelectorAll('[data-eye-slash], [data-forecast-slash], [data-numbers-slash]')) slash.setAttribute('visibility', enabled ? 'hidden' : 'visible')
      }
      if (revealedCategory && geometry.groups.some(group => group.id === revealedCategory && group.keys.length > 0)) revealedCategory = undefined
      const signature = JSON.stringify([empty.checked, revealedCategory, geometry.groups.map(group => [group.id, group.label, group.keys])])
      if (signature !== structure) { structure = signature; rebuild() }
      for (const group of geometry.groups) {
        const section = drawerGroups.get(group.id); if (!section) continue
        const fold = section.querySelector<HTMLButtonElement>('[data-macro-category-fold]')!
        fold.textContent = group.collapsed ? '▸' : '▾'; fold.setAttribute('aria-label', `${group.collapsed ? 'Expand' : 'Collapse'} ${group.label}`); fold.setAttribute('aria-expanded', String(!group.collapsed))
        const eye = section.querySelector<HTMLButtonElement>('[data-macro-category-visibility]')!
        eye.textContent = group.hidden ? '○' : '◉'; eye.setAttribute('aria-label', `${group.hidden ? 'Show' : 'Hide'} category ${group.label}`); eye.setAttribute('aria-pressed', String(!group.hidden))
        const color = section.querySelector<HTMLInputElement>('input[type=color]')!; if (document.activeElement !== color) color.value = macroCategoryColor(next, group.id)
      }
      updateCategorySelection(); if (scrollTimer === null) scrollY = macroLayout(next).laneScroll ?? 0
      scroll.hidden = !macroLayout(next).laneMode || geometry.height <= available; spacer.style.height = `${geometry.height}px`
      scrollY = Math.max(0, Math.min(scrollY, geometry.height - available)); scroll.scrollTop = scrollY; positionRows()
    },
    destroy() { if (scrollTimer !== null) window.clearTimeout(scrollTimer); window.removeEventListener('pagehide', flushScroll); cancelWindowDrag(); cancelDrag(); element.removeEventListener('keydown', escape); layer.remove(); scroll.remove(); drawer.remove() },
  }
}
