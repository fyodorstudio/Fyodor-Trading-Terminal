import { createPortal } from 'react-dom'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { chartOffsetAt, brokerClockProfile } from '../appearance/time-display/chart-clock'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { HeatmapTimeline } from './HeatmapTimeline'
import { HeatmapSymbols } from './HeatmapSymbols'
import { createHeatmapRowBuilder, heatmapDate, heatmapDefaults, heatmapPeriods, heatmapRequests, orderHeatmapGroups, weekStart, type HeatmapInstrument } from './heatmap-model'
import { HeatmapRanking } from './HeatmapRanking'
import { heatmapColumnSelected, heatmapColumnSelection, selectedHeatmapRows, toggleHeatmapCell, type HeatmapSelection } from './heatmap-selection'
import { readHeatmapPreferences, saveHeatmapPreferences, type HeatmapPreferences } from './heatmap-preferences'
import { useHeatmapHistory } from './useHeatmapHistory'
import { heatmapChangesText, heatmapDetailsText, heatmapResearchPrompt, heatmapRankingText } from './heatmap-export'
import { useWildcards } from '../wildcards/useWildcards'
import { wildcardHeatmapDay } from '../wildcards/wildcard-model'
import { wildcardHeatmapRows } from './wildcards-model'
import { HeatmapFields, HeatmapCopyOptions } from './HeatmapOptions'
import { EventWindowControls } from './EventWindowControls'
import { eventRows, eventPeriods, eventChangesText, jakartaTime, type EventWindow } from './event-window'
import { useIntradayHistory } from './useIntradayHistory'
import './heatmap.css'

const tapeMemory = new Map<string, { left: number; top: number }>()
const sessions = new Map<string, { date: string; pinned: boolean; month: string }>()

// Quote ticks do not invalidate the history, basket calculations or timeline.
export function HeatmapDock({ symbols, broker, generation, active = true, connected = true, dockActive = active, rankingTarget = null, onCloseRanking, onOpenNews }: { symbols: SymbolQuote[]; broker: string | null; generation: number; active?: boolean; connected?: boolean; dockActive?: boolean; rankingTarget?: HTMLElement | null; onCloseRanking?: () => void; onOpenNews?: (date: string) => void }) {
  const catalog = JSON.stringify(symbols.map(s => ({ symbol: s.symbol, description: s.description })))
  return <HeatmapContent key={`${broker}:${generation}`} catalogJson={catalog} broker={broker} generation={generation} active={active} connected={connected} dockActive={dockActive} rankingTarget={rankingTarget} onCloseRanking={onCloseRanking} onOpenNews={onOpenNews} />
}

