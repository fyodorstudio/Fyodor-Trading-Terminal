import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { validNewsPage, type NewsPage, type NewsSource } from './model'

async function responseJson(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `News Flow unavailable (HTTP ${response.status})`)
  }
  return response.json()
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

export async function saveNewsSource(name: string, url: string, identity?: string, signal?: AbortSignal) {
  return responseJson(await fetch('/storage-api/news-flow/sources' + (identity ? `/${encodeURIComponent(identity)}` : ''), {
    method: identity ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url }), signal,
  })) as Promise<{ id: string }>
}

export async function refreshNews(signal?: AbortSignal) {
  await responseJson(await fetch('/storage-api/news-flow/refresh', { method: 'POST', signal }))
}
