import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPipMultiplier, type TradeDirection } from '../contracts/entry-trade-types'
import type { EntryTradePanelProps } from './entry-trade-panel-contract'
import { computeTpPrice, tradeMetrics, tradeSide } from './plan-math'
import { journalKey, readJournalDraft, savedSymbolJournal } from '../storage/journal-drafts'

export function useEntryTradePlan({
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

  const precision = quote?.precision ?? 5
  const pipMultiplier = useMemo(() => getPipMultiplier(selectedSymbol, precision), [selectedSymbol, precision])

  // Derive current values from draft plan or selected registered arrow
  const selectedArrow = useMemo(() => {
    return selectedArrowId ? registeredArrows.find((a) => a.id === selectedArrowId) ?? null : null
  }, [registeredArrows, selectedArrowId])

  const targetRr = selectedArrow ? null : plan.targetRr ?? null
  const direction = selectedArrow ? selectedArrow.direction : plan.direction
  const entryPrice = selectedArrow ? selectedArrow.entryPrice : plan.entryPrice
  const tpPrice = selectedArrow ? selectedArrow.tpPrice : plan.tpPrice
  const slPrice = selectedArrow ? selectedArrow.slPrice : plan.slPrice

  const levelSide = tradeSide(direction, entryPrice, slPrice, tpPrice)
  const calculatedMetrics = useMemo(() => tradeMetrics({ direction, entryPrice, slPrice, tpPrice }, pipMultiplier),
    [direction, entryPrice, slPrice, tpPrice, pipMultiplier])

  const handleDirectionChange = (next: TradeDirection) => {
    if (selectedArrow) {
      const metrics = tradeMetrics({ ...selectedArrow, direction: next }, pipMultiplier)
      if (metrics.tpPips == null || metrics.slPips == null || metrics.rrRatio == null
        || ![metrics.tpPips, metrics.slPips, metrics.rrRatio].every(value => Number.isFinite(value) && value > 0)) return
      onUpdateArrow(selectedArrow.id, { direction: next, tpPips: metrics.tpPips, slPips: metrics.slPips, rrRatio: metrics.rrRatio })
    } else onPlanChange({ ...plan, direction: next })
  }

  const resetDraftPlanState = () => {
    onPlanChange({ ...plan, targetRr: null })
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
    const currentPrice = plan.direction === 'waiting' ? Number(((quote.ask + quote.bid) / 2).toFixed(precision)) : plan.direction === 'long' ? quote.ask : quote.bid
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
    if (!levelSide) return
    const nextSl = levelSide === 'long' ? plan.entryPrice - priceDelta : plan.entryPrice + priceDelta
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
    onPlanChange({ ...plan, tpPrice: nextTp, targetRr: null })
    onSelectArrowId(null)
  }

  const handleTpPipsChange = (pipsStr: string) => {
    if (!pipsStr || plan.entryPrice == null) {
      onPlanChange({ ...plan, tpPrice: null, targetRr: null })
      onSelectArrowId(null)
      return
    }
    const pips = Number(pipsStr)
    const priceDelta = pips / pipMultiplier
    if (!levelSide) return
    const nextTp = levelSide === 'long' ? plan.entryPrice + priceDelta : plan.entryPrice - priceDelta
    onPlanChange({ ...plan, tpPrice: Number(nextTp.toFixed(precision)), targetRr: null })
    onSelectArrowId(null)
  }

  const handleCustomRrChange = (valStr: string) => {
    setCustomRrInput(valStr)
    const nextR = valStr.trim() !== '' ? Number(valStr) : null
    if (nextR != null && Number.isFinite(nextR) && nextR > 0) {
      const nextTp = computeTpPrice({
        entryPrice: plan.entryPrice,
        slPrice: plan.slPrice,
        slPips: calculatedMetrics.slPips,
        targetRr: nextR,
        direction: plan.direction,
        pipMultiplier,
        precision,
      })
      onPlanChange({ ...plan, tpPrice: nextTp ?? plan.tpPrice, targetRr: nextR })
    } else if (valStr.trim() === '') {
      onPlanChange({ ...plan, targetRr: null })
    }
    onSelectArrowId(null)
  }

  const handleCustomRrBlur = () => {
    setCustomRrInput(null)
  }

  const handleTargetRrChange = (rrTarget: number) => {
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
    onPlanChange({ ...plan, tpPrice: nextTp ?? plan.tpPrice, targetRr: rrTarget })
    onSelectArrowId(null)
  }

  // Pin Arrow Handler
  const canRegister =
    entryPrice != null &&
    Number.isFinite(entryPrice) && entryPrice > 0 &&
    tpPrice != null &&
    Number.isFinite(tpPrice) && tpPrice > 0 &&
    slPrice != null &&
    Number.isFinite(slPrice) && slPrice > 0 &&
    calculatedMetrics.tpPips != null &&
    calculatedMetrics.slPips != null &&
    calculatedMetrics.rrRatio != null &&
    Number.isFinite(calculatedMetrics.tpPips) && Number.isFinite(calculatedMetrics.slPips) && Number.isFinite(calculatedMetrics.rrRatio) &&
    calculatedMetrics.tpPips > 0 &&
    calculatedMetrics.slPips > 0

  const handleRegisterClick = () => {
    if (!canRegister || selectedArrow) return
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
      note: readJournalDraft(journalKey(selectedSymbol), savedSymbolJournal(selectedSymbol)),
      precision,
    })
    setRegSuccessMsg('✓ Pinned!')
    if (regSuccessTimer.current !== null) clearTimeout(regSuccessTimer.current)
    regSuccessTimer.current = setTimeout(() => setRegSuccessMsg(null), 2500)
  }

  return { calculatedMetrics, canRegister, clock, customRrInput, direction, entryPrice, handleCustomRrBlur, handleCustomRrChange, handleDirectionChange, handleEntryChange, handleRegisterClick, handleSlPipsChange, handleSlPriceChange, handleTargetRrChange, handleTpPipsChange, handleTpPriceChange, handleUseMarketPrice, levelSide, onDeleteArrow, onUpdateArrow, onPlanChange, onSelectArrowId, plan, precision, quote, quotes, regSuccessMsg, registeredArrows, resetDraftPlanState, rrDropdownOpen, rrDropdownRef, selectedArrow, selectedArrowId, selectedSymbol, setRrDropdownOpen, slPrice, targetRr, tpPrice }
}

export type EntryTradePlanView = ReturnType<typeof useEntryTradePlan>
