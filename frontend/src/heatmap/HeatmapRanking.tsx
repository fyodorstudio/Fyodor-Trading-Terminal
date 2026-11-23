import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { formatHeatmapChange, heatmapOHLC, type HeatmapField, type HeatmapPoint, type HeatmapRow } from './heatmap-model'
import type { HeatmapPreferences } from './heatmap-preferences'
import { useRankingMotion } from './useRankingMotion'

type Entry = { row: HeatmapRow; point: HeatmapPoint | undefined }
const direction = (value: number | null | undefined) => value == null ? '' : value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

function RankingNote({ storageKey, label }: { storageKey: string; label: string }) {
  const [note, setNote] = useState(() => {
    try { return localStorage.getItem(storageKey) ?? '' }
    catch { return '' }
  })
  const [saveFailed, setSaveFailed] = useState(false)
  return <div className="heatmap-ranking-note">
    <textarea aria-label={`Note for ${label}`} placeholder="Add a note…" rows={3} value={note}
      onChange={event => {
        const value = event.target.value
        setNote(value)
        try {
          if (value) localStorage.setItem(storageKey, value)
          else localStorage.removeItem(storageKey)
          setSaveFailed(false)
        } catch { setSaveFailed(true) }
      }} />
    {saveFailed && <small role="alert">Could not save this note in browser storage.</small>}
  </div>
}

