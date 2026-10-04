export type ScatterLineStyle = { visible: boolean; color: string; width: number }
export type ScatterGuideLevel = { id: number; visible: boolean; factor: number; color: string; width: number; shade: number }
export type ScatterAppearance = {
  dotSize: number; selectedDotSize: number; dotColor: string; goodColor: string; badColor: string; quantileColor: string
  grid: ScatterLineStyle; zero: ScatterLineStyle; inspectedDate: ScatterLineStyle
  showGuides: boolean; showBands: boolean; guideStyle: 'solid' | 'dashed' | 'dotted'; guideOpacity: number
  levels: ScatterGuideLevel[]
  customLevels: ScatterGuideLevel[]
}

export const scatterAppearanceKey = 'fyodor.scatter-plot.appearance.v1'
export const defaultScatterAppearance: ScatterAppearance = {
  dotSize: 10, selectedDotSize: 14, dotColor: '#64748b', goodColor: '#18a77d', badColor: '#e45462', quantileColor: '#6366f1',
  grid: { visible: true, color: '#94a3b8', width: .6 },
  zero: { visible: true, color: '#64748b', width: 1 },
  inspectedDate: { visible: true, color: '#6366f1', width: 1 },
  showGuides: true, showBands: true, guideStyle: 'dashed', guideOpacity: 50,
  levels: [1 / 3, 2 / 3, 1].map((factor, index) => ({ id: index + 1, visible: true, factor, color: '#6366f1', width: .7, shade: [3.5, 7, 11][index] })),
  customLevels: [1 / 3, 2 / 3, 1].map((factor, index) => ({ id: index + 1, visible: true, factor, color: '#6366f1', width: .7, shade: [3.5, 7, 11][index] })),
}

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
function line(value: unknown, fallback: ScatterLineStyle): ScatterLineStyle {
  const item = object(value)
  return { visible: bool(item.visible, fallback.visible), color: color(item.color, fallback.color), width: number(item.width, fallback.width, .25, 6) }
}
export function normalizeScatterAppearance(value: unknown): ScatterAppearance {
  const item = object(value), d = defaultScatterAppearance
  const ids = new Set<number>()
  const levels = Array.isArray(item.levels) ? item.levels.slice(0, 8).flatMap((raw, index) => {
    const level = object(raw)
    if (typeof level.factor !== 'number' || !Number.isFinite(level.factor) || level.factor <= 0) return []
    let id = typeof level.id === 'number' && Number.isSafeInteger(level.id) && level.id > 0 && level.id <= 1e6 ? level.id : index + 1
    while (ids.has(id)) id++
    ids.add(id)
    return [{ id, visible: bool(level.visible, true), factor: number(level.factor, 1, .001, 10),
      color: color(level.color, '#6366f1'), width: number(level.width, .7, .25, 6), shade: number(level.shade, 7, 0, 100) }]
  }) : d.levels.map((level) => ({ ...level }))
  // Older preferences supplied only automatic guide levels. Preserve their
  // matching styles as the initial custom styles, without dropping extra guides.
  const customLevels = d.customLevels.map((fallback) => {
    const level = object(Array.isArray(item.customLevels) ? item.customLevels.find((raw) => object(raw).id === fallback.id) :
      levels.find((raw) => raw.id === fallback.id))
    return { ...fallback, visible: bool(level.visible, fallback.visible), color: color(level.color, fallback.color),
      width: number(level.width, fallback.width, .25, 6), shade: number(level.shade, fallback.shade, 0, 100) }
  })
  return {
    dotSize: number(item.dotSize, d.dotSize, 2, 32), selectedDotSize: number(item.selectedDotSize, d.selectedDotSize, 2, 40),
    dotColor: color(item.dotColor, d.dotColor), goodColor: color(item.goodColor, d.goodColor), badColor: color(item.badColor, d.badColor), quantileColor: color(item.quantileColor, d.quantileColor),
    grid: line(item.grid, d.grid), zero: line(item.zero, d.zero), inspectedDate: line(item.inspectedDate, d.inspectedDate),
    showGuides: bool(item.showGuides, d.showGuides), showBands: bool(item.showBands, d.showBands),
    guideStyle: item.guideStyle === 'solid' || item.guideStyle === 'dotted' ? item.guideStyle : d.guideStyle,
    guideOpacity: number(item.guideOpacity, d.guideOpacity, 0, 100), levels, customLevels,
  }
}
export function readScatterAppearance(): ScatterAppearance {
  try { return normalizeScatterAppearance(JSON.parse(window.localStorage.getItem(scatterAppearanceKey) ?? '{}')) }
  catch { return normalizeScatterAppearance(null) }
}
export function saveScatterAppearance(appearance: ScatterAppearance) {
  try { window.localStorage.setItem(scatterAppearanceKey, JSON.stringify(appearance)) }
  catch { /* Appearance still applies when device storage is unavailable. */ }
}
export function customMagnitudeGuideStyles(appearance: ScatterAppearance) {
  return appearance.customLevels
}
export function scatterGuideLevels(appearance: ScatterAppearance, threshold: number, customLimits?: readonly number[]) {
  if (customLimits) return customMagnitudeGuideStyles(appearance).map((level, index) => ({ ...level,
    factor: customLimits[index] / threshold, inner: index ? customLimits[index - 1] : 0, limit: customLimits[index],
  })).filter((level) => level.visible)
  let inner = 0
  return appearance.levels.filter((level) => level.visible).slice().sort((a, b) => a.factor - b.factor || a.id - b.id).map((level) => {
    const limit = threshold * level.factor, result = { ...level, inner, limit }
    inner = limit
    return result
  })
}
