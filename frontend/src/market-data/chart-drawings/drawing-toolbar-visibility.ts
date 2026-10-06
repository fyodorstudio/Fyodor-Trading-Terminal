const storageKey = 'fyodor.drawing-toolbar-visible.v1'

export function readDrawingToolbarVisible(): boolean {
  try {
    const saved = window.localStorage.getItem(storageKey)
    return saved !== null ? saved === 'true' : true
  } catch {
    return true
  }
}

export function saveDrawingToolbarVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(storageKey, String(visible))
  } catch {
    // The live setting remains active in memory if storage is unavailable.
  }
}
