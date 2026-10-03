import { formatUnit } from './cpi-event-timeline-data'
import './cpi-event-timeline.css'

export type TimelineRelationship =
  | 'before'
  | 'simultaneous'
  | 'after_release_before_entry'
  | 'after_release_known_by_entry'
  | 'after_entry'
  | 'after'

export type TimelineGrossResult = {
  grossR: number
  outcome: string
  horizon: number
  stop: number
  target: number
}

export type TimelineSeriesRow = {
  series: string // 'Headline m/m', 'Core m/m', 'Headline y/y', 'Core y/y', 'm/m Sum', 'y/y Sum', or other indicator name
  actual?: number | string | null
  previous?: number | string | null
  revisedPrevious?: number | string | null
  delta?: number | string | null
  unit?: string | null
  multiplier?: string | null
  digits?: number | string | null
  direction?: 'Long' | 'Short' | 'Flat' | 'Missing' | 'CONTEXT_ONLY' | null
  proposedDirection?: 'Long' | 'Short' | 'Flat' | 'Missing' | null
  grossResult?: TimelineGrossResult | null
  isSumRow?: boolean
  eventId?: string | null
  valueId?: string | null
  countryCode?: string | null
  eligibility?: {
    isEligible: boolean
    exclusionReason: string | null
  } | null
}

export type TimelineReleaseBlock = {
  id: string
  eventId?: string | null
  family: string
  currency: string
  countryCode?: string | null
  releaseTimestamp: number
  releaseTimeText: string
  entryTimestamp?: number | null
  entryTimeText?: string | null
  relationship: TimelineRelationship
  timingUncertain?: boolean
  timeMode?: string
  rows: TimelineSeriesRow[]
}

export type CpiEventTimelineTableProps = {
  blocks?: TimelineReleaseBlock[] | null
  pendingMessage?: string
  horizon?: number
  stop?: number
  target?: number
  customResultHeader?: string
  selectedRowKey?: string | null
  onSelectRow?: (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => void
}

function formatValue(
  val: number | string | null | undefined,
  unit?: string | null,
  multiplier?: string | null
): string {
  if (val == null || val === '') return '—'
  const str = String(val).trim()
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'none') return '—'
  const unitLabel = formatUnit(unit, multiplier)
  return unitLabel ? `${str} ${unitLabel}` : str
}

function formatDelta(
  delta: number | string | null | undefined,
  unit?: string | null,
  multiplier?: string | null
): { text: string; className: string } {
  if (delta == null || delta === '') return { text: '—', className: '' }
  const str = String(delta).trim()
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'none') return { text: '—', className: '' }

  const num = parseFloat(str)
  if (isNaN(num)) return { text: str, className: '' }

  let className = ''
  let text = str
  if (num > 0) {
    className = 'positive'
    if (!str.startsWith('+')) {
      text = `+${str}`
    }
  } else if (num < 0) {
    className = 'negative'
  } else {
    className = 'neutral'
  }

  const unitLabel = formatUnit(unit, multiplier)
  return { text: unitLabel ? `${text} ${unitLabel}` : text, className }
}

function getRelationshipMeta(
  rel: TimelineRelationship,
  timingUncertain?: boolean
): { label: string; badgeClass: string } {
  let label = ''
  let badgeClass = ''

  switch (rel) {
    case 'before':
      label = 'Before CPI'
      badgeClass = 'before'
      break
    case 'simultaneous':
      label = timingUncertain ? 'Simultaneous (Tentative)' : 'Simultaneous'
      badgeClass = 'simultaneous'
      break
    case 'after_release_before_entry':
    case 'after_release_known_by_entry':
      label = timingUncertain ? 'After CPI (Pre-Entry, Tentative)' : 'After CPI (Pre-Entry)'
      badgeClass = 'pre-entry'
      break
    case 'after_entry':
    case 'after':
    default:
      label = 'After CPI Entry'
      badgeClass = 'after'
      break
  }

  return { label, badgeClass }
}

function formatUnpricedReason(row: TimelineSeriesRow): string {
  const reason = row.eligibility?.exclusionReason
  if (reason) {
    if (reason === 'FLAT_DIRECTION') return 'FLAT'
    if (reason === 'MISSING_DIRECTION') return 'MISSING'
    if (reason === 'CONTEXT_ONLY_FAMILY') return 'CONTEXT'
    if (reason === 'INSUFFICIENT_PATH_COVERAGE') return 'SHORT PATH'
    if (reason === 'ENTRY_DELAY_EXCEEDED') return 'ENTRY DELAY'
    if (reason === 'TIMING_UNCERTAIN') return 'TIME UNCERTAIN'
    if (reason === 'PATH_GAP_EXCEEDED') return 'GAP EXCEEDED'
    return reason
  }
  if (row.direction === 'Flat') return 'FLAT'
  if (row.direction === 'Missing') return 'MISSING'
  if (row.direction === 'CONTEXT_ONLY') return 'CONTEXT'
  return '—'
}

