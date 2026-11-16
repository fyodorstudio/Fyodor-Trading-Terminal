import { useEffect, useRef, useState } from 'react'
import type { NewsSource } from './model'
import { providerGroups } from './provider-groups'

export function NewsProviderSelector({ sources, hidden, onChange }: { sources: NewsSource[]; hidden: string[]; onChange: (hidden: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const count = sources.filter(source => !hidden.includes(source.id)).length
  const groups = providerGroups(sources)
  function toggle(ids: string[], visible: boolean) {
    onChange(visible ? hidden.filter(id => !ids.includes(id)) : [...new Set([...hidden, ...ids])])
  }
  function sourceRow(source: NewsSource) {
    return <label key={source.id}><input type="checkbox" aria-label={`Show provider ${source.name}`} checked={!hidden.includes(source.id)} onChange={event => toggle([source.id], event.target.checked)} />{source.name}{(source.collect_enabled === 0 || source.collect_enabled === false) && ' · collection paused'}</label>
  }
  useEffect(() => {
    if (!open) return
    container.current?.querySelector<HTMLElement>('[role="group"] button')?.focus()
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="news-provider-selector" ref={container} onBlur={event => {
    // Label clicks can briefly move focus to the document before the native
    // checkbox activation. Outside pointer presses are already handled above.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" aria-label="Select news providers" title={`Providers: ${count} of ${sources.length} shown`} aria-expanded={open} aria-controls="news-visible-providers" aria-pressed={count < sources.length} onClick={() => setOpen(value => !value)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/><path d="m6 3 3 2-3 2m8 3 3 2-3 2m-8 3 3 2-3 2"/></svg>
    </button>
    {open && <div id="news-visible-providers" className="news-provider-options" role="group" aria-label="Visible news providers">
      <div><strong>Providers · {count}/{sources.length}</strong><button type="button" onClick={() => onChange([])}>All</button><button type="button" onClick={() => onChange([...new Set([...hidden, ...sources.map(source => source.id)])])}>None</button></div>
      {!sources.length && <p>Loading providers…</p>}
      {groups.map(group => {
        if (group.sources.length === 1) return sourceRow(group.sources[0])
        const shown = group.sources.filter(source => !hidden.includes(source.id)).length, mixed = shown > 0 && shown < group.sources.length
        const isExpanded = expanded.includes(group.id), membersId = `news-group-${group.id.replace(/[^\w-]/g, '-')}`
        return <div className="news-provider-group" key={group.id}>
          <div className="news-provider-group-heading"><label><input type="checkbox" aria-label={`Show ${group.name} group`} aria-checked={mixed ? 'mixed' : shown > 0}
            ref={input => { if (input) input.indeterminate = mixed }} checked={shown === group.sources.length} onChange={event => toggle(group.sources.map(source => source.id), event.target.checked)} />
            <strong>{group.name}</strong><small>{shown}/{group.sources.length}</small></label>
            <button type="button" aria-label={`Expand ${group.name} feeds`} aria-expanded={isExpanded} aria-controls={membersId}
              onClick={() => setExpanded(old => isExpanded ? old.filter(id => id !== group.id) : [...old, group.id])}>{isExpanded ? '▴' : '▾'}</button>
          </div>
          {isExpanded && <div id={membersId} className="news-provider-group-members">{group.sources.map(sourceRow)}</div>}
        </div>
      })}
    </div>}
  </div>
}