const HeatmapContent = memo(function HeatmapContent({ catalogJson, broker, generation, active, connected, dockActive, rankingTarget, onCloseRanking, onOpenNews }: { catalogJson: string; broker: string | null; generation: number; active: boolean; connected: boolean; dockActive: boolean; rankingTarget: HTMLElement | null; onCloseRanking?: () => void; onOpenNews?: (date: string) => void }) {
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
  const [view, setView] = useState(() => sessions.get(`${broker}:${generation}`) ?? { date: brokerToday(), month: brokerToday().slice(0, 7), pinned: false })
  const year = Number(view.month.slice(0, 4)), month = Number(view.month.slice(5, 7))
  // Wildcard actions need the latest date without invalidating the cached grid
  // every time hover changes the active ranking period.
  const viewDate = useRef(view.date)
  useLayoutEffect(() => { viewDate.current = view.date }, [view.date])
  useEffect(() => {
    sessions.set(`${broker}:${generation}`, view)
    while (sessions.size > 8) sessions.delete(sessions.keys().next().value!)
  }, [view, broker, generation])
  const [manager, setManager] = useState(false), [saveError, setSaveError] = useState<string | null>(null)
  const wildcards = useWildcards()
  const { openNew, openDay, snapshot } = wildcards
  const wildcardRows = useMemo(() => wildcardHeatmapRows(snapshot?.items ?? [], { brokerId: broker, brokerOffsetSeconds: 0 }), [snapshot?.items, broker])
  const [copied, setCopied] = useState<{ key: string; message: string } | null>(null)
  const [selection, setSelection] = useState<HeatmapSelection | null>(null)
  const copyScope = eventMode ? `event:${eventWindow.from}:${eventWindow.through}:${eventWindow.anchor}:${eventWindow.minutes}` : `${view.month}:${preferences.mode}`
  if (selection && selection.scope !== copyScope) setSelection(null)
  const currentSelection = selection?.scope === copyScope ? selection : null
  const copyRange = currentSelection?.kind === 'columns' ? currentSelection : null
  if (!active && manager) setManager(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const toggleGroup = useCallback((group: string) => setCollapsed(old => old.includes(group) ? old.filter(g => g !== group) : [...old, group]), [])
  const [buildRows] = useState(createHeatmapRowBuilder)
  const [attempt, setAttempt] = useState(0), [focusRequest, setFocusRequest] = useState(0), [rankGroup, setRankGroup] = useState('All')
  const [rankingVisible, setRankingVisible] = useState(true), [help, setHelp] = useState(false)
  const ids = useMemo(() => preferences.rows ?? heatmapDefaults(catalog, broker), [preferences.rows, catalog, broker])
  if (currentSelection?.kind === 'cells' && currentSelection.cells.some(cell => !ids.includes(cell.rowId))) {
    const cells = currentSelection.cells.filter(cell => ids.includes(cell.rowId))
    setSelection(cells.length ? { ...currentSelection, cells } : null)
  }
  const names = useMemo(() => heatmapRequests(ids, catalog).join('\0'), [ids, catalog])
  const { data, error: dailyError } = useHeatmapHistory(broker, generation, names, year, attempt, connected)
  const today = data?.today ?? brokerToday(), maxMonth = today.slice(0, 7)
  const intraday = useIntradayHistory(broker, generation, names, eventWindow, attempt, eventMode && active && connected)
  const error = eventMode ? (!connected ? 'Broker disconnected. Intraday readings may be stale.' : intraday.error) : dailyError
  const eventClock = eventMode ? clock : 0
  const periods = useMemo(() => eventMode ? eventPeriods(eventWindow, eventClock) : heatmapPeriods(year, preferences.mode, today, month), [year, month, preferences.mode, today, eventMode, eventWindow, eventClock])
  const rows = useMemo(() => active ? eventMode ? eventRows(ids, catalog, broker, intraday.data, eventWindow) : buildRows(ids, catalog, broker, data, preferences.mode) : [], [active, buildRows, ids, catalog, broker, data, preferences.mode, eventMode, intraday.data, eventWindow])
  const selected = eventMode ? eventSelected : preferences.mode === 'weekly' ? weekStart(view.date) : view.date
  const copyFrom = copyRange?.from ?? selected, copyThrough = copyRange?.to ?? selected
  const copyDays = useMemo(() => periods.filter(period => !period.future && (currentSelection?.kind === 'cells'
    ? currentSelection.cells.some(cell => cell.day === period.day) : copyRange ? heatmapColumnSelected(copyRange, period.day) : period.day >= copyFrom && period.day <= copyThrough)).map(period => period.day), [periods, copyFrom, copyThrough, currentSelection, copyRange])
  const copyKey = `${copyScope}:${copyDays.join(',')}:${JSON.stringify(currentSelection)}:${preferences.fields}:${preferences.copyFields}:${preferences.matchFields}:${preferences.copyRows}:${preferences.copyFormat}:${preferences.rank}:${preferences.rankingView}:${rankGroup}`
  const exportRows = useMemo(() => currentSelection ? selectedHeatmapRows(rows, currentSelection)
    : preferences.copyRows === null ? rows : rows.filter(row => preferences.copyRows!.includes(row.id)), [rows, preferences.copyRows, currentSelection])
  const exportFields = preferences.matchFields ? preferences.fields : preferences.copyFields
  const exportDays = eventMode && !currentSelection ? periods.filter(period => !period.future && (preferences.copyFormat === 'summary' ? period.day === 'window' : period.day !== 'window')).map(period => period.day) : copyDays
  const canCopy = exportRows.some(row => exportDays.some(day => row.points.get(day)?.value != null))
  const selectedCount = currentSelection?.kind === 'cells' ? currentSelection.cells.length : copyRange ? copyDays.length * rows.length : 0
  const groups = useMemo(() => orderHeatmapGroups(rows.map(r => r.group), preferences.groupOrder), [rows, preferences.groupOrder])
  const effectiveGroup = groups.includes(rankGroup) ? rankGroup : 'All'
  const ranking = useMemo(() => rows.filter(r => effectiveGroup === 'All' || r.group === effectiveGroup).map(row => ({ row, point: row.points.get(selected) }))
    .sort((a, b) => {
      const metric = (entry: typeof a) => preferences.rank === 'unusual' ? Math.abs(entry.point?.relative ?? NaN)
        : preferences.rank === 'largest' ? Math.abs(entry.point?.value ?? NaN) : entry.point?.value ?? NaN
      const left = metric(a), right = metric(b)
      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0
      if (!Number.isFinite(right)) return -1
      return (preferences.rank === 'lowest' ? left - right : right - left) || a.row.label.localeCompare(b.row.label)
    }), [rows, effectiveGroup, selected, preferences.rank])
  const changeView = useCallback((date: string, pinned: boolean, focus = false) => {
    setView(old => {
      const month = focus ? date.slice(0, 7) : old.month
      return old.date === date && old.pinned === pinned && old.month === month ? old : { date, pinned, month }
    })
    if (focus) setFocusRequest(n => n + 1)
  }, [])
  const hover = useCallback((day: string) => { if (eventMode || currentSelection) return; if (!view.pinned) changeView(day, false) }, [view.pinned, changeView, eventMode, currentSelection])
  const pin = useCallback((day: string, extend = false) => {
    setSelection(heatmapColumnSelection(copyScope, day, extend ? currentSelection?.anchor ?? day : day, eventMode ? periods : undefined))
    if (eventMode) setEventSelected(day)
    else changeView(day, true)
  }, [changeView, currentSelection, copyScope, eventMode, periods])
  const selectCell = useCallback((rowId: string, day: string, extend: boolean, toggle: boolean) => {
    if (toggle) setSelection(toggleHeatmapCell(currentSelection, { rowId, day }, copyScope, rows, periods))
    else if (extend) setSelection(heatmapColumnSelection(copyScope, day, currentSelection?.anchor ?? day, eventMode ? periods : undefined))
    else setSelection({ kind: 'cells', scope: copyScope, anchor: day, cells: [{ rowId, day }] })
    if (eventMode) setEventSelected(day)
    else changeView(day, true)
  }, [currentSelection, copyScope, rows, periods, eventMode, changeView])
  const clearSelection = useCallback(() => setSelection(null), [])
  const closeManager = useCallback(() => setManager(false), [])
  const addWildcard = useCallback(() => openNew(undefined, eventMode ? heatmapDate(eventWindow.from) : viewDate.current), [openNew, eventMode, eventWindow.from])
  const editWildcard = useCallback((_rowId: string, day: string) => {
    const end = preferences.mode === 'weekly' ? heatmapDate(Date.parse(day) + 6 * 86400_000) : day
    const items = (snapshot?.items ?? []).filter(entry => {
      const date = wildcardHeatmapDay(entry, { brokerId: broker, brokerOffsetSeconds: 0 })
      return !entry.archived && date !== null && date >= day && date <= end
    })
    openDay(day, items)
  }, [preferences.mode, snapshot?.items, openDay, broker])
  const manageWildcards = useCallback(() => openDay(viewDate.current, snapshot?.items.filter(entry => !entry.archived) ?? []), [openDay, snapshot?.items])
  async function copyDetails(kind: 'details' | 'research') {
    try {
      const copiedAt = Date.now()
      const readings = eventMode ? eventChangesText(exportRows, eventWindow, exportFields, preferences.copyFormat, preferences.groupOrder, intraday.data?.observed_at ?? clock/1000, currentSelection ? copyDays : undefined) : heatmapChangesText(exportRows, copyDays, preferences.mode, preferences.groupOrder, today, exportFields)
      const stale = !connected || !!error || exportRows.some(row => exportDays.some(day => periods.find(p => p.day === day)?.partial && row.checkedAt != null && clock / 1000 - row.checkedAt > 90))
      const changes = readings && `${stale ? 'Some readings may be stale; confirm current prices.\n\n' : ''}${readings}`
      await navigator.clipboard.writeText(kind === 'research' ? heatmapResearchPrompt(changes, preferences.mode, broker, copiedAt, eventMode) : heatmapDetailsText(changes, copiedAt))
      setCopied({ key: copyKey, message: kind === 'research' ? 'Research prompt copied. Paste it into your agent chat.' : 'Changes copied.' })
    }
    catch { setCopied({ key: copyKey, message: 'Clipboard unavailable. Try copying again.' }) }
  }
  const save = useCallback((next: HeatmapPreferences) => {
    saveHeatmapPreferences(broker ?? '', next)
    setPreferences(next); setSaveError(null)
  }, [broker])
  const option = useCallback((next: HeatmapPreferences) => {
    try { save(next) } catch { setSaveError('Could not save heatmap preferences. Your previous settings are preserved.') }
  }, [save])
  const chosenPeriod = periods.find(p => p.day === selected)
  const firstCopyDay = periods[0]?.day ?? `${view.month}-01`
  const lastCopyDay = periods.findLast(period => !period.future)?.day ?? firstCopyDay
  function changeCopyRange(field: 'from' | 'to', value: string) {
    if (!copyRange || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || heatmapDate(Date.parse(value)) !== value) return
    const day = preferences.mode === 'weekly' ? weekStart(value) : value
    if (day >= firstCopyDay && day <= lastCopyDay) setSelection({ ...copyRange, [field]: day })
  }
  const available = ranking.filter(r => r.point?.value != null)
  const requested = names ? names.split('\0') : []
  const missing = data ? requested.filter(s => !data.symbols[s]).length : requested.length
  const unavailable = data ? requested.filter(s => data.symbols[s] && data.symbols[s].availability !== 'available').length : 0
  const newsAction = onOpenNews && <button type="button" aria-label="Open news for selected heatmap date" disabled={eventMode || preferences.mode !== 'daily' || (!!broker && !brokerClockProfile(broker))} onClick={() => onOpenNews(view.date)}>News for this date</button>
  const rankingView = <HeatmapRanking entries={ranking} fields={preferences.fields} preferences={preferences} onChange={option}
    heading={`${eventMode ? selected === 'window' ? 'Window summary' : jakartaTime(Date.parse(selected)) : selected}${!eventMode && preferences.mode === 'weekly' ? ' · Week' : ''}`}
    status={`${eventMode ? 'Common anchor · ' + jakartaTime(eventWindow.anchor) : view.pinned ? 'Pinned' : 'Following hover'}${chosenPeriod?.partial ? ' · In progress' : ''}`}
    groups={groups} group={effectiveGroup} onGroup={setRankGroup} eventMode={eventMode} actions={<>
        <button type="button" disabled={!available.length} onClick={async () => {
          try {
            const shown = ranking.map(entry => entry.row)
            const text = heatmapRankingText(shown, selected, preferences.rankingView === 'bars' ? ['C'] : preferences.fields, eventMode
              ? `Event-window ranking · ${selected==='window' ? jakartaTime(eventWindow.from)+' → '+jakartaTime(eventWindow.through) : jakartaTime(Date.parse(selected))} · Anchor ${jakartaTime(eventWindow.anchor)} · ${eventWindow.minutes}-minute candles${chosenPeriod?.partial?' · In progress':''}`
              : `${selected} · ${preferences.mode}${chosenPeriod?.partial?' · In progress':''} · ${preferences.rank}`, preferences.rank === 'unusual')
            await navigator.clipboard.writeText(text); setCopied({key:copyKey,message:'Displayed ranking copied.'})
          } catch { setCopied({key:copyKey,message:'Clipboard unavailable. Try copying again.'}) }
        }}>Copy displayed ranking</button>
        {newsAction}
      </>} />
  const todayAction = () => {
    clearSelection()
    if(eventMode){const end=Math.floor(Date.now()/60000)*60000;setEventWindow({from:end-3600000,through:end,anchor:end-3600000,minutes:eventWindow.minutes});setEventSelected('window')}
    else changeView(today,false,true)
  }
  const fieldControls = <HeatmapFields value={preferences.fields} onChange={fields => option({...preferences,fields})} />
  const copyOptions = <HeatmapCopyOptions preferences={preferences} rows={rows} onChange={option} eventMode={eventMode} selectionActive={!!currentSelection} />
  const periodControls = <div className="heatmap-segmented" role="group" aria-label="Heatmap period">
    <button type="button" aria-pressed={!eventMode && preferences.mode==='daily'} onClick={()=>{setEventMode(false);option({...preferences,mode:'daily'})}}>Daily</button>
    <button type="button" aria-pressed={!eventMode && preferences.mode==='weekly'} onClick={()=>{setEventMode(false);option({...preferences,mode:'weekly'})}}>Weekly</button>
    <button type="button" aria-pressed={eventMode} onClick={()=>{setEventMode(true);if(preferences.rank==='unusual')option({...preferences,rank:'largest'})}}>Event window</button>
  </div>
  const eventControls = eventMode && <EventWindowControls key={eventWindow.from+':'+eventWindow.through+':'+eventWindow.anchor+':'+eventWindow.minutes} value={eventWindow} onApply={next=>{setEventWindow(next);setEventSelected('window');setFocusRequest(n=>n+1)}} />
  const dateControl = !eventMode && <label>Date <input aria-label="Heatmap date" type="date" min="2015-01-01" max={today} value={view.date} onChange={e=>{
    const day=e.target.value;if(day>='2015-01-01'&&day<=today&&Number.isFinite(Date.parse(day))){clearSelection();changeView(day,true,true)}
  }}/></label>
  function changeMonth(next: string) {
    if (!/^\d{4}-\d{2}$/.test(next) || Number(next.slice(5)) < 1 || Number(next.slice(5)) > 12 || next < '2015-01' || next > maxMonth) return
    const last = heatmapDate(Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5, 7)), 0))
    const date = `${next}-${String(Math.min(Number(view.date.slice(8)), Number(last.slice(8)))).padStart(2, '0')}`
    clearSelection()
    changeView(date > today ? today : date, true, true)
  }
  const monthControls = !eventMode && <div className="heatmap-month-controls" role="group" aria-label="Displayed heatmap month">
    <button type="button" aria-label="Previous heatmap month" disabled={view.month <= '2015-01'} onClick={() => changeMonth(heatmapDate(Date.UTC(year, month - 2, 1)).slice(0, 7))}>‹</button>
    <input type="month" aria-label="Heatmap month" min="2015-01" max={maxMonth} value={view.month} onChange={e => changeMonth(e.target.value)} />
    <button type="button" aria-label="Next heatmap month" disabled={view.month >= maxMonth} onClick={() => changeMonth(heatmapDate(Date.UTC(year, month, 1)).slice(0, 7))}>›</button>
  </div>
  const exportControls = <div className="heatmap-toolbar-group heatmap-export-controls" role="group" aria-label="Selection and export">
    <span className="heatmap-selection-count" role="status">{currentSelection ? `${selectedCount} ${selectedCount === 1 ? 'cell' : 'cells'} selected` : 'Active period'}</span>
    {currentSelection && <button type="button" onClick={clearSelection} title="Clear selection (Escape)">Clear</button>}
    <button type="button" disabled={!canCopy} onClick={() => void copyDetails('details')}>Copy Details Only</button>
    <button className="heatmap-primary" type="button" disabled={!canCopy} onClick={() => void copyDetails('research')}>Copy Research Prompt</button>
    {copyOptions}
    <button type="button" disabled={eventMode} aria-pressed={!!copyRange} title="Set From/Through, or click a date then Shift-click another to select a range" onClick={() => setSelection(copyRange ? null : heatmapColumnSelection(copyScope, selected))}>Copy range</button>
  </div>
  const rangeControls = !eventMode && copyRange && <div className="heatmap-copy-range" role="group" aria-label="Dates to copy">
    <label>From <input type="date" aria-label="Copy from date" min={firstCopyDay} max={lastCopyDay} value={copyRange.from} onChange={event => changeCopyRange('from', event.target.value)} /></label>
    <label>Through <input type="date" aria-label="Copy through date" min={firstCopyDay} max={lastCopyDay} value={copyRange.to} onChange={event => changeCopyRange('to', event.target.value)} /></label>
    {copyRange.from > copyRange.to ? <span role="alert">From must be on or before Through.</span>
      : <small>{copyDays.length} {preferences.mode === 'weekly' ? 'weeks' : 'dates'} · {view.month} timeline · Days without readings are omitted.</small>}
    <button type="button" onClick={clearSelection}>Clear range</button>
  </div>
  if (!active) return null
  return <><section className="heatmap-dock" hidden={!dockActive} style={{"--heat-fields":preferences.fields.length} as import('react').CSSProperties} aria-label="Heatmap"
    onKeyDown={e => { if (e.key === 'Escape' && currentSelection && !(e.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"]')) { e.stopPropagation(); clearSelection() } }}>
    <div className="heatmap-toolbar">
      <strong>Heatmap</strong>
      <div className="heatmap-toolbar-group" role="group" aria-label="Period and navigation">{periodControls}
      <button type="button" onClick={todayAction}>Today</button>
      {dateControl}
      {monthControls}
      {!eventMode && view.pinned && <button type="button" onClick={() => { clearSelection(); changeView(view.date, false) }}>Unpin date</button>}
      </div>
      <div className="heatmap-toolbar-group" role="group" aria-label="Heatmap display">{fieldControls}
      <label>Shading <select aria-label="Heatmap shading" disabled={eventMode} value={preferences.shade} onChange={e => option({ ...preferences, shade: e.target.value as HeatmapPreferences['shade'] })}>
        <option value="return">Return %</option><option value="relative">Relative to usual volatility</option></select></label>
      <button type="button" onClick={() => setManager(true)}>Instruments · {ids.length}</button>
      <button type="button" aria-pressed={rankingVisible} onClick={() => setRankingVisible(v => !v)}>Ranking</button>
      </div>
      {exportControls}
      <div className="heatmap-toolbar-group heatmap-utility-controls">
      <button type="button" onClick={() => setAttempt(n => n + 1)}>Refresh</button>
      <details className="heatmap-utilities"><summary>More</summary><div>
      {newsAction}
      <button type="button" disabled={!wildcards.snapshot} onClick={manageWildcards}>Manage Wildcards</button>
      <button type="button" disabled={!broker || !wildcards.snapshot} onClick={wildcards.reload}>Reload Wildcards</button>
      <button type="button" aria-expanded={help} onClick={() => setHelp(v => !v)}>Method</button>
      </div></details></div>
    </div>
    {eventControls}
    {rangeControls}
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
        : `${rows.length} rows · ${unavailable ? `${unavailable} instruments unavailable · ` : ''}Drag to browse · Click a cell · Ctrl-click to toggle · Shift-click for dates`}
      {data && <span title="Time of the most recent history response, not the last market tick">Checked {formatAppTimestamp(data.observed_at * 1000, preference, 'time')}</span>}</>}
    </div>
    <div className="heatmap-body">
      {dockActive && <HeatmapTimeline fields={preferences.fields} showWildcards={!eventMode} rows={rows} periods={periods} selected={selected} shade={eventMode ? 'return' : preferences.shade} focusRequest={focusRequest}
        memory={tapeMemory} memoryKey={`${broker}:${generation}:${copyScope}:${preferences.fields}`} observedAt={clock / 1000} onHover={hover} onPin={pin} hoverEnabled={!eventMode && !view.pinned && !currentSelection}
        groupOrder={preferences.groupOrder} collapsed={collapsed} onToggleGroup={toggleGroup}
        selection={currentSelection} onSelectCell={selectCell}
        wildcards={wildcardRows} wildcardsReady={!!wildcards.snapshot}
        onAddWildcard={addWildcard} onEditWildcard={editWildcard} onManageWildcards={manageWildcards} />}
      {rankingVisible && !rankingTarget && rankingView}
    </div>
    {dockActive && !rankingTarget && manager && <HeatmapSymbols catalog={catalog} broker={broker} preferences={preferences} rows={ids}
      onSave={next => { save(next); setManager(false) }} onClose={closeManager} />}
  </section>
    {rankingTarget && createPortal(<div onKeyDown={e=>{if(e.key==='Escape' && !(e.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"]')){e.stopPropagation();if(currentSelection)clearSelection();else onCloseRanking?.()}}} className="heatmap-dock heatmap-ranking-panel" style={{'--heat-fields':preferences.fields.length} as import('react').CSSProperties}>
      <div className="heatmap-toolbar">
        <div className="heatmap-toolbar-group">{periodControls}<button type="button" onClick={todayAction}>Today</button>{dateControl}{monthControls}</div>
        <div className="heatmap-toolbar-group">{preferences.rankingView === 'details' && fieldControls}<button type="button" onClick={()=>setManager(true)}>Instruments · {ids.length}</button><button type="button" onClick={()=>setAttempt(n=>n+1)}>Refresh</button></div>
        <details className="heatmap-panel-export"><summary>Research &amp; export</summary>{exportControls}{rangeControls}</details>
      </div>
      {eventControls}{!eventMode && !data && <p role="status">Loading broker daily history…</p>}{error && <p role="alert" className="heatmap-message">{error}</p>}{saveError && <p role="alert" className="heatmap-message">{saveError}</p>}
      {copied?.key===copyKey && <small role="status">{copied.message}</small>}
      {eventMode && !intraday.data && <p role="status">Loading intraday history…</p>}
      {eventMode && eventWindow.anchor>clock && <p role="status">Waiting for the anchor time before calculating returns.</p>}
      {rankingView}
      {manager && <HeatmapSymbols catalog={catalog} broker={broker} preferences={preferences} rows={ids} onSave={next=>{save(next);setManager(false)}} onClose={closeManager}/>}
    </div>,rankingTarget)}
  </>
})