export function CpiEventTimelineTable({
  blocks,
  pendingMessage = 'Research pending — no audited results published.',
  horizon,
  stop,
  target,
  customResultHeader,
  selectedRowKey,
  onSelectRow,
}: CpiEventTimelineTableProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="timeline-pending-notice" role="status">
        <p>{pendingMessage}</p>
      </div>
    )
  }

  const resultHeader =
    customResultHeader ??
    (horizon != null && stop != null && target != null
      ? `Gross Result (H${horizon} · SL ${stop} · TP ${target})`
      : 'Gross Result (H240 · SL 1 ATR · TP 1 ATR)')

  return (
    <div className="timeline-table-container">
      {blocks.map((block) => {
        const { label: relLabel, badgeClass: relBadgeClass } = getRelationshipMeta(
          block.relationship,
          block.timingUncertain
        )

        const isExploratory =
          block.eventId === '840140001' ||
          block.eventId === '840020010' ||
          block.eventId === '840030001' ||
          (block.family ? block.family.includes('Initial Jobless') : false) ||
          (block.family ? block.family.includes('Retail Sales') : false) ||
          (block.family ? block.family.includes('PPI') : false)

        return (
          <section
            key={block.id}
            className="timeline-release-block"
            aria-label={`${block.family} ${relLabel} block`}
          >
            <header className="timeline-block-header">
              <div className="timeline-block-meta">
                <span className="timeline-block-family">
                  <strong>{block.family}</strong>{' '}
                  {block.countryCode ? `(${block.countryCode} · ${block.currency})` : `(${block.currency})`}
                </span>
                <span className={`timeline-block-relationship badge ${relBadgeClass}`}>
                  {relLabel.toUpperCase()}
                </span>
                {isExploratory && (
                  <span
                    className="timeline-exploratory-badge badge"
                    title="Exploratory Non-CPI Family with independent entry and levels"
                  >
                    EXPLORATORY
                  </span>
                )}
                {block.timingUncertain && (
                  <span
                    className="timeline-uncertain-badge badge"
                    title="Time mode is tentative or date-only; release-time timing not guaranteed"
                  >
                    TIME UNCERTAIN
                  </span>
                )}
              </div>
              <div className="timeline-block-times">
                <span>
                  Release: <b>{block.releaseTimeText}</b>
                </span>
                {block.entryTimeText && (
                  <>
                    <span className="timeline-dot">·</span>
                    <span>
                      Entry: <b>{block.entryTimeText}</b>
                    </span>
                  </>
                )}
              </div>
            </header>

            <table className="timeline-table" aria-label={`${block.family} series and results`}>
              <thead>
                <tr>
                  <th className="th-series">Series</th>
                  <th className="th-num">A</th>
                  <th className="th-num">P</th>
                  <th className="th-num">A−P</th>
                  <th className="th-dir">Direction</th>
                  <th className="th-result">{resultHeader}</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, idx) => {
                  const dir = row.direction
                  const dirClass =
                    dir === 'Long'
                      ? 'long'
                      : dir === 'Short'
                      ? 'short'
                      : dir === 'Flat'
                      ? 'neutral'
                      : dir === 'Missing'
                      ? 'missing'
                      : dir === 'CONTEXT_ONLY'
                      ? 'context'
                      : ''

                  const deltaInfo = formatDelta(row.delta, row.unit, row.multiplier)

                  const hasRevised =
                    row.revisedPrevious != null &&
                    row.revisedPrevious !== '' &&
                    String(row.revisedPrevious) !== String(row.previous)

                  const rowKey = `${block.id}:${row.series}:${idx}`
                  const isSelected = selectedRowKey === rowKey

                  return (
                    <tr
                      key={rowKey}
                      className={`${row.isSumRow ? 'sum-row ' : ''}${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectRow?.(block, row, rowKey)}
                      title="Click row to inspect on chart"
                    >
                      <td className="td-series">
                        <strong>{row.series}</strong>
                      </td>
                      <td className="td-num">{formatValue(row.actual, row.unit, row.multiplier)}</td>
                      <td className="td-num">
                        <div>{formatValue(row.previous, row.unit, row.multiplier)}</div>
                        {hasRevised && (
                          <div
                            className="revised-p-subtext"
                            title="Revised Previous value in source ledger"
                          >
                            Rev: {formatValue(row.revisedPrevious, row.unit, row.multiplier)}
                          </div>
                        )}
                      </td>
                      <td className={`td-num ${deltaInfo.className}`}>{deltaInfo.text}</td>
                      <td className="td-dir">
                        {dir && dir !== 'CONTEXT_ONLY' ? (
                          <span className={`direction-badge ${dirClass}`}>
                            {dir.toUpperCase()}
                          </span>
                        ) : dir === 'CONTEXT_ONLY' ? (
                          <span
                            className="direction-badge context"
                            title="Context only — no operational trading direction"
                          >
                            CONTEXT
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="td-result">
                        {row.grossResult ? (
                          <span
                            className={`gross-badge ${
                              row.grossResult.grossR >= 0 ? 'positive' : 'negative'
                            }`}
                          >
                            <b>{row.grossResult.grossR.toFixed(3)} R</b>
                            <span className="gross-outcome">({row.grossResult.outcome})</span>
                          </span>
                        ) : (
                          <span className="unpriced-reason-badge">
                            {formatUnpricedReason(row)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
