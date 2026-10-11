import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { workflowSnapshot } from '../workflow/workflow-model'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPipMultiplier } from '../contracts/trader-notebook-types'
import type { TraderNotebookPanelProps } from './notebook-panel-contract'
import { computeTpPrice } from './plan-math'

export function useNotebookPlan({
  contextScope,
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
  const clock = useDisplayClock()
  const [note, setNote] = useState<string>(() => {
    return localStorage.getItem(`trader_notebook_note_${selectedSymbol}`) || ''
  })
  const [savedNote, setSavedNote] = useState<string>(() => {
    return localStorage.getItem(`trader_notebook_note_${selectedSymbol}`) || ''
  })
  const [isNoteDirty, setIsNoteDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null)
  const regSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (regSuccessTimer.current !== null) clearTimeout(regSuccessTimer.current) }, [selectedSymbol])
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
      workflow: workflowSnapshot(plan.workflow),
    })
    setRegSuccessMsg('✓ Pinned!')
    if (regSuccessTimer.current !== null) clearTimeout(regSuccessTimer.current)
    regSuccessTimer.current = setTimeout(() => setRegSuccessMsg(null), 2500)
  }

  return { calculatedMetrics, canRegister, clock, contextScope, customRrInput, direction, entryPrice, handleCustomRrBlur, handleCustomRrChange, handleEntryChange, handleNoteChange, handleRegisterClick, handleSaveNote, handleSlPipsChange, handleSlPriceChange, handleTargetRrChange, handleTpPipsChange, handleTpPriceChange, handleUseMarketPrice, isNoteDirty, note, onDeleteArrow, onPlanChange, onSelectArrowId, plan, precision, quote, regSuccessMsg, registeredArrows, resetDraftPlanState, rrDropdownOpen, rrDropdownRef, saveStatus, selectedArrow, selectedArrowId, selectedSymbol, setRrDropdownOpen, slPrice, targetRr, tpPrice }
}

export type NotebookPlanView = ReturnType<typeof useNotebookPlan>
