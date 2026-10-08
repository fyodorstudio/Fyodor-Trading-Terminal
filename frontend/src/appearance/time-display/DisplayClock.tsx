import { useMemo, type ReactNode } from 'react'
import type { ChartClockScope } from './chart-clock'
import type { TimeDisplayPreference } from './time-display-preference'
import { DisplayClockContext } from './useDisplayClock'

export function DisplayClockProvider({ brokerId, brokerOffsetSeconds, preference, children }: ChartClockScope & { preference: TimeDisplayPreference; children: ReactNode }) {
  const value = useMemo(() => ({ scope: { brokerId, brokerOffsetSeconds }, preference }), [brokerId, brokerOffsetSeconds, preference])
  return <DisplayClockContext.Provider value={value}>{children}</DisplayClockContext.Provider>
}
