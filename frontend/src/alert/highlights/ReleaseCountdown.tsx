import { useCountdownNow } from '../../inspector/calendar-clock'
import { alertComingIn } from '../model/alert-format'

export function ReleaseCountdown({ at, now }: { at: number; now: number }) {
  return <>{alertComingIn(at, useCountdownNow(now))}</>
}
