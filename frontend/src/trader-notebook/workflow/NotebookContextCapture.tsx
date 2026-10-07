import { relativeContextVersion } from '../../pair-context/core/eur-policy'
import { useMemo, useState } from 'react'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { useRaycasterFamilies } from '../../raycaster/storage/raycaster-family-settings'
import { contextSourceFamilies } from '../../usd-context/core/policy'
import { useUsdContextTimeline } from '../../usd-context/runtime/useUsdContextTimeline'
import { contextAt } from '../../usd-context/core/context-lookup'
import { contextResultLabel, usdPair } from '../../usd-context/core/usd-pair'
import { useRelativePreferences } from '../../pair-context/storage/relative-preferences'
import { useEurContextTimeline } from '../../pair-context/runtime/useEurContextTimeline'
import { eurContextAt, relativeContext } from '../../pair-context/core/relative-context'
import type { ContextRecord } from './workflow-model'

const disabled: readonly string[] = []
export type CaptureScope = { brokerId: string | null; brokerOffsetSeconds: number; clockOffsetMs: number }
/** An explicit request reuses the shared history job; this never records an old hovered candle. */
export function NotebookContextCapture({ symbol, scope, onRecord }: { symbol: string; scope: CaptureScope; onRecord: (record: ContextRecord) => void }) {
  const [requested, setRequested] = useState(false)
  const families = useRaycasterFamilies(), preferences = useRelativePreferences(), now = useCalendarNow(scope.clockOffsetMs, 10000, requested)
  const relative = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol) && preferences.mode === 'relative'
  const selected = useMemo(() => requested ? contextSourceFamilies(families) : disabled, [requested, families])
  const usd = useUsdContextTimeline(scope.brokerId, selected, now)
  const eur = useEurContextTimeline(scope.brokerId, preferences.families, now, requested && relative)
  const at = now + scope.brokerOffsetSeconds * 1000
  const point = requested && usd.result ? contextAt(usd.result, at) : null
  const ep = relative && eur.result ? eurContextAt(eur.result, at) : null
  const pair = relative ? relativeContext(ep, point) : null
  const label = pair?.label ?? contextResultLabel(symbol, point?.result)
  const evidence = (relative ? pair?.strength : point?.result.strength) ?? 'unavailable'
  const loading = usd.loading || (relative && eur.loading)
  const error = usd.error ?? usd.storage.error ?? (relative ? eur.error ?? eur.storage.error : null)
  const usable = requested && !loading && !error && label !== 'Uncomputed' && !!scope.brokerId
  const partial = !!usd.result?.excludedTiming || Object.values(usd.storage.coverage).some(c => c.missing.length > 0) ||
    (relative && (!!eur.result?.excludedTiming || Object.values(eur.storage.coverage).some(c => c.missing.length > 0)))
  return <div className="notebook-context-capture">
    {!requested ? <button type="button" disabled={!scope.brokerId || !usdPair(symbol)} onClick={() => setRequested(true)}>Load current context</button> : <>
      <p>{loading ? 'Loading shared context…' : error ?? `${label}${evidence === 'unavailable' ? '' : ` · ${evidence} evidence`} · ${relative ? 'EUR vs USD' : 'USD side'}${partial ? ' · Partial history' : ''}`}</p>
      <button type="button" disabled={!usable} onClick={() => onRecord({ recordedAt: now, asOf: at, symbol, broker: scope.brokerId!,
        mode: relative ? 'relative' : 'usd', version: `${usd.result!.version}${relative ? ` / ${relativeContextVersion}` : ''}`,
        inputs: [...families.map(f => `USD:${f}`), ...(relative ? preferences.families.map(f => `EUR:${f}`) : [])],
        label, evidence, update: [point?.update, relative ? ep?.update : null].filter(Boolean).join(' · '), partial })}>Record current context</button>
    </>}
    <small>Records now, using Raycaster’s current inputs and mode. It does not record the hovered historical candle or place an order.</small>
  </div>
}
