import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { jakartaDate } from './alert-day-model'

export function alertDateForRelease(release: InspectorRelease): string | null {
  const publication = release.daily?.publications[0] ?? release.pmiPublications?.[0] ?? release
  if (!publication.timingUncertain && publication.releaseAt !== null) return jakartaDate(publication.releaseAt)
  const sourceTime = publication.events[0]?.server_time_seconds
  return sourceTime > 0 && Number.isFinite(sourceTime) ? new Date(sourceTime * 1000).toISOString().slice(0, 10) : null
}

export type AlertFocus = {
  request: number
  externalKey?: string
  sourceId?: string
  valueIds?: string[]
  date?: string
  families?: string[]
}
