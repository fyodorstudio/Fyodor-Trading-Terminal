import { inspectorFamilies } from '../inspector-data'

// Only the control is combined. Source IDs, release clocks and scorer histories
// remain distinct; old one-sector selections display as partially checked.
export const inspectorFilterRows = inspectorFamilies.flatMap(family =>
  family.id === 'ism-services' ? [] : [{ ...family,
    label: family.id === 'ism-manufacturing' ? 'US ISM Manufacturing / Services' : family.label,
    ids: family.id === 'ism-manufacturing' ? ['ism-manufacturing', 'ism-services'] : [family.id],
  }])
