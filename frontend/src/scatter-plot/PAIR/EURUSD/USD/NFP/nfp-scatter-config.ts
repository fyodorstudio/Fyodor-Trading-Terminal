import { nfpReadingRules } from '../../../../../inspector/grading/nfp-grading'

export const nfpScatterScope = {
  pair: { id: 'EURUSD', label: 'EURUSD' },
  side: { id: 'USD/QUOTE', label: 'USD / Quote' },
  family: { id: 'NFP', label: 'NFP' },
  series: ['840030016', '840030015', '840030017', '840030018', '840030019', '840030020',
    '840030023', '840030022', '840030032', '840030024'].map((id) => ({ id, label: nfpReadingRules[id].name })),
}
