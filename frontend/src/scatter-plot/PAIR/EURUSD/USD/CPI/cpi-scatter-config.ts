import { cpiMagnitudeScope } from '../../../../../inspector/magnitude/cpi-magnitude-settings'
import { cpiReadingRules } from '../../../../../inspector/grading/cpi-grading'

export const cpiScatterScope = {
  pair: { id: cpiMagnitudeScope.pair, label: cpiMagnitudeScope.pair },
  side: { id: `${cpiMagnitudeScope.currency}/${cpiMagnitudeScope.side}`, label: 'USD / Quote' },
  family: { id: cpiMagnitudeScope.family, label: 'US CPI / core CPI' },
  series: Object.entries(cpiReadingRules).map(([id, rule]) => ({ id, label: rule.name })),
}
