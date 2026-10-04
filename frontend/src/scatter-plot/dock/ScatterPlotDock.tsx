import { NfpScatterPanel } from '../PAIR/EURUSD/USD/NFP/NfpScatterPanel'
import type { ScatterPlotDockProps } from '../contracts/scatter-plot-types'
import './scatter-plot-dock.css'

// Supported family bindings own data, selection and settings. Shared dock and
// plotting modules remain independent of any family's IDs or completion rules.
export function ScatterPlotDock(props: ScatterPlotDockProps) {
  return <NfpScatterPanel {...props} />
}
