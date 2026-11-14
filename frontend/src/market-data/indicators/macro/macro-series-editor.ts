import { isMacroTextEvent, macroCatalog } from './macro-catalog'
import { macroCategoryColor, macroEssentialGaps } from './macro-essentials'
import { macroCategories, macroCategory, moveMacroRow } from './macro-layout'
import { setMacroEvents, type MacroPreferences } from './macro-preferences'

export function createMacroEventPicker(change: (preferences: MacroPreferences) => void) {
  const element = document.createElement('section'); element.className = 'macro-drawer-picker'; element.hidden = true
  element.setAttribute('aria-label', 'Add MFDI events')
  const heading = document.createElement('strong'), close = document.createElement('button'); close.type = 'button'; close.textContent = 'Done'
  const tools = document.createElement('div'); tools.className = 'macro-picker-tools'; tools.append(heading, close)
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search events…'; search.setAttribute('aria-label', 'Search MFDI events')
  const category = document.createElement('select'); category.setAttribute('aria-label', 'Category for new events')
  const result = document.createElement('div'); result.className = 'macro-picker-results'
  const note = document.createElement('p'); note.className = 'macro-picker-note'
  element.append(tools, search, category, note, result)
  let preferences: MacroPreferences | undefined, signature = '', currency = ''
  const draw = () => {
    if (!preferences || element.hidden) return
    const nextCurrency = preferences.activeCurrency ?? 'USD'
    if (currency !== nextCurrency) { currency = nextCurrency; search.value = ''; signature = '' }
    heading.textContent = `Add ${currency} events`
    note.textContent = macroEssentialGaps[currency] ?? 'Announcements share the Speeches / Wildcards row.'
    const categories = macroCategories(preferences), selected = preferences.eventsByCurrency?.[currency] ?? []
    const next = JSON.stringify([currency, search.value, categories, selected])
    if (next === signature) return
    signature = next
    const selectedCategory = category.value; category.replaceChildren()
    const automatic = document.createElement('option'); automatic.value = ''; automatic.textContent = 'Use event’s category'; category.append(automatic)
    for (const group of categories) { const option = document.createElement('option'); option.value = group.id; option.textContent = group.label; category.append(option) }
    category.value = selectedCategory
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean)
    const scrollTop = result.scrollTop, focused = document.activeElement?.getAttribute('aria-label')
    result.replaceChildren()
    for (const [key, definition] of Object.entries(macroCatalog)) {
      if (definition.currency !== currency || !terms.every(term => `${definition.label} ${definition.country} ${definition.eventId}`.toLowerCase().includes(term))) continue
      const label = document.createElement('label'), input = document.createElement('input'), name = document.createElement('span'), kind = document.createElement('small')
      input.type = 'checkbox'; input.checked = selected.includes(key); input.setAttribute('aria-label', `Select ${definition.controlLabel}`)
      name.textContent = definition.controlLabel.replace(`${currency} · `, '')
      kind.textContent = isMacroTextEvent(key) ? 'Announcement · shared row' : categories.find(group => group.id === macroCategory(preferences!, key))?.label ?? 'Uncategorized'
      name.append(kind); label.append(input, name); result.append(label)
      input.onchange = () => {
        if (!preferences) return
        const current = preferences.eventsByCurrency?.[currency] ?? []
        let next = setMacroEvents(preferences, currency, input.checked ? [...current, key] : current.filter(item => item !== key))
        if (input.checked) next = { ...next, series: { ...next.series, [key]: { ...next.series[key], visible: true } } }
        if (input.checked && category.value && !isMacroTextEvent(key)) next = moveMacroRow(next, key, category.value)
        change(next)
      }
    }
    if (!result.children.length) { const empty = document.createElement('p'); empty.textContent = 'No matching events.'; result.append(empty) }
    result.scrollTop = scrollTop
    if (focused?.startsWith('Select ')) [...result.querySelectorAll('input')].find(input => input.getAttribute('aria-label') === focused)?.focus({ preventScroll: true })
  }
  search.oninput = draw
  close.onclick = () => { element.hidden = true }
  element.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); element.hidden = true } }
  return { element,
    toggle() { element.hidden = !element.hidden; if (!element.hidden) { draw(); search.focus() } },
    sync(next: MacroPreferences) { preferences = next; draw() },
  }
}

export function createMacroCategoryForm(preferences: () => MacroPreferences | undefined, change: (next: MacroPreferences) => void, categoryId?: string) {
  const element = document.createElement('div'); element.className = 'macro-category-form'
  const input = document.createElement('input'); input.maxLength = 80; input.placeholder = 'Category name'; input.setAttribute('aria-label', categoryId ? 'Rename MFDI category' : 'New MFDI category')
  input.value = preferences()?.categories?.find(category => category.id === categoryId)?.label ?? ''
  const save = document.createElement('button'); save.type = 'button'; save.textContent = categoryId ? 'Rename' : 'Add'
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'
  const error = document.createElement('span'); error.setAttribute('role', 'status')
  const finish = () => {
    const current = preferences(), name = input.value.trim()
    if (!current || !name) { error.textContent = 'Enter a name.'; return }
    const existing = macroCategories(current), id = categoryId ?? `custom-${crypto.randomUUID()}`
    const categories = categoryId ? existing.map(category => category.id === id ? { ...category, label: name } : category) : [...existing, { id, label: name }]
    if (macroCategories({ ...current, categories }).length !== categories.length) { error.textContent = 'A category with that name already exists.'; return }
    change({ ...current, categories, categoryColors: { ...current.categoryColors, [id]: macroCategoryColor(current, id) } }); element.remove()
  }
  save.onclick = finish; cancel.onclick = () => element.remove()
  input.onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); finish() }
    if (event.key === 'Escape') { event.stopPropagation(); element.remove() }
  }
  element.append(input, save, cancel, error)
  return { element, focus: () => input.focus() }
}
