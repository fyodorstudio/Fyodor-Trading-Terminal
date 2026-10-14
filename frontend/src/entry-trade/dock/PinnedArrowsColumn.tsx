import { useMemo, useState } from 'react'
import { journalDate, readTablePreference, sortArrows, tablePreferenceKey, type ArrowSort } from './arrow-table'
import type { EntryTradePlanView } from './useEntryTradePlan'

const researchDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

export function PinnedArrowsColumn({ view }: { view: EntryTradePlanView }) {
  const { saveStatus, importError, clock, onDeleteArrow, onSelectArrowId, quotes, registeredArrows, selectedArrowId } = view
  const [preference, setPreference] = useState(readTablePreference)
  const activeCount = registeredArrows.filter(arrow => !arrow.archived).length
  const archivedCount = registeredArrows.length - activeCount
  const rows = useMemo(() => sortArrows(registeredArrows.filter(arrow => Boolean(arrow.archived) === preference.archived), preference.sort, clock.scope), [registeredArrows, preference, clock.scope])
  const update = (value: typeof preference) => {
    setPreference(value)
    try { localStorage.setItem(tablePreferenceKey, JSON.stringify(value)) } catch { /* View remains usable without preference storage. */ }
  }
  const sort = (column: ArrowSort['column']) => update({ ...preference, sort: { column, descending: preference.sort.column === column ? !preference.sort.descending : false } })
  const columns = [['symbol', 'PAIR'], ['date', 'DATE'], ['direction', 'DIR'], ['entryPrice', 'ENTRY'], ['slPrice', 'SL'], ['tpPrice', 'TP'], ['rrRatio', 'R:R']] as const
  return (
      <div className="entry-trade-col entry-trade-pinned-col">
        <div className="entry-trade-col-header">
          <span className="entry-trade-eyebrow">
            JOURNAL ENTRIES ({rows.length})
          </span>
          <div className="journal-table-toolbar">
            <button type="button" className="new-draft-btn-compact" aria-pressed={!preference.archived}
              onClick={() => { update({ ...preference, archived: false }); onSelectArrowId(null) }}>Active ({activeCount})</button>
            <button type="button" className="new-draft-btn-compact" aria-pressed={preference.archived}
              onClick={() => { update({ ...preference, archived: true }); onSelectArrowId(null) }}>Archived ({archivedCount})</button>
          </div>
        </div>
        {saveStatus && <div className="journal-sync-status" role="status">{saveStatus}</div>}

        {importError && <p role="alert">{importError}</p>}
        {rows.length === 0 ? (
          <div className="pinned-arrows-empty">
            <p className="pinned-empty-title">{preference.archived ? 'No archived entries.' : 'No journal entries yet.'}</p>
            <p className="pinned-empty-desc">
              Save an entry now; fill its direction and technical levels whenever you choose.
            </p>
          </div>
        ) : (
          <div className="pinned-arrows-table-wrapper">
            <table className="pinned-arrows-table">
              <thead>
                <tr>
                  {columns.map(([column, label]) => <th key={column} aria-sort={preference.sort.column === column ? preference.sort.descending ? 'descending' : 'ascending' : 'none'}>
                    <button type="button" className="journal-sort-button" onClick={() => sort(column)} aria-label={`Sort by ${label.toLowerCase()}`}>
                      {label}{preference.sort.column === column ? preference.sort.descending ? ' ↓' : ' ↑' : ''}
                    </button>
                  </th>)}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((arrow) => {
                  const isSelected = arrow.id === selectedArrowId
                  const isLong = arrow.direction === 'long'
                  const waiting = arrow.direction === 'waiting'
                  const precision = arrow.precision ?? quotes.find(quote => quote.symbol === arrow.symbol)?.precision
                    ?? (arrow.symbol.includes('JPY') ? 3 : 5)
                  const date = journalDate(arrow, clock.scope)
                  const dateStr = date == null ? 'Date unset' : researchDate.format(new Date(date))
                  return (
                    <tr
                      key={arrow.id}
                      data-arrow-id={arrow.id}
                      className={`pinned-arrow-row ${isSelected ? 'selected' : ''}`}
                      tabIndex={0}
                      onClick={() => onSelectArrowId(arrow.id)}
                      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectArrowId(arrow.id) } }}
                    >
                      <td className="pinned-pair">{arrow.symbol}</td>
                      <td className="pinned-date">{dateStr}</td>
                      <td>
                        <span className={`dir-badge ${waiting ? 'waiting' : isLong ? 'long' : 'short'}`}>
                          {waiting ? 'WAITING' : isLong ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="mono">{arrow.entryPrice == null ? '—' : arrow.entryPrice.toFixed(precision)}</td>
                      <td className="mono">{arrow.slPrice == null ? '—' : arrow.slPrice.toFixed(precision)}</td>
                      <td className="mono">{arrow.tpPrice == null ? '—' : arrow.tpPrice.toFixed(precision)}</td>
                      <td className="mono font-bold text-accent">{arrow.rrRatio == null ? '—' : `${arrow.rrRatio >= 0 ? '+' : ''}${arrow.rrRatio.toFixed(2)}R`}</td>
                      <td className="journal-row-actions">
                        <button
                          type="button"
                          className="pinned-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteArrow(arrow.id)
                          }}
                          title="Delete this pinned arrow"
                          aria-label="Delete pinned arrow"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
  )
}
