import type { NotebookPlanView } from './useNotebookPlan'
import { RR_PRESETS } from './plan-math'

export function ExecutionPlanColumn({ view }: { view: NotebookPlanView }) {
  const { calculatedMetrics, customRrInput, direction, entryPrice, handleCustomRrBlur, handleCustomRrChange, handleEntryChange, handleSlPipsChange, handleSlPriceChange, handleTargetRrChange, handleTpPipsChange, handleTpPriceChange, handleUseMarketPrice, onDeleteArrow, onPlanChange, onSelectArrowId, plan, precision, quote, resetDraftPlanState, rrDropdownOpen, rrDropdownRef, selectedArrow, selectedSymbol, setRrDropdownOpen, slPrice, targetRr, tpPrice } = view
  return (
      <div className="notebook-col notebook-levels-col">
        <div className="notebook-col-header">
          <span className="notebook-eyebrow">
            {selectedArrow ? 'Pinned Execution Plan' : 'Draft Execution Plan'}
          </span>
          {selectedArrow ? (
            <div className="selected-arrow-header-actions">
              <button
                type="button"
                className="new-draft-btn-compact"
                onClick={resetDraftPlanState}
                title="Return to drafting a new setup plan"
              >
                + New Plan
              </button>
              <button
                type="button"
                className="delete-arrow-btn-compact"
                onClick={() => onDeleteArrow(selectedArrow.id)}
                title="Delete this registered setup arrow"
              >
                Delete
              </button>
            </div>
          ) : (
            (plan.entryPrice != null || plan.slPrice != null || plan.tpPrice != null) && (
              <div className="selected-arrow-header-actions">
                <button
                  type="button"
                  className="new-draft-btn-compact"
                  onClick={() => {
                    resetDraftPlanState()
                    onPlanChange({ ...plan, entryPrice: null, slPrice: null, tpPrice: null })
                  }}
                  title="Clear draft inputs and start a new plan"
                >
                  + New Plan
                </button>
              </div>
            )
          )}
        </div>

        {/* Symbol & Direction Segmented Switch */}
        <div className="notebook-symbol-strip">
          <strong className="notebook-symbol-title">{selectedSymbol}</strong>
          <div className="direction-segmented" role="group" aria-label="Order direction">
            <button
              type="button"
              className={`dir-seg-btn buy ${direction === 'long' ? 'active' : ''}`}
              onClick={() => {
                onPlanChange({ ...plan, direction: 'long' })
                onSelectArrowId(null)
              }}
              disabled={Boolean(selectedArrow)}
            >
              LONG (BUY)
            </button>
            <button
              type="button"
              className={`dir-seg-btn sell ${direction === 'short' ? 'active' : ''}`}
              onClick={() => {
                onPlanChange({ ...plan, direction: 'short' })
                onSelectArrowId(null)
              }}
              disabled={Boolean(selectedArrow)}
            >
              SHORT (SELL)
            </button>
          </div>
        </div>

        {/* Aligned Execution Parameters Grid */}
        <div className="execution-params-grid">
          {/* Entry Row: Price + Market Snap Button */}
          <div className="param-row">
            <label htmlFor="plan-entry" className="param-label">Entry</label>
            <div className="param-controls-dual">
              <input
                id="plan-entry"
                type="number"
                step="any"
                placeholder="Entry Price"
                value={entryPrice ?? ''}
                onChange={(e) => handleEntryChange(e.target.value)}
                readOnly={Boolean(selectedArrow)}
              />
              {quote && !selectedArrow ? (
                <button
                  type="button"
                  className="market-snap-btn"
                  onClick={handleUseMarketPrice}
                  title={`Snap to broker ${direction === 'long' ? 'Ask' : 'Bid'} (${direction === 'long' ? quote.ask.toFixed(precision) : quote.bid.toFixed(precision)})`}
                >
                  Use Market
                </button>
              ) : (
                <div className="param-aux-placeholder" />
              )}
            </div>
          </div>

          {/* Target R:R Row: Customizable Ratio Number + Horizontal Preset Strip */}
          <div className="param-row">
            <label htmlFor="plan-rr" className="param-label">Target R:R</label>
            <div className="param-controls-dual">
              <div className="rr-field-wrapper" title="Target Reward-to-Risk ratio. Type a multiplier (e.g. 2.5) to auto-adjust Take Profit.">
                <span className="rr-field-prefix" aria-hidden="true">1:</span>
                <input
                  id="plan-rr"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  placeholder="—"
                  className="rr-clean-input"
                  value={
                    customRrInput ?? (
                      targetRr != null
                        ? targetRr.toFixed(2)
                        : calculatedMetrics.rrRatio != null
                        ? calculatedMetrics.rrRatio.toFixed(2)
                        : ''
                    )
                  }
                  onChange={(e) => handleCustomRrChange(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={handleCustomRrBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                  readOnly={Boolean(selectedArrow)}
                  title="Target Reward-to-Risk multiplier"
                />
                <span className="rr-field-suffix" aria-hidden="true">R</span>
              </div>

              {!selectedArrow ? (
                <div className="rr-selector-container" ref={rrDropdownRef}>
                  <button
                    type="button"
                    className={`rr-selector-trigger ${rrDropdownOpen ? 'open' : ''}`}
                    onClick={() => setRrDropdownOpen((prev) => !prev)}
                    title="Toggle target Reward-to-Risk preset pills"
                  >
                    <span>Presets</span>
                    <span className="rr-trigger-arrow" aria-hidden="true">{rrDropdownOpen ? '◂' : '▾'}</span>
                  </button>

                  {rrDropdownOpen && (
                    <div className="rr-selector-dropdown-horizontal" role="menu">
                      {RR_PRESETS.map(({ r, label }) => {
                        const isMatch =
                          targetRr != null
                            ? Math.abs(targetRr - r) < 0.05
                            : calculatedMetrics.rrRatio != null &&
                              Math.abs(calculatedMetrics.rrRatio - r) < 0.05
                        return (
                          <button
                            key={r}
                            type="button"
                            className={`rr-preset-pill ${isMatch ? 'active' : ''}`}
                            onClick={() => {
                              handleTargetRrChange(r)
                              setRrDropdownOpen(false)
                            }}
                            title={`Set target R:R to 1:${r.toFixed(2)}`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rr-locked-pill" title="Target R:R is locked while viewing a pinned setup">
                  Locked
                </div>
              )}
            </div>
          </div>

          {/* Take Profit Row: Price + Pips */}
          <div className="param-row">
            <label htmlFor="plan-tp" className="param-label">Take Profit</label>
            <div className="param-controls-dual">
              <input
                id="plan-tp"
                type="number"
                step="any"
                placeholder="TP Price"
                value={tpPrice ?? ''}
                onChange={(e) => handleTpPriceChange(e.target.value)}
                readOnly={Boolean(selectedArrow)}
              />
              <div className="pips-field-wrapper">
                <input
                  type="number"
                  step="any"
                  placeholder="TP Pips"
                  value={calculatedMetrics.tpPips != null ? calculatedMetrics.tpPips.toFixed(1) : ''}
                  onChange={(e) => handleTpPipsChange(e.target.value)}
                  readOnly={Boolean(selectedArrow)}
                />
                <span className="pips-tag">pips</span>
              </div>
            </div>
          </div>

          {/* Stop Loss Row: Price + Pips */}
          <div className="param-row">
            <label htmlFor="plan-sl" className="param-label">Stop Loss</label>
            <div className="param-controls-dual">
              <input
                id="plan-sl"
                type="number"
                step="any"
                placeholder="SL Price"
                value={slPrice ?? ''}
                onChange={(e) => handleSlPriceChange(e.target.value)}
                readOnly={Boolean(selectedArrow)}
              />
              <div className="pips-field-wrapper">
                <input
                  type="number"
                  step="any"
                  placeholder="SL Pips"
                  value={calculatedMetrics.slPips != null ? calculatedMetrics.slPips.toFixed(1) : ''}
                  onChange={(e) => handleSlPipsChange(e.target.value)}
                  readOnly={Boolean(selectedArrow)}
                />
                <span className="pips-tag">pips</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
