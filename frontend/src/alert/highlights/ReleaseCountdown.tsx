import { useCountdownNow } from '../../inspector/calendar-clock'
import { alertCountdown } from '../model/alert-episodes'

export function ReleaseCountdown({ at, now, precise = false, prefix = '' }: { at: number; now: number; precise?: boolean; prefix?: string }) {
  return <>{prefix}{alertCountdown(at, useCountdownNow(now), precise)}</>
}
