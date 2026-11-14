import { memo, useEffect, useRef } from 'react'
import { LedgerDetail } from '../currency-ledger/LedgerDetail'
import { chartEventCurrencies } from '../economic-calendar/forex/chart-event-scope'
import './currency-details.css'
import { useLedger } from '../currency-ledger/useLedger'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { DetailWildcards } from '../wildcards/DetailWildcards'
export const CurrencyDetailPanel = memo(function CurrencyDetailPanel({ brokerId, symbol, onClose }: {
  brokerId: string | null; symbol: string; onClose: () => void
}) {
  const panel = useRef<HTMLElement>(null)
  const { following, followChart, stopFollowing, canPick, at, detailPinned, goToToday } = useLedger()
  const { utc } = useDisplayClock()
  useEffect(() => stopFollowing, [stopFollowing])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = panel.current
    element?.querySelector('button')?.focus()
    return () => { if (element?.contains(document.activeElement)) previous?.focus() }
  }, [])
  return <aside ref={panel} id="currency-detail-panel" className="currency-detail-panel" aria-labelledby="currency-detail-title" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
    <header><span>{symbol}</span><h2 id="currency-detail-title">Detail</h2><button type="button" aria-label="Close Detail" onClick={onClose}>×</button></header>
    <div className="detail-body"><div className="detail-time-controls"><button type="button" disabled={!canPick} aria-pressed={following} onClick={followChart}>{following ? 'Following chart…' : 'Follow chart cursor'}</button><button type="button" onClick={goToToday}>Today</button><time>{utc(at)}</time></div>
      {!chartEventCurrencies(symbol).length ? <p>No currency Detail scope for {symbol}.</p> : !brokerId ? <p>Connect a broker to view Detail.</p> : <LedgerDetail />}
      <DetailWildcards at={at} pinned={detailPinned} /></div>
  </aside>
})
