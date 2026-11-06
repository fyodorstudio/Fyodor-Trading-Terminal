import { memo, useCallback, useRef, useState } from 'react'
import { useLedger } from './useLedger'
import { ledgerDay, ledgerDayEnd } from './ledger-model'
import { LedgerTimeline } from './LedgerTimeline'
import './ledger.css'
import { LedgerReleaseHeader } from './LedgerReleaseHeader'
import type { DetailReading } from '../currency-details/detail-model'
import { LedgerFiltersPopover } from './LedgerFiltersPopover'

export const LedgerDock = memo(function LedgerDock({ supported, broker, onOpenDetail, onViewEvent }: {
  supported: boolean; broker: string | null; onOpenDetail: () => void; onViewEvent: (reading: DetailReading, currency: string) => void
}) {
  const { data, scoreData, error, selection, setSelection, at, now, setYear, picking, canPick, togglePicking, cancelPicking, pickDay, goToToday, focusRequest, viewMemory, currencies, filters, applyFilters } = useLedger()
  const filterButton=useRef<HTMLButtonElement>(null),scope=currencies.join('')
  const [filterScope,setFilterScope]=useState<string|null>(null)
  if(filterScope!==null&&(!supported||filterScope!==scope))setFilterScope(null)
  const filtersOpen=supported&&filterScope===scope
  const closeFilters=useCallback(()=>setFilterScope(null),[])
  const [landing, setLanding] = useState<{ year: number; edge: 'start' | 'end'; request: number } | null>(null)
  const open = useCallback((currency: string, category: string | null = null) => {
    setSelection(s => ({ ...s, currency, category })); onOpenDetail()
  }, [setSelection, onOpenDetail])
  const select = useCallback((time: number) => { setLanding(null); pickDay(ledgerDay(time)) }, [pickDay])
  const changeYear = useCallback((year: number, edge: 'start' | 'end') => {
    setLanding({ year, edge, request: focusRequest }); setYear(year)
  }, [setYear, focusRequest])
  return <section className="ledger-dock" aria-label="Ledger">
    {supported && <div className="ledger-toolbar">
      <button ref={filterButton} type="button" aria-label="Ledger filters" aria-haspopup="dialog" aria-expanded={filtersOpen}
        onClick={()=>{cancelPicking();setFilterScope(filtersOpen?null:scope)}}>Filters · {filters.tiers.join('/')||'None'}</button>
      <button type="button" className="ledger-pick-button" aria-label="Pick Ledger date from a chart candle" title={picking ? 'Click a candle · Escape to cancel' : 'Pick Ledger date from a chart candle'}
        disabled={!canPick} aria-pressed={picking} onClick={togglePicking}>
        <span aria-hidden="true">⌖</span>
      </button>
      <button type="button" onClick={() => { setLanding(null); goToToday() }} aria-pressed={selection.at === null}>Today</button>
      <input aria-label="Ledger as-of date" type="date" min={`${(data ?? scoreData)?.min_year ?? 2015}-01-01`} max={ledgerDay(now)} value={ledgerDay(at)}
        onChange={e => { if (e.target.value && e.target.value <= ledgerDay(now) && e.target.value >= `${(data ?? scoreData)?.min_year ?? 2015}-01-01`) select(ledgerDayEnd(e.target.value)) }} />
    </div>}
    {!supported ? <p>Select one of the 28 major FX pairs to open Ledger.</p> : !broker ? <p>Connect a broker to load the Ledger.</p> : <>
      {error && <p role="alert">{error}</p>}
      {data?.source_available===false && <p>No stored broker calendar is available for this source.</p>}
      {data?.coverage && Object.entries(data.coverage).some(([,c])=>c.missing.length>0) && <p className="ledger-coverage">Some dates have incomplete stored coverage. Filters control which captured events are shown.</p>}
      <LedgerReleaseHeader onViewEvent={onViewEvent} onOpenDetail={open} />
      {!data ? !error && <p role="status">Loading Ledger…</p> : <LedgerTimeline data={data} filters={filters} at={at} now={now} focusRequest={focusRequest} viewMemory={viewMemory} landing={landing?.request === focusRequest ? landing : null} onSelect={select} onOpenCurrency={open} onViewEvent={onViewEvent} onYear={changeYear} />}
    </>}
    {filtersOpen&&<LedgerFiltersPopover anchor={filterButton} currencies={currencies} filters={filters} onApply={applyFilters} onClose={closeFilters}/>}
  </section>
})
