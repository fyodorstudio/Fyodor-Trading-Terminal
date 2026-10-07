export type ContextRecord = { recordedAt: number; asOf: number; symbol: string; broker: string; mode: 'usd' | 'relative';
  version: string; inputs: string[]; label: string; evidence: string; update: string; partial: boolean }
export type TradeWorkflow = { thesis: string; priceInvalidation: string; fundamentalInvalidation: string;
  riskLimit: string; reviewHorizon: string; exitRule: string; reviewTrigger: 'manual' | 'opposing-publication' | 'opposing-moderate'; context?: ContextRecord }
export const emptyWorkflow: TradeWorkflow = Object.freeze({ thesis: '', priceInvalidation: '', fundamentalInvalidation: '',
  riskLimit: '', reviewHorizon: '', exitRule: '', reviewTrigger: 'manual' })
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function validTradeWorkflow(v: unknown): v is TradeWorkflow {
  if (!record(v) || !['thesis', 'priceInvalidation', 'fundamentalInvalidation', 'riskLimit', 'reviewHorizon', 'exitRule'].every(k => typeof v[k] === 'string') ||
    !['manual', 'opposing-publication', 'opposing-moderate'].includes(v.reviewTrigger as string)) return false
  if (v.context === undefined) return true
  const c = v.context
  return record(c) && ['recordedAt', 'asOf'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k])) &&
    ['symbol', 'broker', 'version', 'label', 'evidence', 'update'].every(k => typeof c[k] === 'string') &&
    ['usd', 'relative'].includes(c.mode as string) && typeof c.partial === 'boolean' && Array.isArray(c.inputs) && c.inputs.every(f => typeof f === 'string')
}
export function workflowSnapshot(workflow: TradeWorkflow | undefined) {
  return workflow && validTradeWorkflow(workflow) ? { ...workflow, ...(workflow.context ? { context: { ...workflow.context, inputs: [...workflow.context.inputs] } } : {}) } : undefined
}
