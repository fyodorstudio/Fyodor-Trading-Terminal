import { isInspectorCommentary } from './group-releases'
import { type InspectorRelease } from '../../economic-calendar/releases/release'

export function releaseStatus(release: InspectorRelease, now: number, brokerTime = false): string {
  if (release.events.some(event => event.actual !== null)) return 'Released'
  if ((brokerTime ? release.serverTime * 1000 : release.releaseAt ?? 0) > now) return 'Upcoming'
  if (release.events.every(isInspectorCommentary)) return 'Commentary'
  return 'Awaiting actual'
}
