export const raycasterVisibleKey = 'fyodor.raycaster.visible.v1'
export const raycasterPositionKey = 'fyodor.raycaster.position.v1'
export const defaultRaycasterPosition = { x: 14, y: 58 }
export function readRaycasterVisible() {
  try { return localStorage.getItem(raycasterVisibleKey) === 'true' } catch { return false }
}
export function saveRaycasterVisible(value: boolean) {
  try { localStorage.setItem(raycasterVisibleKey, JSON.stringify(value)) } catch { /* Session visibility still works. */ }
}
export function readRaycasterPosition() {
  try {
    const value = JSON.parse(localStorage.getItem(raycasterPositionKey) ?? 'null')
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) && value.x >= 0 && value.y >= 0 ?
      { x: value.x as number, y: value.y as number } : defaultRaycasterPosition
  } catch { return defaultRaycasterPosition }
}
export function saveRaycasterPosition(value: { x: number; y: number }) {
  try { localStorage.setItem(raycasterPositionKey, JSON.stringify(value)) } catch { /* Session dragging still works. */ }
}
