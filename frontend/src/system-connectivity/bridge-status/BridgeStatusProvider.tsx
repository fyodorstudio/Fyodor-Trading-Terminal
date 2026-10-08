import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createUtcClockCorrection, UtcClockCorrectionContext } from '../../appearance/time-display/utc-clock-correction'
import { BridgeConnectionContext, BridgeTelemetryContext } from './bridge-status-context'
import { useBridgeStatus } from './use-bridge-status'

export function BridgeStatusProvider({ children }: { children: ReactNode }) {
  const bridge = useBridgeStatus()
  const [correction] = useState(createUtcClockCorrection)
  useEffect(() => correction.update(bridge.clockOffsetMs), [correction, bridge.clockOffsetMs])
  const reachable = bridge.reachable, connected = bridge.health?.mt5.connected === true
  const processRunning = bridge.health?.mt5.process_running === true
  const generation = bridge.health?.mt5.generation ?? 0, brokerId = bridge.health?.mt5.account_server ?? null
  const brokerOffsetSeconds = bridge.health?.calendar.server_utc_offset_seconds ?? 0
  const connection = useMemo(() => ({ reachable, connected, processRunning, generation, brokerId, brokerOffsetSeconds }),
    [reachable, connected, processRunning, generation, brokerId, brokerOffsetSeconds])
  return <UtcClockCorrectionContext.Provider value={correction}>
    <BridgeConnectionContext.Provider value={connection}>
      <BridgeTelemetryContext.Provider value={bridge}>{children}</BridgeTelemetryContext.Provider>
    </BridgeConnectionContext.Provider>
  </UtcClockCorrectionContext.Provider>
}
