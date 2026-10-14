import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RegisteredTradeArrow } from '../contracts/entry-trade-types'
import { clearJournalDraft, journalKey } from './journal-drafts'

const storageKey = 'fyodor.registered_arrows.v1'

function loadSavedArrows(): RegisteredTradeArrow[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const saved: unknown = JSON.parse(raw)
    return Array.isArray(saved) ? saved.filter(validArrow) : []
  } catch {
    return []
  }
}

function validArrow(value: unknown): value is RegisteredTradeArrow {
  if (!value || typeof value !== 'object') return false
  const arrow = value as RegisteredTradeArrow
  return typeof arrow.id === 'string' && typeof arrow.symbol === 'string' && typeof arrow.note === 'string'
    && (arrow.direction === 'long' || arrow.direction === 'short' || arrow.direction === 'waiting')
    && [arrow.time, arrow.entryPrice, arrow.tpPrice, arrow.slPrice, arrow.tpPips, arrow.slPips, arrow.rrRatio, arrow.createdAt]
      .every(number => typeof number === 'number' && Number.isFinite(number))
}

function persistArrows(arrows: RegisteredTradeArrow[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(arrows))
  } catch {
    // quota exceeded or private mode
  }
}

export function useRegisteredArrows(symbol: string) {
  const [allArrows, setAllArrows] = useState<RegisteredTradeArrow[]>(loadSavedArrows)
  const arrowsRef = useRef(allArrows)
  useEffect(() => { arrowsRef.current = allArrows }, [allArrows])
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null)

  // Listen to cross-tab storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey || e.key === null) setAllArrows(loadSavedArrows())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const symbolArrows = useMemo(() => {
    return allArrows.filter((a) => a.symbol === symbol)
  }, [allArrows, symbol])

  const selectedArrow = useMemo(() => {
    if (!selectedArrowId) return null
    return symbolArrows.find((a) => a.id === selectedArrowId) ?? null
  }, [symbolArrows, selectedArrowId])

  const addArrow = useCallback((data: Omit<RegisteredTradeArrow, 'id' | 'createdAt'>) => {
    const newArrow: RegisteredTradeArrow = {
      ...data,
      id: `arrow_${data.symbol}_${crypto.randomUUID()}`,
      createdAt: Date.now(),
    }
    setAllArrows((prev) => {
      const updated = [newArrow, ...prev]
      persistArrows(updated)
      return updated
    })
    setSelectedArrowId(newArrow.id)
    return newArrow
  }, [])

  const deleteArrow = useCallback((id: string) => {
    clearJournalDraft(journalKey('', id))
    setAllArrows((prev) => {
      const updated = prev.filter((a) => a.id !== id)
      persistArrows(updated)
      return updated
    })
    setSelectedArrowId((curr) => (curr === id ? null : curr))
  }, [])

  const updateArrow = useCallback((id: string, changes: Partial<Pick<RegisteredTradeArrow,
    'note' | 'time' | 'direction' | 'entryPrice' | 'tpPrice' | 'slPrice' | 'tpPips' | 'slPips' | 'rrRatio'>>) => {
    const updated = arrowsRef.current.map(arrow => arrow.id === id ? { ...arrow, ...changes } : arrow)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    arrowsRef.current = updated
    setAllArrows(updated)
  }, [])

  return {
    allArrows,
    symbolArrows,
    selectedArrowId: selectedArrow?.id ?? null,
    selectedArrow,
    setSelectedArrowId,
    addArrow,
    deleteArrow,
    updateArrow,
  }
}
