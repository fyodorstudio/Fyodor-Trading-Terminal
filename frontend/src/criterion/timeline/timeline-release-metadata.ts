import type { TimelineReleaseBlock, TimelineRelationship } from './CpiEventTimelineTable'

export function getRelationshipMeta(rel: TimelineRelationship, timingUncertain?: boolean): { label: string; badgeClass: string } {
  switch (rel) {
    case 'before':
      return { label: 'Before CPI', badgeClass: 'before' }
    case 'simultaneous':
      return { label: timingUncertain ? 'Simultaneous (Tentative)' : 'Simultaneous', badgeClass: 'simultaneous' }
    case 'after_release_before_entry':
    case 'after_release_known_by_entry':
      return { label: timingUncertain ? 'After CPI (Pre-Entry, Tentative)' : 'After CPI (Pre-Entry)', badgeClass: 'pre-entry' }
    case 'after_entry':
    case 'after':
    default:
      return { label: 'After CPI Entry', badgeClass: 'after' }
  }
}

export function isExploratoryBlock(block: TimelineReleaseBlock): boolean {
  return ['840140001', '840020010', '840030001'].includes(block.eventId ?? '') ||
    /Initial Jobless|Retail Sales|PPI/.test(block.family)
}
