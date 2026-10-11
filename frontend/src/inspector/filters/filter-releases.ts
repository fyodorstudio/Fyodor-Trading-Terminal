import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { InspectorPreferences } from '../preferences/inspector-preferences'
import type { CalendarDisplayRange } from '../../economic-calendar/time/calendar-display-range'
import { episodePublications } from '../episodes/display-episodes'

export function filterInspectorReleases(groups: InspectorRelease[], preferences: InspectorPreferences, range: CalendarDisplayRange | null, brokerTime = false,
  dateTime: (release: InspectorRelease) => number | null = release => release.serverTime * 1000) {
  if (!range) return []
  return groups.filter((group) => {
    const at = brokerTime ? group.serverTime * 1000 : group.releaseAt ?? (group.timingUncertain ? dateTime(group) : null)
    const publications = episodePublications(group), members = publications ?? [group]
    return members.some((member) => preferences.families.includes(member.familyId)) &&
      (publications ? members.some((member) => {
        const time = brokerTime ? member.serverTime * 1000 : member.releaseAt ?? (member.timingUncertain ? dateTime(member) : null)
        return time !== null && time >= range.from && time < range.to
      }) : at !== null && at >= range.from && at < range.to)
  })
}
