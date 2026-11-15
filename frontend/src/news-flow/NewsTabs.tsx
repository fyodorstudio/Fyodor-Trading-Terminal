import type { NewsMode } from './model'

export function NewsTabs({ label, value, items, onChange, controls }: { label: string; value: string; items: { id: string; label: string }[]; onChange: (value: string) => void; controls: string }) {
  return <div className="news-tabs" role="tablist" aria-label={label} onKeyDown={event => {
    const index = items.findIndex(item => item.id === value)
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + items.length) % items.length
      if (items[next]) { onChange(items[next].id); document.getElementById(`${controls}-${items[next].id}-tab`)?.focus() }
    }
  }}>
    {items.map(item => <button type="button" role="tab" key={item.id} id={`${controls}-${item.id}-tab`} aria-label={item.label} tabIndex={value === item.id ? 0 : -1}
      aria-selected={value === item.id} aria-controls={controls} onClick={() => onChange(item.id)}>{item.label}</button>)}
  </div>
}

export function NewsFilterTabs({ value, onChange, controls }: { value: NewsMode; onChange: (value: NewsMode) => void; controls: string }) {
  return <NewsTabs label="Headline classification" value={value} onChange={value => onChange(value as NewsMode)} controls={controls}
    items={[{ id: 'all', label: 'All' }, { id: 'included', label: 'Included' }, { id: 'excluded', label: 'Excluded' }]} />
}
