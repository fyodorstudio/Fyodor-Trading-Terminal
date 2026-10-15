import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { InspectorPreferences } from '../preferences/inspector-preferences'
import type { CalendarDisplayRange } from '../../economic-calendar/time/calendar-display-range'
import { episodePublications, releaseFamilyIds, selectedPackageSeries } from '../episodes/display-episodes'

export function filterInspectorReleases(groups: InspectorRelease[], preferences: InspectorPreferences, range: CalendarDisplayRange | null,
  dateTime: (release: InspectorRelease) => number | null = release => release.serverTime * 1000) {
  if (!range) return []
  return groups.flatMap((source) => {
    const group = selectedPackageSeries(source, preferences.families)
    if (!group) return []
    const at = group.releaseAt ?? (group.timingUncertain ? dateTime(group) : null)
    const publications = episodePublications(group), members = publications ?? [group]
    const admitted = members.some((member) => releaseFamilyIds(member).some(id => preferences.families.includes(id))) &&
      (publications ? members.some((member) => {
        const time = member.releaseAt ?? (member.timingUncertain ? dateTime(member) : null)
        return time !== null && time >= range.from && time < range.to
      }) : at !== null && at >= range.from && at < range.to)
    return admitted ? [group] : []
  })
}
