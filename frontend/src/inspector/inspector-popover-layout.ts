const filterWidth = 720
const margin = 16
const gap = 12
export const inspectorPopoversFit = (viewportWidth: number) => viewportWidth - filterWidth - gap - margin * 2 >= 320

export function inspectorCalendarPosition(viewportWidth: number, viewportHeight: number, center: number, filtersOpen: boolean) {
  const right = filtersOpen ? viewportWidth - Math.min(filterWidth, viewportWidth) - gap : viewportWidth
  const width = Math.max(1, Math.min(660, right - margin * 2))
  return { left: Math.max(margin, Math.min(center - width / 2, right - width - margin)),
    bottom: 32, width, maxHeight: Math.max(1, viewportHeight - 32 - margin) }
}
