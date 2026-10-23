export const eventIconsVisibilityKey = 'fyodor.chart-event-icons-visible.v1'

export function readEventIconsVisible(legacyVisible = true): boolean {
  try {
    const saved = window.localStorage.getItem(eventIconsVisibilityKey)
    return saved === 'true' ? true : saved === 'false' ? false : legacyVisible
  } catch {
    return legacyVisible
  }
}

export function saveEventIconsVisible(visible: boolean): void {
  try { window.localStorage.setItem(eventIconsVisibilityKey, String(visible)) }
  catch { /* Keep the toggle usable in memory when browser storage is unavailable. */ }
}
