import { useCallback, useEffect, useState } from 'react'
import { ledgerFilterStorageKey, readLedgerFilters, saveLedgerFilters, type LedgerFilters } from './ledger-filters'

export function useLedgerFilters(currencies: readonly string[]) {
  const [filters, setFilters] = useState(readLedgerFilters)
  const applyFilters = useCallback((next: LedgerFilters, save = false) => {
    setFilters(save ? saveLedgerFilters(next, currencies) : next)
  }, [currencies])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === ledgerFilterStorageKey || event.key === null) setFilters(readLedgerFilters()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return { filters, applyFilters }
}
