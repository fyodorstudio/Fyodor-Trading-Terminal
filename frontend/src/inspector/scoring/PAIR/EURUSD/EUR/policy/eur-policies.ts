export type EurFamily = 'euro-inflation' | 'german-inflation' | 'euro-pmi' | 'german-pmi' | 'french-pmi' | 'euro-labor' | 'euro-wages' | 'euro-gdp'
export type EurSignal = { id: string; label: string; seriesId: string; weight: number; group: string; unit: string;
  mode: 'change' | 'trend' | 'pmi'; inverse?: boolean; cadence: 1 | 3; description: string }
export type EurPolicy = { family: EurFamily; country: string; label: string; signals: readonly EurSignal[] }
const signal = (id: string, label: string, seriesId: string, weight: number, cadence: 1 | 3,
  mode: EurSignal['mode'] = 'change', inverse = false, group = 'release'): EurSignal => ({ id, label, seriesId, weight,
  cadence, mode, inverse, group, unit: mode === 'pmi' ? 'index points' : 'pp', description: mode === 'pmi' ?
    'Below 50 counts as contraction; at or above 50 compares with the preceding three distinct reference months, with the benchmark floored at 50.' :
    mode === 'trend' ? 'Latest three-period mean minus the preceding three-period mean; earlier periods use only publications known at this release.' :
    `${inverse ? 'Inverse ' : ''}actual minus the preceding distinct reference period. A same-period flash reading is not a prior-month benchmark.` })
const pmi = (family: EurFamily, country: string, prefix: string, label: string): EurPolicy => ({ family, country, label, signals: [
  signal('composite', 'Composite activity', prefix + '003', 100, 1, 'pmi'),
  signal('services', 'Services activity', prefix + '002', 0, 1, 'pmi'),
  signal('manufacturing', 'Manufacturing activity', prefix + '001', 0, 1, 'pmi'),
] })
export const eurPolicies: readonly EurPolicy[] = [
  { family: 'euro-inflation', country: 'EU', label: 'Euro-area inflation v1.1', signals: [
    signal('core-change', 'Annual core change', '999030012', 50, 1, 'change', false, 'annual-inflation'),
    signal('core-trend', 'Annual core trend', '999030012', 35, 1, 'trend', false, 'annual-inflation'),
    signal('headline-change', 'Annual headline change', '999030013', 15, 1, 'change', false, 'annual-inflation'),
  ] },
  { family: 'german-inflation', country: 'DE', label: 'German inflation v1.1', signals: [
    signal('hicp-change', 'Annual HICP change', '276010023', 60, 1, 'change', false, 'annual-inflation'),
    signal('hicp-trend', 'Annual HICP trend', '276010023', 25, 1, 'trend', false, 'annual-inflation'),
    signal('cpi-change', 'Annual CPI change', '276010021', 15, 1, 'change', false, 'annual-inflation'),
  ] },
  pmi('euro-pmi', 'EU', '999500', 'Euro-area PMI v1.1'), pmi('german-pmi', 'DE', '276500', 'German PMI v1.1'),
  pmi('french-pmi', 'FR', '250500', 'French PMI v1.1'),
  { family: 'euro-labor', country: 'EU', label: 'Euro-area labor v1.1', signals: [
    signal('unemployment', 'Unemployment change', '999030020', 60, 1, 'change', true, 'slack'),
    signal('employment', 'Employment quarterly growth', '999030001', 30, 3, 'change', false, 'employment'),
    signal('employment-annual', 'Employment annual growth', '999030002', 10, 3, 'change', false, 'employment'),
  ] },
  { family: 'euro-wages', country: 'EU', label: 'Euro-area wage costs v1.1', signals: [
    signal('wages', 'Annual wage-cost change', '999030023', 70, 3, 'change', false, 'costs'),
    signal('labor-cost', 'Annual labor-cost change', '999030009', 30, 3, 'change', false, 'costs'),
  ] },
  { family: 'euro-gdp', country: 'EU', label: 'Euro-area GDP v1.1', signals: [
    signal('growth', 'Quarterly growth pace', '999030016', 80, 3, 'change', false, 'growth'),
    signal('annual', 'Annual growth change', '999030017', 20, 3, 'change', false, 'growth'),
  ] },
]
export const eurPolicy = (family: string) => eurPolicies.find(p => p.family === family) ?? null
export const eurNumericSeriesIds = [...new Set(eurPolicies.flatMap(p => p.signals.map(s => s.seriesId)))]
export const eurScoreVersion = 'eur-dataset-interpreter-v1.1'
