import { eventFamilyOptions } from '../../event-families'
import { eurNumericEventCatalog } from './EUR/numeric-event-catalog'
import { usdNumericEventCatalog } from './USD/numeric-event-catalog'
import type { ReadingFamily } from '../reading-grading'

const catalog = { ...eurNumericEventCatalog, ...usdNumericEventCatalog }
// Catalog admission is explicit, never inferred from a name, a missing value,
// or an event that happens to arrive with numbers. Existing scored families keep
// their detailed reading definitions and historical settings keys.
export const expandedReadingFamilies: (ReadingFamily & { label: string })[] = eventFamilyOptions.flatMap((family) => {
  const readingRules = Object.fromEntries(family.events.filter((id) => Object.hasOwn(catalog, id)).map((id) =>
    [id, { name: catalog[id], definition: `${catalog[id]}. ${['fomc', 'ecb'].includes(family.id) ? 'Rate deltas and magnitude boundaries use basis points.' : "Changes use the source series' native units."}` }]))
  return Object.keys(readingRules).length ? [{ familyId: family.id, country: family.country, currency: family.currency,
    label: family.label, readingRules }] : []
})
