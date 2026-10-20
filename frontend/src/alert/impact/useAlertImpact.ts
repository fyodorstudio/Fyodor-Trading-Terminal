import { useEffect, useMemo, useState } from 'react'
import { safeWebUrl } from '../../external-sources/external-source-model'

export type AlertImpact = {
  id: string; key: string; source: 'highlight' | 'external'; reference: string; broker: string
  level: 'high' | 'medium' | 'low'; reason: string; as_of_utc: string; saved_utc: string
  sources: { kind: 'web' | 'local'; label: string; locator: string; note: string }[]
}
const empty: AlertImpact[] = []
function validItems(value: unknown, broker: string): value is AlertImpact[] {
  return Array.isArray(value) && new Set(value.map(item => item?.key)).size === value.length && value.every(item => item
    && typeof item.id === 'string' && typeof item.reference === 'string' && typeof item.reason === 'string' && item.reason.trim()
    && ['high', 'medium', 'low'].includes(item.level)
    && ['as_of_utc', 'saved_utc'].every(key => typeof item[key] === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(item[key]) && Number.isFinite(Date.parse(item[key])))
    && (item.source === 'highlight' && item.broker === broker && item.key === `highlight:${broker}:${item.reference}`
      || item.source === 'external' && item.broker === '' && item.key === `external:${item.reference}`)
    && Array.isArray(item.sources) && item.sources.length > 0 && item.sources.some((source: AlertImpact['sources'][number]) => source?.kind === 'web')
    && item.sources.every((source: AlertImpact['sources'][number]) => source && ['web', 'local'].includes(source.kind)
      && typeof source.label === 'string' && typeof source.locator === 'string' && (source.kind !== 'web' || safeWebUrl(source.locator))))
}
export function useAlertImpact(sourceId: string | null, pollMs = 5000) {
  const broker = sourceId ?? ''
  const [snapshot, setSnapshot] = useState({ broker, items: empty })
  const [failure, setFailure] = useState<{ broker: string; message: string } | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    let timer: number | undefined, revision = ''
    async function poll() {
      try {
        const query = new URLSearchParams({ source_id: broker })
        if (revision) query.set('after_revision', revision)
        const response = await fetch(`/storage-api/alert-impact?${query}`, { signal: abort.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'AI impact needs the updated calendar storage service.' : 'AI impact assessments unavailable.')
        const data = await response.json()
        if (abort.signal.aborted) return
        if (data.broker !== broker || typeof data.revision !== 'string' || !data.revision
          || (data.unchanged ? data.revision !== revision : !validItems(data.items, broker))) throw new Error('Invalid AI impact response')
        revision = data.revision
        if (!data.unchanged) setSnapshot(old => {
          const items = data.items.map((item: AlertImpact) => old.broker === broker ? old.items.find(previous => previous.id === item.id) ?? item : item)
          return old.broker === broker && old.items.length === items.length && old.items.every((item, index) => item === items[index]) ? old : { broker, items }
        })
        setFailure(null)
      } catch (error) {
        if (!abort.signal.aborted) setFailure({ broker, message: error instanceof Error ? error.message : 'AI impact assessments unavailable.' })
      } finally {
        if (!abort.signal.aborted && pollMs > 0) timer = window.setTimeout(poll, pollMs)
      }
    }
    void poll()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [broker, pollMs])
  const items = snapshot.broker === broker ? snapshot.items : empty
  const byKey = useMemo(() => new Map(items.map(item => [item.key, item])), [items])
  return { byKey, error: failure?.broker === broker ? failure.message : null }
}
