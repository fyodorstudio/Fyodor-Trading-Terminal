import { useEffect, useMemo, useRef, useState } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import {
  getPipMultiplier,
  type PlannedTradeState,
  type RegisteredTradeArrow,
} from '../contracts/trader-notebook-types'
import './trader-notebook-panel.css'

const RR_PRESETS = [
  { r: 1.0, label: '1.0R' },
  { r: 1.25, label: '1.25R' },
  { r: 1.5, label: '1.5R' },
  { r: 2.0, label: '2.0R' },
  { r: 3.0, label: '3.0R' },
] as const

interface ComputeTpPriceParams {
  entryPrice: number | null
  slPrice?: number | null
  slPips?: number | null
  targetRr: number | null
  direction: 'long' | 'short'
  pipMultiplier: number
  precision: number
}

function computeTpPrice({
  entryPrice,
  slPrice,
  slPips,
  targetRr,
  direction,
  pipMultiplier,
  precision,
}: ComputeTpPriceParams): number | null {
  if (entryPrice == null || targetRr == null || targetRr <= 0) {
    return null
  }
  let effectiveSlPips: number | null = null
  if (slPips != null && slPips > 0) {
    effectiveSlPips = slPips
  } else if (slPrice != null) {
    effectiveSlPips = direction === 'long'
      ? (entryPrice - slPrice) * pipMultiplier
      : (slPrice - entryPrice) * pipMultiplier
  }
  if (effectiveSlPips == null || effectiveSlPips <= 0) {
    return null
  }
  const desiredTpPips = effectiveSlPips * targetRr
  const priceDelta = desiredTpPips / pipMultiplier
  const rawTp = direction === 'long' ? entryPrice + priceDelta : entryPrice - priceDelta
  return Number(rawTp.toFixed(precision))
}

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
  const [savedNote, setSavedNote] = useState<string>(() => {
    return localStorage.getItem(`trader_notebook_note_${selectedSymbol}`) || ''
  })
  const [isNoteDirty, setIsNoteDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null)
  const [rrDropdownOpen, setRrDropdownOpen] = useState(false)
  const [targetRr, setTargetRr] = useState<number | null>(null)
  const [customRrInput, setCustomRrInput] = useState<string | null>(null)
  const rrDropdownRef = useRef<HTMLDivElement>(null)

  // Handle symbol change
  if (selectedSymbol !== prevSymbol) {
    setPrevSymbol(selectedSymbol)
    const saved = localStorage.getItem(`trader_notebook_note_${selectedSymbol}`) || ''
    setNote(saved)
    setSavedNote(saved)
    setIsNoteDirty(false)
    setSaveStatus('Saved')
    setRegSuccessMsg(null)
    setTargetRr(null)
    setCustomRrInput(null)
    setRrDropdownOpen(false)
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
    const dirty = val !== savedNote
    setIsNoteDirty(dirty)
    setSaveStatus(dirty ? 'Unsaved' : 'Saved')
  }

  const handleSaveNote = () => {
    localStorage.setItem(`trader_notebook_note_${selectedSymbol}`, note)
    setSavedNote(note)
    setIsNoteDirty(false)
    setSaveStatus('Saved')
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

  const resetDraftPlanState = () => {
    setTargetRr(null)
    setCustomRrInput(null)
    setRrDropdownOpen(false)
    onSelectArrowId(null)
  }

  // Bi-directional input handlers for Draft Plan
  const handleEntryChange = (valStr: string) => {
    const nextEntry = valStr ? Number(valStr) : null
    const nextTp = computeTpPrice({
      entryPrice: nextEntry,
      slPrice: plan.slPrice,
      targetRr,
      direction: plan.direction,
      pipMultiplier,
      precision,
    }) ?? plan.tpPrice
    onPlanChange({ ...plan, entryPrice: nextEntry, tpPrice: nextTp })
    onSelectArrowId(null)
  }

  const handleUseMarketPrice = () => {
    if (!quote) return
    const currentPrice = plan.direction === 'long' ? quote.ask : quote.bid
    const nextTp = computeTpPrice({
      entryPrice: currentPrice,
      slPrice: plan.slPrice,
      targetRr,
      direction: plan.direction,
      pipMultiplier,
      precision,
    }) ?? plan.tpPrice
    onPlanChange({ ...plan, entryPrice: currentPrice, tpPrice: nextTp })
    onSelectArrowId(null)
  }

  const handleSlPriceChange = (valStr: string) => {
    const nextSl = valStr ? Number(valStr) : null
    const nextTp = computeTpPrice({
      entryPrice: plan.entryPrice,
      slPrice: nextSl,
      targetRr,
      direction: plan.direction,
      pipMultiplier,
      precision,
    }) ?? plan.tpPrice
    onPlanChange({ ...plan, slPrice: nextSl, tpPrice: nextTp })
    onSelectArrowId(null)
  }

  const handleSlPipsChange = (pipsStr: string) => {
    if (!pipsStr || plan.entryPrice == null) {
      onPlanChange({ ...plan, slPrice: null })
      onSelectArrowId(null)
      return
    }
    const pips = Number(pipsStr)
    const priceDelta = pips / pipMultiplier
    const nextSl = plan.direction === 'long' ? plan.entryPrice - priceDelta : plan.entryPrice + priceDelta
    const nextTp = computeTpPrice({
      entryPrice: plan.entryPrice,
      slPips: pips,
      targetRr,
      direction: plan.direction,
      pipMultiplier,
      precision,
    }) ?? plan.tpPrice
    onPlanChange({
      ...plan,
      slPrice: Number(nextSl.toFixed(precision)),
      tpPrice: nextTp,
    })
    onSelectArrowId(null)
  }

  const handleTpPriceChange = (valStr: string) => {
    const nextTp = valStr ? Number(valStr) : null
    setTargetRr(null)
    onPlanChange({ ...plan, tpPrice: nextTp })
    onSelectArrowId(null)
  }

  const handleTpPipsChange = (pipsStr: string) => {
    setTargetRr(null)
    if (!pipsStr || plan.entryPrice == null) {
      onPlanChange({ ...plan, tpPrice: null })
      onSelectArrowId(null)
      return
    }
    const pips = Number(pipsStr)
    const priceDelta = pips / pipMultiplier
    const nextTp = plan.direction === 'long' ? plan.entryPrice + priceDelta : plan.entryPrice - priceDelta
    onPlanChange({ ...plan, tpPrice: Number(nextTp.toFixed(precision)) })
    onSelectArrowId(null)
  }

  const handleCustomRrChange = (valStr: string) => {
    setCustomRrInput(valStr)
    const nextR = valStr.trim() !== '' ? Number(valStr) : null
    if (nextR != null && !isNaN(nextR) && nextR > 0) {
      setTargetRr(nextR)
      const nextTp = computeTpPrice({
        entryPrice: plan.entryPrice,
        slPrice: plan.slPrice,
        slPips: calculatedMetrics.slPips,
        targetRr: nextR,
        direction: plan.direction,
        pipMultiplier,
        precision,
      })
      if (nextTp != null) {
        onPlanChange({ ...plan, tpPrice: nextTp })
      }
    } else if (valStr.trim() === '') {
      setTargetRr(null)
    }
    onSelectArrowId(null)
  }

  const handleCustomRrBlur = () => {
    setCustomRrInput(null)
  }

  const handleTargetRrChange = (rrTarget: number) => {
    setTargetRr(rrTarget)
    setCustomRrInput(null)
    const nextTp = computeTpPrice({
      entryPrice: plan.entryPrice,
      slPrice: plan.slPrice,
      slPips: calculatedMetrics.slPips,
      targetRr: rrTarget,
      direction: plan.direction,
      pipMultiplier,
      precision,
    })
    if (nextTp != null) {
      onPlanChange({ ...plan, tpPrice: nextTp })
    }
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

      {/* Col 2: Pinned Arrows Registry */}
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
              <span className={`meta-item meta-status${isNoteDirty ? ' unsaved' : ''}`}>● {saveStatus}</span>
            </div>

            <button
              type="button"
              className={`save-note-btn-compact ${isNoteDirty ? 'ready' : 'saved'}`}
              onClick={handleSaveNote}
              disabled={!isNoteDirty}
              title={isNoteDirty ? 'Save note (Ctrl+Enter)' : 'Note saved'}
            >
              {isNoteDirty ? '💾 Save Note' : '✓ Saved'}
            </button>

            {!selectedArrow && (
              <button
                type="button"
                className={`register-arrow-btn-compact ${regSuccessMsg ? 'success' : canRegister ? 'ready' : 'disabled'}`}
                onClick={handleRegisterClick}
                disabled={!canRegister}
                title={canRegister ? 'Pin this setup arrow to chart' : 'Set Entry, SL, and TP to pin arrow'}
              >
                {regSuccessMsg ? '✓ Pinned!' : '↗ Pin Arrow'}
              </button>
            )}
          </div>
        </div>

        <div className="journal-textarea-container">
          <textarea
            className="journal-textarea"
            value={note}
            onChange={handleNoteChange}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isNoteDirty) {
                e.preventDefault()
                handleSaveNote()
              }
            }}
            placeholder={`Type your trade thesis, catalyst observation, technical structure, or post-trade audit notes for ${selectedSymbol}...\n\nClick "Save Note" or press Ctrl+Enter to preserve locally.`}
            aria-label="Trader journal note"
          />
        </div>
      </div>
    </section>
  )
}
