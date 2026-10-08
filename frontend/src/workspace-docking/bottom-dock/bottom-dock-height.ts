import type { BottomDockWindow } from './bottom-dock-window'

export const bottomDockHeightKey = 'fyodor.bottom-dock.height.v2'
export const legacyBottomDockHeightKeys: Partial<Record<BottomDockWindow, string>> = {
  inspector: 'fyodor.inspector.dock-height.v1', notebook: 'fyodor.notebook.dock-height.v1',
  activity: 'fyodor.activity.dock-height.v1', 'scatter-plot': 'fyodor.scatter-plot.dock-height.v1', alert: 'fyodor.alert.dock-height.v1',
}
export const defaultBottomDockHeight = 258
export const validBottomDockHeight = (height: unknown): height is number =>
  typeof height === 'number' && Number.isFinite(height) && height > 0 && height <= 100000

export function saveBottomDockHeight(height: number, storage: Storage = localStorage) {
  storage.setItem(bottomDockHeightKey, String(height))
  // Old exports remain importable, but new exports carry just one dock size.
  for (const key of Object.values(legacyBottomDockHeightKeys)) storage.removeItem(key)
}

export function readBottomDockHeight(activeWindow: BottomDockWindow | null): number {
  try {
    const shared = Number(localStorage.getItem(bottomDockHeightKey))
    if (validBottomDockHeight(shared)) return shared
    const order = [...new Set([...(activeWindow ? [activeWindow] : []), ...Object.keys(legacyBottomDockHeightKeys) as BottomDockWindow[]])]
    for (const dock of order) {
      const key = legacyBottomDockHeightKeys[dock]
      if (!key) continue
      const height = Number(localStorage.getItem(key))
      if (!validBottomDockHeight(height)) continue
      try { saveBottomDockHeight(height) } catch { /* Keep the migrated size for this session. */ }
      return height
    }
  } catch { /* Device storage may be unavailable. */ }
  return defaultBottomDockHeight
}
