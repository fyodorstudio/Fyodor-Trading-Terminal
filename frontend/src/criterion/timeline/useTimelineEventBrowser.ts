import { useState } from 'react'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'
import type { EventSection, TimelineEventGroup } from './timeline-event-view'

export type EventBrowserTab = 'anchor' | EventSection | 'selected'
export const eventPageSize = 8
export function eventDate(group: TimelineEventGroup): string { return group.releaseTimeText.slice(0, 10) }
type Selection = { tab: EventBrowserTab; date: string | null; query: string; page: number }

function selectionForGroup(group: TimelineEventGroup, groups: TimelineEventGroup[]): Selection {
  const dayGroups = groups.filter((candidate) => candidate.section === group.section && eventDate(candidate) === eventDate(group))
  return { tab: group.section, date: eventDate(group), query: '',
    page: Math.floor(dayGroups.findIndex((candidate) => candidate.id === group.id) / eventPageSize) }
}

// Browsing state only: changing tabs/dates/pages never changes chart selections.
export function useTimelineEventBrowser(view: TimelineEventAnnotations, hasAnchor: boolean) {
  const focused = view.groups.find((group) => group.id === view.focusedGroupId)
  const [selection, setSelection] = useState<Selection>(() => focused ? selectionForGroup(focused, view.groups) :
    { tab: hasAnchor ? 'anchor' : 'after', date: null, query: '', page: 0 })
  const [seenFocus, setSeenFocus] = useState(view.focusedGroupId)
  // A chart click is a new navigation request. Update before committing so the
  // target tab/day/page mounts immediately instead of scrolling a hidden row.
  if (seenFocus !== view.focusedGroupId) {
    setSeenFocus(view.focusedGroupId)
    if (focused) setSelection(selectionForGroup(focused, view.groups))
  }

  const counts = {
    before: view.groups.filter((group) => group.section === 'before').length,
    simultaneous: view.groups.filter((group) => group.section === 'simultaneous').length,
    after: view.groups.filter((group) => group.section === 'after').length,
    selected: view.selectedGroups.length,
  }
  const tabGroups = selection.tab === 'selected' ? view.selectedGroups :
    view.groups.filter((group) => group.section === selection.tab)
  const dates = [...new Set(tabGroups.map(eventDate))].sort()
  if (selection.tab === 'before') dates.reverse() // Start with the day nearest CPI.
  const date = selection.date === 'ALL' || selection.tab === 'selected' && selection.date === null ? 'ALL' :
    selection.date && dates.includes(selection.date) ? selection.date : dates[0] ?? 'ALL'
  const tokens = selection.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matching = tabGroups.filter((group) => {
    if (!tokens.length) return date === 'ALL' || eventDate(group) === date
    const text = [group.family, group.countryCode, group.currency, group.releaseTimeText,
      ...group.block.rows.map((row) => row.series)].join(' ').toLowerCase()
    return tokens.every((token) => text.includes(token))
  })
  const pageCount = Math.max(1, Math.ceil(matching.length / eventPageSize))
  const page = Math.min(Math.max(0, selection.page), pageCount - 1)
  const groups = matching.slice(page * eventPageSize, (page + 1) * eventPageSize)

  function navigate(update: Partial<Selection>) {
    view.setFocusedGroupId(null)
    setSelection((previous) => ({ ...previous, ...update }))
  }
  return { tab: selection.tab, query: selection.query, counts, dates, date, groups, matching,
    page, pageCount, tabGroups, searching: tokens.length > 0,
    selectTab: (tab: EventBrowserTab) => navigate({ tab, date: null, query: '', page: 0 }),
    selectDate: (date: string) => navigate({ date, query: '', page: 0 }),
    search: (query: string) => navigate({ query, page: 0 }),
    selectPage: (page: number) => navigate({ page }),
  }
}
