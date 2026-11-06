import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { type DetailReading } from '../currency-details/detail-model'
import { ledgerHistory } from './ledger-model'
import { useLedger } from './useLedger'
import { ledgerHeaderGroups as groups, headerOptions } from './ledger-header-options'
import { LedgerValues } from './LedgerValues'

export const LedgerReleaseHeader = memo(function LedgerReleaseHeader({ onViewEvent, onOpenDetail }: {
  onViewEvent: (reading: DetailReading, currency: string) => void; onOpenDetail: (currency: string) => void
}) {
  const { scoreData, at, headerChoices, setHeaderChoices, viewMemory, saveHeaderScroll, currencies } = useLedger()
  const scroll = useRef<HTMLDivElement>(null)
  const columns = useMemo(() => groups.map(group => {
    const options=headerOptions(scoreData,currencies,group.id)
    const choiceKey=currencies.join('')+':'+group.id
    const preset=options.find(p=>p.id===headerChoices[choiceKey])??options[0]
    return { group, preset, options, choiceKey, rows: currencies.map(currency => {
      const metric = preset?.metrics[currency]
      const history = metric ? ledgerHistory(metric, at) : []
      return { currency, metric, readings: [...Array(3 - history.length).fill(null), ...history] as (typeof history[number] | null)[] }
    }) }
  }), [scoreData, at, headerChoices,currencies])
  useLayoutEffect(() => {
    const element = scroll.current
    if (element) element.scrollLeft = viewMemory.current.headerLeft
    return () => { if (element) saveHeaderScroll(element.scrollLeft) }
  }, [viewMemory, saveHeaderScroll])
  return <div ref={scroll} className="ledger-release-header" aria-label="Ledger recent releases by category"
    onScroll={event => saveHeaderScroll(event.currentTarget.scrollLeft)}>
    <table><colgroup><col className="ledger-header-currency-col" />{groups.map(group => <col key={group.id} className="ledger-header-group-col" />)}</colgroup>
      <thead><tr><th scope="col" className="ledger-header-currency">CUR</th>{columns.map(({ group, preset, options, choiceKey }) => <th scope="col" key={group.id}>
        <label><span>{group.label}</span><select aria-label={`Ledger ${group.label} measure`} value={preset?.id??''}
          onChange={event => setHeaderChoices(old => ({ ...old, [choiceKey]: event.target.value }))}>
          {[...new Set(options.map(o=>o.section))].map(section=><optgroup key={section} label={section}>
            {options.filter(o=>o.section===section).map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
          </optgroup>)}
        </select></label>
      </th>)}</tr></thead>
      <tbody>{currencies.map((currency, rowIndex) => <tr key={currency}>
        <th scope="row" className="ledger-header-currency"><button type="button" aria-label={`Open ${currency} Ledger scorecard`} onClick={() => onOpenDetail(currency)}>{currency}</button></th>
        {columns.map(({ group, rows }) => {
          const { metric, readings } = rows[rowIndex]
          return <td key={group.id} data-ledger-header={`${currency}-${group.id}`}>
            <span className="ledger-header-metric" title={metric?.definition}>{metric?.id === 'usd.rate' ? 'Fed target upper bound' : metric?.label ?? 'Measure unavailable for this currency'}</span>
            <div className="ledger-header-readings">{readings.map((selected, i) => <div key={selected?.entry.value_id ?? i}>
              {selected && metric ? <button type="button" className="ledger-header-release" data-ledger-header-value={selected.entry.value_id}
                title={`${metric.definition} · Reference ${selected.entry.period ?? 'not supplied'}${selected.backfilled ? ' · Backfilled: original release vintage unverified' : ''}`}
                onClick={() => onViewEvent(selected.entry, currency)}>
                <LedgerValues entry={selected.entry} unit={metric.unit} />
                <time dateTime={selected.entry.day}>{new Date(selected.entry.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}{selected.backfilled ? ' *' : ''}</time>
              </button> : <span className="ledger-header-empty">—</span>}
            </div>)}</div>
          </td>
        })}
      </tr>)}</tbody>
    </table>
  </div>
})
