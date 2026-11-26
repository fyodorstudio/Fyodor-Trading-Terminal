import { useEffect, useRef, useState } from 'react'
import { bridgeRequest } from '../../../system-connectivity/bridge-status/bridge-client'

type PreloadJob = {
  state: 'running' | 'paused' | 'complete' | 'cancelled'
  start: number
  symbol: string | null
  completed_symbols: number
  total_symbols: number
  completed_chunks: number
  total_chunks: number
  incomplete_symbols: string[]
  message: string | null
}
const endpoint = '/volume-profile/preload'
const storageKey = 'fyodor.volume-profile.preload-start.v1'
function readStartDate() {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved
  } catch { /* Continue with the default date. */ }
  return '2022-01-01'
}

export function VolumeProfilePreloadControls({ symbol, connected, brokerOffset }: {
  symbol: string; connected: boolean; brokerOffset: number
}) {
  const [date, setDate] = useState(readStartDate)
  const [job, setJob] = useState<PreloadJob | null>(null)
  const [error, setError] = useState('')
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
          const result = await bridgeRequest<{ job: PreloadJob | null }>(endpoint, controller.signal)
          if (!controller.signal.aborted && started === revision.current) setJob(result.job)
        } catch (failure) {
          if (!controller.signal.aborted && started === revision.current) {
            setError(current => current || (failure instanceof Error ? failure.message : 'Preload status is unavailable'))
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

  const latest = new Date(Date.now() + brokerOffset * 1000).toISOString().slice(0, 10)
  function start(all: boolean) {
    const start = Date.parse(`${date}T00:00:00Z`) / 1000
    if (!Number.isFinite(start) || start <= 0 || date > latest) {
      setError('Choose a valid start date on or before today.')
      return
    }
    try { window.localStorage.setItem(storageKey, date) } catch { /* The date still applies to this preload. */ }
    const query = new URLSearchParams({ start: String(start), broker_offset: String(brokerOffset) })
    if (!all) query.set('symbol', symbol)
    void submit(`${endpoint}?${query}`)
  }

  const active = job?.state === 'running' || job?.state === 'paused'
  const status = job && `${job.state === 'running' ? 'Preloading' : job.state === 'paused' ? 'Paused' : job.state === 'complete' ? 'Complete' : 'Cancelled'} · ${job.completed_symbols}/${job.total_symbols} symbols`
  return <fieldset>
    <legend>Preload Fast Historical (H1)</legend>
    <label>Start date<input type="date" min="1970-01-02" max={latest} disabled={active || busy}
      value={active && job ? new Date(job.start * 1000).toISOString().slice(0, 10) : date}
      onChange={event => setDate(event.target.value)} /></label>
    <div className="volume-profile-preload-actions">
      {active ? <>
        {job.state === 'running'
          ? <button type="button" disabled={busy} onClick={() => void submit(`${endpoint}/pause`)}>Pause preload</button>
          : <button type="button" disabled={busy || !connected} onClick={() => void submit(`${endpoint}/resume`)}>Resume preload</button>}
        <button type="button" disabled={busy} onClick={() => void submit(`${endpoint}/cancel`)}>Cancel preload</button>
      </> : <>
        <button type="button" disabled={busy || !connected || !symbol} onClick={() => start(false)}>Preload {symbol}</button>
        <button type="button" disabled={busy || !connected} onClick={() => start(true)}>Preload all 36</button>
      </>}
    </div>
    {job && <p role="status">{status}
      {active && job.symbol && <> · {job.symbol} · {job.completed_chunks}/{job.total_chunks} batches</>}
      {job.message && <> · {job.message}</>}
    </p>}
    {!!job?.incomplete_symbols.length && <p>Incomplete H1 history for {job.incomplete_symbols.join(', ')}.</p>}
    {error && <p role="alert">{error}</p>}
  </fieldset>
}
