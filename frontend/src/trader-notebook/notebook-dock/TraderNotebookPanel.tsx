import { useEffect, useMemo, useRef, useState } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import {
  getPipMultiplier,
  type PlannedTradeState,
  type RegisteredTradeArrow,
} from '../contracts/trader-notebook-types'
import './trader-notebook-panel.css'

type TraderNotebookPanelProps = {
  selectedSymbol: string
  quote: SymbolQuote | null
  latestBarTime: number
  plan: PlannedTradeState
  registeredArrows: RegisteredTradeArrow[]
  selectedArrowId: string | null
  onPlanChange: (plan: PlannedTradeState) => void
  onSelectArrowId: (id: string | null) => void
  onRegisterArrow: (arrow: Omit<RegisteredTradeArrow, 'id' | 'createdAt'>) => void
  onDeleteArrow: (id: string) => void
}

export function TraderNotebookPanel({
  selectedSymbol,
  quote,
  latestBarTime,
  plan,
  registeredArrows,
  selectedArrowId,
  onPlanChange,
  onSelectArrowId,
  onRegisterArrow,
  onDeleteArrow,
}: TraderNotebookPanelProps) {
  const [prevSymbol, setPrevSymbol] = useState(selectedSymbol)
  const [note, setNote] = useState<string>(() => {
    return localStorage.getItem(`trader_notebook_note_${selectedSymbol}`) || ''
  })
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null)
  const [rrDropdownOpen, setRrDropdownOpen] = useState(false)
  const rrDropdownRef = useRef<HTMLDivElement>(null)

  // Handle symbol change
  if (selectedSymbol !== prevSymbol) {
    setPrevSymbol(selectedSymbol)
    const saved = localStorage.getItem(`trader_notebook_note_${selectedSymbol}`)
    setNote(saved || '')
    setSaveStatus('Saved')
    setRegSuccessMsg(null)
  }

  // Close R:R dropdown on click outside
  useEffect(() => {
    if (!rrDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (rrDropdownRef.current && !rrDropdownRef.current.contains(e.target as Node)) {
        setRrDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [rrDropdownOpen])

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setNote(val)
    localStorage.setItem(`trader_notebook_note_${selectedSymbol}`, val)
    setSaveStatus('Auto-saved')
  }

  const precision = quote?.precision ?? 5
  const pipMultiplier = useMemo(() => getPipMultiplier(selectedSymbol, precision), [selectedSymbol, precision])

  // Derive current values from draft plan or selected registered arrow
  const selectedArrow = useMemo(() => {
    return selectedArrowId ? registeredArrows.find((a) => a.id === selectedArrowId) ?? null : null
  }, [registeredArrows, selectedArrowId])

  const direction = selectedArrow ? selectedArrow.direction : plan.direction
  const entryPrice = selectedArrow ? selectedArrow.entryPrice : plan.entryPrice
  const tpPrice = selectedArrow ? selectedArrow.tpPrice : plan.tpPrice
  const slPrice = selectedArrow ? selectedArrow.slPrice : plan.slPrice

  // Calculate pips and R:R
  const calculatedMetrics = useMemo(() => {
    let tpPips: number | null = null
    let slPips: number | null = null
    let rrRatio: number | null = null

    if (entryPrice != null && entryPrice > 0) {
      if (tpPrice != null && tpPrice > 0) {
        tpPips = direction === 'long'
          ? (tpPrice - entryPrice) * pipMultiplier
          : (entryPrice - tpPrice) * pipMultiplier
      }
      if (slPrice != null && slPrice > 0) {
        slPips = direction === 'long'
          ? (entryPrice - slPrice) * pipMultiplier
          : (slPrice - entryPrice) * pipMultiplier
      }
      if (tpPips != null && slPips != null && slPips > 0) {
        rrRatio = tpPips / slPips
      }
    }
    return { tpPips, slPips, rrRatio }
  }, [direction, entryPrice, pipMultiplier, slPrice, tpPrice])

  // Bi-directional input handlers for Draft Plan
  const handleEntryChange = (valStr: string) => {
    const nextEntry = valStr ? Number(valStr) : null
    onPlanChange({ ...plan, entryPrice: nextEntry })
    onSelectArrowId(null)
  }

  const handleUseMarketPrice = () => {
    if (!quote) return
    const currentPrice = plan.direction === 'long' ? quote.ask : quote.bid
    onPlanChange({ ...plan, entryPrice: currentPrice })
    onSelectArrowId(null)
  }

  const handleSlPriceChange = (valStr: string) => {
    const nextSl = valStr ? Number(valStr) : null
    onPlanChange({ ...plan, slPrice: nextSl })
    onSelectArrowId(null)
  }

  const handleSlPipsChange = (pipsStr: string) => {
    if (!pipsStr || plan.entryPrice == null) {
      onPlanChange({ ...plan, slPrice: null })
      return
    }
    const pips = Number(pipsStr)
    const priceDelta = pips / pipMultiplier
    const nextSl = plan.direction === 'long' ? plan.entryPrice - priceDelta : plan.entryPrice + priceDelta
    onPlanChange({ ...plan, slPrice: Number(nextSl.toFixed(precision)) })
    onSelectArrowId(null)
  }

  const handleTpPriceChange = (valStr: string) => {
    const nextTp = valStr ? Number(valStr) : null
    onPlanChange({ ...plan, tpPrice: nextTp })
    onSelectArrowId(null)
  }

  const handleTpPipsChange = (pipsStr: string) => {
    if (!pipsStr || plan.entryPrice == null) {
      onPlanChange({ ...plan, tpPrice: null })
      return
    }
    const pips = Number(pipsStr)
    const priceDelta = pips / pipMultiplier
    const nextTp = plan.direction === 'long' ? plan.entryPrice + priceDelta : plan.entryPrice - priceDelta
    onPlanChange({ ...plan, tpPrice: Number(nextTp.toFixed(precision)) })
    onSelectArrowId(null)
  }

  const handleTargetRrChange = (rrTarget: number) => {
    if (plan.entryPrice == null || calculatedMetrics.slPips == null || calculatedMetrics.slPips <= 0) return
    const desiredTpPips = calculatedMetrics.slPips * rrTarget
    const priceDelta = desiredTpPips / pipMultiplier
    const nextTp = plan.direction === 'long' ? plan.entryPrice + priceDelta : plan.entryPrice - priceDelta
    onPlanChange({ ...plan, tpPrice: Number(nextTp.toFixed(precision)) })
    onSelectArrowId(null)
  }

  // Pin Arrow Handler
  const canRegister =
    entryPrice != null &&
    entryPrice > 0 &&
    tpPrice != null &&
    tpPrice > 0 &&
    slPrice != null &&
    slPrice > 0 &&
    calculatedMetrics.tpPips != null &&
    calculatedMetrics.slPips != null &&
    calculatedMetrics.rrRatio != null &&
    calculatedMetrics.tpPips > 0 &&
    calculatedMetrics.slPips > 0

  const handleRegisterClick = () => {
    if (!canRegister) return
    onRegisterArrow({
      symbol: selectedSymbol,
      time: latestBarTime || Math.floor(Date.now() / 1000),
      direction,
      entryPrice: entryPrice!,
      tpPrice: tpPrice!,
      slPrice: slPrice!,
      tpPips: calculatedMetrics.tpPips!,
      slPips: calculatedMetrics.slPips!,
      rrRatio: calculatedMetrics.rrRatio!,
      note,
    })
    setRegSuccessMsg('✓ Pinned!')
    setTimeout(() => setRegSuccessMsg(null), 2500)
  }

  return (
    <section className="trader-notebook-panel" aria-label="Trader Notebook & Execution Planner">
      {/* Col 1: Execution Plan */}
      <div className="notebook-col notebook-levels-col">
        <div className="notebook-col-header">
          <span className="notebook-eyebrow">
            {selectedArrow ? 'Edit Execution Plan' : 'Draft Execution Plan'}
          </span>
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

          {/* Target R:R Row: Live Ratio Box + Click Selector Dropdown */}
          <div className="param-row">
            <span className="param-label">Target R:R</span>
            <div className="param-controls-dual">
              <div className="rr-ratio-pill" title="Current live Reward-to-Risk ratio based on Entry, SL, and TP">
                <span>Ratio</span>
                <strong>{calculatedMetrics.rrRatio != null ? `1:${calculatedMetrics.rrRatio.toFixed(2)}` : '—'}</strong>
              </div>

              {!selectedArrow ? (
                <div className="rr-selector-container" ref={rrDropdownRef}>
                  <button
                    type="button"
                    className={`rr-selector-trigger ${rrDropdownOpen ? 'open' : ''}`}
                    onClick={() => setRrDropdownOpen((prev) => !prev)}
                    disabled={calculatedMetrics.slPips == null || calculatedMetrics.slPips <= 0}
                    title={
                      calculatedMetrics.slPips == null || calculatedMetrics.slPips <= 0
                        ? 'Set Stop Loss to enable target R:R presets'
                        : 'Choose target Reward-to-Risk multiplier'
                    }
                  >
                    <span>
                      {calculatedMetrics.rrRatio != null
                        ? `Target: +${calculatedMetrics.rrRatio.toFixed(2)}R`
                        : 'Set Target R:R'}
                    </span>
                    <span className="rr-trigger-arrow" aria-hidden="true">▾</span>
                  </button>

                  {rrDropdownOpen && (
                    <div className="rr-selector-dropdown" role="menu">
                      <div className="rr-dropdown-header">Target Multiplier</div>
                      {[
                        { r: 1.0, label: '+1.00R (1:1.00)' },
                        { r: 1.25, label: '+1.25R (1:1.25)' },
                        { r: 1.5, label: '+1.50R (1:1.50)' },
                        { r: 2.0, label: '+2.00R (1:2.00)' },
                        { r: 3.0, label: '+3.00R (1:3.00)' },
                      ].map(({ r, label }) => {
                        const isMatch =
                          calculatedMetrics.rrRatio != null &&
                          Math.abs(calculatedMetrics.rrRatio - r) < 0.05
                        return (
                          <button
                            key={r}
                            type="button"
                            className={`rr-dropdown-item ${isMatch ? 'active' : ''}`}
                            onClick={() => {
                              handleTargetRrChange(r)
                              setRrDropdownOpen(false)
                            }}
                          >
                            <span>{label}</span>
                            {isMatch && <span className="rr-item-check">✓</span>}
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
        </div>
      </div>

      {/* Col 2: Pinned Arrows Registry */}
      <div className="notebook-col notebook-pinned-col">
        <div className="notebook-col-header">
          <span className="notebook-eyebrow">
            PINNED ARROWS ({registeredArrows.length})
          </span>
          {selectedArrow && (
            <button
              type="button"
              className="clear-selection-link"
              onClick={() => onSelectArrowId(null)}
              title="Return to drafting a new setup"
            >
              + New Plan
            </button>
          )}
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
                  const dateStr = new Date(arrow.time * 1000).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })
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

      {/* Col 3: Trader Forensic Journal & Observations */}
      <div className="notebook-col notebook-journal-col">
        <div className="notebook-col-header">
          <span className="notebook-eyebrow">Trader Journal &amp; Thesis</span>
          <div className="journal-header-actions">
            {!selectedArrow && (
              <label className="header-chart-toggle" title="Show horizontal planned lines on chart">
                <input
                  type="checkbox"
                  checked={plan.showOnChart}
                  onChange={(e) => onPlanChange({ ...plan, showOnChart: e.target.checked })}
                />
                <span>Project on Chart</span>
              </label>
            )}

            <div className="header-meta-pill">
              <span className="meta-item">Scope: <strong>{selectedSymbol}</strong></span>
              <span className="meta-sep" aria-hidden="true">·</span>
              <span className="meta-item meta-durable">Durable</span>
              <span className="meta-sep" aria-hidden="true">·</span>
              <span className="meta-item meta-status">● {saveStatus}</span>
            </div>

            {!selectedArrow ? (
              <button
                type="button"
                className={`register-arrow-btn-compact ${regSuccessMsg ? 'success' : canRegister ? 'ready' : 'disabled'}`}
                onClick={handleRegisterClick}
                disabled={!canRegister}
                title={canRegister ? 'Pin this setup arrow to chart' : 'Set Entry, SL, and TP to pin arrow'}
              >
                {regSuccessMsg ? '✓ Pinned!' : '↗ Pin Arrow'}
              </button>
            ) : (
              <div className="selected-arrow-header-actions">
                <button
                  type="button"
                  className="new-draft-btn-compact"
                  onClick={() => onSelectArrowId(null)}
                  title="Start drafting a new setup plan"
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
            )}
          </div>
        </div>

        <div className="journal-textarea-container">
          <textarea
            className="journal-textarea"
            value={note}
            onChange={handleNoteChange}
            placeholder={`Type your trade thesis, catalyst observation, technical structure, or post-trade audit notes for ${selectedSymbol}...\n\nAll notes are automatically preserved locally and durable across browser refresh.`}
            aria-label="Trader journal note"
          />
        </div>
      </div>
    </section>
  )
}
