import { useEffect, useRef, useState } from 'react'
import type { NewsSource } from './model'

export function NewsProviderSelector({ sources, hidden, onChange }: { sources: NewsSource[]; hidden: string[]; onChange: (hidden: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const count = sources.filter(source => !hidden.includes(source.id)).length
  useEffect(() => {
    if (!open) return
    container.current?.querySelector<HTMLElement>('[role="group"] button')?.focus()
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="news-provider-selector" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" aria-label="Select news providers" title={`Providers: ${count} of ${sources.length} shown`} aria-expanded={open} aria-controls="news-visible-providers" aria-pressed={count < sources.length} onClick={() => setOpen(value => !value)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/><path d="m6 3 3 2-3 2m8 3 3 2-3 2m-8 3 3 2-3 2"/></svg>
    </button>
    {open && <div id="news-visible-providers" className="news-provider-options" role="group" aria-label="Visible news providers">
      <div><strong>Providers · {count}/{sources.length}</strong><button type="button" onClick={() => onChange([])}>All</button><button type="button" onClick={() => onChange([...new Set([...hidden, ...sources.map(source => source.id)])])}>None</button></div>
      {!sources.length && <p>Loading providers…</p>}
      {sources.map(source => <label key={source.id}><input type="checkbox" checked={!hidden.includes(source.id)} onChange={event => onChange(event.target.checked ? hidden.filter(id => id !== source.id) : [...hidden, source.id])} />{source.name}</label>)}
    </div>}
  </div>
}
