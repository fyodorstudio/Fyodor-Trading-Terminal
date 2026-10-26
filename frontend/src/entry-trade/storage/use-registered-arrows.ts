import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RegisteredTradeArrow } from '../contracts/entry-trade-types'
import { validArrow } from './registered-arrow-validation'
import { applyJournalOperations, journalUrl, migrationKey, parseJournal, pendingKey, stableJournalArrows, type JournalOperation } from './journal-sync'
import { clearJournalDraft, journalKey, readJournalDraft } from './journal-drafts'

// Retain deleted IDs from the previous browser-only research importer during migration.
const researchImportKey = 'fyodor.entry-trade.research-imported.v1'
const storageKey = 'fyodor.registered_arrows.v1'
function loadSavedArrows(): RegisteredTradeArrow[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(data) ? data.filter(validArrow) : [] }
  catch { return [] }
}
function readPending(): JournalOperation[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(pendingKey) ?? '[]'); return Array.isArray(value) ? value : [] }
  catch { return [] }
}
export function useRegisteredArrows(symbol: string, dockOpen = false) {
  const [allArrows, setAllArrows] = useState<RegisteredTradeArrow[]>(loadSavedArrows)
  const arrowsRef = useRef(allArrows)
  const pendingRef = useRef(readPending())
  const [pendingVersion, setPendingVersion] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState('Connecting journal…')
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null)
  const commitLocal = useCallback((operation: Omit<JournalOperation, 'operationId'>) => {
    const full = { ...operation, operationId: crypto.randomUUID() }
    const queue = [...readPending(), full]
    const next = applyJournalOperations(loadSavedArrows(), [full])
    try {
      localStorage.setItem(pendingKey, JSON.stringify(queue))
      localStorage.setItem(storageKey, JSON.stringify(next))
      pendingRef.current = queue; arrowsRef.current = next; setAllArrows(next)
      setSaveStatus('Saving to repo…'); setImportError(null); setPendingVersion(value => value + 1)
      return true
    } catch { setImportError('Could not save journal locally. Your edit has not been confirmed.'); return false }
  }, [])

  useEffect(() => {
    const change = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) { const next = loadSavedArrows(); arrowsRef.current = next; setAllArrows(next) }
      if (event.key === pendingKey || event.key === null) { pendingRef.current = readPending(); setPendingVersion(value => value + 1) }
    }
    window.addEventListener('storage', change); return () => window.removeEventListener('storage', change)
  }, [])

  useEffect(() => {
    let stopped = false
    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = async () => {
      controller = new AbortController()
      try {
        let response = await fetch(journalUrl, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Repository journal is unavailable; edits remain saved locally for retry.')
        let snapshot = parseJournal(await response.json())
        if (stopped) return
        if (!localStorage.getItem(migrationKey)) {
          const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
          if (!Array.isArray(saved) || !saved.every(validArrow)) throw new Error('Existing browser journal could not be validated; it was preserved.')
          const migrated = new Set(pendingRef.current.filter(operation => operation.action === 'migrate').map(operation => operation.id))
          const legacy: JournalOperation[] = saved.filter(arrow => !migrated.has(arrow.id)).map(arrow => ({ operationId: crypto.randomUUID(), action: 'migrate' as const, id: arrow.id, arrow }))
          const imported: unknown = JSON.parse(localStorage.getItem(researchImportKey) ?? '[]')
          if (Array.isArray(imported)) for (const id of imported) {
            if (typeof id === 'string' && !saved.some(arrow => arrow.id === id) && !pendingRef.current.some(operation => operation.id === id && operation.action === 'delete'))
              legacy.push({ operationId: crypto.randomUUID(), action: 'delete', id })
          }
          pendingRef.current = [...legacy, ...pendingRef.current]
          localStorage.setItem(pendingKey, JSON.stringify(pendingRef.current))
        }
        pendingRef.current = readPending()
        const batch = [...pendingRef.current]
        if (batch.length) {
          setSaveStatus('Saving to repo…')
          for (let attempt = 0; attempt < 3; attempt++) {
            response = await fetch(journalUrl, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ expectedRevision: snapshot.revision, operations: batch }) })
            const value = await response.json()
            if (stopped) return
            if (response.status === 409) { snapshot = parseJournal(value); if (attempt === 2) throw new Error('Journal changed repeatedly; local edits are queued for retry.'); continue }
            if (!response.ok) throw new Error(value.error ?? 'Could not save journal to the repository.')
            snapshot = parseJournal(value); break
          }
          const acknowledged = new Set(batch.map(operation => operation.operationId))
          pendingRef.current = readPending().filter(operation => !acknowledged.has(operation.operationId))
          localStorage.setItem(pendingKey, JSON.stringify(pendingRef.current))
        }
        if (stopped) return
        localStorage.setItem(migrationKey, '1')
        const next = stableJournalArrows(arrowsRef.current, applyJournalOperations(snapshot.arrows, pendingRef.current))
        if (next !== arrowsRef.current) { localStorage.setItem(storageKey, JSON.stringify(next)); arrowsRef.current = next; setAllArrows(next) }
        setSaveStatus(pendingRef.current.length ? 'Saving to repo…' : 'Saved to repo')
        setImportError(null)
      } catch (error) {
        if (!stopped) { setSaveStatus('Saved locally · repo sync pending'); setImportError(error instanceof Error ? error.message : 'Could not sync journal.') }
      } finally {
        if (!stopped && (dockOpen || pendingRef.current.length)) timer = setTimeout(sync, 5000)
      }
    }
    void sync()
    return () => { stopped = true; controller?.abort(); if (timer !== undefined) clearTimeout(timer) }
  }, [dockOpen, pendingVersion])

  const symbolArrows = useMemo(() => allArrows.filter(arrow => arrow.symbol === symbol && !arrow.archived), [allArrows, symbol])
  const selectedArrow = useMemo(() => allArrows.find(arrow => arrow.id === selectedArrowId && arrow.symbol === symbol) ?? null, [allArrows, selectedArrowId, symbol])
  const addArrow = useCallback((data: Omit<RegisteredTradeArrow, 'id' | 'createdAt'>) => {
    const arrow = { ...data, id: `arrow_${data.symbol}_${crypto.randomUUID()}`, createdAt: Date.now() }
    if (commitLocal({ action: 'insert', id: arrow.id, arrow })) setSelectedArrowId(arrow.id)
    return arrow
  }, [commitLocal])
  const deleteArrow = useCallback((id: string) => {
    if (commitLocal({ action: 'delete', id })) { clearJournalDraft(journalKey('', id)); setSelectedArrowId(current => current === id ? null : current) }
  }, [commitLocal])
  const updateArrow = useCallback((id: string, changes: Partial<Pick<RegisteredTradeArrow,
    'note' | 'time' | 'direction' | 'entryPrice' | 'tpPrice' | 'slPrice' | 'tpPips' | 'slPips' | 'rrRatio' | 'archived' | 'targetRr' | 'eventAt' | 'eventTitle'>>) => {
    if (!commitLocal({ action: 'update', id, changes })) throw new Error('Journal edit could not be saved.')
  }, [commitLocal])
  const archiveArrow = useCallback((id: string, archived: boolean) => {
    const arrow = arrowsRef.current.find(item => item.id === id)
    if (!arrow) return
    const key = journalKey(arrow.symbol, id)
    if (commitLocal({ action: 'update', id, changes: { archived, note: readJournalDraft(key, arrow.note) } })) {
      clearJournalDraft(key); setSelectedArrowId(current => current === id ? null : current)
    }
  }, [commitLocal])
  return { allArrows, symbolArrows, selectedArrowId: selectedArrow?.id ?? null, selectedArrow, setSelectedArrowId,
    addArrow, deleteArrow, updateArrow, archiveArrow, importError, saveStatus }
}
