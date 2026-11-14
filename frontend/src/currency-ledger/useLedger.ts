import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ledgerDevelopments, ledgerDay, ledgerDayEnd, validLedger, type LedgerData, type LedgerSelection } from './ledger-model'
import { useLedgerFilters } from './useLedgerFilters'

export function useLedgerState(broker: string | null, enabled: boolean, pickerScope: string | null, currencies: readonly string[]) {
  const scope=currencies.join(',')
  const { filters, applyFilters } = useLedgerFilters(currencies)
  const [selection, setSelection] = useState<LedgerSelection>(()=>({ at: null, currency: currencies[0]??'', category: null }))
  const [selectionScope,setSelectionScope]=useState(scope)
  if(selectionScope!==scope){setSelectionScope(scope);setSelection(old=>({...old,currency:currencies.includes(old.currency)?old.currency:currencies[0]??'',category:null}))}
  const [year, setYear] = useState(() => Number(ledgerDay(Date.now()).slice(0, 4)))
  const [state, setState] = useState<{ broker: string; scope: string; years: Record<number, LedgerData>; error: string | null } | null>(null)
  const cache = useRef(new Map<string, LedgerData>())
  const [now, setNow] = useState(Date.now)
  const [picker, setPicker] = useState({ scope: pickerScope, armed: false })
  const [focusRequest, setFocusRequest] = useState(0)
  const [following, setFollowing] = useState(false), [detailPinned, setDetailPinned] = useState(false)
  const [followingScope, setFollowingScope] = useState(pickerScope)
  if (followingScope !== pickerScope) { setFollowingScope(pickerScope); if (following) setFollowing(false) }
  const followChart = useCallback(() => { setPicker(old => old.armed ? { ...old, armed: false } : old); setFollowing(value => !value) }, [])
  const stopFollowing = useCallback(() => setFollowing(false), [])
  const pickTime = useCallback((utc: number, pin: boolean) => {
    if (!Number.isFinite(utc) || utc < Date.parse('2015-01-01T00:00:00+07:00') || utc > Date.now()) return
    setSelection(old => old.at === utc ? old : { ...old, at: utc })
    setDetailPinned(pin)
    if (pin) { setFollowing(false); setYear(Number(ledgerDay(utc).slice(0, 4))); setFocusRequest(n => n + 1) }
  }, [])
  const viewMemory = useRef({ tape: new Map<string, { left: number; top: number; day: string; request: number }>(), cells: new Map<string, number>() })
  if (picker.scope !== pickerScope) setPicker({ scope: pickerScope, armed: false })
  const picking = pickerScope !== null && picker.scope === pickerScope && picker.armed
  const togglePicking = useCallback(() => setPicker(old => ({ scope: pickerScope,
    armed: pickerScope !== null && !(old.scope === pickerScope && old.armed) })), [pickerScope])
  const cancelPicking = useCallback(() => setPicker(old => old.armed ? { ...old, armed: false } : old), [])
  const pickDay = useCallback((day: string) => {
    const current = Date.now(), end = ledgerDayEnd(day)
    if (!Number.isFinite(end) || day < '2015-01-01' || day > ledgerDay(current)) return
    setYear(Number(day.slice(0, 4))); setNow(current)
    setSelection(old => ({ ...old, at: Math.min(end, current) }))
    setFollowing(false); setDetailPinned(true)
    setFocusRequest(n => n + 1); cancelPicking()
  }, [cancelPicking])
  const goToToday = useCallback(() => {
    const current = Date.now()
    setYear(Number(ledgerDay(current).slice(0, 4))); setNow(current)
    setSelection(old => ({ ...old, at: null })); setFocusRequest(n => n + 1); cancelPicking()
    setFollowing(false); setDetailPinned(false)
  }, [cancelPicking])
  const at = Math.min(selection.at ?? now, now), detailYear = Number(ledgerDay(at).slice(0, 4))
  useEffect(() => {
    if (!enabled || !broker) return
    const controller = new AbortController()
    let timer = 0
    async function pollLedger() {
      try {
        const requested = [...new Set([year, detailYear])]
        const snapshots = await Promise.all(requested.map(async requestedYear => {
          const current = cache.current.get(`${broker}:${scope}:${requestedYear}`)
          const query = new URLSearchParams({ source_id: broker!, year: String(requestedYear), scope: currencies.join('') })
          if (current) query.set('after_revision', current.revision)
          const response = await fetch(`/storage-api/currency-ledger?${query}`, { signal: controller.signal })
          if (!response.ok) throw new Error(`Ledger unavailable (HTTP ${response.status})`)
          const result = await response.json()
          if (current && result?.unchanged === true && result.schema === 1 && result.broker === broker && result.year === requestedYear && result.revision === current.revision
            && result.currencies?.join(',')===scope) return current
          if (!validLedger(result, broker!, requestedYear,currencies)) throw new Error('Invalid Ledger response')
          return result
        }))
        if (controller.signal.aborted) return
        for (const snapshot of snapshots) {
          cache.current.delete(`${broker}:${scope}:${snapshot.year}`)
          cache.current.set(`${broker}:${scope}:${snapshot.year}`, snapshot)
        }
        while (cache.current.size > 4) cache.current.delete(cache.current.keys().next().value!)
        setState(old => {
          const years = Object.fromEntries(snapshots.map(data => [data.year, data]))
          return old?.broker === broker && old.scope===scope && !old.error && requested.every(y => old.years[y] === years[y]) && Object.keys(old.years).length === requested.length
            ? old : { broker: broker!, scope, years, error: null }
        })
        setNow(Date.now())
      } catch (e) {
        if (!controller.signal.aborted) setState(old => ({ broker: broker!, scope, years: old?.broker === broker && old.scope===scope ? old.years : {}, error: e instanceof Error ? e.message : 'Ledger unavailable' }))
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(pollLedger, 30_000)
      }
    }
    void pollLedger()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [enabled, broker, year, detailYear, scope, currencies])
  const active = state?.broker === broker && state.scope===scope ? state : null
  const data = active?.years[year] ?? null, detailData = active?.years[detailYear] ?? null, error = active?.error
  const developments = useMemo(() => detailData ? ledgerDevelopments(detailData, at) : [], [detailData, at])
  // Dock geometry belongs to the parent workspace. Keep this context stable so
  // height-only parent renders never invalidate the tape or the category details.
  return useMemo(() => ({ data, detailData, error, selection, setSelection, at, developments, now, year, setYear, currencies, filters, applyFilters,
    picking, canPick: pickerScope !== null, togglePicking, cancelPicking, pickDay, goToToday, focusRequest, viewMemory,
    following, detailPinned, followChart, stopFollowing, pickTime }),
    [data, detailData, error, selection, at, developments, now, year, picking, pickerScope, togglePicking, cancelPicking, pickDay, goToToday, focusRequest,currencies,filters,applyFilters, following, detailPinned, followChart, stopFollowing, pickTime])
}
export const LedgerContext = createContext<ReturnType<typeof useLedgerState> | null>(null)
export function useLedger() {
  const value = useContext(LedgerContext)
  if (!value) throw new Error('Ledger requires LedgerProvider')
  return value
}
