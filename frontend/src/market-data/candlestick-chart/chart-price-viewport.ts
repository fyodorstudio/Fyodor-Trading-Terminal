type Range = { from: number; to: number }
type View = { range: Range; reference: number }
const valid = (range: Range | null): range is Range => !!range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from

/** Share price bounds across an instrument's timeframes, without carrying one
 * instrument's absolute prices into another instrument's price scale. */
export function createPriceViewportMemory() {
  const views = new Map<string, View>()
  let scope: string | null = null, instrument: string | null = null, broker: string | null = null, reference: number | null = null, inherited: View | null = null
  return {
    switchScope(next: string, nextInstrument: string, nextBroker: string | null, range: Range | null) {
      if (scope === next) return
      if (instrument && reference !== null) {
        if (valid(range)) {
          const view = { range: { ...range }, reference }
          views.set(instrument, view); inherited = broker === nextBroker ? view : null
        } else { views.delete(instrument); inherited = null }
      }
      if (broker !== nextBroker) inherited = null
      scope = next; instrument = nextInstrument; broker = nextBroker; reference = null
    },
    restore(price: number, precision: number): Range | null {
      reference = price
      const saved = instrument ? views.get(instrument) : undefined
      if (saved) return { ...saved.range }
      if (!inherited || !Number.isFinite(price) || !inherited.reference) return null
      const span = Math.max((inherited.range.to - inherited.range.from) * Math.abs(price / inherited.reference), 4 * 10 ** -precision)
      const offset = ((inherited.range.from + inherited.range.to) / 2 - inherited.reference) / (inherited.range.to - inherited.range.from)
      const center = price + offset * span, result = { from: center - span / 2, to: center + span / 2 }
      return valid(result) ? result : null
    },
    updateReference(price: number) { if (Number.isFinite(price)) reference = price },
  }
}
