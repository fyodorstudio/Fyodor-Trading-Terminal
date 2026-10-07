import { inspectorFamilies } from '../inspector-data'

// Only the control is combined. Source IDs, release clocks and scorer histories
// remain distinct; old one-sector selections display as partially checked.
export const inspectorFilterRows = inspectorFamilies.flatMap(family =>
  ['ism-services', 'german-pmi', 'french-pmi'].includes(family.id) ? [] : [{ ...family,
    label: family.id === 'ism-manufacturing' ? 'US ISM Manufacturing / Services' : family.id === 'euro-pmi' ? 'Euro-area PMI · France / Germany / Euro area' : family.label,
    ids: family.id === 'ism-manufacturing' ? ['ism-manufacturing', 'ism-services'] : family.id === 'euro-pmi' ? ['euro-pmi', 'german-pmi', 'french-pmi'] : [family.id],
  }])
