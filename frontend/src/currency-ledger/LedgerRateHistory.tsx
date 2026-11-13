import { useMemo } from 'react'
import type { DetailReading } from '../currency-details/detail-model'
import { ledgerPublications } from './ledger-model'
import { LedgerValues } from './LedgerValues'
import { useLedger } from './useLedger'

export function LedgerRateHistory({ onViewEvent }: { onViewEvent: (reading: DetailReading,currency: string) => void }) {
  const { detailData: data, currencies, at } = useLedger()
  const columns = useMemo(() => {
    return currencies.map(currency => {
      const metric=data?.metrics.find(m=>m.id===`${currency.toLowerCase()}.rate`)
      return {currency,metric,events:metric?ledgerPublications(metric,at).filter(r=>r.entry.value!==null&&r.entry.day.startsWith(`${data!.year}-`)).reverse():[]}
    })
  }, [data, currencies, at])
  return <div className="ledger-rate-history"><p>Released policy decisions · {data?.year ?? 'Loading…'} · newest first</p>
    <div className="ledger-rate-columns">{columns.map(({ currency, metric, events }) => <section key={currency}>
      <h3>{currency}</h3>{events.length && metric ? events.map(({ entry,backfilled }) => <button type="button" key={entry.value_id}
        title={`${metric.definition}${backfilled?' · Backfilled: original release vintage unverified':''}`} onClick={() => onViewEvent(entry,currency)}><time>{entry.day}{backfilled?' *':''}</time><LedgerValues entry={entry} unit={metric.unit} /></button>)
        : <p>No retained decisions by the selected date.</p>}
    </section>)}</div>
  </div>
}
