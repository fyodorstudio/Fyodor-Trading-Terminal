import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { eventTiers, type EventTier } from '../event-tiers/event-tiers'
import { inspectorFamilies } from '../inspector/catalog/inspector-families'
import { FamilyFilterGroups } from '../inspector/filters/FamilyFilterGroups'
import { inspectorFilterRows } from '../inspector/filters/inspector-filter-rows'
import type { LedgerFilters } from './ledger-filters'
import '../inspector/inspector.css'

export function LedgerFiltersPopover({ anchor, currencies, filters, onApply, onClose }: {
  anchor: RefObject<HTMLButtonElement | null>; currencies: readonly string[]; filters: LedgerFilters
  onApply: (filters: LedgerFilters, save?: boolean) => void; onClose: () => void
}) {
  const [original] = useState(filters), committed = useRef(false)
  const [draft, setDraft] = useState(filters), [search, setSearch] = useState(''), [error, setError] = useState('')
  const [position, setPosition] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const panel = useRef<HTMLDivElement>(null), titleId = useId()
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(720, Math.max(0, window.innerWidth - 16))
      const above = Math.max(0, rect.top - 12), below = Math.max(0, window.innerHeight - rect.bottom - 12)
      const height = Math.min(620, Math.max(above, below))
      setPosition({ width, height, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: above >= below ? rect.top - height - 4 : rect.bottom + 4 })
    }
    place(); window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }
    document.addEventListener('pointerdown', dismiss, true); window.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true); window.removeEventListener('keydown', escape, true)
      if (!committed.current) onApply(original)
      if (previous?.isConnected) previous.focus()
    }
  }, [anchor, onClose, onApply, original])
  const update = (next: LedgerFilters) => { setDraft(next); onApply(next); setError('') }
  const toggle = (ids: string[], checked: boolean) => update({ ...draft,
    families: checked ? [...new Set([...draft.families, ...ids])] : draft.families.filter(id => !ids.includes(id)) })
  const activeFamilies = inspectorFamilies.filter(f => currencies.includes(f.currency))
  const preset = (tiers: EventTier[]) => update({ tiers, families: [...draft.families.filter(id => !activeFamilies.some(f => f.id === id)), ...activeFamilies.map(f => f.id)] })
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = inspectorFilterRows.filter(f => currencies.includes(f.currency) && terms.every(term =>
    `${f.label} ${f.search ?? ''} ${f.category} ${f.currency} ${f.ids.join(' ')}`.toLocaleLowerCase().includes(term)))
  return createPortal(<div ref={panel} role="dialog" aria-modal="false" aria-labelledby={titleId}
    className="inspector-modal ledger-filters-popover" style={{ ...position, visibility: position ? undefined : 'hidden' }}>
    <div className="inspector-modal-content">
      <header><div><h2 id={titleId}>Ledger filters · {currencies.join(' / ')}</h2><p>Timeline visibility</p></div>
        <button type="button" aria-label="Close Ledger filters" onClick={onClose}>×</button></header>
      <div className="ledger-filter-presets" aria-label="Ledger filter presets">
        <button type="button" onClick={() => preset(['S', 'A', 'B'])}>S/A/B · recommended</button>
        <button type="button" onClick={() => preset(['S', 'A'])}>S/A only</button>
        <button type="button" onClick={() => preset(['S', 'A', 'B', 'C'])}>All events</button>
      </div>
      <div className="ledger-filter-tiers">{eventTiers.map(tier => <label key={tier.id} title={tier.events}>
        <input type="checkbox" aria-label={`Show ${tier.label}`} checked={draft.tiers.includes(tier.id)}
          onChange={event => update({ ...draft, tiers: event.target.checked ? [...draft.tiers, tier.id] : draft.tiers.filter(t => t !== tier.id) })} />{tier.label}</label>)}</div>
      <div className="inspector-filter-tools"><div className="inspector-filter-search"><input type="search" aria-label="Search Ledger families"
        placeholder="Search families…" value={search} onChange={event => setSearch(event.target.value)} />
        {search && <button type="button" aria-label="Clear Ledger family search" onClick={() => setSearch('')}>×</button>}</div></div>
      <div className="inspector-filter-columns">{currencies.map((currency, column) => {
        const ids = activeFamilies.filter(f => f.currency === currency).map(f => f.id)
        return <Fragment key={currency}><h3 style={{ gridColumn: column + 1, gridRow: 1 }}>{currency}
          <label className="inspector-select-all"><input type="checkbox" aria-label={`Select all Ledger ${currency}`} checked={ids.every(id => draft.families.includes(id))}
            ref={input => { if (input) input.indeterminate = ids.some(id => draft.families.includes(id)) && !ids.every(id => draft.families.includes(id)) }}
            onChange={event => toggle(ids, event.target.checked)} />Select all</label></h3>
          <FamilyFilterGroups currency={currency} column={column} selected={draft.families} matches={matches} toggle={toggle} />
        </Fragment>
      })}</div>
      {!matches.length && <p className="inspector-search-note" role="status">No families match your search.</p>}
      <p className="inspector-modal-note">Events must match both a tier and a checked family. Unclassified events use C. Category details and Inspector filters stay unchanged.</p>
      {error && <p className="ledger-filter-error" role="alert">{error}</p>}
      <footer><span className="inspector-filter-save-note">Preview changes here. Save shares Ledger choices across pairs with these currencies.</span>
        <button type="button" onClick={onClose}>Cancel</button><button type="button" className="inspector-primary" onClick={() => {
          try { onApply(draft, true); committed.current = true; onClose() }
          catch { setError('Could not save filters. Retry, or Cancel to restore your previous choices.') }
        }}>Save</button></footer>
    </div>
  </div>, document.body)
}
