import { useState } from 'react'
import { FamilyScatterPanel } from './FamilyScatterPanel'
import { scatterFamilyBindings as bindings } from './scatter-family-bindings'
import type { ScatterPlotDockProps } from '../contracts/scatter-plot-types'
import './scatter-plot-dock.css'

const sides = [...new Map(bindings.map((binding) => [binding.scope.side.id, binding.scope.side])).values()]
export function ScatterPlotDock(props: ScatterPlotDockProps) {
  const targetBinding = props.target?.brokerId === props.brokerId ? bindings.find((candidate) => candidate.family.familyId === props.target?.familyId) : null
  const initial = () => ({ broker: props.brokerId, source: props.target,
    target: targetBinding ? props.target : null, familyId: targetBinding?.scope.family.id ?? bindings[0].scope.family.id })
  const [state, setState] = useState(initial)
  if (state.source !== props.target) setState(initial())
  else if (state.broker !== props.brokerId) setState({ ...state, broker: props.brokerId, target: null })
  const binding = bindings.find((candidate) => candidate.scope.family.id === state.familyId) ?? bindings[0]
  const target = state.broker === props.brokerId ? state.target : null
  return <FamilyScatterPanel key={JSON.stringify([binding.scope.family.id, target?.releaseId,target?.calculation])} {...props} target={target}
    binding={binding} sideOptions={sides} onSideChange={(side) => {
      const next = bindings.find((candidate) => candidate.scope.side.id === side)
      if (next) setState({ ...state, familyId: next.scope.family.id, target: null })
    }} familyOptions={bindings.filter((candidate) => candidate.scope.side.id === binding.scope.side.id).map((candidate) => candidate.scope.family)} onFamilyChange={(familyId) => setState({ ...state, familyId, target: null })} />
}
