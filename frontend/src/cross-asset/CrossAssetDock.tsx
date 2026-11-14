import { createPortal } from 'react-dom'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { chartOffsetAt } from '../appearance/time-display/chart-clock'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { HeatmapTimeline } from './HeatmapTimeline'
import { HeatmapSymbols } from './HeatmapSymbols'
import { createHeatmapRowBuilder, formatHeatmapChange, heatmapOHLC, heatmapDate, heatmapDefaults, heatmapPeriods, heatmapRequests, orderHeatmapGroups, weekStart, type HeatmapInstrument } from './heatmap-model'
import { readHeatmapPreferences, saveHeatmapPreferences, type HeatmapPreferences } from './heatmap-preferences'
import { useHeatmapHistory } from './useHeatmapHistory'
import { heatmapChangesText, heatmapResearchPrompt, heatmapRankingText } from './heatmap-export'
import { useWildcards } from './useWildcards'
import { WildcardEditor, WildcardManager } from './WildcardEditor'
import type { WildcardSnapshot } from './wildcards-model'
import { HeatmapFields, HeatmapCopyOptions } from './HeatmapOptions'
import { EventWindowControls } from './EventWindowControls'
import { eventRows, eventPeriods, eventChangesText, jakartaTime, type EventWindow } from './event-window'
import { useIntradayHistory } from './useIntradayHistory'
import './cross-asset.css'

const tapeMemory = new Map<string, { left: number; top: number }>()
const sessions = new Map<string, { date: string; pinned: boolean; year: number }>()
const noWildcards: WildcardSnapshot['rows'] = []

// Quote ticks do not invalidate the history, basket calculations or timeline.
export function CrossAssetDock({ symbols, broker, generation, active = true, connected = true, dockActive = active, rankingTarget = null, onCloseRanking }: { symbols: SymbolQuote[]; broker: string | null; generation: number; active?: boolean; connected?: boolean; dockActive?: boolean; rankingTarget?: HTMLElement | null; onCloseRanking?: () => void }) {
  const catalog = JSON.stringify(symbols.map(s => ({ symbol: s.symbol, description: s.description })))
  return <HeatmapDock key={`${broker}:${generation}`} catalogJson={catalog} broker={broker} generation={generation} active={active} connected={connected} dockActive={dockActive} rankingTarget={rankingTarget} onCloseRanking={onCloseRanking} />
}

