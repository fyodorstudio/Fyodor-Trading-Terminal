import type {R1Aggregate,R1Balance} from './contracts'
import {r1Profiles} from './profiles'

export function r1DirectionLabel(b:Pick<R1Balance,'direction'|'net'|'coverage'>,currency='USD') {
  if(b.direction==='insufficient')return !b.coverage?'Evidence unavailable':b.net?`${currency} · Available evidence favors ${b.net>0?'strength':'weakness'}`:'Available evidence has no directional lead'
  return b.direction==='strengthening'?`${currency} Strengthening`:b.direction==='weakening'?`${currency} Weakening`:b.direction==='balanced'?'Balanced evidence':'No evidence selected'
}

// Use the actual routed unknown leaves, not every unscored/retired slot.
export function r1MissingEvidence(aggregate:R1Aggregate):string[] {
  return [...new Set(aggregate.leaves.filter(l=>l.value===null&&l.budget>0).map(l=>l.family.endsWith('pmi')?'PMI':l.family==='fomc'?'Fed context':r1Profiles[l.family].label))]
}
