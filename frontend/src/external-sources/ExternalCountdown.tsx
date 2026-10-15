import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { useCountdownNow } from '../inspector/calendar-clock'
import type { ExternalSource } from './external-source-model'
import { externalCountdown } from './external-schedule'

export function ExternalCountdown({ item, now, timeDisplay }: { item: ExternalSource; now: number; timeDisplay: TimeDisplayPreference }) {
  return <>{externalCountdown(item, useCountdownNow(now), timeDisplay)}</>
}
