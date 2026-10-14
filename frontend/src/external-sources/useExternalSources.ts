import { useCallback, useEffect, useState } from 'react'
import { validExternalItems, type ExternalSource } from './external-source-model'

const empty: ExternalSource[] = []
export function useExternalSources(scope: string, visibility: 'active' | 'archived' | 'all', pollMs = 5000) {
  const context = `${scope}:${visibility}`
  const [snapshot, setSnapshot] = useState({ context, items: empty })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true), [refreshToken, setRefreshToken] = useState(0)
  const requestContext = `${context}:${refreshToken}`
  const [savedRequestContext, setSavedRequestContext] = useState(requestContext)
  if (savedRequestContext !== requestContext) {
    setSavedRequestContext(requestContext); setLoading(true); setError(null)
  }
  const refresh = useCallback(() => setRefreshToken(value => value + 1), [])
  useEffect(() => {
    const abort = new AbortController()
    let timer: number | undefined, revision = ''
    async function poll() {
      try {
        let offset = 0, next: number | null = 0, nextRevision = '', items: ExternalSource[] = []
        while (next !== null) {
          const query = new URLSearchParams({ scope, visibility, offset: String(offset), limit: '100' })
          if (offset === 0 && revision) query.set('after_revision', revision)
          const response = await fetch(`/storage-api/external-sources?${query}`, { signal: abort.signal })
          if (!response.ok) throw new Error(response.status === 404 ? 'External Sources needs the updated calendar storage service.' : `External Sources unavailable (HTTP ${response.status})`)
          const data = await response.json()
          if (abort.signal.aborted) return
          if (typeof data.revision !== 'string' || data.scope !== scope || data.visibility !== visibility) throw new Error('Invalid External Sources response')
          if (data.unchanged === true) {
            if (offset !== 0 || !revision || data.revision !== revision) throw new Error('Invalid External Sources revision')
            setError(null); return
          }
          if (!validExternalItems(data.items) || visibility !== 'all' && data.items.some((item: ExternalSource) => item.archived !== (visibility === 'archived'))
            || data.offset !== offset || !Number.isInteger(data.matches) || data.matches < 0
            || (data.next_offset !== null && (!Number.isInteger(data.next_offset) || data.next_offset !== offset + 100))) throw new Error('Invalid External Sources page')
          if (nextRevision && nextRevision !== data.revision) throw new Error('External Sources changed during paging; retrying')
          nextRevision = data.revision; items = [...items, ...data.items]; next = data.next_offset; offset += 100
          if (offset > 10000) throw new Error('External Sources exceeds its page limit')
        }
        revision = nextRevision
        setSnapshot(old => {
          const stable = items.map(item => {
            const previous = old.context === context ? old.items.find(value => value.key === item.key) : undefined
            return previous?.id === item.id && previous.version_count === item.version_count ? previous : item
          })
          return old.context === context && old.items.length === stable.length && old.items.every((item, index) => item === stable[index]) ? old : { context, items: stable }
        })
        setError(null)
      } catch (failure) {
        if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'External Sources unavailable')
      } finally {
        if (!abort.signal.aborted) {
          setLoading(false)
          if (pollMs > 0) timer = window.setTimeout(poll, pollMs)
        }
      }
    }
    void poll()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [scope, visibility, context, refreshToken, pollMs])
  return { items: snapshot.context === context ? snapshot.items : empty, error, loading, refresh }
}
