import type {R1Assessment,R1Family,R1FreshnessPolicy,R1Schedule,R1Slot} from './contracts'
import {r1Families} from './profiles'

export const r1FreshnessVersion='r1-scheduled-or-age-v1'
export const r1DefaultFreshness:R1FreshnessPolicy={graceHours:24,fallbackDays:{
  'us-cpi':45,pce:45,ppi:45,jobs:45,claims:10,gdp:45,retail:45,
  'ism-services':45,'ism-manufacturing':45,fomc:70,
}}
export function validR1Freshness(value:unknown):value is R1FreshnessPolicy {
  if(!value||typeof value!=='object')return false
  const v=value as R1FreshnessPolicy
  return Number.isInteger(v.graceHours)&&v.graceHours>=0&&v.graceHours<=168&&!!v.fallbackDays&&typeof v.fallbackDays==='object'&&!Array.isArray(v.fallbackDays)&&
    Object.keys(v.fallbackDays).length===r1Families.length&&r1Families.every(f=>Number.isInteger(v.fallbackDays[f])&&v.fallbackDays[f]>=1&&v.fallbackDays[f]<=365)
}
export function r1Freshness(family:R1Family,assessment:R1Assessment|null,at:number,schedules:readonly R1Schedule[],policy:R1FreshnessPolicy=r1DefaultFreshness):R1Slot {
  const base={family,assessment,nextDue:null,expiresAt:null,method:null,graceHours:policy.graceHours,fallbackDays:policy.fallbackDays[family]}
  if(!assessment||assessment.publishedAt===null||!Number.isFinite(assessment.publishedAt)||assessment.publishedAt>at)return{...base,assessment:null,status:'unavailable'}
  const announced=schedules.filter(s=>s.family===family&&Number.isFinite(s.dueAt)&&Number.isFinite(s.knownAt)&&s.knownAt<=at&&!!s.source)
  const superseded=new Set(announced.flatMap(s=>s.supersedesDueAt==null?[]:[s.supersedesDueAt]))
  const next=announced.filter(s=>s.dueAt>assessment.publishedAt!&&!superseded.has(s.dueAt)).sort((a,b)=>a.dueAt-b.dueAt||b.knownAt-a.knownAt)[0]
  // A missing schedule never invents a due date. Age begins at publication,
  // not a later storage capture/correction; known schedules take priority.
  const expiresAt=next?next.dueAt+policy.graceHours*3600000:assessment.publishedAt+policy.fallbackDays[family]*86400000
  return {...base,status:at>expiresAt?'stale':'current',nextDue:next?.dueAt??null,expiresAt,method:next?'scheduled':'age-based'}
}
