import { chartClockToUtc, utcToChartClock } from '../../appearance/time-display/chart-clock'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPipMultiplier, type TradeDirection } from '../contracts/entry-trade-types'
import type { EntryTradePanelProps } from './entry-trade-panel-contract'
import { computeTpPrice, tradeMetrics, tradeSide } from './plan-math'
import { journalKey, readJournalDraft, savedSymbolJournal } from '../storage/journal-drafts'

export function useEntryTradePlan({
  importError,
  saveStatus,
  onArchiveArrow,
  selectedSymbol,
  quote,
  quotes,
  latestBarTime,
  plan,
  registeredArrows,
  selectedArrowId,
  onPlanChange,
  onSelectArrowId,
  onRegisterArrow,
  onDeleteArrow,
  onUpdateArrow,
}: EntryTradePanelProps) {
  const [prevSymbol, setPrevSymbol] = useState(selectedSymbol)
  const clock = useDisplayClock()
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null)
  const regSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (regSuccessTimer.current !== null) clearTimeout(regSuccessTimer.current) }, [selectedSymbol])
  const [rrDropdownOpen, setRrDropdownOpen] = useState(false)
  const [customRrInput, setCustomRrInput] = useState<string | null>(null)
  const rrDropdownRef = useRef<HTMLDivElement>(null)

  // Handle symbol change
  if (selectedSymbol !== prevSymbol) {
    setPrevSymbol(selectedSymbol)
    setRegSuccessMsg(null)
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

  // Derive current values from draft plan or selected registered arrow
  const selectedArrow = useMemo(() => {
    return selectedArrowId ? registeredArrows.find((a) => a.id === selectedArrowId) ?? null : null
  }, [registeredArrows, selectedArrowId])

  const precision = quote?.precision ?? selectedArrow?.precision ?? (selectedSymbol.includes('JPY') ? 3 : 5)
  const pipMultiplier = useMemo(() => getPipMultiplier(selectedSymbol, precision), [selectedSymbol, precision])

  const targetRr = selectedArrow ? selectedArrow.targetRr ?? null : plan.targetRr ?? null
  const direction = selectedArrow ? selectedArrow.direction : plan.direction
  const entryPrice = selectedArrow ? selectedArrow.entryPrice : plan.entryPrice
  const tpPrice = selectedArrow ? selectedArrow.tpPrice : plan.tpPrice
  const slPrice = selectedArrow ? selectedArrow.slPrice : plan.slPrice

  const eventAt = selectedArrow ? selectedArrow.eventAt ?? null : plan.eventAt ?? null
  const eventTitle = selectedArrow ? selectedArrow.eventTitle ?? /^EVENT: (.+)$/m.exec(selectedArrow.note)?.[1] ?? '' : plan.eventTitle ?? ''
  const arrowTime = selectedArrow ? selectedArrow.time : plan.arrowTime ?? (entryPrice != null ? latestBarTime : 0)
  const arrowDate = arrowTime > 0 ? chartClockToUtc(arrowTime * 1000, clock.scope) : null
  const [dateError, setDateError] = useState<string | null>(null)
  const handleEventTitleChange = (title: string) => {
    if (selectedArrow) onUpdateArrow(selectedArrow.id, { eventTitle: title })
    else onPlanChange({ ...plan, eventTitle: title })
  }
  const handleEventDateChange = (utc: number | null) => {
    const value = utc == null ? null : new Date(utc).toISOString()
    if (selectedArrow) onUpdateArrow(selectedArrow.id, { eventAt: value })
    else onPlanChange({ ...plan, eventAt: value })
  }
  const handleArrowDateChange = (utc: number | null) => {
    const chart = utc == null ? 0 : utcToChartClock(utc, clock.scope)
    if (chart == null) { setDateError('Broker clock is unavailable for that date.'); return }
    setDateError(null)
    if (selectedArrow) onUpdateArrow(selectedArrow.id, { time: chart / 1000 })
    else onPlanChange({ ...plan, arrowTime: chart / 1000 })
  }

  const levelSide = tradeSide(direction, entryPrice, slPrice, tpPrice)
  const calculatedMetrics = useMemo(() => tradeMetrics({ direction, entryPrice, slPrice, tpPrice }, pipMultiplier),
    [direction, entryPrice, slPrice, tpPrice, pipMultiplier])

  const handleDirectionChange = (next: TradeDirection) => {
    if (selectedArrow) {
      const metrics = tradeMetrics({ ...selectedArrow, direction: next }, pipMultiplier)
      onUpdateArrow(selectedArrow.id, { direction: next, ...metrics })
    } else onPlanChange({ ...plan, direction: next })
  }

  const resetDraftPlanState = () => {
    onPlanChange({ direction: 'waiting', entryPrice: null, slPrice: null, tpPrice: null, targetRr: null, showOnChart: false })
    setCustomRrInput(null)
    setRrDropdownOpen(false)
    onSelectArrowId(null)
  }

  const editPinnedPrice = (field: 'entryPrice' | 'slPrice' | 'tpPrice', value: string) => {
    if (!selectedArrow) return false
    const price = value.trim() ? Number(value) : null
    if (price !== null && !Number.isFinite(price)) return true
    const next = { ...selectedArrow, [field]: price }
    if (field !== 'tpPrice' && targetRr != null) next.tpPrice = computeTpPrice({ ...next, targetRr, pipMultiplier, precision }) ?? next.tpPrice
    const metrics = tradeMetrics(next, pipMultiplier)
    onUpdateArrow(selectedArrow.id, { [field]: price, ...metrics,
      ...(field !== 'tpPrice' && targetRr != null ? { tpPrice: next.tpPrice } : {}),
      ...(field === 'tpPrice' ? { targetRr: null } : {}),
      ...(field === 'entryPrice' && selectedArrow.time === 0 && latestBarTime ? { time: latestBarTime } : {}) })
    return true
  }

  // Bi-directional input handlers for Draft Plan
  const handleEntryChange = (valStr: string) => {
    if (editPinnedPrice('entryPrice', valStr)) return
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
    const currentPrice = direction === 'waiting' ? Number(((quote.ask + quote.bid) / 2).toFixed(precision)) : direction === 'long' ? quote.ask : quote.bid
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return
    if (editPinnedPrice('entryPrice', String(currentPrice))) return
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
    if (editPinnedPrice('slPrice', valStr)) return
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

  const handleSlPipsChange = (value: string) => {
    if (!value.trim()) { handleSlPriceChange(''); return }
    const pips = Number(value)
    if (entryPrice == null || !levelSide || !Number.isFinite(pips) || pips <= 0) return
    handleSlPriceChange(String(Number((entryPrice + (levelSide === 'long' ? -1 : 1) * pips / pipMultiplier).toFixed(precision))))
  }

  const handleTpPriceChange = (valStr: string) => {
    if (editPinnedPrice('tpPrice', valStr)) return
    const nextTp = valStr ? Number(valStr) : null
    onPlanChange({ ...plan, tpPrice: nextTp, targetRr: null })
    onSelectArrowId(null)
  }

  const handleTpPipsChange = (value: string) => {
    if (!value.trim()) { handleTpPriceChange(''); return }
    const pips = Number(value)
    if (entryPrice == null || !levelSide || !Number.isFinite(pips) || pips <= 0) return
    handleTpPriceChange(String(Number((entryPrice + (levelSide === 'long' ? 1 : -1) * pips / pipMultiplier).toFixed(precision))))
  }

  const applyTargetRr = (nextR: number | null) => {
    const nextTp = computeTpPrice({ entryPrice, slPrice, slPips: calculatedMetrics.slPips, targetRr: nextR, direction, pipMultiplier, precision }) ?? tpPrice
    if (selectedArrow) onUpdateArrow(selectedArrow.id, { targetRr: nextR, tpPrice: nextTp,
      ...tradeMetrics({ direction, entryPrice, slPrice, tpPrice: nextTp }, pipMultiplier) })
    else onPlanChange({ ...plan, targetRr: nextR, tpPrice: nextTp })
  }

  const handleCustomRrChange = (valStr: string) => {
    setCustomRrInput(valStr)
    const nextR = valStr.trim() !== '' ? Number(valStr) : null
    if (nextR != null && Number.isFinite(nextR) && nextR > 0) applyTargetRr(nextR)
    else if (valStr.trim() === '') applyTargetRr(null)
  }

  const handleCustomRrBlur = () => {
    setCustomRrInput(null)
  }

  const handleTargetRrChange = (rrTarget: number) => {
    setCustomRrInput(null)
    applyTargetRr(rrTarget)
  }

  // Save a journal entry at any stage.
  const canRegister = true

  const handleRegisterClick = () => {
    if (!canRegister || selectedArrow) return
    onRegisterArrow({
      symbol: selectedSymbol,
      time: plan.arrowTime ?? (entryPrice == null ? 0 : latestBarTime || Math.floor(Date.now() / 1000)),
      eventAt,
      eventTitle,
      direction,
      entryPrice,
      tpPrice,
      slPrice,
      tpPips: calculatedMetrics.tpPips,
      slPips: calculatedMetrics.slPips,
      rrRatio: calculatedMetrics.rrRatio,
      note: readJournalDraft(journalKey(selectedSymbol), savedSymbolJournal(selectedSymbol)),
      precision,
    })
    setRegSuccessMsg('✓ Pinned!')
    if (regSuccessTimer.current !== null) clearTimeout(regSuccessTimer.current)
    regSuccessTimer.current = setTimeout(() => setRegSuccessMsg(null), 2500)
  }

  return { eventAt, eventTitle, arrowDate, dateError, handleEventTitleChange, handleEventDateChange, handleArrowDateChange, importError, saveStatus, onArchiveArrow, calculatedMetrics, canRegister, clock, customRrInput, direction, entryPrice, handleCustomRrBlur, handleCustomRrChange, handleDirectionChange, handleEntryChange, handleRegisterClick, handleSlPipsChange, handleSlPriceChange, handleTargetRrChange, handleTpPipsChange, handleTpPriceChange, handleUseMarketPrice, levelSide, onDeleteArrow, onUpdateArrow, onPlanChange, onSelectArrowId, plan, precision, quote, quotes, regSuccessMsg, registeredArrows, resetDraftPlanState, rrDropdownOpen, rrDropdownRef, selectedArrow, selectedArrowId, selectedSymbol, setRrDropdownOpen, slPrice, targetRr, tpPrice }
}

export type EntryTradePlanView = ReturnType<typeof useEntryTradePlan>
