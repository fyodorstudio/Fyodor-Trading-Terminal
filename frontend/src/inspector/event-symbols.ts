export const eventSymbols = [
  ['star', '★', 'Star'], ['sun', '☀', 'Sun'], ['cloud', '☁', 'Cloud'],
  ['umbrella', '☂', 'Umbrella'], ['snowflake', '❄', 'Snowflake'], ['moon', '☾', 'Moon'],
] as const
export type EventSymbol = typeof eventSymbols[number][0]
export function symbolGlyph(symbol: EventSymbol): string {
  // Text presentation allows the user's currency colour to apply to weather
  // glyphs instead of the platform replacing them with coloured emoji.
  return `${eventSymbols.find(([id]) => id === symbol)?.[1] ?? '★'}\uFE0E`
}

export function isEventSymbol(value: unknown): value is EventSymbol {
  return eventSymbols.some(([id]) => id === value)
}
