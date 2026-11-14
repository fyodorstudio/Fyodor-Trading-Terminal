import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { newsCurrencies, validNews, type NewsCurrency, type NewsEntry, type NewsDraft } from './news-model'
import { AlertDateSelector } from '../alert/dock/AlertDateSelector'
import { jakartaDate } from '../alert/model/alert-day-model'
import './currency-news.css'

export const CurrencyNewsDock = memo(function CurrencyNewsDock() {
  const [date, setDate] = useState(() => jakartaDate(Date.now()))
  const [scope, setScope] = useState<NewsCurrency | 'ALL'>('ALL')
  const [items, setItems] = useState<NewsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<NewsDraft | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const requests = useRef(new Set<AbortController>())
  useEffect(() => {
    const pending = requests.current
    const controller = new AbortController(); pending.add(controller)
    fetch('/storage-api/currency-news', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load news')
      const body: unknown = await response.json()
      if (!validNews(body)) throw new Error('Invalid news response')
      if (!controller.signal.aborted) { setItems(body.items); setLoading(false) }
    }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false) } })
    return () => { for (const request of pending) request.abort(); pending.clear() }
  }, [])
  async function mutate(method: 'POST' | 'PUT' | 'DELETE', identity: string | null, entry?: NewsDraft) {
    const controller = new AbortController(); requests.current.add(controller)
    setSaving(true); setError('')
    try {
      const response = await fetch(`/storage-api/currency-news${identity ? '/' + encodeURIComponent(identity) : ''}`, {
        method, signal: controller.signal, headers: { 'Content-Type': 'application/json' }, ...(entry ? { body: JSON.stringify(entry) } : {}) })
      if (!response.ok) { const body = await response.json(); throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not save news') }
      const body: unknown = await response.json()
      if (!validNews(body)) throw new Error('Invalid news response')
      if (!controller.signal.aborted) { setItems(body.items); setDraft(null); setEditing(null); setDeleting(null) }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not save news') }
    finally { requests.current.delete(controller); if (!controller.signal.aborted) setSaving(false) }
  }
  function add() { setEditing(null); setDeleting(null); setError(''); setDraft({ date, currencies: scope === 'ALL' ? ['USD'] : [scope], title: '', details: '', url: '' }) }
  function edit(item: NewsEntry) { setEditing(item.id); setDeleting(null); setError(''); setDraft({ date: item.date, currencies: [...item.currencies], title: item.title, details: item.details, url: item.url }) }
  function submit(event: FormEvent) { event.preventDefault(); if (draft && !saving) void mutate(editing ? 'PUT' : 'POST', editing, draft) }
  const stories = items.filter(item => item.date === date && (scope === 'ALL' || item.currencies.includes(scope)))
  return <section className="currency-news-dock" aria-label="Currency News">
    <header className="currency-news-header"><h2>Currency News</h2><AlertDateSelector date={date} onChange={setDate} label="Currency News" />
      <div className="news-currencies" role="group" aria-label="News currency">{(['ALL', ...newsCurrencies] as const).map(c => <button key={c} type="button" aria-pressed={scope === c} onClick={() => setScope(c)}>{c === 'ALL' ? 'All' : c}</button>)}</div>
      <button type="button" disabled={saving} onClick={add}>Add news</button></header>
    {error && <p role="alert" className="news-error">{error}</p>}
    <div className="news-scroll">
      {draft && <form className="news-editor" aria-label={editing ? 'Edit news' : 'Add news'} onSubmit={submit}>
        <label>Date<input aria-label="News date" type="date" required value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} disabled={saving} /></label>
        <fieldset disabled={saving}><legend>Currencies</legend>{newsCurrencies.map(c => <label key={c}><input type="checkbox" checked={draft.currencies.includes(c)} onChange={e => setDraft({ ...draft, currencies: e.target.checked ? [...draft.currencies, c] : draft.currencies.filter(v => v !== c) })} />{c}</label>)}</fieldset>
        <label>Title<input aria-label="News title" required maxLength={300} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} disabled={saving} /></label>
        <label>Details<textarea aria-label="News details" maxLength={20000} value={draft.details} onChange={e => setDraft({ ...draft, details: e.target.value })} disabled={saving} /></label>
        <label>Source URL<input aria-label="News source URL" type="url" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} disabled={saving} /></label>
        <div className="news-editor-actions"><button type="submit" disabled={saving || !draft.currencies.length || !draft.title.trim()}>{saving ? 'Saving…' : 'Save'}</button><button type="button" disabled={saving} onClick={() => { setDraft(null); setEditing(null) }}>Cancel</button></div>
      </form>}
      <table className="currency-news-table"><thead><tr><th>Currencies</th><th>News</th><th>Actions</th></tr></thead><tbody>
        {stories.map(item => <tr key={item.id} data-news-story={item.id}><th scope="row">{item.currencies.join(' / ')}</th><td><strong>{item.title}</strong><p className="news-details">{item.details}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Source</a>}</td>
          <td>{deleting === item.id ? <><span>Delete this news entry?</span><button type="button" disabled={saving} onClick={() => { void mutate('DELETE', item.id) }}>Confirm delete</button><button type="button" disabled={saving} onClick={() => setDeleting(null)}>Cancel</button></> : <><button type="button" disabled={saving} onClick={() => edit(item)}>Edit</button><button type="button" disabled={saving} onClick={() => setDeleting(item.id)}>Delete</button></>}</td></tr>)}
        {!stories.length && <tr><td colSpan={3}>{loading ? 'Loading news…' : 'No news for this date.'}</td></tr>}
      </tbody></table>
    </div>
  </section>
})
