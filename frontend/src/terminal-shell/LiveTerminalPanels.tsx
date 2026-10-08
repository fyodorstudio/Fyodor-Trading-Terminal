import { memo, type ComponentProps, type ReactNode } from 'react'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { InspectorPanel } from '../inspector'
import { useBridgeTelemetry } from '../system-connectivity/bridge-status/bridge-status-context'
import { DataHeartbeatPanel } from '../system-connectivity/bridge-status/DataHeartbeatPanel'
import { ActivityLogPanel } from '../system-observability/activity-log/ActivityLogPanel'
import { useActivityActions, useActivityEntries } from '../system-observability/activity-log/use-activity-log'
import { TerminalStatusBar } from './TerminalStatusBar'

function BridgeHeartbeat({ actions }: { actions: ReactNode }) {
  const bridge = useBridgeTelemetry()
  return bridge && <DataHeartbeatPanel {...bridge} clockExtra={actions} />
}
const renderHeartbeat = (actions: ReactNode) => <BridgeHeartbeat actions={actions} />

export function ActivityDock({ timeDisplay }: { timeDisplay: TimeDisplayPreference }) {
  const entries = useActivityEntries(), { clearActivity } = useActivityActions()
  return <ActivityLogPanel entries={entries} timeDisplay={timeDisplay} onClear={clearActivity} renderHeartbeat={renderHeartbeat} />
}

export function LiveTerminalStatusBar(props: Omit<ComponentProps<typeof TerminalStatusBar>, 'activityCount'>) {
  const entries = useActivityEntries()
  return <TerminalStatusBar {...props} activityCount={entries.length} />
}

const StableInspectorPanel = memo(InspectorPanel)
export function InspectorDock(props: Omit<ComponentProps<typeof InspectorPanel>, 'source' | 'error'>) {
  const bridge = useBridgeTelemetry()
  return <StableInspectorPanel {...props} source={bridge?.health?.calendar ?? null} error={null} />
}
