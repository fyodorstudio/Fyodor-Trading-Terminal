// Read/import old choices, but expose and persist only the current family scorer.
export type InspectorDetailView = 'table' | 'scoring' | 'r1'
export function isStoredInspectorDetailView(value: unknown) {
  return value === 'r1' || value === 'table' || value === 'scoring' || value === 'scoring-v2' || value === 'scoring-v3' || value === 'scoring-v4'
}
export function normalizeInspectorDetailView(value: unknown): InspectorDetailView {
  return value==='r1'?'r1':isStoredInspectorDetailView(value) && value !== 'table' ? 'scoring' : 'table'
}
