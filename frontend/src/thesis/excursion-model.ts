export type ExcursionWindow = {
  status: 'complete' | 'partial' | 'unavailable'; gap?: string; max_pct?: number;
  favourable_pct?: number; adverse_pct?: number; adverse_before_peak_pct?: number; peak_utc?: string;
  baseline_utc?: string; through_utc?: string; missing_samples?: number; end_utc?: string;
  end_reason?: string; phase?: 'developing' | 'final'; direction_result?: 'aligned' | 'opposed' | 'flat';
}
export type AssessmentExcursion = {
  protocol_id: string; basis: string; source_id: string; broker_day: string;
  day_start_utc: string; day_end_utc: string; phase: 'developing' | 'final'; delivery_utc: string;
  day: ExcursionWindow; after_verdict: ExcursionWindow; active_window: ExcursionWindow;
  feedback: 'supporting_case' | 'refinement_candidate' | 'flat' | 'unresolved'; eligible: boolean;
  refresh_gap?: string;
}
const stamp = (v: unknown): v is string => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))
export function validExcursion(v: AssessmentExcursion) {
  const validWindow = (w: ExcursionWindow) => w && ['complete','partial','unavailable'].includes(w.status)
    && (w.gap === undefined || typeof w.gap === 'string')
    && ['max_pct','favourable_pct','adverse_pct','adverse_before_peak_pct'].every(key => w[key as keyof ExcursionWindow] === undefined || typeof w[key as keyof ExcursionWindow] === 'number' && Number.isFinite(w[key as keyof ExcursionWindow]))
    && ['peak_utc','baseline_utc','through_utc','end_utc'].every(key => w[key as keyof ExcursionWindow] === undefined || stamp(w[key as keyof ExcursionWindow]))
    && (w.favourable_pct === undefined || [w.adverse_pct,w.adverse_before_peak_pct].every(v=>typeof v === 'number' && Number.isFinite(v)) && stamp(w.peak_utc) && stamp(w.baseline_utc))
  return v && typeof v.protocol_id === 'string' && typeof v.basis === 'string' && v.source_id === 'Pepperstone-Demo'
    && /^\d{4}-\d\d-\d\d$/.test(v.broker_day) && stamp(v.day_start_utc) && stamp(v.day_end_utc) && stamp(v.delivery_utc)
    && Date.parse(v.day_end_utc) > Date.parse(v.day_start_utc) && ['developing','final'].includes(v.phase)
    && typeof v.eligible === 'boolean' && ['supporting_case','refinement_candidate','flat','unresolved'].includes(v.feedback)
    && (v.refresh_gap === undefined || typeof v.refresh_gap === 'string')
    && validWindow(v.day) && validWindow(v.after_verdict) && validWindow(v.active_window)
}
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`
const hour = (value: string) => new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value))
export function excursionHeading(value?: AssessmentExcursion) {
  return value?.day.max_pct === undefined ? 'Day max: —' : `Day max: ${percent(value.day.max_pct)} · ${value.phase === 'final' ? 'Final' : 'Developing'}${value.day.status === 'partial' ? ' · Partial history' : ''}`
}
export function excursionLines(value?: AssessmentExcursion) {
  if (!value) return ['Sampled FX basket · Price history not loaded.']
  const lines = [`Sampled FX basket · Broker day ${value.broker_day} · ends ${new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value.day_end_utc))} Jakarta.`]
  if (value.phase === 'developing' && value.day.through_utc) lines[0] += ` Prices through ${hour(value.day.through_utc)}.`
  if (value.refresh_gap) lines.push(`Price refresh unavailable: ${value.refresh_gap}. Retaining the last measured observations.`)
  if (value.day.status === 'unavailable') lines.push(value.day.gap || 'Daily price history unavailable.')
  const describe = (prefix: string, w: ExcursionWindow) => w.favourable_pct === undefined ? `${prefix}: ${w.gap || 'Measurement unavailable.'}`
    : `${prefix}: best ${percent(w.favourable_pct)} · adverse ${percent(w.adverse_pct!)} · before peak ${percent(w.adverse_before_peak_pct!)} · peak ${hour(w.peak_utc!)}${w.status === 'partial' ? ' · Partial history' : ''}.`
  lines.push(describe(`After verdict ${hour(value.delivery_utc)} → day end`,value.after_verdict))
  if (value.active_window.end_utc) lines.push(describe(`Active window → ${hour(value.active_window.end_utc)}${value.active_window.phase === 'developing' ? ' (developing)' : ''}`,value.active_window))
  if (!value.eligible) lines[0] += ' Context only: not eligible for standalone forecast feedback.'
  else if (value.feedback === 'supporting_case') lines[lines.length-1] += ' Supporting case: active-window excursion aligned.'
  else if (value.feedback === 'refinement_candidate') lines[lines.length-1] += ' Refinement candidate: active-window excursion opposed.'
  return lines
}
