import { useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { SymbolQuote } from '../contracts/SymbolQuote'
import type { FavouriteSection, FavouriteSectionAction, MarketSort } from './market-watch-preferences'
import { sortMarketQuotes } from './market-watch-sort'

export function FavouriteSections({ sections, quotes, onChange, renderRow, sort, sortValues }: {
  sections: FavouriteSection[]; quotes: SymbolQuote[]
  onChange: (action: FavouriteSectionAction) => void; renderRow: (quote: SymbolQuote) => ReactNode
  sort: MarketSort
  sortValues: ReadonlyMap<string, number | null>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const dragged = useRef<string | null>(null)
  const bySymbol = useMemo(() => new Map(quotes.map(quote => [quote.symbol, quote])), [quotes])
  const clearDrag = () => { dragged.current = null }
  const drop = (event: DragEvent, sectionId: string, before?: string) => {
    if (!dragged.current) return
    event.preventDefault(); event.stopPropagation()
    onChange({ type: 'move', symbol: dragged.current, sectionId, before }); clearDrag()
  }
  return <>
    <div className="market-watch-organize">
      <button type="button" aria-pressed={editing} onClick={() => setEditing(value => !value)}>{editing ? 'Done' : 'Edit sections'}</button>
      <span>{sort === 'saved' ? 'Drag ⋮⋮ to reorder' : 'Choose Saved order to reorder'}</span>
    </div>
    {editing && <form className="market-watch-add-section" onSubmit={event => {
      event.preventDefault()
      if (!name.trim()) return
      onChange({ type: 'add', id: crypto.randomUUID(), name }); setName('')
    }}>
      <input aria-label="New favourite section name" placeholder="Section name" value={name} onChange={event => setName(event.target.value)} maxLength={80} />
      <button type="submit" disabled={!name.trim()}>Add section</button>
    </form>}
    {sections.map(section => <div className="market-watch-favourite-section" role="group" aria-label={section.name} key={section.id}
      onDragOver={event => { if (dragged.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }}
      onDrop={event => drop(event, section.id)}>
      <div className="market-watch-section-heading">
        {editing ? <input key={section.name} aria-label={`Rename ${section.name} section`} defaultValue={section.name} maxLength={80}
          onBlur={event => { if (event.target.value.trim()) onChange({ type: 'rename', id: section.id, name: event.target.value }); else event.target.value = section.name }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = section.name; event.currentTarget.blur() } }} />
          : <strong>{section.name}</strong>}
        <small>{section.symbols.filter(symbol => bySymbol.has(symbol)).length}</small>
        {editing && section.id !== 'default' && <button type="button" aria-label={`Delete ${section.name} section`}
          title="Move its symbols back to the first section" onClick={() => onChange({ type: 'remove', id: section.id })}>×</button>}
      </div>
      {sortMarketQuotes(section.symbols.flatMap(symbol => bySymbol.has(symbol) ? [bySymbol.get(symbol)!] : []), sort, sortValues).flatMap(quote => {
        const symbol = quote.symbol, index = section.symbols.indexOf(symbol)
        return [<div className="market-watch-draggable-row" key={symbol} onDrop={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          drop(event, section.id, event.clientY > bounds.top + bounds.height / 2 ? section.symbols[index + 1] : symbol)
        }}>
          <button type="button" className="market-watch-drag-handle" draggable={sort === 'saved'} disabled={sort !== 'saved'} aria-label={`Reorder ${symbol}`}
            title="Drag to move; use Up/Down keys to reorder"
            onDragStart={event => { dragged.current = symbol; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', symbol) }}
            onDragEnd={clearDrag} onKeyDown={event => {
              if (event.key === 'ArrowUp' && index > 0) {
                event.preventDefault(); onChange({ type: 'move', symbol, sectionId: section.id, before: section.symbols[index - 1] })
              } else if (event.key === 'ArrowDown' && index < section.symbols.length - 1) {
                event.preventDefault(); onChange({ type: 'move', symbol, sectionId: section.id, before: section.symbols[index + 2] })
              }
            }}>⋮⋮</button>
          {renderRow(quote)}
          {editing && sections.length > 1 && <select aria-label={`Move ${symbol} to section`} value={section.id}
            onChange={event => onChange({ type: 'move', symbol, sectionId: event.target.value })}>
            {sections.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>}
        </div>]
      })}
      {!section.symbols.some(symbol => bySymbol.has(symbol)) && <p className="market-watch-section-empty">Drop symbols here</p>}
    </div>)}
  </>
}
