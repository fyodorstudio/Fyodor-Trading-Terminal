import { BridgeStatusProvider } from '../system-connectivity/bridge-status/BridgeStatusProvider'
import { TerminalWorkspace } from './TerminalWorkspace'

export function FyodorTerminalShell() {
  return <BridgeStatusProvider><TerminalWorkspace /></BridgeStatusProvider>
}
