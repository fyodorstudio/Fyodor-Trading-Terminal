import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { chartOffsetAt } from '../appearance/time-display/chart-clock'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { HeatmapTimeline } from './HeatmapTimeline'
import { HeatmapSymbols } from './HeatmapSymbols'
import { createHeatmapRowBuilder, formatHeatmapChange, heatmapDate, heatmapDefaults, heatmapPeriods, heatmapRequests, orderHeatmapGroups, weekStart, type HeatmapInstrument } from './heatmap-model'
import { readHeatmapPreferences, saveHeatmapPreferences, type HeatmapPreferences } from './heatmap-preferences'
import { useHeatmapHistory } from './useHeatmapHistory'
import { heatmapChangesText, heatmapResearchPrompt } from './heatmap-export'
import { useWildcards } from './useWildcards'
import { WildcardEditor, WildcardManager } from './WildcardEditor'
import type { WildcardSnapshot } from './wildcards-model'
import './cross-asset.css'

const tapeMemory = new Map<string, { left: number; top: number }>()
const sessions = new Map<string, { date: string; pinned: boolean; year: number }>()
const noWildcards: WildcardSnapshot['rows'] = []

// Quote ticks do not invalidate the history, basket calculations or timeline.
export function CrossAssetDock({ symbols, broker, generation, active = true, connected = true }: { symbols: SymbolQuote[]; broker: string | null; generation: number; active?: boolean; connected?: boolean }) {
  const catalog = JSON.stringify(symbols.map(s => ({ symbol: s.symbol, description: s.description })))
  return <HeatmapDock key={`${broker}:${generation}`} catalogJson={catalog} broker={broker} generation={generation} active={active} connected={connected} />
}