export function HeatmapRanking({ entries, fields, heading, status, dateNavigation, notePeriod, groups, group, onGroup, preferences, onChange, eventMode, actions, onOpenRow, animate = false, motionScope = '' }: {
  entries: Entry[]; fields: readonly HeatmapField[]; heading: string; status: string
  dateNavigation?: { previous: (() => void) | undefined; next: (() => void) | undefined }
  notePeriod: readonly (string | null)[]
  groups: string[]; group: string; onGroup: (group: string) => void
  preferences: HeatmapPreferences; onChange: (next: HeatmapPreferences) => void
  eventMode: boolean; actions: ReactNode; onOpenRow?: (rowId: string) => void; animate?: boolean; motionScope?: string
}) {
  const bars = preferences.rankingView === 'bars'
  const notes = preferences.rankingView === 'note'
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const available = entries.filter(entry => entry.point?.value != null)
  const up = available.filter(entry => entry.point!.value! > 0).length
  const down = available.filter(entry => entry.point!.value! < 0).length
  const flat = available.length - up - down
  const maximum = Math.max(0, ...available.map(entry => Math.abs(entry.point!.value!)))
  const root = useRef<HTMLElement>(null)
  useRankingMotion({ root, entries, fields, enabled: animate, bars, unusual: preferences.rank === 'unusual',
    scope: JSON.stringify([motionScope, group, preferences.rank, preferences.rankingView, fields]) })
  return <aside ref={root} className={`heatmap-ranking${bars ? ' heatmap-ranking-bars' : ''}`} style={{ '--heat-ranking-width': `${bars ? 320 : Math.max(280, 76 + 57 * fields.length)}px` } as CSSProperties} aria-label="Selected period ranking">
    <header>
      <div>
        <div className="heatmap-ranking-heading">
          <strong>{heading}</strong>
          {dateNavigation && <div className="heatmap-ranking-date-nav" role="group" aria-label="Ranking date">
            <button type="button" aria-label="Previous ranking date" disabled={!dateNavigation.previous} onClick={dateNavigation.previous}>‹</button>
            <button type="button" aria-label="Next ranking date" disabled={!dateNavigation.next} onClick={dateNavigation.next}>›</button>
          </div>}
        </div>
        <small>{status}</small>
      </div>
      <div className="heatmap-segmented" role="group" aria-label="Ranking view">
        <button type="button" aria-pressed={preferences.rankingView === 'details'} onClick={() => onChange({ ...preferences, rankingView: 'details' })}>Details</button>
        <button type="button" aria-pressed={bars} onClick={() => onChange({ ...preferences, rankingView: 'bars' })}>Bars</button>
        <button type="button" aria-pressed={notes} onClick={() => onChange({ ...preferences, rankingView: 'note' })}>Note</button>
      </div>
    </header>
    <div className="heatmap-ranking-controls">
      <select aria-label="Ranking group" value={group} onChange={e => onGroup(e.target.value)}><option>All</option>{groups.map(g => <option key={g}>{g}</option>)}</select>
      <select aria-label="Rank instruments" value={preferences.rank} onChange={e => onChange({ ...preferences, rank: e.target.value as HeatmapPreferences['rank'] })}>
        <option value="largest">Largest moves</option>
        <option value="highest">Highest returns</option><option value="lowest">Lowest returns</option><option value="unusual" disabled={eventMode}>Largest unusual moves</option>
      </select>
    </div>
    <div className="heatmap-ranking-breadth"><span className="positive">{up} up</span><span className="negative">{down} down</span>{flat > 0 && <span>{flat} flat</span>}<span>{entries.length - available.length} unavailable</span></div>
    <div className="heatmap-ranking-actions">{actions}</div>
    {bars && <small className="heatmap-bar-caption">C return % · shared scale · zero at center{preferences.rank === 'unusual' ? ' · sorted by unusualness' : ''}</small>}
    <ol>{entries.map(({ row, point }) => {
      const value = point?.value ?? null
      const width = value == null || maximum === 0 ? 0 : Math.abs(value) / maximum * 50
      const noteOpen = notes && expandedNote === row.id
      const rowAction = row.id.startsWith('basket:') ? `Search Market Watch for ${row.id.slice(7)}` : `Open chart for ${row.label}`
      const noteKey = noteOpen ? `fyodor.heatmap.note.v1:${JSON.stringify([...notePeriod, row.id])}` : null
      return <li key={row.id} data-ranking-row={row.id} title={point?.reason || undefined}>
        <button type="button" className="heatmap-ranking-entry" disabled={!notes && !onOpenRow}
          onClick={() => notes ? setExpandedNote(noteOpen ? null : row.id) : onOpenRow?.(row.id)}
          aria-label={notes ? `Edit note for ${row.label}` : rowAction} aria-expanded={notes ? noteOpen : undefined}>
        <div className="heatmap-ranking-name"><span title={`${row.label} · ${row.group}`}>{row.label}</span>
          {preferences.rank === 'unusual' && <small data-rank-field="relative" title="Return relative to usual volatility">{formatHeatmapChange(point?.relative ?? null, '×')}</small>}
          {notes && <small aria-hidden="true">{noteOpen ? '▾' : '▸'}</small>}
        </div>
        {bars ? <div className="heatmap-bar-row">
          <div className="heatmap-bar-track" aria-hidden="true">
            {value != null && <span className={`heatmap-bar-fill ${direction(value)}`} style={{ left: `${value < 0 ? 50 - width : 50}%`, width: `${width}%` }} />}
            {value === 0 && <span className="heatmap-bar-zero" />}
          </div>
          <span data-rank-field="C" className={`heatmap-bar-value ${direction(value)}`}>{formatHeatmapChange(value)}</span>
        </div> : <div className="heatmap-ohlc" title={eventMode ? 'Percent changes versus the common anchor baseline; ranking uses C' : 'Percent changes versus previous close; ranking uses C'}>
          {heatmapOHLC(point).filter(field => fields.includes(field.label)).map(field => <span key={field.label} data-rank-field={field.label} className={`${direction(field.value)}${field.label === 'C' ? ' ohlc-close' : ''}`}>
            <small>{field.label}</small>{formatHeatmapChange(field.value)}
          </span>)}
        </div>}
        </button>
        {noteKey && <RankingNote key={noteKey} storageKey={noteKey} label={row.label} />}
      </li>
    })}</ol>
    {!entries.length && <p className="heatmap-ranking-empty">No instruments in this group.</p>}
  </aside>
}