const HeatmapDock = memo(function HeatmapDock({ catalogJson, broker, generation, active, connected, dockActive, rankingTarget, onCloseRanking }: { catalogJson: string; broker: string | null; generation: number; active: boolean; connected: boolean; dockActive: boolean; rankingTarget: HTMLElement | null; onCloseRanking?: () => void }) {
  const catalog: HeatmapInstrument[] = useMemo(() => JSON.parse(catalogJson), [catalogJson])
  const { preference } = useDisplayClock()
  const [eventMode, setEventMode] = useState(false)
  const [eventWindow, setEventWindow] = useState<EventWindow>(() => { const end=Math.floor(Date.now()/60000)*60000; return { from:end-3600000, through:end, anchor:end-3600000, minutes:5 } })
  const [eventSelected, setEventSelected] = useState('window')
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
  const copyScope = eventMode ? `${eventWindow.from}:${eventWindow.through}:${eventWindow.minutes}` : `${view.year}:${preferences.mode}`
  if (copyRange && copyRange.scope !== copyScope) setCopyRange(null)
  if (!active && manager) setManager(false)
  if ((!active || !dockActive) && noteEditor) setNoteEditor(null)
  if ((!active || !dockActive) && wildcardManager) setWildcardManager(null)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const toggleGroup = useCallback((group: string) => setCollapsed(old => old.includes(group) ? old.filter(g => g !== group) : [...old, group]), [])
  const [buildRows] = useState(createHeatmapRowBuilder)
  const [attempt, setAttempt] = useState(0), [focusRequest, setFocusRequest] = useState(0), [rankGroup, setRankGroup] = useState('All')
  const [rankingVisible, setRankingVisible] = useState(true), [help, setHelp] = useState(false)
  const ids = useMemo(() => preferences.rows ?? heatmapDefaults(catalog, broker), [preferences.rows, catalog, broker])
  const names = useMemo(() => heatmapRequests(ids, catalog).join('\0'), [ids, catalog])
  const { data, error: dailyError } = useHeatmapHistory(broker, generation, names, view.year, attempt, connected)
  const today = data?.today ?? brokerToday(), maxYear = Number(today.slice(0, 4))
  const intraday = useIntradayHistory(broker, generation, names, eventWindow, attempt, eventMode && active && connected)
  const error = eventMode ? (!connected ? 'Broker disconnected. Intraday readings may be stale.' : intraday.error) : dailyError
  const eventClock = eventMode ? clock : 0
  const periods = useMemo(() => eventMode ? eventPeriods(eventWindow, eventClock) : heatmapPeriods(view.year, preferences.mode, today), [view.year, preferences.mode, today, eventMode, eventWindow, eventClock])
  const rows = useMemo(() => active ? eventMode ? eventRows(ids, catalog, broker, intraday.data, eventWindow) : buildRows(ids, catalog, broker, data, preferences.mode) : [], [active, buildRows, ids, catalog, broker, data, preferences.mode, eventMode, intraday.data, eventWindow])
  const selected = eventMode ? eventSelected : preferences.mode === 'weekly' ? weekStart(view.date) : view.date
  const copyFrom = copyRange?.from ?? selected, copyThrough = copyRange?.to ?? selected
  const copyDays = useMemo(() => periods.filter(period => !period.future && period.day >= copyFrom && period.day <= copyThrough).map(period => period.day), [periods, copyFrom, copyThrough])
  const copyKey = `${copyScope}:${copyDays.join(',')}:${preferences.fields}:${preferences.copyFields}:${preferences.matchFields}:${preferences.copyRows}:${preferences.copyFormat}`
  const exportRows = useMemo(() => preferences.copyRows === null ? rows : rows.filter(row => preferences.copyRows!.includes(row.id)), [rows, preferences.copyRows])
  const exportFields = preferences.matchFields ? preferences.fields : preferences.copyFields
  const canCopy = useMemo(() => exportRows.some(row => (eventMode ? [...row.points.values()] : copyDays.map(day => row.points.get(day))).some(point => point?.value != null)), [exportRows, copyDays, eventMode])
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
  const hover = useCallback((day: string) => { if (eventMode) return; if (!view.pinned) changeView(day, false) }, [view.pinned, changeView, eventMode])
  const pin = useCallback((day: string, extend = false) => {
    if (eventMode) { setEventSelected(day); return }
    if (extend) {
      const anchor = copyRange?.anchor ?? selected
      setCopyRange({ from: anchor < day ? anchor : day, to: anchor > day ? anchor : day, anchor, scope: copyScope })
    } else setCopyRange(null)
    changeView(day, true)
  }, [changeView, copyRange, selected, copyScope, eventMode])
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
      const changes = eventMode ? eventChangesText(exportRows, eventWindow, exportFields, preferences.copyFormat, preferences.groupOrder, intraday.data?.observed_at ?? clock/1000) : heatmapChangesText(exportRows, copyDays, preferences.mode, preferences.groupOrder, today, exportFields)
      await navigator.clipboard.writeText(kind === 'research' ? heatmapResearchPrompt(changes, preferences.mode, broker, Date.now(), eventMode) : changes)
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
  const rankingView = <aside className="heatmap-ranking" style={{ width: rankingTarget ? undefined : 76 + 57 * preferences.fields.length }} aria-label="Selected period ranking">
        <header><strong>{eventMode ? selected==='window'?'Window summary':jakartaTime(Date.parse(selected)) : selected}{!eventMode && preferences.mode === 'weekly' ? ' · Week' : ''}</strong><small>{eventMode ? 'Common anchor · '+jakartaTime(eventWindow.anchor) : view.pinned ? 'Pinned' : 'Following hover'}{chosenPeriod?.partial ? ' · In progress' : ''}</small></header>
        <div className="heatmap-ranking-controls"><select aria-label="Ranking group" value={effectiveGroup} onChange={e => setRankGroup(e.target.value)}><option>All</option>{groups.map(g => <option key={g}>{g}</option>)}</select>
          <select aria-label="Rank instruments" value={preferences.rank} onChange={e => option({ ...preferences, rank: e.target.value as HeatmapPreferences['rank'] })}>
            <option value="highest">Highest returns</option><option value="lowest">Lowest returns</option><option value="unusual" disabled={eventMode}>Largest unusual moves</option></select></div>
        <small>{winners} up · {available.length - winners - available.filter(r => r.point!.value === 0).length} down · {ranking.length - available.length} unavailable</small>
        <button type="button" disabled={!available.length} onClick={async () => {
          try {
            const shown = ranking.map(entry => entry.row)
            const text = heatmapRankingText(shown, selected, exportFields, eventMode
              ? `Event-window ranking · ${selected==='window' ? jakartaTime(eventWindow.from)+' → '+jakartaTime(eventWindow.through) : jakartaTime(Date.parse(selected))} · Anchor ${jakartaTime(eventWindow.anchor)} · ${eventWindow.minutes}-minute candles${chosenPeriod?.partial?' · In progress':''}`
              : `${selected} · ${preferences.mode}${chosenPeriod?.partial?' · In progress':''} · ${preferences.rank}`)
            await navigator.clipboard.writeText(text); setCopied({key:copyKey,message:'Displayed ranking copied.'})
          } catch { setCopied({key:copyKey,message:'Clipboard unavailable. Try copying again.'}) }
        }}>Copy displayed ranking</button>
        <ol>{ranking.map(({ row, point }) => <li key={row.id} title={point?.reason || undefined}><span title={row.group}>{row.label}</span><span className={point?.value == null ? '' : point.value > 0 ? 'positive' : point.value < 0 ? 'negative' : ''}>
          {point?.value == null ? '—' : <span className="heatmap-ohlc" title={eventMode ? 'Percent changes versus the common anchor baseline; ranking uses C' : 'Percent changes versus previous close; ranking uses C'}>{heatmapOHLC(point).filter(field => preferences.fields.includes(field.label)).map(field => <span key={field.label} className={field.label === 'C' ? 'ohlc-close' : undefined}>
            <small>{field.label}</small>{formatHeatmapChange(field.value)}</span>)}</span>}
          {preferences.rank === 'unusual' && <small>{formatHeatmapChange(point?.relative ?? null, '×')}</small>}</span></li>)}</ol>
      </aside>
  const todayAction = () => {
    if(eventMode){const end=Math.floor(Date.now()/60000)*60000;setEventWindow({from:end-3600000,through:end,anchor:end-3600000,minutes:eventWindow.minutes});setEventSelected('window')}
    else changeView(today,false,true)
  }
  const fieldControls = <HeatmapFields value={preferences.fields} onChange={fields => option({...preferences,fields})} />
  const copyOptions = <HeatmapCopyOptions preferences={preferences} rows={rows} onChange={option} eventMode={eventMode} />
  const periodControls = <div role="group" aria-label="Heatmap period">
    <button type="button" aria-pressed={!eventMode && preferences.mode==='daily'} onClick={()=>{setEventMode(false);option({...preferences,mode:'daily'})}}>Daily</button>
    <button type="button" aria-pressed={!eventMode && preferences.mode==='weekly'} onClick={()=>{setEventMode(false);option({...preferences,mode:'weekly'})}}>Weekly</button>
    <button type="button" aria-pressed={eventMode} onClick={()=>{setEventMode(true);if(preferences.rank==='unusual')option({...preferences,rank:'highest'})}}>Event window</button>
  </div>
  const eventControls = eventMode && <EventWindowControls key={eventWindow.from+':'+eventWindow.through+':'+eventWindow.anchor+':'+eventWindow.minutes} value={eventWindow} onApply={next=>{setEventWindow(next);setEventSelected('window');setFocusRequest(n=>n+1)}} />
  const dateControl = !eventMode && <label>Date <input aria-label="Heatmap date" type="date" min="2015-01-01" max={today} value={view.date} onChange={e=>{
    const day=e.target.value;if(day>='2015-01-01'&&day<=today&&Number.isFinite(Date.parse(day)))changeView(day,true,true)
  }}/></label>
  if (!active) return null
  return <><section className="cross-asset-dock" hidden={!dockActive} style={{"--heat-fields":preferences.fields.length} as import('react').CSSProperties} aria-label="Cross-asset heatmap">
    <div className="heatmap-toolbar">
      <strong>Cross-Asset</strong>
      {periodControls}{fieldControls}
      <button type="button" onClick={todayAction}>Today</button>
      {dateControl}
      {!eventMode && <><button type="button" aria-label="Previous heatmap year" disabled={view.year <= 2015} onClick={() => changeView(`${view.year - 1}-12-31`, true, true)}>‹</button>
      <span>{view.year}</span><button type="button" aria-label="Next heatmap year" disabled={view.year >= maxYear} onClick={() => changeView(`${view.year + 1}-01-01`, true, true)}>›</button>
      {view.pinned && <button type="button" onClick={() => changeView(view.date, false)}>Unpin date</button>}</>}
      <label>Shading <select aria-label="Heatmap shading" disabled={eventMode} value={preferences.shade} onChange={e => option({ ...preferences, shade: e.target.value as HeatmapPreferences['shade'] })}>
        <option value="return">Return %</option><option value="relative">Relative to usual volatility</option></select></label>
      <button type="button" onClick={() => setManager(true)}>Instruments · {ids.length}</button>
      <button type="button" aria-pressed={rankingVisible} onClick={() => setRankingVisible(v => !v)}>Ranking</button>
      <button type="button" disabled={!canCopy} onClick={() => void copyDetails('details')}>Copy Details Only</button>
      <button type="button" disabled={!canCopy} onClick={() => void copyDetails('research')}>Copy Research Prompt</button>
      {copyOptions}
      <button type="button" disabled={eventMode} aria-pressed={!!copyRange} title="Set From/Through, or click a date then Shift-click another to select a range" onClick={() => setCopyRange(old => old ? null : { from: selected, to: selected, anchor: selected, scope: copyScope })}>Copy range</button>
      <button type="button" disabled={!wildcards.snapshot || wildcards.loading} onClick={manageWildcards}>Manage Wildcards</button>
      <button type="button" disabled={!broker || wildcards.loading} onClick={wildcards.reload}>Reload Wildcards</button>
      <button type="button" onClick={() => setAttempt(n => n + 1)}>Refresh</button>
      <button type="button" aria-expanded={help} onClick={() => setHelp(v => !v)}>Method</button>
    </div>
    {eventControls}
    {!eventMode && copyRange && <div className="heatmap-copy-range" role="group" aria-label="Dates to copy">
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
      <p>O · H · L · C shows opening, highest, lowest and closing price changes side by side, all measured against the same previous close. C is the net return and uses the latest available reading while in progress. Weekly uses the first available opening, whole-week extremes and final available close versus the prior week’s final close. Synthetic baskets show C only; O/H/L remains unavailable without a synchronized intraday path.</p>
      <p>Relative shading divides the return by prior return volatility: up to 60 earlier daily observations (minimum 20), or 26 earlier weeks (minimum 12). It uses no later periods. Missing baselines stay unshaded. Raw instrument returns are in their quoted currencies, without currency conversion, dividends, financing or contract adjustments.</p>
    </div>}
    <div className="heatmap-status" role="status">
      {eventMode ? <span>{intraday.data ? `${rows.length} rows · ${intraday.data.pending} instruments pending · Common anchor ${jakartaTime(eventWindow.anchor)}` : 'Loading intraday history…'}</span> : <>
      {!broker ? 'Connect your broker to load the heatmap.' : !catalog.length ? 'Waiting for broker Market Watch symbols…' : !ids.length ? 'Choose instruments to start your heatmap.'
        : !data && names ? 'Loading broker daily history…' : missing || data?.pending ? `Loading history · ${missing || data?.pending} instruments remaining…`
        : `${rows.length} rows · ${unavailable ? `${unavailable} instruments unavailable · ` : ''}Drag to browse · Hover to compare · Click to pin`}
      {data && <span title="Time of the most recent history response, not the last market tick">Checked {formatAppTimestamp(data.observed_at * 1000, preference, 'time')}</span>}</>}
    </div>
    <div className="heatmap-body">
      {dockActive && <HeatmapTimeline fields={preferences.fields} showWildcards={!eventMode} rows={rows} periods={periods} selected={selected} shade={eventMode ? 'return' : preferences.shade} focusRequest={focusRequest}
        memory={tapeMemory} memoryKey={`${broker}:${generation}:${eventMode?copyScope:view.year+preferences.mode}:${preferences.fields}`} observedAt={clock / 1000} onHover={hover} onPin={pin}
        groupOrder={preferences.groupOrder} collapsed={collapsed} onToggleGroup={toggleGroup}
        copyRange={eventMode?null:copyRange}
        wildcards={wildcards.snapshot?.rows ?? noWildcards} wildcardsReady={!!wildcards.snapshot && !wildcards.loading}
        onAddWildcard={addWildcard} onEditWildcard={editWildcard} onManageWildcards={manageWildcards} />}
      {rankingVisible && !rankingTarget && rankingView}
    </div>
    {dockActive && !rankingTarget && manager && <HeatmapSymbols catalog={catalog} broker={broker} preferences={preferences} rows={ids}
      onSave={next => { save(next); setManager(false) }} onClose={closeManager} />}
    {noteEditor && <WildcardEditor {...noteEditor} onSave={wildcards.save} onClose={closeNote} />}
    {wildcardManager && <WildcardManager snapshot={wildcardManager} onSave={wildcards.save} onClose={closeWildcards} />}
  </section>
    {rankingTarget && createPortal(<div onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onCloseRanking?.()}}} className="cross-asset-dock heatmap-ranking-panel" style={{'--heat-fields':preferences.fields.length} as import('react').CSSProperties}>
      <div className="heatmap-toolbar">{periodControls}<button type="button" onClick={todayAction}>Today</button>{dateControl}{fieldControls}
        <button type="button" onClick={()=>setManager(true)}>Instruments · {ids.length}</button><button type="button" onClick={()=>setAttempt(n=>n+1)}>Refresh</button>{copyOptions}</div>
      {eventControls}{!eventMode && !data && <p role="status">Loading broker daily history…</p>}{error && <p role="alert" className="heatmap-message">{error}</p>}{saveError && <p role="alert" className="heatmap-message">{saveError}</p>}
      {copied?.key===copyKey && <small role="status">{copied.message}</small>}
      {eventMode && !intraday.data && <p role="status">Loading intraday history…</p>}
      {eventMode && eventWindow.anchor>clock && <p role="status">Waiting for the anchor time before calculating returns.</p>}
      {rankingView}
      {manager && <HeatmapSymbols catalog={catalog} broker={broker} preferences={preferences} rows={ids} onSave={next=>{save(next);setManager(false)}} onClose={closeManager}/>}
    </div>,rankingTarget)}
  </>
})
