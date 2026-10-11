import type { NotebookPlanView } from './useNotebookPlan'

export function PinnedArrowsColumn({ view }: { view: NotebookPlanView }) {
  const { clock, onDeleteArrow, onSelectArrowId, precision, registeredArrows, selectedArrowId, selectedSymbol } = view
  return (
      <div className="notebook-col notebook-pinned-col">
        <div className="notebook-col-header">
          <span className="notebook-eyebrow">
            PINNED ARROWS ({registeredArrows.length})
          </span>
        </div>

        {registeredArrows.length === 0 ? (
          <div className="pinned-arrows-empty">
            <p className="pinned-empty-title">No pinned arrows for {selectedSymbol} yet.</p>
            <p className="pinned-empty-desc">
              Fill the execution plan on the left, then pin your arrow.
            </p>
          </div>
        ) : (
          <div className="pinned-arrows-table-wrapper">
            <table className="pinned-arrows-table">
              <thead>
                <tr>
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
                  const dateStr = clock.chart(arrow.time * 1000)
                  return (
                    <tr
                      key={arrow.id}
                      className={`pinned-arrow-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectArrowId(arrow.id)}
                    >
                      <td className="pinned-date">{dateStr}</td>
                      <td>
                        <span className={`dir-badge ${isLong ? 'long' : 'short'}`}>
                          {isLong ? 'LONG' : 'SHORT'}
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
