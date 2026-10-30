import { dailyVerdicts, directionIntensities, reviewCurrencies, safeThesisLink, thesisDay, validDirectionAnchor, validReviewStage, type DirectionAnchor, type CurrencyCheckpoint, type DailyDirection } from './thesis-model'

export type CurrencySummarySnapshot = { schema: 1; revision: string; review_id: string | null; as_of_utc: string | null;
  rows: { currency: string; verdict: DailyDirection['verdict'] | null; verified_utc: string | null;
    basis?: DailyDirection['basis']; intensity?: DailyDirection['intensity']; horizon?: string;
    review_status?: DailyDirection['review_status']; stage_note?: string;
    evidence_anchor?: DirectionAnchor | null; reassessment: CurrencyCheckpoint | null; reassessment_gap: string }[] }

const instant = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value))
export function validCurrencySummary(value: unknown): value is CurrencySummarySnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as CurrencySummarySnapshot
  return item.schema === 1 && typeof item.revision === 'string'
    && (item.review_id === null ? item.as_of_utc === null : typeof item.review_id === 'string' && instant(item.as_of_utc))
    && Array.isArray(item.rows) && item.rows.length === 8 && item.rows.every((row, index) => row && row.currency === reviewCurrencies[index]
      && (row.verdict === null ? row.verified_utc === null && row.reassessment === null
        : item.review_id !== null && dailyVerdicts.includes(row.verdict) && instant(row.verified_utc))
      && typeof row.reassessment_gap === 'string' && (row.reassessment === null || validCheckpoint(row.reassessment, row.verified_utc)))
    && item.rows.every(row => row.basis == null ? row.intensity == null && !row.horizon : row.basis === 'standalone'
      && directionIntensities.includes(row.intensity!) && typeof row.horizon === 'string' && !!row.horizon.trim())
    && item.rows.every(row => validReviewStage(row) && (row.evidence_anchor == null || row.verdict !== null && validDirectionAnchor(row.evidence_anchor, item.as_of_utc!, row.verified_utc!)))
}

// This changes presentation only. Elapsed time never changes the saved verdict.
export function currencyAssessmentStatus(row: Pick<CurrencySummarySnapshot['rows'][number], 'reassessment' | 'reassessment_gap' | 'review_status' | 'stage_note'>, now: number) {
  if (row.reassessment_gap.trim()) return { label: 'Source gap', detail: row.reassessment_gap }
  const until = currencyUntil(row.reassessment, now)
  if (!row.reassessment) return { label: 'No checkpoint', detail: 'No research checkpoint is set.' }
  if (until.due) return { label: 'Checkpoint passed', detail: `The saved call has not incorporated this stage: ${row.reassessment.title}.` }
  if (row.review_status === 'provisional') return { label: 'Provisional', detail: row.stage_note! }
  return null
}

function validCheckpoint(item: CurrencyCheckpoint, cutoff: string | null) {
  return item && cutoff !== null && typeof item.title === 'string' && !!item.title.trim()
    && typeof item.note === 'string' && !!item.note.trim() && instant(item.verified_utc)
    && (item.event_at === null ? typeof item.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(item.event_date) && item.event_date >= thesisDay(cutoff)
      : instant(item.event_at) && item.event_date === null && Date.parse(item.event_at) > Date.parse(cutoff))
    && Array.isArray(item.sources) && item.sources.length > 0 && item.sources.some(source => source?.kind === 'web')
    && item.sources.every(source => source && typeof source.label === 'string' && typeof source.note === 'string'
      && typeof source.locator === 'string' && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))
}

export function currencyUntil(checkpoint: CurrencyCheckpoint | null, now: number, reassessmentGap = '') {
  if (!checkpoint) return reassessmentGap.trim() ? { label: 'Source gap', due: true } : { label: '—', due: false }
  if (!checkpoint.event_at) {
    const due = thesisDay(new Date(now).toISOString()) >= checkpoint.event_date!
    return { label: due ? 'Today · untimed' : 'Hour unknown', due }
  }
  const remaining = Date.parse(checkpoint.event_at) - now
  if (remaining <= 0) return { label: 'Passed', due: true }
  const minutes = Math.ceil(remaining / 60000), days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60)
  const duration = days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  return { label: duration, due: false }
}

export function currencyStaleness(assessedUtc: string | null | undefined, now: number) {
  if (!assessedUtc || !instant(assessedUtc)) return 'Unknown'
  const elapsed = now - Date.parse(assessedUtc)
  if (elapsed < 0) return 'Unknown'
  const minutes = Math.floor(elapsed / 60000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24)
  return days ? `${days}d ${hours % 24}h ago` : hours ? `${hours}h ${minutes % 60}m ago` : `${minutes}m ago`
}

export function currencyEvidenceAge(anchor: DirectionAnchor | null | undefined, now: number) {
  if (!anchor) return 'Undated'
  if (anchor.event_at) return currencyStaleness(anchor.event_at, now)
  if (!anchor.event_date) return 'Undated'
  const today = thesisDay(new Date(now).toISOString())
  const days = Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(anchor.event_date+'T00:00:00Z'))/86400000)
  return days < 0 ? 'Unknown' : days === 0 ? 'Today · hour unknown' : `~${days}d ago`
}
