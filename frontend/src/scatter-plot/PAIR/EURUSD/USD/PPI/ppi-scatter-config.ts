import { ppiMagnitudeScope } from '../../../../../inspector/magnitude/ppi-magnitude-settings'
import { ppiReadingRules } from '../../../../../inspector/grading/ppi-grading'

export const ppiScatterScope = {
  pair: { id: ppiMagnitudeScope.pair, label: ppiMagnitudeScope.pair },
  side: { id: `${ppiMagnitudeScope.currency}/${ppiMagnitudeScope.side}`, label: 'USD / Quote' },
  family: { id: ppiMagnitudeScope.family, label: 'US PPI' },
  series: Object.entries(ppiReadingRules).map(([id, rule]) => ({ id, label: rule.name })),
}
