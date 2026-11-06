import { detailValue } from '../currency-details/detail-model'
import { actualImpact } from '../economic-calendar/presentation/actual-impact'
import type { LedgerEntry } from './ledger-model'

export function LedgerValues({entry,unit}:{entry:LedgerEntry;unit:string}){
  return <span className="ledger-header-values">{[
    {label:'Actual',short:'A',value:entry.value}, {label:'Forecast',short:'F',value:entry.forecast},
    {label:'Previous',short:'P',value:entry.revised_previous??entry.previous},
  ].map(({label,short,value})=><span key={label}>
    <small title={label}>{short}</small><strong data-mt5-impact={label==='Actual'?actualImpact(value,entry.impact):undefined}
      title={label==='Actual'?`Actual · MT5 assessment: ${entry.impact??'none'}`:label}>{detailValue(value,unit)}</strong>
  </span>)}</span>
}
