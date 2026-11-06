import type { LedgerData, LedgerMetric } from './ledger-model'

type Preset={id:string;label:string;defaultSuffix?:string;overrides?:Record<string,string|null>}
const presets:Record<string,Preset[]>={
  policy:[{id:'rate',label:'Policy rate',defaultSuffix:'rate'}],
  inflation:[
    {id:'headline-yoy',label:'Headline inflation YoY (national series)',defaultSuffix:'cpi-yoy',overrides:{EUR:'hicp-yoy',AUD:'cpi-monthly'}},
    {id:'headline-mom',label:'Headline inflation MoM',defaultSuffix:'cpi-mom',overrides:{EUR:'hicp-mom',AUD:null,NZD:null,JPY:null,GBP:null}},
    {id:'underlying-trim',label:'Underlying inflation (national definitions)',defaultSuffix:'core-yoy',overrides:{CAD:'trim',AUD:'trim-monthly',CHF:null,NZD:null}},
    {id:'underlying-median',label:'US core / Canadian median YoY',overrides:{USD:'core-yoy',CAD:'median'}},
    {id:'core-mom',label:'Core CPI MoM',overrides:{USD:'core-mom',EUR:'core-mom'}},
    {id:'pce-yoy',label:'Core PCE YoY (USD)',overrides:{USD:'pce-yoy'}},
    {id:'pce-mom',label:'Core PCE MoM (USD)',overrides:{USD:'pce-mom'}},
  ],
  labour:[
    {id:'unemployment',label:'Unemployment rate',defaultSuffix:'unemployment'},
    {id:'employment',label:'Employment change (national definitions)',overrides:{USD:'payrolls',CAD:'employment',AUD:'employment',NZD:'employment'}},
    {id:'wages',label:'Wages (national definitions)',defaultSuffix:'wages',overrides:{USD:'earnings',CAD:null,CHF:null,NZD:null}},
  ],
  activity:[
    {id:'gdp',label:'Quarterly GDP (national definitions)',defaultSuffix:'gdp',overrides:{CAD:'gdp-quarter',GBP:'gdp-quarter'}},
    {id:'manufacturing',label:'Manufacturing PMI (national surveys)',defaultSuffix:'manufacturing'},
    {id:'services',label:'Services PMI (national surveys)',defaultSuffix:'services'},
    {id:'gdp-month',label:'Monthly GDP',overrides:{CAD:'gdp',GBP:'gdp'}},
    {id:'retail',label:'Retail sales (national definitions)',defaultSuffix:'retail'},
    {id:'spending',label:'Household spending (national definitions)',defaultSuffix:'spending'},
    {id:'control',label:'Retail control MoM (USD)',overrides:{USD:'control'}},
  ],
}
export const ledgerHeaderGroups=[{id:'policy',label:'Interest rate'},{id:'inflation',label:'Inflation'},
  {id:'labour',label:'Labour & wage'},{id:'activity',label:'Activity / other'}]

export function headerOptions(data:LedgerData|null, currencies:readonly string[], group:string){
  const metrics=data?.metrics??[]
  const options:{id:string;label:string;metrics:Record<string,LedgerMetric|undefined>;section:string}[]=[]
  for(const preset of presets[group]??[]){
    const mapped=Object.fromEntries(currencies.map(currency=>{
      const suffix=Object.hasOwn(preset.overrides??{},currency)?preset.overrides![currency]:preset.defaultSuffix
      return [currency,suffix?metrics.find(m=>m.id===`${currency.toLowerCase()}.${suffix}`):undefined]
    }))
    if(Object.values(mapped).some(Boolean) || !data) options.push({...preset,metrics:mapped,section:'Comparable presets'})
  }
  const belongs=(m:LedgerMetric)=>group==='activity'?!['policy','inflation','labour'].includes(m.category):m.category===group
  for(const currency of currencies){
    const individual=metrics.filter(m=>m.currency===currency&&belongs(m)&&m.entries.length>0)
      .sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id))
    for(const metric of individual) options.push({id:`metric:${metric.id}`,label:`${currency} · ${metric.country??''} · ${metric.label} · ${metric.event_id??metric.id}`,
      metrics:{[currency]:metric},section:`${currency} · All captured series`})
  }
  return options
}
