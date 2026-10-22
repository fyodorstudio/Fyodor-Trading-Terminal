import { useEffect, useMemo, useState } from 'react'
import { safeWebUrl } from '../../external-sources/external-source-model'

export type AlertImpact = {
  id: string; key: string; source: 'highlight' | 'external'; reference: string; broker: string
  level: 'high' | 'medium' | 'low'; reason: string; as_of_utc: string; saved_utc: string
  sources: { kind: 'web' | 'local'; label: string; locator: string; note: string }[]
  value_ids?: string[]
}
const empty: AlertImpact[] = []
function validItems(value: unknown, broker: string): value is AlertImpact[] {
  return Array.isArray(value) && new Set(value.map(item => item?.key)).size === value.length && value.every(item => item
    && typeof item.id === 'string' && typeof item.reference === 'string' && typeof item.reason === 'string' && item.reason.trim()
    && ['high', 'medium', 'low'].includes(item.level)
    && (item.value_ids === undefined || Array.isArray(item.value_ids) && item.value_ids.every((id: unknown) => typeof id === 'string'))
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
    async function pollAlertImpact() {
      try {
        const query = new URLSearchParams({ source_id: broker })
        if (revision) query.set('after_revision', revision)
        const response = await fetch(`/storage-api/alert-impact?${query}`, { signal: abort.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Impact ratings need the updated calendar storage service.' : 'Impact assessments unavailable.')
        const data = await response.json()
        if (abort.signal.aborted) return
        if (data.broker !== broker || typeof data.revision !== 'string' || !data.revision
          || (data.unchanged ? data.revision !== revision : !validItems(data.items, broker))) throw new Error('Invalid impact response')
        revision = data.revision
        if (!data.unchanged) setSnapshot(old => {
          const prior = new Map(old.broker === broker ? old.items.map(item => [item.id, item]) : [])
          const items = data.items.map((item: AlertImpact) => {
            const previous = prior.get(item.id)
            // Assessment versions are immutable; only their pin's occurrence
            // membership can grow without a new assessment ID.
            return previous && previous.value_ids?.length === item.value_ids?.length
              && (item.value_ids ?? []).every((id, index) => id === previous.value_ids?.[index]) ? previous : item
          })
          return old.broker === broker && old.items.length === items.length && old.items.every((item, index) => item === items[index]) ? old : { broker, items }
        })
        setFailure(null)
      } catch (error) {
        if (!abort.signal.aborted) setFailure({ broker, message: error instanceof Error ? error.message : 'Impact assessments unavailable.' })
      } finally {
        if (!abort.signal.aborted && pollMs > 0) timer = window.setTimeout(pollAlertImpact, pollMs)
      }
    }
    void pollAlertImpact()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [broker, pollMs])
  const items = snapshot.broker === broker ? snapshot.items : empty
  const byKey = useMemo(() => new Map(items.map(item => [item.key, item])), [items])
  const byValueId = useMemo(() => {
    const result = new Map<string, AlertImpact>()
    for (const item of items) if (item.source === 'highlight') for (const id of item.value_ids ?? []) {
      const previous = result.get(id)
      if (!previous || Date.parse(item.as_of_utc) > Date.parse(previous.as_of_utc)
        || item.as_of_utc === previous.as_of_utc && Date.parse(item.saved_utc) > Date.parse(previous.saved_utc)) result.set(id, item)
    }
    return result
  }, [items])
  const error = failure?.broker === broker ? failure.message : null
  return useMemo(() => ({ byKey, byValueId, error }), [byKey, byValueId, error])
}
