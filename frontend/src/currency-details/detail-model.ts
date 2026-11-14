export type DetailReading = {
  value_id: string; event_id: string; period: string | null; name: string; value: number | null
  forecast: number | null; previous: number | null; revised_previous: number | null
  at: number | null; date: string; availability: string; captured_at: string
}
export function detailValue(value: number | null | undefined, unit: string) {
  return value == null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit}`
}
