import type { NewsSettings } from './model'

export function NewsDateFilter({ settings, zone, onChange }: { settings: NewsSettings; zone: string; onChange: (value: NewsSettings) => void }) {
  const description = settings.date ? `${settings.date} · ${settings.session ? 'Heatmap broker session' : zone}` : `Date filter · ${zone}`
  return <div className="news-date-controls"><label className="news-calendar" data-active={!!settings.date} title={description}>
    <span aria-hidden="true">📅</span>
    <input type="date" aria-label="News publication date" value={settings.date} title={description}
      onClick={event => {
        try { event.currentTarget.showPicker?.() }
        catch { /* The native picker indicator still works if programmatic opening is restricted. */ }
      }}
      onChange={event => onChange({ ...settings, date: event.target.value, session: null })} />
  </label>{settings.date && <button type="button" aria-label="Clear news date" title="Clear date filter" onClick={() => onChange({ ...settings, date: '', session: null })}>×</button>}</div>
}
