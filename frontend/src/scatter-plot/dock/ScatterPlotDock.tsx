import { useState } from 'react'
import { nfpScatterScope } from '../PAIR/EURUSD/USD/NFP/nfp-scatter-config'
import { nfpScatterModel } from '../PAIR/EURUSD/USD/NFP/nfp-scatter-adapter'
import { cpiScatterScope } from '../PAIR/EURUSD/USD/CPI/cpi-scatter-config'
import { cpiScatterModel } from '../PAIR/EURUSD/USD/CPI/cpi-scatter-adapter'
import { nfpMagnitudeFamily, cpiMagnitudeFamily } from '../../inspector/magnitude/magnitude-families'
import { FamilyScatterPanel, type ScatterFamilyBinding } from './FamilyScatterPanel'
import type { ScatterPlotDockProps } from '../contracts/scatter-plot-types'
import './scatter-plot-dock.css'

// Supported family bindings own data, selection and settings. Shared dock and
// plotting modules remain independent of any family's IDs or completion rules.
const bindings: ScatterFamilyBinding[] = [
  { family: nfpMagnitudeFamily, scope: nfpScatterScope, model: nfpScatterModel },
  { family: cpiMagnitudeFamily, scope: cpiScatterScope, model: cpiScatterModel },
]
const options = bindings.map((binding) => binding.scope.family)
export function ScatterPlotDock(props: ScatterPlotDockProps) {
  const [familyId, setFamilyId] = useState(bindings[0].scope.family.id)
  const binding = bindings.find((candidate) => candidate.scope.family.id === familyId) ?? bindings[0]
  return <FamilyScatterPanel key={binding.scope.family.id} {...props} binding={binding} familyOptions={options} onFamilyChange={setFamilyId} />
}
