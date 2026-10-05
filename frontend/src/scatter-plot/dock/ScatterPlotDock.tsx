import { useState } from 'react'
import { FamilyScatterPanel } from './FamilyScatterPanel'
import { scatterFamilyBindings as bindings } from './scatter-family-bindings'
import type { ScatterPlotDockProps } from '../contracts/scatter-plot-types'
import './scatter-plot-dock.css'

const options = bindings.map((binding) => binding.scope.family)
export function ScatterPlotDock(props: ScatterPlotDockProps) {
  const targetBinding = props.target?.brokerId === props.brokerId ? bindings.find((candidate) => candidate.family.familyId === props.target?.familyId) : null
  const initial = () => ({ broker: props.brokerId, source: props.target,
    target: targetBinding ? props.target : null, familyId: targetBinding?.scope.family.id ?? bindings[0].scope.family.id })
  const [state, setState] = useState(initial)
  if (state.source !== props.target) setState(initial())
  else if (state.broker !== props.brokerId) setState({ ...state, broker: props.brokerId, target: null })
  const binding = bindings.find((candidate) => candidate.scope.family.id === state.familyId) ?? bindings[0]
  const target = state.broker === props.brokerId ? state.target : null
  return <FamilyScatterPanel key={JSON.stringify([binding.scope.family.id, target?.releaseId])} {...props} target={target}
    binding={binding} familyOptions={options} onFamilyChange={(familyId) => setState({ ...state, familyId, target: null })} />
}
