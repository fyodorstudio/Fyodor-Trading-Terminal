import { useEffect, useState } from 'react'

type Limitation = {
  id: string; source_id: string; key: string; currency: string; kind: string; title: string; description: string; action: string
  checked_utc: string; status: 'open' | 'resolved'; official_schedule: string; stored_schedule: string
  sources: { kind: 'web' | 'local'; label: string; locator: string; note: string }[]
}
function valid(value: unknown, brokerId: string): value is Limitation[] {
  return Array.isArray(value) && value.every(item => item && item.source_id === brokerId && ['open','resolved'].includes(item.status)
    && ['id','key','currency','kind','title','description','action','checked_utc','official_schedule','stored_schedule'].every(key => typeof item[key] === 'string')
    && Array.isArray(item.sources) && item.sources.every((source: Limitation['sources'][number]) => source && ['web','local'].includes(source.kind)
      && ['label','locator','note'].every(key => typeof source[key as keyof typeof source] === 'string')))
}
function cached(brokerId: string | null): Limitation[] {
  if (!brokerId) return []
  try { const value = JSON.parse(localStorage.getItem(`fyodor.highlight-limitations.${brokerId}`) ?? '[]'); return valid(value, brokerId) ? value : [] } catch { return [] }
}

export function DiscoveredLimitations({ brokerId }: { brokerId: string | null }) {
  const [snapshot, setSnapshot] = useState(() => ({ brokerId, items: cached(brokerId) }))
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState(brokerId)
  if (source !== brokerId) { setSource(brokerId); setSnapshot({ brokerId, items: cached(brokerId) }); setError(null) }
  useEffect(() => {
    if (!brokerId) return
    const abort = new AbortController()
    let timer: number | undefined, revision: string | null = null
    async function poll() {
      try {
        const params = new URLSearchParams({ source_id: brokerId! })
        if (revision) params.set('after_revision', revision)
        const response = await fetch(`/storage-api/highlight-limitations?${params}`, { signal: abort.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Restart calendar storage to load Discovered Limitations.' : `Limitations unavailable (HTTP ${response.status})`)
        const data = await response.json() as { source_id: string; revision: string; unchanged?: boolean; items?: Limitation[] }
        if (abort.signal.aborted) return
        if (data.source_id !== brokerId || typeof data.revision !== 'string' || !data.revision || (!data.unchanged && !valid(data.items, brokerId!))) throw new Error('Invalid limitations response')
        revision = data.revision
        if (!data.unchanged) {
          setSnapshot(old => {
            const items = data.items!.map(item => {
              const previous = old.brokerId === brokerId ? old.items.find(value => value.id === item.id) : undefined
              return previous && JSON.stringify(previous) === JSON.stringify(item) ? previous : item
            })
            try { localStorage.setItem(`fyodor.highlight-limitations.${brokerId}`, JSON.stringify(items)) } catch { /* Disk retains records. */ }
            return old.brokerId === brokerId && old.items.length === items.length && old.items.every((item, index) => item === items[index]) ? old : { brokerId, items }
          })
        }
        setError(null)
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Limitations unavailable') }
      finally { if (!abort.signal.aborted) timer = window.setTimeout(poll, 2000) }
    }
    void poll()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [brokerId])
  const items = snapshot.brokerId === brokerId ? snapshot.items : []
  return <section className="highlight-limitations" aria-label="Discovered limitations">
    <p className="highlight-research-meta">Documented calendar and data issues. Each record keeps its source, verification time and follow-up action.</p>
    {error && <p role="status">{error}</p>}
    {!items.length && <p>{brokerId ? 'No recorded limitations for this broker.' : 'Choose a calendar broker to load limitations.'}</p>}
    {items.map(item => <article key={item.id} className="highlight-limitation" data-limitation-key={item.key}>
      <h4>{item.currency} · {item.title}</h4><p className="highlight-research-meta">{item.status === 'open' ? 'Open' : 'Resolved'} · Checked {item.checked_utc}</p>
      <p>{item.description}</p>
      {item.official_schedule && <p><strong>Official schedule:</strong> {item.official_schedule}</p>}
      {item.stored_schedule && <p><strong>Stored schedule:</strong> {item.stored_schedule}</p>}
      <p><strong>Follow-up:</strong> {item.action}</p>
      <ul>{item.sources.map((source, index) => <li key={index}>
        {source.kind === 'web' && /^https?:\/\//i.test(source.locator) ? <a href={source.locator} target="_blank" rel="noopener noreferrer">{source.label}</a> : <code>{source.locator}</code>}
        {source.note && <p>{source.note}</p>}</li>)}</ul>
    </article>)}
  </section>
}
