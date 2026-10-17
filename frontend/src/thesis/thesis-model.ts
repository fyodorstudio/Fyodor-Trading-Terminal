import { majorForexPairs } from '../economic-calendar/forex/pairs'

export const thesisMonth = '2026-10'
export const thesisMonths = [{ value: '2026-07', label: 'JUL 2026' }, { value: '2026-10', label: 'OCT 2026' }] as const
export const thesisChanges = ['Baseline', 'Materially strengthened', 'Strengthened', 'Unchanged', 'Weakened', 'Reversed'] as const
export const verdicts = ['STRONG BUY', 'BUY', 'MIXED', 'SELL', 'STRONG SELL'] as const
export type ThesisTarget = { kind: 'highlight' | 'external'; reference: string; source_id: string | null; event_at: string | null; event_date: string | null }
export type ThesisSource = { kind: 'web' | 'local'; label: string; locator: string; note: string }
export type ThesisEntry = {
  id: string; row_id: string; expected_version: string | null; scope: string; as_of_utc: string; saved_utc: string
  title: string; verdict: typeof verdicts[number]; thesis: string; horizon: string; sources: ThesisSource[]
  note: string; provenance: 'assessment' | 'reconstruction'; target: ThesisTarget | null; journal_id: string | null
  change?: typeof thesisChanges[number] | null; change_reason?: string; compared_with?: string | null; as_of_precision?: 'minute' | 'date'
}
export type ThesisRow = ThesisEntry & { versions: ThesisEntry[]; comparison?: { id: string; as_of_utc: string; verdict: typeof verdicts[number] } | null }
export type ThesisSnapshot = { schema: 1; scope: string; month: string; source_id: string | null; revision: string; past: ThesisRow[] }

const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
const text = (value: unknown): value is string => typeof value === 'string'
function validTarget(value: unknown): value is ThesisTarget {
  if (!value || typeof value !== 'object') return false
  const item = value as ThesisTarget
  return ['highlight', 'external'].includes(item.kind) && text(item.reference) && !!item.reference
    && (item.kind === 'highlight' ? text(item.source_id) && !!item.source_id : item.source_id === null)
    && (item.event_at === null ? typeof item.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(item.event_date) : timestamp(item.event_at) && item.event_date === null)
}
export function safeThesisLink(locator: string) {
  try { const url = new URL(locator); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
function validEntry(value: unknown, scope: string): value is ThesisEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as ThesisEntry
  return item.scope === scope && ['id', 'row_id', 'title', 'thesis', 'horizon', 'note'].every(key => text(item[key as keyof ThesisEntry]))
    && verdicts.includes(item.verdict) && ['assessment', 'reconstruction'].includes(item.provenance)
    && timestamp(item.as_of_utc) && timestamp(item.saved_utc) && (item.target === null || validTarget(item.target))
    && (item.change === undefined || item.change === null || thesisChanges.includes(item.change))
    && (item.change_reason === undefined || text(item.change_reason))
    && (item.compared_with === undefined || item.compared_with === null || text(item.compared_with))
    && (item.as_of_precision === undefined || ['minute', 'date'].includes(item.as_of_precision))
    && (item.expected_version === null || text(item.expected_version)) && (item.journal_id === null || text(item.journal_id))
    && Array.isArray(item.sources) && item.sources.length > 0 && item.sources.every(source => source && text(source.label) && text(source.locator) && text(source.note)
      && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))
}
export function validThesisSnapshot(value: unknown, scope: string, month: string, sourceId: string | null): value is ThesisSnapshot {
  if (!value || typeof value !== 'object') return false
  const data = value as ThesisSnapshot
  return data.schema === 1 && data.scope === scope && data.month === month && data.source_id === sourceId && !!data.revision
    && Array.isArray(data.past) && data.past.every(item => validEntry(item, scope) && Array.isArray(item.versions)
      && item.versions.length > 0 && item.versions.every(entry => validEntry(entry, scope) && entry.row_id === item.row_id)
      && (item.comparison === undefined || item.comparison === null || text(item.comparison.id) && timestamp(item.comparison.as_of_utc) && verdicts.includes(item.comparison.verdict)))
}
export function readThesisPair() {
  try { const pair = localStorage.getItem('fyodor.thesis.pair.v1'); if (pair && majorForexPairs.includes(pair)) return pair } catch { /* Session default. */ }
  return 'NZDCHF'
}
export function readThesisMonth() {
  try { const month = localStorage.getItem('fyodor.thesis.month.v1'); if (thesisMonths.some(item => item.value === month)) return month! } catch { /* Session default. */ }
  return thesisMonth
}

export function thesisPrompt(scope: string, month: string, row?: ThesisRow) {
  const assessment = row
  const target = row?.target ?? null
  const skill = '$assess-trade-now at .agents/skills/assess-trade-now/SKILL.md'
  const broker = target?.source_id
  return `Follow AGENTS.md and use ${skill}. Assess ${scope} as of now; intraday horizon unless I specify otherwise. The Thesis dock is displaying ${month}; that display month is not an instruction to pretend today is in the past.\n\n` +
    (target ? `Occurrence: ${target.kind} ${target.reference}${target.source_id ? `, broker ${target.source_id}` : ''}. Title: ${row!.title}. Target stage (UTC internally): ${JSON.stringify(target)}. Verify the official timing, publication stages and fresh actuals.\n\n` : '') +
    `Research both currencies on the web; local calendar readings and saved research are optional except for identifying a named Highlight. No candles/OHLC. Reuse prepared context and verify decisive facts. A passed release time is not proof actuals arrived. Answer in chat using the skill's current format.\n\n` +
    `Also save the supported compact verdict, thesis change and its evidence versus the exact earlier assessment version, one or two thesis paragraphs, direct sources, actual assessment cutoff and horizon to the Thesis dock. Use change/compared_with/change_reason; weakening an existing buy/sell case does not establish the opposite case. This prompt authorizes that save. Read docs/THESIS.md and run pnpm analyst thesis read --scope ${scope} --month ${month}${broker ? ` --broker "${broker.replaceAll('"', '')}"` : ''} first. ` +
    (assessment ? `Append a revision to row_id ${assessment.row_id}, using its latest expected_version; preserve history. ` : 'Create a standalone assessment with target null. ') +
    `Use pnpm analyst thesis append with a ThesisRequest JSON file inside Lite. Preserve the real as_of_utc and saved time; never backdate a current assessment to fit this displayed month. Use the invocation's actual cutoff; do not anchor every day to 1:00 PM. Unknown historical publication hours use as_of_precision date with an explicit conservative cutoff note. If the actual month is outside JUL/OCT, disclose that it is not yet selectable. Do not alter pins, raw calendar readings or Entry Trade notes.`
}
