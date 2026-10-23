import { useCountdownNow } from '../../inspector/calendar-clock'
import { alertComingIn, alertCountdown } from '../model/alert-episodes'

export function ReleaseCountdown({ at, now, precise = false, prefix = '', coming = false }: { at: number; now: number; precise?: boolean; prefix?: string; coming?: boolean }) {
  const current = useCountdownNow(now)
  return <>{prefix}{coming ? alertComingIn(at, current) : alertCountdown(at, current, precise)}</>
}
