import { useSyncExternalStore } from 'react'

export type ScatterLineStyle = { visible: boolean; color: string; width: number }
export type ScatterGuideLevel = { id: number; visible: boolean; factor: number; color: string; width: number; shade: number }
export type ScatterAppearance = {
  dotSize: number; selectedDotSize: number; dotColor: string; higherColor: string; lowerColor: string
  grid: ScatterLineStyle; zero: ScatterLineStyle; inspectedDate: ScatterLineStyle; connection: ScatterLineStyle
  showGuides: boolean; showBands: boolean; guideStyle: 'solid' | 'dashed' | 'dotted'; guideOpacity: number
  levels: ScatterGuideLevel[]
  customLevels: ScatterGuideLevel[]
  magnitudeColors: readonly [string, string, string]
}

export const scatterAppearanceKey = 'fyodor.scatter-plot.appearance.v1'
const magnitudeFactors = [1 / 3, 2 / 3, 1]
const magnitudeColors = ['#0891b2', '#d97706', '#8b5cf6'] as const
export const defaultScatterAppearance: ScatterAppearance = {
  dotSize: 10, selectedDotSize: 14, dotColor: '#64748b', higherColor: '#18a77d', lowerColor: '#e45462',
  grid: { visible: true, color: '#94a3b8', width: .6 },
  zero: { visible: true, color: '#64748b', width: 1 },
  inspectedDate: { visible: true, color: '#6366f1', width: 1 },
  connection: { visible: true, color: '#64748b', width: 1.5 },
  showGuides: true, showBands: true, guideStyle: 'dashed', guideOpacity: 50,
  levels: magnitudeFactors.map((factor, index) => ({ id: index + 1, visible: true, factor, color: magnitudeColors[index], width: .7, shade: [12, 16, 20][index] })),
  customLevels: magnitudeFactors.map((factor, index) => ({ id: index + 1, visible: true, factor, color: magnitudeColors[index], width: .7, shade: [12, 16, 20][index] })),
  magnitudeColors,
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
  // The appearance editor admits eight guides; color shortcuts may additionally
  // restore the three canonical magnitude guides without discarding those eight.
  const levels = Array.isArray(item.levels) ? item.levels.slice(0, 11).flatMap((raw, index) => {
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
  // Migrate the old split palettes. Prefer an edited Custom palette; otherwise
  // inherit canonical P95 colors. Future edits always use this single palette.
  const editedCustom = Array.isArray(item.customLevels) && customLevels.some((level, index) => level.color !== d.magnitudeColors[index])
  const palette = magnitudeFactors.map((_, index) => color(Array.isArray(item.magnitudeColors) ? item.magnitudeColors[index] : undefined,
    editedCustom ? customLevels[index].color : levels.find((level) => matchesMagnitudeFactor(level, index))?.color ?? customLevels[index].color)) as [string, string, string]
  return {
    dotSize: number(item.dotSize, d.dotSize, 2, 32), selectedDotSize: number(item.selectedDotSize, d.selectedDotSize, 2, 40),
    dotColor: color(item.dotColor, d.dotColor),
    // Preserve colors saved before Higher/Lower replaced economic judgment labels.
    higherColor: color(item.higherColor, color(item.goodColor, d.higherColor)),
    lowerColor: color(item.lowerColor, color(item.badColor, d.lowerColor)),
    grid: line(item.grid, d.grid), zero: line(item.zero, d.zero), inspectedDate: line(item.inspectedDate, d.inspectedDate),
    connection: line(item.connection, d.connection),
    showGuides: bool(item.showGuides, d.showGuides), showBands: bool(item.showBands, d.showBands),
    guideStyle: item.guideStyle === 'solid' || item.guideStyle === 'dotted' ? item.guideStyle : d.guideStyle,
    guideOpacity: number(item.guideOpacity, d.guideOpacity, 0, 100), magnitudeColors: palette,
    levels: levels.map((level) => {
      const index = magnitudeFactors.findIndex((_, index) => matchesMagnitudeFactor(level, index))
      return index < 0 ? level : { ...level, color: palette[index] }
    }), customLevels: customLevels.map((level, index) => ({ ...level, color: palette[index] })),
  }
}
export function customMagnitudeGuideStyles(appearance: ScatterAppearance) {
  return appearance.customLevels
}
const matchesMagnitudeFactor = (level: ScatterGuideLevel, index: number) => Math.abs(level.factor - magnitudeFactors[index]) <= 4 * Number.EPSILON
export function magnitudeBandGuideStyles(appearance: ScatterAppearance, custom: boolean) {
  return custom ? appearance.customLevels : magnitudeFactors.map((_, index) =>
    appearance.levels.find((level) => matchesMagnitudeFactor(level, index)) ?? defaultScatterAppearance.levels[index])
}
export function withMagnitudeBandColor(appearance: ScatterAppearance, index: number, nextColor: string, custom: boolean): ScatterAppearance {
  if (index < 0 || index >= magnitudeFactors.length || !Number.isInteger(index) || !/^#[0-9a-f]{6}$/i.test(nextColor)) return appearance
  const found = appearance.levels.some((level) => matchesMagnitudeFactor(level, index))
  let newId = 1
  while (appearance.levels.some((level) => level.id === newId)) newId++
  // Recreate an absent canonical P95 guide without moving an unrelated guide.
  const levels = found || custom ? appearance.levels.map((level) => matchesMagnitudeFactor(level, index) ? { ...level, color: nextColor } : level) :
    [...appearance.levels, { ...defaultScatterAppearance.levels[index], color: nextColor,
      id: newId }]
  const palette = [...appearance.magnitudeColors] as [string, string, string]
  palette[index] = nextColor
  return { ...appearance, levels, magnitudeColors: palette,
    customLevels: appearance.customLevels.map((level, at) => at === index ? { ...level, color: nextColor } : level) }
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

// One subscribed snapshot for every dock/family and browser window. Colors,
// drafts and saved guide styles no longer diverge between mounted consumers.
const appearanceChanged = `${scatterAppearanceKey}:changed`
let cachedRaw: string | null | undefined
let cachedAppearance: ScatterAppearance | undefined
function immutableAppearance(appearance: ScatterAppearance) {
  for (const line of [appearance.grid, appearance.zero, appearance.inspectedDate, appearance.connection]) Object.freeze(line)
  for (const levels of [appearance.levels, appearance.customLevels]) {
    levels.forEach(Object.freeze); Object.freeze(levels)
  }
  Object.freeze(appearance.magnitudeColors)
  return Object.freeze(appearance)
}
export function readScatterAppearance(): ScatterAppearance {
  if (typeof window === 'undefined') return defaultScatterAppearance
  try {
    const raw = window.localStorage.getItem(scatterAppearanceKey)
    if (!cachedAppearance || raw !== cachedRaw) {
      cachedRaw = raw
      try { cachedAppearance = immutableAppearance(normalizeScatterAppearance(JSON.parse(raw ?? '{}'))) }
      catch { cachedAppearance = immutableAppearance(normalizeScatterAppearance(null)) }
    }
  } catch { /* Preserve session changes when device storage is unavailable. */ }
  return cachedAppearance ??= immutableAppearance(normalizeScatterAppearance(null))
}
export function saveScatterAppearance(appearance: ScatterAppearance) {
  const next = normalizeScatterAppearance(appearance), raw = JSON.stringify(next)
  if (JSON.stringify(readScatterAppearance()) === raw) return
  try { window.localStorage.setItem(scatterAppearanceKey, raw); cachedRaw = raw }
  catch { /* Shared session changes still apply when device storage is unavailable. */ }
  cachedAppearance = immutableAppearance(next)
  window.dispatchEvent(new window.Event(appearanceChanged))
}
function subscribeAppearance(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === scatterAppearanceKey || event.key === null) listener() }
  window.addEventListener(appearanceChanged, listener)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(appearanceChanged, listener); window.removeEventListener('storage', storage) }
}
export function useScatterAppearance() {
  return useSyncExternalStore(subscribeAppearance, readScatterAppearance, () => defaultScatterAppearance)
}