const HeatmapDock = memo(function HeatmapDock({ catalogJson, broker, generation, active, connected }: { catalogJson: string; broker: string | null; generation: number; active: boolean; connected: boolean }) {
  const catalog: HeatmapInstrument[] = useMemo(() => JSON.parse(catalogJson), [catalogJson])
  const { preference } = useDisplayClock()
  const [clock, setClock] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  const brokerToday = () => heatmapDate(clock + (chartOffsetAt(clock, { brokerId: broker, brokerOffsetSeconds: 0 }) ?? 0))
  const [preferences, setPreferences] = useState(() => readHeatmapPreferences(broker ?? ''))
  const [view, setView] = useState(() => sessions.get(`${broker}:${generation}`) ?? { date: brokerToday(), year: Number(brokerToday().slice(0, 4)), pinned: false })
  useEffect(() => {
    sessions.set(`${broker}:${generation}`, view)
    while (sessions.size > 8) sessions.delete(sessions.keys().next().value!)
  }, [view, broker, generation])
  const [manager, setManager] = useState(false), [saveError, setSaveError] = useState<string | null>(null)
  const wildcards = useWildcards(broker)
  const [noteEditor, setNoteEditor] = useState<{ snapshot: WildcardSnapshot; rowId?: string; day: string; mode: HeatmapPreferences['mode'] } | null>(null)
  const [wildcardManager, setWildcardManager] = useState<WildcardSnapshot | null>(null)
  const [copied, setCopied] = useState<{ key: string; message: string } | null>(null)
  const [copyRange, setCopyRange] = useState<{ from: string; to: string; anchor: string; scope: string } | null>(null)
  const copyScope = `${view.year}:${preferences.mode}`
  if (copyRange && copyRange.scope !== copyScope) setCopyRange(null)
  if (!active && manager) setManager(false)
  if (!active && noteEditor) setNoteEditor(null)
  if (!active && wildcardManager) setWildcardManager(null)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const toggleGroup = useCallback((group: string) => setCollapsed(old => old.includes(group) ? old.filter(g => g !== group) : [...old, group]), [])
  const [buildRows] = useState(createHeatmapRowBuilder)
  const [attempt, setAttempt] = useState(0), [focusRequest, setFocusRequest] = useState(0), [rankGroup, setRankGroup] = useState('All')
  const [rankingVisible, setRankingVisible] = useState(true), [help, setHelp] = useState(false)
  const ids = useMemo(() => preferences.rows ?? heatmapDefaults(catalog, broker), [preferences.rows, catalog, broker])
  const names = useMemo(() => heatmapRequests(ids, catalog).join('\0'), [ids, catalog])
  const { data, error } = useHeatmapHistory(broker, generation, names, view.year, attempt, connected)
  const today = data?.today ?? brokerToday(), maxYear = Number(today.slice(0, 4))
  const periods = useMemo(() => heatmapPeriods(view.year, preferences.mode, today), [view.year, preferences.mode, today])
  const rows = useMemo(() => active ? buildRows(ids, catalog, broker, data, preferences.mode) : [], [active, buildRows, ids, catalog, broker, data, preferences.mode])
  const selected = preferences.mode === 'weekly' ? weekStart(view.date) : view.date
  const copyFrom = copyRange?.from ?? selected, copyThrough = copyRange?.to ?? selected
  const copyDays = useMemo(() => periods.filter(period => !period.future && period.day >= copyFrom && period.day <= copyThrough).map(period => period.day), [periods, copyFrom, copyThrough])
  const copyKey = `${copyScope}:${copyDays.join(',')}`
  const canCopy = useMemo(() => rows.some(row => copyDays.some(day => row.points.get(day)?.value != null)), [rows, copyDays])
  const groups = useMemo(() => orderHeatmapGroups(rows.map(r => r.group), preferences.groupOrder), [rows, preferences.groupOrder])
  const effectiveGroup = groups.includes(rankGroup) ? rankGroup : 'All'
  const ranking = useMemo(() => rows.filter(r => effectiveGroup === 'All' || r.group === effectiveGroup).map(row => ({ row, point: row.points.get(selected) }))
    .sort((a, b) => {
      const metric = (entry: typeof a) => preferences.rank === 'unusual' ? Math.abs(entry.point?.relative ?? NaN) : entry.point?.value ?? NaN
      const left = metric(a), right = metric(b)
      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0
      if (!Number.isFinite(right)) return -1
      return (preferences.rank === 'lowest' ? left - right : right - left) || a.row.label.localeCompare(b.row.label)
    }), [rows, effectiveGroup, selected, preferences.rank])
  const changeView = useCallback((date: string, pinned: boolean, focus = false) => {
    setView(old => {
      const year = focus ? Number(date.slice(0, 4)) : old.year
      return old.date === date && old.pinned === pinned && old.year === year ? old : { date, pinned, year }
    })
    if (focus) setFocusRequest(n => n + 1)
  }, [])
  const hover = useCallback((day: string) => { if (!view.pinned) changeView(day, false) }, [view.pinned, changeView])
  const pin = useCallback((day: string, extend = false) => {
    if (extend) {
      const anchor = copyRange?.anchor ?? selected
      setCopyRange({ from: anchor < day ? anchor : day, to: anchor > day ? anchor : day, anchor, scope: copyScope })
    } else setCopyRange(null)
    changeView(day, true)
  }, [changeView, copyRange, selected, copyScope])
  const closeManager = useCallback(() => setManager(false), [])
  const closeNote = useCallback(() => setNoteEditor(null), [])
  const closeWildcards = useCallback(() => setWildcardManager(null), [])
  const addWildcard = useCallback(() => {
    if (wildcards.snapshot && !wildcards.loading) setNoteEditor({ snapshot: wildcards.snapshot, day: selected, mode: preferences.mode })
  }, [wildcards.snapshot, wildcards.loading, selected, preferences.mode])
  const editWildcard = useCallback((rowId: string, day: string) => {
    if (wildcards.snapshot && !wildcards.loading) setNoteEditor({ snapshot: wildcards.snapshot, rowId, day, mode: preferences.mode })
  }, [wildcards.snapshot, wildcards.loading, preferences.mode])
  const manageWildcards = useCallback(() => { if (wildcards.snapshot && !wildcards.loading) setWildcardManager(wildcards.snapshot) }, [wildcards.snapshot, wildcards.loading])
  async function copyDetails(kind: 'details' | 'research') {
    try {
      const changes = heatmapChangesText(rows, copyDays, preferences.mode, preferences.groupOrder, today)
      await navigator.clipboard.writeText(kind === 'research' ? heatmapResearchPrompt(changes, preferences.mode, broker, Date.now()) : changes)
      setCopied({ key: copyKey, message: kind === 'research' ? 'Research prompt copied. Paste it into your agent chat.' : 'Changes copied.' })
    }
    catch { setCopied({ key: copyKey, message: 'Clipboard unavailable. Try copying again.' }) }
  }
  function save(next: HeatmapPreferences) {
    saveHeatmapPreferences(broker ?? '', next)
    setPreferences(next); setSaveError(null)
  }
  function option(next: HeatmapPreferences) {
    try { save(next) } catch { setSaveError('Could not save heatmap preferences. Your previous settings are preserved.') }
  }
  const chosenPeriod = periods.find(p => p.day === selected)
  const firstCopyDay = periods[0]?.day ?? `${view.year}-01-01`
  const lastCopyDay = periods.findLast(period => !period.future)?.day ?? firstCopyDay
  function changeCopyRange(field: 'from' | 'to', value: string) {
    if (!copyRange || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || heatmapDate(Date.parse(value)) !== value) return
    const day = preferences.mode === 'weekly' ? weekStart(value) : value
    if (day >= firstCopyDay && day <= lastCopyDay) setCopyRange({ ...copyRange, [field]: day })
  }
  const available = ranking.filter(r => r.point?.value != null), winners = available.filter(r => r.point!.value! > 0).length
  const requested = names ? names.split('\0') : []
  const missing = data ? requested.filter(s => !data.symbols[s]).length : requested.length
  const unavailable = data ? requested.filter(s => data.symbols[s] && data.symbols[s].availability !== 'available').length : 0
  if (!active) return null
  return <section className="cross-asset-dock" aria-label="Cross-asset heatmap">
    <div className="heatmap-toolbar">
      <strong>Cross-Asset</strong>
      <div role="group" aria-label="Heatmap period"><button type="button" aria-pressed={preferences.mode === 'daily'} onClick={() => option({ ...preferences, mode: 'daily' })}>Daily</button>
        <button type="button" aria-pressed={preferences.mode === 'weekly'} onClick={() => option({ ...preferences, mode: 'weekly' })}>Weekly</button></div>
      <button type="button" onClick={() => changeView(today, false, true)}>Today</button>
      <input aria-label="Heatmap date" type="date" min="2015-01-01" max={today} value={view.date} onChange={e => {
        const day = e.target.value
        if (day >= '2015-01-01' && day <= today && Number.isFinite(Date.parse(day))) changeView(day, true, true)
      }} />
      <button type="button" aria-label="Previous heatmap year" disabled={view.year <= 2015} onClick={() => changeView(`${view.year - 1}-12-31`, true, true)}>‹</button>
      <span>{view.year}</span><button type="button" aria-label="Next heatmap year" disabled={view.year >= maxYear} onClick={() => changeView(`${view.year + 1}-01-01`, true, true)}>›</button>
      {view.pinned && <button type="button" onClick={() => changeView(view.date, false)}>Unpin date</button>}
      <label>Shading <select aria-label="Heatmap shading" value={preferences.shade} onChange={e => option({ ...preferences, shade: e.target.value as HeatmapPreferences['shade'] })}>
        <option value="return">Return %</option><option value="relative">Relative to usual volatility</option></select></label>
      <button type="button" onClick={() => setManager(true)}>Instruments · {ids.length}</button>
      <button type="button" aria-pressed={rankingVisible} onClick={() => setRankingVisible(v => !v)}>Ranking</button>
      <button type="button" disabled={!canCopy} onClick={() => void copyDetails('details')}>Copy Details Only</button>
      <button type="button" disabled={!canCopy} onClick={() => void copyDetails('research')}>Copy Research Prompt</button>
      <button type="button" aria-pressed={!!copyRange} title="Set From/Through, or click a date then Shift-click another to select a range" onClick={() => setCopyRange(old => old ? null : { from: selected, to: selected, anchor: selected, scope: copyScope })}>Copy range</button>
      <button type="button" disabled={!wildcards.snapshot || wildcards.loading} onClick={manageWildcards}>Manage Wildcards</button>
      <button type="button" disabled={!broker || wildcards.loading} onClick={wildcards.reload}>Reload Wildcards</button>
      <button type="button" onClick={() => setAttempt(n => n + 1)}>Refresh</button>
      <button type="button" aria-expanded={help} onClick={() => setHelp(v => !v)}>Method</button>
    </div>
    {copyRange && <div className="heatmap-copy-range" role="group" aria-label="Dates to copy">
      <label>From <input type="date" aria-label="Copy from date" min={firstCopyDay} max={lastCopyDay} value={copyRange.from} onChange={event => changeCopyRange('from', event.target.value)} /></label>
      <label>Through <input type="date" aria-label="Copy through date" min={firstCopyDay} max={lastCopyDay} value={copyRange.to} onChange={event => changeCopyRange('to', event.target.value)} /></label>
      {copyRange.from > copyRange.to ? <span role="alert">From must be on or before Through.</span>
        : <small>{copyDays.length} {preferences.mode === 'weekly' ? 'weeks' : 'dates'} · {view.year} timeline · Days without readings are omitted.</small>}
      <button type="button" onClick={() => setCopyRange(null)}>Single date</button>
    </div>}
    {(error || saveError) && <p className="heatmap-message" role="alert">{saveError ?? error}{error && data ? ' Displayed readings may be stale.' : ''}</p>}
    {wildcards.error && <p className="heatmap-message" role="alert">{wildcards.error}</p>}
    {copied?.key === copyKey && <small className="heatmap-copy-status" role="status">{copied.message}</small>}
    {help && <div className="heatmap-method">
      <p>Daily % compares each broker D1 close with its previous available close, including opening gaps. Weekly compares the prior week’s final available close with the selected Monday–Sunday broker week’s final close; the current week is incomplete. Dates are broker session dates, independent of the display timezone. Markets have different hours.</p>
      <p>Each synthetic currency basket is the equal-weight geometric return against the other seven currencies. All seven must have matching start/end dates. This is a custom basket, distinct from USDX/EURX/JPYX. Figures show price performance, providing evidence to research rotation and risk appetite; they do not measure capital-flow amounts or assign a risk-on/off verdict.</p>
      <p>Relative shading divides the return by prior return volatility: up to 60 earlier daily observations (minimum 20), or 26 earlier weeks (minimum 12). It uses no later periods. Missing baselines stay unshaded. Raw instrument returns are in their quoted currencies, without currency conversion, dividends, financing or contract adjustments.</p>
    </div>}
    <div className="heatmap-status" role="status">
      {!broker ? 'Connect your broker to load the heatmap.' : !catalog.length ? 'Waiting for broker Market Watch symbols…' : !ids.length ? 'Choose instruments to start your heatmap.'
        : !data && names ? 'Loading broker daily history…' : missing || data?.pending ? `Loading history · ${missing || data?.pending} instruments remaining…`
        : `${rows.length} rows · ${unavailable ? `${unavailable} instruments unavailable · ` : ''}Drag to browse · Hover to compare · Click to pin`}
      {data && <span title="Time of the most recent history response, not the last market tick">Checked {formatAppTimestamp(data.observed_at * 1000, preference, 'time')}</span>}
    </div>
    <div className="heatmap-body">
      <HeatmapTimeline rows={rows} periods={periods} selected={selected} shade={preferences.shade} focusRequest={focusRequest}
        memory={tapeMemory} memoryKey={`${broker}:${generation}:${view.year}:${preferences.mode}`} observedAt={clock / 1000} onHover={hover} onPin={pin}
        groupOrder={preferences.groupOrder} collapsed={collapsed} onToggleGroup={toggleGroup}
        copyRange={copyRange}
        wildcards={wildcards.snapshot?.rows ?? noWildcards} wildcardsReady={!!wildcards.snapshot && !wildcards.loading}
        onAddWildcard={addWildcard} onEditWildcard={editWildcard} onManageWildcards={manageWildcards} />
      {rankingVisible && <aside className="heatmap-ranking" aria-label="Selected period ranking">
        <header><strong>{selected}{preferences.mode === 'weekly' ? ' · Week' : ''}</strong><small>{view.pinned ? 'Pinned' : 'Following hover'}{chosenPeriod?.partial ? ' · In progress' : ''}</small></header>
        <div className="heatmap-ranking-controls"><select aria-label="Ranking group" value={effectiveGroup} onChange={e => setRankGroup(e.target.value)}><option>All</option>{groups.map(g => <option key={g}>{g}</option>)}</select>
          <select aria-label="Rank instruments" value={preferences.rank} onChange={e => option({ ...preferences, rank: e.target.value as HeatmapPreferences['rank'] })}>
            <option value="highest">Highest returns</option><option value="lowest">Lowest returns</option><option value="unusual">Largest unusual moves</option></select></div>
        <small>{winners} up · {available.length - winners - available.filter(r => r.point!.value === 0).length} down · {ranking.length - available.length} unavailable</small>
        <ol>{ranking.map(({ row, point }) => <li key={row.id}><span title={row.group}>{row.label}</span><span className={point?.value == null ? '' : point.value > 0 ? 'positive' : point.value < 0 ? 'negative' : ''}>
          {formatHeatmapChange(point?.value ?? null)}{preferences.rank === 'unusual' && <small>{formatHeatmapChange(point?.relative ?? null, '×')}</small>}</span></li>)}</ol>
      </aside>}
    </div>
    {manager && <HeatmapSymbols catalog={catalog} broker={broker} preferences={preferences} rows={ids}
      onSave={next => { save(next); setManager(false) }} onClose={closeManager} />}
    {noteEditor && <WildcardEditor {...noteEditor} onSave={wildcards.save} onClose={closeNote} />}
    {wildcardManager && <WildcardManager snapshot={wildcardManager} onSave={wildcards.save} onClose={closeWildcards} />}
  </section>
})
