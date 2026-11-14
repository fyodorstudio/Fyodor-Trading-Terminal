import { memo } from 'react'
import { detailValue } from '../currency-details/detail-model'
import { useLedger } from './useLedger'
import { actualImpact } from '../economic-calendar/presentation/actual-impact'
export const LedgerDetail = memo(function LedgerDetail() {
  const { detailData: data, error, developments } = useLedger()
  return <div className="ledger-detail">
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading calendar readings…</p> : <table className="ledger-categories" aria-label="Currency developments by category"><thead><tr><th>Category</th>{developments.map(card => <th key={card.currency}>{card.currency}</th>)}</tr></thead><tbody>
      {developments[0]?.categories.map((category,index) => <tr key={category.id}><th>{category.label}</th>{developments.map(card => <td key={card.currency} data-ledger-category={`${card.currency}-${category.id}`}>
        {card.categories[index].rows.filter(row => row.entry).map(row => <div key={row.metric.id} data-ledger-metric={row.metric.id}><span>{row.metric.id === 'usd.rate' ? 'Fed upper bound' : row.metric.label}</span><b>{detailValue(row.previous,row.metric.unit)} → <span data-mt5-impact={actualImpact(row.entry!.value,row.entry!.impact)}>{detailValue(row.entry!.value,row.metric.unit)}</span></b></div>)}
        {!card.categories[index].rows.some(row => row.entry) && <span>—</span>}
      </td>)}</tr>)}
    </tbody></table>}
  </div>
})
