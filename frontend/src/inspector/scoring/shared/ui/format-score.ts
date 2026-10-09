export const formatScore = (value: number | null) => value === null ? '—' :
  value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
