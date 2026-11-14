import { useState } from 'react'
import { useWildcards } from './useWildcards'
import { wildcardDay, wildcardLocalTime } from './wildcard-model'

export function WildcardsDock() {
  const { snapshot, error, reload, openNew, openEntry } = useWildcards()
  const [date, setDate] = useState(() => wildcardDay(Date.now())), [search, setSearch] = useState(''), [all, setAll] = useState(false), [archived, setArchived] = useState(false)
  const items = snapshot?.items.filter(item => (all || item.date === date) && (archived || !item.archived) && `${item.title}\n${item.details}`.toLowerCase().includes(search.toLowerCase())) ?? []
  return <section className="wildcards-dock" aria-label="Wildcards"><header><strong>Wildcards</strong><input type="date" aria-label="Wildcards date" value={date} onChange={event => setDate(event.target.value)} />
    <button type="button" onClick={() => setDate(wildcardDay(Date.now()))}>Today</button><label><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />All dates</label>
    <input type="search" aria-label="Search Wildcards" placeholder="Search…" value={search} onChange={event => setSearch(event.target.value)} /><label><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Include archived</label>
    <button type="button" disabled={!snapshot} onClick={() => openNew(undefined, date)}>Add wildcard</button><button type="button" onClick={reload}>Reload</button></header>
    {error && <p role="alert">{error}</p>}<div className="wildcards-scroll"><table><thead><tr><th>Date / time · Jakarta</th><th>Wildcard</th><th>Actions</th></tr></thead><tbody>
      {items.map(entry => <tr key={entry.id}><td>{entry.date}<br />{entry.at ? wildcardLocalTime(Date.parse(entry.at)) : 'Date only'}</td><td><strong>{entry.title}{entry.archived ? ' (archived)' : ''}</strong><p>{entry.details}</p>{entry.url && <a href={entry.url} target="_blank" rel="noreferrer">Source</a>}</td><td><button type="button" onClick={() => openEntry(entry)}>Edit / Delete</button></td></tr>)}
      {!items.length && <tr><td colSpan={3}>{snapshot ? 'No wildcards for this selection.' : 'Loading Wildcards…'}</td></tr>}
    </tbody></table></div></section>
}
