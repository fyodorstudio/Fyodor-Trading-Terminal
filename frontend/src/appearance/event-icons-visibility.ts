const eventIconsVisibilityKey = 'fyodor.chart-event-icons-visible.v1'
const eventIconModes = ['off', 'wildcards', 'inspector', 'all'] as const
export type EventIconMode = typeof eventIconModes[number]

export function nextEventIconMode(mode: EventIconMode): EventIconMode {
  return eventIconModes[(eventIconModes.indexOf(mode) + 1) % eventIconModes.length]
}

export function readEventIconMode(): EventIconMode {
  try {
    const saved = window.localStorage.getItem(eventIconsVisibilityKey)
    // The old toggle saved 'true' even when the user had never changed it.
    if (saved === 'false') return 'off'
    return eventIconModes.find(mode => mode === saved) ?? 'wildcards'
  } catch {
    return 'wildcards'
  }
}

export function saveEventIconMode(mode: EventIconMode): void {
  try { window.localStorage.setItem(eventIconsVisibilityKey, mode) }
  catch { /* Keep the control usable in memory when browser storage is unavailable. */ }
}
