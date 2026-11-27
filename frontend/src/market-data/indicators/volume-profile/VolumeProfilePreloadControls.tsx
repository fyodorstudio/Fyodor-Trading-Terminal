import { useEffect, useRef, useState } from 'react'
import { bridgeRequest } from '../../../system-connectivity/bridge-status/bridge-client'

type PreloadJob = {
  state: 'running' | 'paused' | 'complete' | 'cancelled'
  symbol: string | null
  symbol_start?: number | null
  completed_symbols: number
  total_symbols: number
  completed_chunks: number
  total_chunks: number
  available_symbols?: number
  first_candles?: Record<string, number>
  incomplete_symbols: string[]
  unavailable_symbols?: string[]
  message: string | null
}
const endpoint = '/volume-profile/preload'
const dateLabel = (time: number) => new Date(time * 1000).toISOString().slice(0, 10)
type PreloadStatus = { job: PreloadJob | null; exact_ticks?: boolean; symbol_groups?: Record<string, string[]> }

export function VolumeProfilePreloadControls({ symbol, connected, brokerOffset }: {
  symbol: string; connected: boolean; brokerOffset: number
}) {
  const [job, setJob] = useState<PreloadJob | null>(null)
  const [exactTicks, setExactTicks] = useState<boolean | null>(null)
  const [symbolGroups, setSymbolGroups] = useState<PreloadStatus['symbol_groups']>()
  const [error, setError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [busy, setBusy] = useState(false)
  const action = useRef<AbortController | null>(null)
  const revision = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function pollPreload() {
      if (!action.current) {
        const started = revision.current
        try {
          const result = await bridgeRequest<PreloadStatus>(endpoint, controller.signal)
          if (!controller.signal.aborted && started === revision.current) {
            setJob(result.job)
            setExactTicks(result.exact_ticks === true)
            setSymbolGroups(result.symbol_groups)
            setStatusError('')
          }
        } catch (failure) {
          if (!controller.signal.aborted && started === revision.current) {
            setStatusError(failure instanceof Error ? failure.message : 'Preload status is unavailable')
          }
        }
      }
      if (!controller.signal.aborted) timer = window.setTimeout(pollPreload, 1_000)
    }
    void pollPreload()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      action.current?.abort()
    }
  }, [])

  async function submit(path: string) {
    if (action.current) return
    const controller = new AbortController()
    action.current = controller
    revision.current++
    setBusy(true)
    setError('')
    try {
      const result = await bridgeRequest<{ job: PreloadJob }>(path, controller.signal, 'POST')
      if (!controller.signal.aborted) setJob(result.job)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Preload request failed')
    } finally {
      action.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function start(all: boolean) {
    const query = new URLSearchParams({ broker_offset: String(brokerOffset) })
    if (!all) query.set('symbol', symbol)
    void submit(`${endpoint}?${query}`)
  }

  const active = job?.state === 'running' || job?.state === 'paused'
  const status = job && `${job.state === 'running' ? 'Preloading' : job.state === 'paused' ? 'Paused' : job.state === 'complete' ? 'Complete' : 'Cancelled'} · ${job.completed_symbols}/${job.total_symbols} symbols`
  const firstCandle = job?.first_candles?.[symbol]
  const blocked = busy || !connected || exactTicks !== true
  const groups = Object.entries(symbolGroups ?? {})
  const symbolCount = groups.reduce((total, [, symbols]) => total + symbols.length, 0)
  return <fieldset>
    <legend>Preload exact ticks</legend>
    <p>Checks all available broker history, newest dates first. Completed dates are saved locally.</p>
    <div className="volume-profile-preload-actions">
      {active ? <>
        {job.state === 'running'
          ? <button type="button" disabled={busy} onClick={() => void submit(`${endpoint}/pause`)}>Pause preload</button>
          : <button type="button" disabled={busy || !connected} onClick={() => void submit(`${endpoint}/resume`)}>Resume preload</button>}
        <button type="button" disabled={busy} onClick={() => void submit(`${endpoint}/cancel`)}>Cancel preload</button>
      </> : <>
        <button type="button" disabled={blocked || !symbol} onClick={() => start(false)}>Preload {symbol}</button>
        {!!symbolCount && <button type="button" disabled={blocked} onClick={() => start(true)}>Preload all {symbolCount}</button>}
      </>}
    </div>
    {!!symbolCount && <details>
      <summary>View all {symbolCount} preload symbols</summary>
      {groups.map(([name, symbols]) => <p key={name}><strong>{name} ({symbols.length})</strong><br />{symbols.join(', ')}</p>)}
    </details>}
    {job && <p role="status">{status}
      {active && job.symbol && (job.total_chunks
        ? <> · {job.symbol}{job.symbol_start != null && <> from {dateLabel(job.symbol_start)}</>} · {job.completed_chunks}/{job.total_chunks} batches</>
        : <> · Checking available history for {job.symbol}</>)}
      {job.available_symbols != null && job.completed_symbols > 0 && <> · {job.available_symbols} with cached ticks</>}
      {job.message && <> · {job.message}</>}
    </p>}
    {firstCandle !== undefined && <p>{symbol} cached from {dateLabel(firstCandle)}.</p>}
    {!!job?.incomplete_symbols.length && <p>Cached with history gaps for {job.incomplete_symbols.join(', ')}.</p>}
    {!!job?.unavailable_symbols?.length && <p>Tick history unavailable for {job.unavailable_symbols.join(', ')}.</p>}
    {exactTicks === false && <p>Restart the MT5 bridge to enable exact tick preload.</p>}
    {exactTicks === true && !symbolCount && <p>Restart the MT5 bridge to view the full preload list.</p>}
    {(error || statusError) && <p role="alert">{error || statusError}</p>}
  </fieldset>
}
