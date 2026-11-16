import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { validNewsPage, type NewsPage, type NewsSource } from './model'

async function responseJson(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `News Flow unavailable (HTTP ${response.status})`)
  }
  return response.json()
}

export async function exportNews(query: string, signal: AbortSignal) {
  const body = await responseJson(await fetch(`/storage-api/news-flow/export?${query}`, { signal }))
  if (!body || typeof body.text !== 'string' || !Number.isSafeInteger(body.count) || body.count < 0 || (body.count > 0 && !body.text)) throw new Error('Invalid headline export; nothing copied.')
  return body as { text: string; count: number }
}

export function useNewsSources() {
  const [sources, setSources] = useState<NewsSource[]>([]), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function poll() {
      try {
        const body = await responseJson(await fetch('/storage-api/news-flow/sources', { signal: controller.signal }))
        if (!Array.isArray(body.sources) || !body.sources.every((s: NewsSource) => s && ['id', 'name', 'url', 'error'].every(k => typeof s[k as keyof NewsSource] === 'string')
          && (s.last_success === null || Number.isFinite(s.last_success)))) throw new Error('Invalid News Flow providers')
        if (!controller.signal.aborted) {
          setSources(old => JSON.stringify(old) === JSON.stringify(body.sources) ? old : body.sources)
          setError('')
        }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load providers') }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(poll, 1000) }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return { sources, error, reload }
}

export function useNewsPage(query: string, paused: RefObject<boolean>) {
  const [snapshot, setSnapshot] = useState<{ query: string; page: NewsPage } | null>(null)
  const [pending, setPending] = useState<{ query: string; page: NewsPage } | null>(null)
  const [failure, setFailure] = useState<{ query: string; message: string } | null>(null)
  const current = useRef(snapshot)
  useEffect(() => { current.current = snapshot }, [snapshot])
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function poll() {
      try {
        const body: unknown = await responseJson(await fetch(`/storage-api/news-flow/items?${query}`, { signal: controller.signal }))
        if (!validNewsPage(body)) throw new Error('Invalid News Flow headlines')
        if (!controller.signal.aborted) {
          const previous = current.current?.query === query ? current.current.page : null
          if (JSON.stringify(previous) !== JSON.stringify(body)) {
            if (paused.current && previous) setPending({ query, page: body })
            else { setSnapshot({ query, page: body }); setPending(null) }
          } else setPending(null)
          setFailure(null)
        }
      } catch (cause) { if (!controller.signal.aborted) setFailure({ query, message: cause instanceof Error ? cause.message : 'Could not load headlines' }) }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(poll, 1000) }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [query, paused])
  return { page: snapshot?.query === query ? snapshot.page : null, pending: pending?.query === query ? pending.page : null, error: failure?.query === query ? failure.message : '',
    reveal: () => { if (pending?.query === query) { setSnapshot(pending); setPending(null) } } }
}

export async function saveNewsSource(name: string, url: string, identity?: string, signal?: AbortSignal, pollSeconds?: number, collectEnabled?: boolean) {
  return responseJson(await fetch('/storage-api/news-flow/sources' + (identity ? `/${encodeURIComponent(identity)}` : ''), {
    method: identity ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url, poll_seconds: pollSeconds, ...(collectEnabled === undefined ? {} : { collect_enabled: collectEnabled }) }), signal,
  })) as Promise<{ id: string }>
}

export async function pinNews(url: string, pinned: boolean, signal?: AbortSignal) {
  await responseJson(await fetch('/storage-api/news-flow/priority', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, pinned }), signal }))
}

export async function refreshNews(signal?: AbortSignal) {
  await responseJson(await fetch('/storage-api/news-flow/refresh', { method: 'POST', signal }))
}

type HistoryResult = { searched: number; cached: number; found: number; unsupported: string[]; errors: string[] }

export function useNewsHistory(start: number | null, end: number | null, sources: NewsSource[], hidden: string[]) {
  const selected = sources.filter(source => !hidden.includes(source.id)).map(source => ({ id: source.id, url: source.url }))
  // Success timestamps change every second; only dates and provider URLs start searches.
  const key = start !== null && end !== null && selected.length ? JSON.stringify({ start, end, selected }) : ''
  const [attempt, setAttempt] = useState(0), force = useRef(false)
  const requestKey = `${key}:${attempt}`
  const [outcome, setOutcome] = useState<{ key: string; result: HistoryResult | null; error: string } | null>(null)
  useEffect(() => {
    if (!key) return
    const controller = new AbortController(), value = JSON.parse(key), forced = force.current
    force.current = false
    async function search() {
      try {
        const body = await responseJson(await fetch('/storage-api/news-flow/history', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ start: value.start, end: value.end, source: value.selected.map((source: { id: string }) => source.id), force: forced }),
        }))
        if (!['searched', 'cached', 'found'].every(field => Number.isSafeInteger(body[field]) && body[field] >= 0)
          || !['unsupported', 'errors'].every(field => Array.isArray(body[field]) && body[field].every((entry: unknown) => typeof entry === 'string')))
          throw new Error('Invalid historical news response')
        if (!controller.signal.aborted) setOutcome({ key: requestKey, result: body, error: '' })
      } catch (cause) {
        if (!controller.signal.aborted) setOutcome({ key: requestKey, result: null, error: cause instanceof Error ? cause.message : 'Historical search unavailable' })
      }
    }
    void search()
    return () => controller.abort()
  }, [key, requestKey])
  const retry = useCallback(() => { if (key) { force.current = true; setAttempt(value => value + 1) } }, [key])
  return { loading: !!key && outcome?.key !== requestKey, result: key && outcome?.key === requestKey ? outcome.result : null,
    error: key && outcome?.key === requestKey ? outcome.error : '', retry }
}
