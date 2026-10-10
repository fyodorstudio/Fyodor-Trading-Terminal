import type { R1Component, R1Family, R1Profile } from './contracts'

export const r1Version = 'usd-evidence-r1.0'
export const r1CalibrationPolicy = { version: 'r1-earlier-ap-q50-80-95-v1', minimum: 60, quantiles: [.5, .8, .95] } as const
const rate = (id: string, seriesId: string, label: string, weight: number): R1Component => ({ id, seriesId, label, weight, polarity: 1, unit: 'pp', units: [1], multiplier: 0, changeLabel: `${label} changed`, period: 'month' })
const inflation = (prefix: string, ids: string[], weights: number[]) => [rate('core-monthly', ids[0], `Core ${prefix} m/m`, weights[0]), rate('core-annual', ids[1], `Core ${prefix} y/y`, weights[1]), rate('headline-monthly', ids[2], `${prefix} m/m`, weights[2]), rate('headline-annual', ids[3], `${prefix} y/y`, weights[3])]
const component = (id: string, seriesId: string, label: string, weight: number, polarity: 1 | -1, unit: string, units: number[], multiplier: number, period: R1Component['period']): R1Component => ({ id, seriesId, label, weight, polarity, unit, units, multiplier, period, changeLabel: `${label} changed` })

export const r1Profiles: Record<R1Family, R1Profile> = {
  'us-cpi': { family: 'us-cpi', label: 'CPI', version: 'USD-CPI-SCORING-SYSTEM-V5', category: 'inflation', components: inflation('CPI', ['840030006', '840030008', '840030005', '840030007'], [50, 20, 15, 15]), alternatives: [[50,20,15,15], [45,20,20,15], [60,15,15,10], [50,30,10,10], [40,25,10,25]] },
  pce: { family: 'pce', label: 'PCE', version: 'USD-PCE-R1', category: 'inflation', components: inflation('PCE', ['840010001', '840010002', '840010003', '840010004'], [50,15,20,15]), alternatives: [[50,15,20,15], [50,20,15,15], [45,20,20,15], [50,25,15,10]] },
  ppi: { family: 'ppi', label: 'PPI', version: 'USD-PPI-R1', category: 'inflation', components: inflation('PPI', ['840030002', '840030004', '840030001', '840030003'], [40,15,30,15]), alternatives: [[40,15,30,15], [50,20,15,15], [35,15,35,15], [40,20,25,15]] },
  jobs: { family: 'jobs', label: 'Jobs', version: 'USD-JOBS-R1', category: 'labor', components: [component('payrolls','840030016','Nonfarm payroll change',60,1,'k',[0,4],1,'month'), {...rate('unemployment','840030015','Unemployment rate',30),polarity:-1},rate('wages','840030018','Hourly earnings m/m',10)], alternatives: [[60,30,10],[50,30,20],[50,40,10]] },
  claims: { family: 'claims', label: 'Jobless claims', version: 'USD-CLAIMS-R1.1', category: 'labor', components: [component('initial','840140001','Initial claims',70,-1,'k',[0],1,'week'),{...component('continuing','840140002','Continuing claims',30,-1,'k',[0],2,'week'),scale:1000}], alternatives: [[70,30],[60,40],[80,20],[50,50]] },
  gdp: { family: 'gdp', label: 'GDP', version: 'USD-GDP-R1', category: 'activity', components: [{...rate('growth','840010007','Real GDP growth',100),period:'quarter'}], alternatives:[[100]] },
  retail: { family: 'retail', label: 'Retail sales', version: 'USD-RETAIL-R1', category: 'activity', components: [rate('sales','840020010','Retail and food services m/m',100)], alternatives:[[100]] },
  'ism-services': { family:'ism-services',label:'ISM services',version:'USD-ISM-SERVICES-DEMAND-R1',category:'activity',components:[component('orders','840040007','New orders',60,1,'pts',[0],0,'month'),component('activity','840040009','Business activity',40,1,'pts',[0],0,'month')],alternatives:[[60,40],[50,50],[70,30],[40,60]] },
  // Explicit orders-only model for the current feed, not a missing-input
  // renormalization of the proposed 60/40 orders/production model.
  'ism-manufacturing': {family:'ism-manufacturing',label:'Manufacturing new orders',version:'USD-ISM-MANUFACTURING-ORDERS-R1.1',category:'activity',components:[component('orders','840040006','New orders',100,1,'pts',[0],0,'month')],alternatives:[[100]]},
  fomc: {family:'fomc',label:'Fed action',version:'USD-FED-ACTION-R1',category:'policy',components:[{...rate('action','840050014','Fed target rate',100),period:'action',unit:'bp'}],alternatives:[[100]]},
}
export const r1Families = Object.keys(r1Profiles) as R1Family[]
// PMI locates a newer manufacturing publication even when Orders is missing;
// it supplies reference/schedule metadata, never a score component.
export const r1SeriesIds = [...new Set([...r1Families.flatMap(f=>r1Profiles[f].components.map(c=>c.seriesId)),'840040001'])].filter(id=>/^\d+$/.test(id))
export const r1Family = (id: string): R1Family | null => Object.hasOwn(r1Profiles,id) ? id as R1Family : null
