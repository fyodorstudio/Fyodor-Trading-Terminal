import type { EurSlot } from './contracts'
// Match the USD domain budget: inflation 40, labor/wages 40, activity 20.
export const eurSlotWeights: Record<EurSlot, number> = { inflation: 40, unemployment: 20, employment: 10, wages: 10, pmi: 15, gdp: 5 }
export const eurSlots = Object.keys(eurSlotWeights) as EurSlot[]
export const eurHalfLife = (slot: EurSlot) => ['employment','wages','gdp'].includes(slot) ? 90 : 30
export const eurExpiry = (slot: EurSlot) => ['employment','wages','gdp'].includes(slot) ? 150 : 60
export const relativeContextVersion = 'eurusd-relative-context-v1'
