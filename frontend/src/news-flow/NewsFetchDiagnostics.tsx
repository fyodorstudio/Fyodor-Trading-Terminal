import { useEffect, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'

type Check = { minute: number; last_at: number; ok: number; unchanged: number; limited: number; errors: number;
  http_status: number | null; cache_age: number | null; response_at?: number | null; item_count: number | null; max_fetch_ms: number; max_queue_ms: number }
type Diagnostics = { checks: Check[]; runs: { started_at: number; heartbeat_at: number; stopped_at: number | null }[]; retention_hours: number }

export function NewsFetchDiagnostics({ source }: { source: string }) {
  const clock = useDisplayClock(), [open, setOpen] = useState(false)
  const [data, setData] = useState<Diagnostics | null>(null), [error, setError] = useState('')
  const [observedAt, setObservedAt] = useState(0)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let timer = 0
    async function load() {
      try {
        const response = await fetch(`/storage-api/news-flow/diagnostics?source=${encodeURIComponent(source)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Fetch diagnostics unavailable')
        const body = await response.json()
        if (!Array.isArray(body.checks) || !Array.isArray(body.runs)
          || body.checks.some((row: Check) => !row || ![row.minute, row.last_at, row.ok, row.unchanged, row.limited, row.errors, row.max_fetch_ms, row.max_queue_ms].every(Number.isFinite))
          || body.runs.some((run: Diagnostics['runs'][number]) => !run || !Number.isFinite(run.started_at) || !Number.isFinite(run.heartbeat_at))) throw new Error('Invalid fetch diagnostics')
        if (!controller.signal.aborted) { setData(body); setObservedAt(Date.now()); setError('') }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load diagnostics') }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(load, 10000) }
    }
    void load()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [source, open])
  return <div className="news-fetch-diagnostics">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>Fetch diagnostics</button>
    {open && <>
      <p>Minute summaries retained for 24 hours; showing the last hour. No article bodies or full feed responses are saved. Evidence starts after this update.</p>
      {error && <p role="alert">{error}</p>}
      {data && !data.checks.length && <p>No recorded checks for this feed URL in the last hour.</p>}
      {data?.checks[0] && <p>Last recorded check: {clock.utc(data.checks[0].last_at)} · HTTP {data.checks[0].http_status ?? 'network/parse error'}
        {data.checks[0].item_count !== null ? ` · Last parsed count this minute: ${data.checks[0].item_count}` : ''}
        {data.checks[0].cache_age !== null ? ` · Response Age header: ${data.checks[0].cache_age}s` : ''}
        {data.checks[0].response_at != null ? ` · Response Date: ${clock.utc(data.checks[0].response_at)}` : ''}</p>}
      {data && data.checks.length > 0 && <table><thead><tr><th>Minute</th><th>OK / unchanged</th><th>429 / errors</th><th>Max request / wait</th></tr></thead>
        <tbody>{data.checks.map(row => <tr key={row.minute}><td>{clock.utc(row.minute)}</td><td>{row.ok} / {row.unchanged}</td><td>{row.limited} / {row.errors}</td><td>{(row.max_fetch_ms / 1000).toFixed(1)}s / {(row.max_queue_ms / 1000).toFixed(1)}s</td></tr>)}</tbody></table>}
      {data?.runs.map(run => <p key={run.started_at}>Collector started {clock.utc(run.started_at)} · last heartbeat {clock.utc(run.heartbeat_at)}{run.stopped_at ? ` · stopped ${clock.utc(run.stopped_at)}` : observedAt - run.heartbeat_at < 90000 ? ' · heartbeat current' : ' · no recent heartbeat (stop unconfirmed)'}</p>)}
      <p>Unchanged means HTTP 304. Wait is time after the request became due, including downtime. Empty minutes can also mean a longer interval or cooldown. Previous successful check times appear in delayed headlines’ Collected tooltip; they do not prove exact publisher/index availability.</p>
    </>}
  </div>
}
