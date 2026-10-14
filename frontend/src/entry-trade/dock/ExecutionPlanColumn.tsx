import type { EntryTradePlanView } from './useEntryTradePlan'
import { JournalTimeField } from './JournalTimeField'
import { RR_PRESETS } from './plan-math'

export function ExecutionPlanColumn({ view }: { view: EntryTradePlanView }) {
  const { eventAt, eventTitle, arrowDate, dateError, handleEventTitleChange, handleEventDateChange, handleArrowDateChange, onArchiveArrow, calculatedMetrics, canRegister, customRrInput, direction, entryPrice, handleCustomRrBlur, handleCustomRrChange, handleDirectionChange, handleEntryChange, handleRegisterClick, handleSlPipsChange, handleSlPriceChange, handleTargetRrChange, handleTpPipsChange, handleTpPriceChange, handleUseMarketPrice, levelSide, onDeleteArrow, onPlanChange, plan, quote, regSuccessMsg, resetDraftPlanState, rrDropdownOpen, rrDropdownRef, selectedArrow, selectedSymbol, setRrDropdownOpen, slPrice, targetRr, tpPrice } = view
  return (
      <div className="entry-trade-col entry-trade-levels-col">
        <div className="entry-trade-col-header">
          <span className="entry-trade-eyebrow">
            {selectedArrow ? 'Trade Journal Entry' : 'New Journal Entry'}
          </span>
          {selectedArrow ? (
            <div className="selected-arrow-header-actions">
              <button
                type="button"
                className="new-draft-btn-compact"
                onClick={resetDraftPlanState}
                title="Create a new journal entry"
              >
                + New Entry
              </button>
              {onArchiveArrow && <button type="button" className="new-draft-btn-compact"
                onClick={() => onArchiveArrow(selectedArrow.id, !selectedArrow.archived)}>
                {selectedArrow.archived ? 'Restore' : 'Archive'}
              </button>}
              <button
                type="button"
                className="delete-arrow-btn-compact"
                onClick={() => onDeleteArrow(selectedArrow.id)}
                title="Delete this journal entry"
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
                    onPlanChange({ ...plan, entryPrice: null, slPrice: null, tpPrice: null, targetRr: null })
                  }}
                  title="Clear inputs and start a new journal entry"
                >
                  + New Entry
                </button>
              </div>
            )
          )}
        </div>

        {/* Symbol & Direction Segmented Switch */}
        <div className="entry-trade-symbol-strip">
          <strong className="entry-trade-symbol-title">{selectedSymbol}</strong>
          <div className="direction-segmented" role="group" aria-label="Trade direction">
            <button
              type="button"
              className={`dir-seg-btn buy ${direction === 'long' ? 'active' : ''}`}
              onClick={() => handleDirectionChange('long')}

            >
              LONG (BUY)
            </button>
            <button
              type="button"
              className={`dir-seg-btn sell ${direction === 'short' ? 'active' : ''}`}
              onClick={() => handleDirectionChange('short')}

            >
              SHORT (SELL)
            </button>
            <button type="button" className={`dir-seg-btn waiting ${direction === 'waiting' ? 'active' : ''}`}
              onClick={() => handleDirectionChange('waiting')}>WAITING</button>
          </div>
        </div>

        <div className="journal-anchor-controls">
          <label htmlFor="journal-event-title">Event anchor</label>
          <input id="journal-event-title" type="text" maxLength={512} placeholder="Event name (optional)" value={eventTitle}
            onChange={event => handleEventTitleChange(event.target.value)} />
          <JournalTimeField id="journal-event" label="Event anchor" value={eventAt ? Date.parse(eventAt) : null} onChange={handleEventDateChange} />
          <JournalTimeField id="journal-arrow" label="Arrow date" value={arrowDate} onChange={handleArrowDateChange} />
          <button type="button" className="new-draft-btn-compact" disabled={!eventAt}
            onClick={() => { if (eventAt) handleArrowDateChange(Date.parse(eventAt)) }}>Use event time for arrow</button>
          {dateError && <span role="alert">{dateError}</span>}
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

              />
              <button type="button" className="market-snap-btn" onClick={handleUseMarketPrice} disabled={!quote}
                title={!quote ? 'Waiting for a broker quote' : direction === 'waiting' ? 'Use broker midpoint' : `Use broker ${direction === 'long' ? 'Ask' : 'Bid'}`}>
                Use Market
              </button>
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

                  title="Target Reward-to-Risk multiplier"
                />
                <span className="rr-field-suffix" aria-hidden="true">R</span>
              </div>

              {(
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

              />
              <div className="pips-field-wrapper">
                <input
                  type="number"
                  step="any"
                  placeholder="TP Pips"
                  disabled={!levelSide}
                  value={calculatedMetrics.tpPips != null ? calculatedMetrics.tpPips.toFixed(1) : ''}
                  onChange={(e) => handleTpPipsChange(e.target.value)}

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

              />
              <div className="pips-field-wrapper">
                <input
                  type="number"
                  step="any"
                  placeholder="SL Pips"
                  disabled={!levelSide}
                  value={calculatedMetrics.slPips != null ? calculatedMetrics.slPips.toFixed(1) : ''}
                  onChange={(e) => handleSlPipsChange(e.target.value)}

                />
                <span className="pips-tag">pips</span>
              </div>
            </div>
          </div>
        </div>
        {!selectedArrow && <div className="entry-trade-actions">
          <label className="header-chart-toggle">
            <input type="checkbox" checked={plan.showOnChart}
              onChange={event => onPlanChange({ ...plan, showOnChart: event.target.checked })} />
            Project on Chart
          </label>
          <button type="button" className={`register-arrow-btn-compact ${regSuccessMsg ? 'success' : canRegister ? 'ready' : 'disabled'}`}
            onClick={handleRegisterClick} disabled={!canRegister}
            title="Save this journal entry; prices may be filled later">
            {regSuccessMsg ? '✓ Pinned!' : 'Save Entry'}
          </button>
        </div>}
      </div>
  )
}
