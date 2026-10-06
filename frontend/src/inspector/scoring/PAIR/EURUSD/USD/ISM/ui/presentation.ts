export const sectorLabel = (sector: 'manufacturing' | 'services') => sector === 'manufacturing' ? 'Manufacturing' : 'Services'
export const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined,
  { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
