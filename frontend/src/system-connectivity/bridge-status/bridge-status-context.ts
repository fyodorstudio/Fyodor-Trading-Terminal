import { createContext, useContext } from 'react'
import type { BridgeStatusState } from './use-bridge-status'

export type BridgeConnection = {
  reachable: boolean
  connected: boolean
  processRunning: boolean
  generation: number
  brokerId: string | null
  brokerOffsetSeconds: number
}
const waiting: BridgeConnection = { reachable: false, connected: false, processRunning: false,
  generation: 0, brokerId: null, brokerOffsetSeconds: 0 }
export const BridgeConnectionContext = createContext(waiting)
export const BridgeTelemetryContext = createContext<BridgeStatusState | null>(null)
export const useBridgeConnection = () => useContext(BridgeConnectionContext)
export const useBridgeTelemetry = () => useContext(BridgeTelemetryContext)
