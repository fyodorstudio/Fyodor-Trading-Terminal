import type { NewsSettings } from './model'

export function NewsSort({ settings, onChange }: { settings: NewsSettings; onChange: (settings: NewsSettings) => void }) {
  return <select aria-label="News sort order" title="Sort by first collection or feed publication time" value={`${settings.order}-${settings.sortBy}`} onChange={event => {
    const [order, sortBy] = event.target.value.split('-') as [NewsSettings['order'], NewsSettings['sortBy']]
    onChange({ ...settings, order, sortBy })
  }}>
    <option value="newest-collected">Newest collected</option><option value="oldest-collected">Oldest collected</option>
    <option value="newest-published">Newest published</option><option value="oldest-published">Oldest published</option>
  </select>
}
