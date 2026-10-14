import type { EntryTradePlanView } from './useEntryTradePlan'

export function PinnedArrowsColumn({ view }: { view: EntryTradePlanView }) {
  const { clock, onDeleteArrow, onSelectArrowId, quotes, registeredArrows, selectedArrowId } = view
  return (
      <div className="entry-trade-col entry-trade-pinned-col">
        <div className="entry-trade-col-header">
          <span className="entry-trade-eyebrow">
            PINNED ARROWS ({registeredArrows.length})
          </span>
        </div>

        {registeredArrows.length === 0 ? (
          <div className="pinned-arrows-empty">
            <p className="pinned-empty-title">No pinned arrows yet.</p>
            <p className="pinned-empty-desc">
              Fill the execution plan on the left, then pin your arrow.
            </p>
          </div>
        ) : (
          <div className="pinned-arrows-table-wrapper">
            <table className="pinned-arrows-table">
              <thead>
                <tr>
                  <th>PAIR</th>
                  <th>DATE</th>
                  <th>DIR</th>
                  <th>ENTRY</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>R:R</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {registeredArrows.map((arrow) => {
                  const isSelected = arrow.id === selectedArrowId
                  const isLong = arrow.direction === 'long'
                  const waiting = arrow.direction === 'waiting'
                  const precision = arrow.precision ?? quotes.find(quote => quote.symbol === arrow.symbol)?.precision
                    ?? (arrow.symbol.includes('JPY') ? 3 : 5)
                  const dateStr = clock.chart(arrow.time * 1000)
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
                      <td className="mono">{arrow.entryPrice.toFixed(precision)}</td>
                      <td className="mono">{arrow.slPrice.toFixed(precision)}</td>
                      <td className="mono">{arrow.tpPrice.toFixed(precision)}</td>
                      <td className="mono font-bold text-accent">+{arrow.rrRatio.toFixed(2)}R</td>
                      <td>
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
