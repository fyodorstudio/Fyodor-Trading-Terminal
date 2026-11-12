import { useEffect, useMemo, useRef, useState } from 'react'
import { majorCurrencies } from '../economic-calendar/forex/currencies'
import { categoryLabels, getSymbolCategory } from '../market-data/market-watch/symbol-classification'
import type { HeatmapInstrument } from './heatmap-model'
import type { HeatmapPreferences } from './heatmap-preferences'

export function HeatmapSymbols({ catalog, broker, preferences, rows, onSave, onClose }: {
  catalog: HeatmapInstrument[]; broker: string | null; preferences: HeatmapPreferences; rows: string[]
  onSave: (value: HeatmapPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState({ ...preferences, rows }), [search, setSearch] = useState('')
  const [category, setCategory] = useState('All'), [name, setName] = useState(''), [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab') {
        const controls = [...dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? []]
        const first = controls[0], last = controls.at(-1)
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', listener)
    return () => { window.removeEventListener('keydown', listener); previousFocus?.focus() }
  }, [onClose])
  const choices = useMemo(() => [...majorCurrencies.map(c => ({ id: `basket:${c}`, label: `${c} basket`, description: 'Equal-weight synthetic · 7 counterparts', group: 'Currencies · synthetic' })),
    ...catalog.map(s => ({ id: `symbol:${s.symbol}`, label: s.symbol, description: s.description, group: categoryLabels[getSymbolCategory(s.symbol, broker)] }))], [catalog, broker])
  const labels = new Map(choices.map(c => [c.id, c.label]))
  const filtered = choices.filter(c => (category === 'All' || c.group === category)
    && `${c.label} ${c.description}`.toLowerCase().includes(search.toLowerCase()))
  function toggle(id: string) {
    setError(null)
    setDraft(old => ({ ...old, rows: old.rows.includes(id) ? old.rows.filter(r => r !== id) : old.rows.length < 96 ? [...old.rows, id] : old.rows }))
  }
  function move(id: string, step: number) {
    setDraft(old => {
      const next = [...old.rows], index = next.indexOf(id), target = index + step
      if (index < 0 || target < 0 || target >= next.length) return old
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...old, rows: next }
    })
  }
  function savePreset() {
    const title = name.trim()
    if (!title) { setError('Enter a watchlist name.'); return }
    const existing = draft.presets.some(p => p.name === title)
    if (!existing && draft.presets.length >= 20) { setError('Remove a watchlist before adding another (maximum 20).'); return }
    setDraft(old => ({ ...old, presets: [...old.presets.filter(p => p.name !== title), { name: title, rows: [...old.rows] }] }))
    setName(''); setError(null)
  }
  return <div className="heatmap-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section ref={dialog} className="heatmap-symbols" role="dialog" aria-modal="true" aria-label="Heatmap instruments and watchlists">
      <header><strong>Instruments & watchlists</strong><button type="button" onClick={onClose} aria-label="Close heatmap instruments">×</button></header>
      <div className="heatmap-preset-controls">
        <label>Load watchlist <select aria-label="Load heatmap watchlist" value="" onChange={e => {
          const preset = draft.presets.find(p => p.name === e.target.value)
          if (preset) setDraft(old => ({ ...old, rows: [...preset.rows] }))
        }}><option value="">Choose…</option>{draft.presets.map(p => <option key={p.name}>{p.name}</option>)}</select></label>
        <input autoFocus aria-label="Heatmap watchlist name" maxLength={60} placeholder="Watchlist name" value={name} onChange={e => setName(e.target.value)} />
        <button type="button" onClick={savePreset}>Save / update watchlist</button>
      </div>
      {draft.presets.length > 0 && <div className="heatmap-preset-list">{draft.presets.map(p => <span key={p.name}>{p.name}
        <button type="button" aria-label={`Delete watchlist ${p.name}`} onClick={() => setDraft(old => ({ ...old, presets: old.presets.filter(v => v.name !== p.name) }))}>×</button></span>)}</div>}
      <div className="heatmap-symbol-columns">
        <section><div className="heatmap-symbol-search"><input aria-label="Search heatmap instruments" placeholder="Search symbols or descriptions" value={search} onChange={e => setSearch(e.target.value)} />
          <select aria-label="Heatmap instrument category" value={category} onChange={e => setCategory(e.target.value)}><option>All</option>
            {[...new Set(choices.map(c => c.group))].map(g => <option key={g}>{g}</option>)}</select></div>
          <div className="heatmap-catalog">{filtered.slice(0, 200).map(c => <label key={c.id}><input type="checkbox" checked={draft.rows.includes(c.id)}
            disabled={!draft.rows.includes(c.id) && draft.rows.length >= 96} onChange={() => toggle(c.id)} /><span><strong>{c.label}</strong><small>{c.description}</small></span></label>)}
            {filtered.length > 200 && <p>Narrow your search to see more of the {filtered.length} matches.</p>}
            {!filtered.length && <p>No matching instruments. Only symbols already visible in broker Market Watch are available.</p>}</div>
        </section>
        <section className="heatmap-chosen"><strong>Selected · {draft.rows.length}/96</strong><small>Order is preserved within each group.</small>
          <div>{draft.rows.map((id, i) => <div key={id}><span>{labels.get(id) ?? id.slice(7)}</span>
            <button type="button" aria-label={`Move ${labels.get(id) ?? id.slice(7)} up`} disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
            <button type="button" aria-label={`Move ${labels.get(id) ?? id.slice(7)} down`} disabled={i === draft.rows.length - 1} onClick={() => move(id, 1)}>↓</button>
            <button type="button" aria-label={`Remove ${labels.get(id) ?? id.slice(7)}`} onClick={() => toggle(id)}>×</button></div>)}</div>
        </section>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={() => { try { onSave(draft) } catch { setError('Could not save instruments. Your previous settings are preserved; retry or Cancel.') } }}>Save</button>
        <button type="button" onClick={onClose}>Cancel</button></footer>
    </section>
  </div>
}
