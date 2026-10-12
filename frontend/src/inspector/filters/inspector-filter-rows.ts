import { inspectorFamilies, inspectorFamilyById } from '../catalog/inspector-families'

// Only the control is combined. Source IDs, release clocks and scorer histories
// remain distinct; old one-sector selections display as partially checked.
export const inspectorFilterRows = inspectorFamilies.flatMap(family => {
  if (['ism-services', 'german-pmi', 'french-pmi'].includes(family.id)) return []
  const ids = family.id === 'ism-manufacturing' ? ['ism-manufacturing', 'ism-services'] : family.id === 'euro-pmi' ? ['euro-pmi', 'german-pmi', 'french-pmi'] : [family.id]
  return [{ ...family,
    label: family.id === 'ism-manufacturing' ? 'US ISM Manufacturing / Services' : family.id === 'euro-pmi' ? 'Euro-area PMI · France / Germany / Euro area' : family.label,
    ids, search: ids.map(id => inspectorFamilyById.get(id)?.search ?? '').join(' '),
  }]
})
