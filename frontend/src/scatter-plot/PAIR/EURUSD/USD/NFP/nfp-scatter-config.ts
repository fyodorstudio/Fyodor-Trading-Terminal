import { nfpReadingRules } from '../../../../../inspector/grading/nfp-grading'
import { nfpMagnitudeScope } from './magnitude/nfp-magnitude-settings'

export const nfpScatterScope = {
  pair: { id: nfpMagnitudeScope.pair, label: nfpMagnitudeScope.pair },
  side: { id: `${nfpMagnitudeScope.currency}/${nfpMagnitudeScope.side}`, label: 'USD / Quote' },
  family: { id: nfpMagnitudeScope.family, label: nfpMagnitudeScope.family },
  series: ['840030016', '840030015', '840030017', '840030018', '840030019', '840030020',
    '840030023', '840030022', '840030032', '840030024'].map((id) => ({ id, label: nfpReadingRules[id].name })),
}
