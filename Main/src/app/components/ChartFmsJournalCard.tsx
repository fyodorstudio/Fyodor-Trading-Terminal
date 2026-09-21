import { BookOpen, ChevronDown } from "lucide-react";
import { Fragment, memo, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { FmsReviewNoteRow } from "@/app/features/fms-dock/FmsReviewNoteRow";
import { useFmsReviewNotes } from "@/app/features/fms-dock/useFmsReviewNotes";
import {
  fetchMacroSignalChartSignals,
  type FmsReviewNote,
  type FmsReviewNoteInput,
  type FmsReviewNoteLabel,
} from "@/app/lib/bridge";
import {
  formatChartFeedTime,
  toChartUtcMetadataViewerTimestampSeconds,
  toChartViewerTimestampSeconds,
  type ChartDisplayTimeMode,
} from "@/app/lib/chartView";
import { getDisplayTimezoneDateParts, getDisplayTimezoneShortLabel } from "@/app/lib/timezoneDisplay";
import { FMS_BASELINE_DISPLAY_VERSION, fmsReviewRecordKey, fmsVersionAtEvent, projectFmsMarketVersion, type FmsDisplayVersion } from "@/app/lib/fmsDisplayVersion";
import type { MacroSignalChartSignal, MacroSignalChartSignalResponse } from "@/app/types";

type JournalSource = "live" | "recovered" | "no_trade" | "historical";

export type JournalRow = {
  key: string;
  market: string;
  label: string;
  patternId: string;
  eventTime: number;
  direction: "long" | "short" | null;
  source: JournalSource;
  state: string;
  resultR: number | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  exitTime: number | null;
  signalTag: string | null;
  demoNet: number | null;
  demoNetR: number | null;
  demoStatus: "completed" | "open_or_partial" | null;
  signal: MacroSignalChartSignal | null;
  registeredVersion: FmsDisplayVersion;
};

type JournalScope = "this_week" | "previous_week" | "month" | "year" | "all" | "broker";
const replayJournalCache = new Map<string, JournalRow[]>();

type JournalDateParts = ReturnType<typeof getDisplayTimezoneDateParts>;

function dateOrdinal(parts: JournalDateParts): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

function feedDateParts(time: number, mode: ChartDisplayTimeMode, sourceTimeOffsetSeconds: number): JournalDateParts {
  return getDisplayTimezoneDateParts(toChartViewerTimestampSeconds(time, mode, sourceTimeOffsetSeconds), mode);
}

function metadataDateParts(time: number, mode: ChartDisplayTimeMode, sourceTimeOffsetSeconds: number): JournalDateParts {
  return getDisplayTimezoneDateParts(toChartUtcMetadataViewerTimestampSeconds(time, mode, sourceTimeOffsetSeconds), mode);
}

function weekStartOrdinal(parts: JournalDateParts): number {
  return dateOrdinal(parts) - ((parts.weekday + 6) % 7);
}

function dateFromOrdinal(ordinal: number): Date {
  return new Date(ordinal * 86_400_000);
}

function rowResolvedTime(row: JournalRow): number {
  return row.exitTime ?? row.eventTime;
}

function aggregate(rows: JournalRow[], source: JournalSource) {
  const resolved = rows.filter((row) => row.source === source && row.resultR != null);
  const total = resolved.reduce((sum, row) => sum + Number(row.resultR), 0);
  return { count: resolved.length, total, average: resolved.length ? total / resolved.length : null };
}

const journalDayLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function signedR(value: number | null): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function money(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

function balance(value: number | null | undefined, currency: string | null | undefined): string {
  return value == null ? "—" : `${currency || "$"} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function price(value: number | null): string {
  return value == null ? "—" : value.toFixed(5);
}

function stateLabel(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return "TP reached";
  if (signal.outcomeStatus === "stop_hit") return "SL reached";
  if (signal.outcomeStatus === "expired") return "Expired";
  if (signal.outcomeStatus === "pending") return signal.entry == null ? signal.prospectiveCapture?.eligible ? "Waiting for entry" : "Entry unavailable" : "Running";
  if (signal.outcomeStatus === "ambiguous") return "Ambiguous";
  return signal.outcomeReason ?? "Unavailable";
}

function signalRow(
  market: MacroSignalChartSignalResponse,
  signal: MacroSignalChartSignal,
  source: JournalSource,
  demo: { netAccountResult?: number | null; netR?: number | null; status?: "completed" | "open_or_partial" } | null = null,
): JournalRow {
  const pattern = market.patterns.find((candidate) => candidate.id === signal.patternId);
  return {
    key: fmsReviewRecordKey(market.symbol, signal.patternId, signal.eventTime, signal.registeredVersion ?? FMS_BASELINE_DISPLAY_VERSION),
    market: market.symbol,
    label: pattern?.label ?? signal.label,
    patternId: signal.patternId,
    eventTime: signal.eventTime,
    direction: signal.direction,
    source,
    state: stateLabel(signal),
    resultR: signal.resultR ?? null,
    entry: signal.entry ?? null,
    stop: signal.initialStop ?? signal.stop ?? null,
    target: signal.target ?? null,
    exitTime: signal.exitTime ?? null,
    signalTag: signal.demoTag ?? null,
    demoNet: demo?.netAccountResult ?? null,
    demoNetR: demo?.netR ?? null,
    demoStatus: demo?.status ?? null,
    signal,
    registeredVersion: signal.registeredVersion ?? FMS_BASELINE_DISPLAY_VERSION,
  };
}

function sortJournalRows(rows: JournalRow[]): JournalRow[] {
  return [...rows].sort((left, right) => rowResolvedTime(right) - rowResolvedTime(left) || left.key.localeCompare(right.key));
}

export function buildFmsJournalRows(data: ChartMacroBiasRealtimeCardData, displayVersion: FmsDisplayVersion = FMS_BASELINE_DISPLAY_VERSION): JournalRow[] {
  const sourceMarkets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const markets = sourceMarkets.map((market) => projectFmsMarketVersion(market, displayVersion));
  const demoTrades = data.globalResponse?.forwardValidation?.demoExecution?.trades ?? [];
  const demoBySignal = new Map(demoTrades.map((trade) => [`${trade.market}:${trade.patternId}:${trade.eventTime}`, trade]));
  const rows = new Map<string, JournalRow>();
  for (const market of markets) {
    const patterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
    for (const signal of [...market.signals, ...(market.recoveredSignals ?? [])]) {
      const activation = patterns.get(signal.patternId)?.activatedAt ?? market.modelActivatedAt;
      if (signal.eventTime < activation || signal.outcomeStatus === "pending") continue;
      const key = `${market.symbol}:${signal.patternId}:${signal.eventTime}`;
      const source = signal.observationMode === "live_captured" ? "live" : "recovered";
      rows.set(key, signalRow(market, signal, source, demoBySignal.get(key) ?? null));
    }
  }
  for (const decision of data.globalResponse?.liveDecisions ?? []) {
    if (decision.status !== "no_trade") continue;
    const market = markets.find((candidate) => candidate.symbol === decision.market);
    const pattern = market?.patterns.find((candidate) => candidate.id === decision.patternId);
    const activation = pattern?.activatedAt ?? market?.modelActivatedAt ?? data.response.modelActivatedAt;
    if (decision.eventTime < activation) continue;
    const sourceMarket = sourceMarkets.find((candidate) => candidate.symbol === decision.market);
    const sourcePattern = sourceMarket?.patterns.find((candidate) => candidate.id === decision.patternId);
    if (!sourcePattern || fmsVersionAtEvent(sourcePattern, decision.eventTime) !== displayVersion) continue;
    const key = fmsReviewRecordKey(decision.market, decision.patternId, decision.eventTime, displayVersion);
    if (rows.has(key)) continue;
    rows.set(key, {
      key,
      market: decision.market,
      label: decision.assessment.label,
      patternId: decision.patternId,
      eventTime: decision.eventTime,
      direction: null,
      source: "no_trade",
      state: "No trade",
      resultR: null,
      entry: null,
      stop: null,
      target: null,
      exitTime: null,
      signalTag: null,
      demoNet: null,
      demoNetR: null,
      demoStatus: null,
      signal: null,
      registeredVersion: displayVersion,
    });
  }
  return sortJournalRows([...rows.values()]);
}

export function buildFmsPreRegistrationJournalRows(response: MacroSignalChartSignalResponse): JournalRow[] {
  if (!response.supported || response.mode !== "research_replay") return [];
  const patterns = new Map(response.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => [pattern.id, pattern]));
  return sortJournalRows(response.signals.flatMap((signal) => {
    const pattern = patterns.get(signal.patternId);
    if (!pattern) return [];
    const activation = pattern.activatedAt ?? response.modelActivatedAt;
    if (signal.eventTime >= activation || signal.outcomeStatus === "pending") return [];
    return [signalRow(response, signal, "historical")];
  }));
}

function usePreRegistrationJournalRows(data: ChartMacroBiasRealtimeCardData, displayVersion: FmsDisplayVersion) {
  const markets = useMemo(
    () => (data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response])
      .map((market) => ({ symbol: market.symbol.toUpperCase(), modelHash: market.modelHash }))
      .sort((left, right) => left.symbol.localeCompare(right.symbol)),
    [data.globalResponse?.markets, data.response],
  );
  const marketPlanKey = `${displayVersion}|${markets.map((market) => `${market.symbol}:${market.modelHash}`).join("|")}`;
  const cacheKeyFor = (market: { symbol: string; modelHash: string }) => `${market.modelHash}:${displayVersion}:${market.symbol}`;
  const [rows, setRows] = useState<JournalRow[]>(() => sortJournalRows(markets.flatMap((market) => replayJournalCache.get(cacheKeyFor(market)) ?? [])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setRows(sortJournalRows(markets.flatMap((market) => replayJournalCache.get(cacheKeyFor(market)) ?? [])));
      const errors: string[] = [];
      for (const market of markets) {
        const cacheKey = cacheKeyFor(market);
        if (!replayJournalCache.has(cacheKey)) {
          try {
            const response = await fetchMacroSignalChartSignals({ symbol: market.symbol, timeframe: "H4", mode: "research_replay", compact: true, registeredVersion: displayVersion });
            replayJournalCache.set(cacheKey, buildFmsPreRegistrationJournalRows(response));
          } catch (reason: unknown) {
            errors.push(`${market.symbol}: ${reason instanceof Error ? reason.message : "replay unavailable"}`);
          }
        }
        if (cancelled) return;
        setRows(sortJournalRows(markets.flatMap((candidate) => replayJournalCache.get(cacheKeyFor(candidate)) ?? [])));
      }
      if (!cancelled) {
        setError(errors.length ? errors.join("; ") : null);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [marketPlanKey]);

  return { rows, loading, error };
}

type JournalGroup = { key: string; label: string; rows: JournalRow[] };
type SaveReviewNote = (input: FmsReviewNoteInput) => Promise<FmsReviewNote>;
type RemoveReviewNote = (recordKey: string) => Promise<void>;

const journalWeekStartLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC", weekday: "short", day: "2-digit", month: "short",
});
const journalWeekEndLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "numeric",
});

export function groupJournalRows(
  rows: JournalRow[],
  grouping: "day" | "week",
  displayTimeMode: ChartDisplayTimeMode = "local",
  sourceTimeOffsetSeconds = 0,
): JournalGroup[] {
  const grouped = new Map<string, { startOrdinal: number; rows: JournalRow[] }>();
  rows.forEach((row) => {
    const timestamp = grouping === "week" ? row.eventTime : rowResolvedTime(row);
    const parts = feedDateParts(timestamp, displayTimeMode, sourceTimeOffsetSeconds);
    const startOrdinal = grouping === "week" ? weekStartOrdinal(parts) : dateOrdinal(parts);
    const key = String(startOrdinal);
    const current = grouped.get(key);
    if (current) current.rows.push(row);
    else grouped.set(key, { startOrdinal, rows: [row] });
  });
  return [...grouped.entries()].map(([key, group]) => ({
    key,
    rows: group.rows,
    label: grouping === "week"
      ? `${journalWeekStartLabel.format(dateFromOrdinal(group.startOrdinal))} – ${journalWeekEndLabel.format(dateFromOrdinal(group.startOrdinal + 4))}`
      : journalDayLabel.format(dateFromOrdinal(group.startOrdinal)),
  }));
}

const JournalRecord = memo(function JournalRecord({
  row,
  savedNote,
  notesLoading,
  saving,
  saveNote,
  removeNote,
  onGoToArrow,
  onGoToEvent,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  row: JournalRow;
  savedNote: FmsReviewNote | null;
  notesLoading: boolean;
  saving: boolean;
  saveNote: SaveReviewNote;
  removeNote: RemoveReviewNote;
  onGoToArrow?: (market: string, signal: MacroSignalChartSignal) => void;
  onGoToEvent?: (market: string, eventTime: number) => void;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [label, setLabel] = useState<FmsReviewNoteLabel>("unlabeled");
  const noteInput = { recordKey: row.key, context: "activity" as const, market: row.market, patternId: row.patternId, eventTime: row.eventTime, signalId: row.signal?.id ?? null };
  const beginNote = () => {
    setDraft(savedNote?.note ?? "");
    setLabel(savedNote?.label ?? "unlabeled");
    setEditing(true);
  };
  const cancelNote = () => {
    setEditing(false);
    setDraft("");
    setLabel("unlabeled");
  };
  const submitNote = (event: FormEvent<HTMLFormElement>, input: Omit<FmsReviewNoteInput, "note">) => {
    event.preventDefault();
    const note = draft.trim();
    if (!note) return;
    void saveNote({ ...input, note }).then(cancelNote).catch(() => undefined);
  };
  const deleteNote = () => {
    if (!window.confirm("Remove this personal audit note?")) return;
    void removeNote(row.key).catch(() => undefined);
  };
  return <Fragment>
    <tr>
      <td><strong>{formatChartFeedTime(row.eventTime, displayTimeMode, sourceTimeOffsetSeconds)}</strong><span>{row.market} · {row.label}</span><small className={`is-${row.source}`}>{row.source === "live" ? "Live captured" : row.source === "recovered" ? "Recovered path" : row.source === "historical" ? "Before registration replay" : "No trade"}</small></td>
      <td><strong>{row.direction ? `${row.direction === "long" ? "Long" : "Short"} ${row.market}` : "No position"}</strong><span>{row.state}</span>{row.signalTag ? <code>{row.signalTag}</code> : null}<span className="fms-journal-row-actions">{row.signal && onGoToArrow ? <button type="button" onClick={() => onGoToArrow(row.market, row.signal!)}>Go to arrow</button> : !row.signal && onGoToEvent ? <button type="button" onClick={() => onGoToEvent(row.market, row.eventTime)}>Go to event</button> : null}<button type="button" disabled={notesLoading} onClick={beginNote}>{savedNote ? "Edit note" : "Add note"}</button></span></td>
      <td><strong>{signedR(row.resultR)}</strong><span>Entry {price(row.entry)}</span><small>SL {price(row.stop)} · TP {price(row.target)}</small></td>
      <td><strong>{row.demoStatus ? money(row.demoNet) : "Not placed"}</strong><span>{row.demoStatus?.replaceAll("_", " ") ?? "No matching tagged MT5 trade"}</span><small>{row.demoNetR == null ? "Actual broker result unavailable" : `${signedR(row.demoNetR)} net`}</small></td>
    </tr>
    <FmsReviewNoteRow input={noteInput} saved={savedNote} editing={editing} draft={draft} label={label} loading={notesLoading} saving={saving} valueColSpan={3} displayTimeMode={displayTimeMode} sourceTimeOffsetSeconds={sourceTimeOffsetSeconds} onDraftChange={setDraft} onLabelChange={setLabel} onEdit={beginNote} onCancel={cancelNote} onSave={submitNote} onRemove={deleteNote} />
  </Fragment>;
});

const JournalDisclosure = memo(function JournalDisclosure({
  group,
  initiallyOpen,
  notesByKey,
  notesLoading,
  noteSavingKey,
  saveNote,
  removeNote,
  onGoToArrow,
  onGoToEvent,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  group: JournalGroup;
  initiallyOpen: boolean;
  notesByKey: Map<string, FmsReviewNote>;
  notesLoading: boolean;
  noteSavingKey: string | null;
  saveNote: SaveReviewNote;
  removeNote: RemoveReviewNote;
  onGoToArrow?: (market: string, signal: MacroSignalChartSignal) => void;
  onGoToEvent?: (market: string, eventTime: number) => void;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const resolved = group.rows.filter((row) => row.resultR != null);
  const totalR = resolved.reduce((sum, row) => sum + Number(row.resultR), 0);
  const demoRows = group.rows.filter((row) => row.demoStatus != null);
  const totalMoney = demoRows.reduce((sum, row) => sum + Number(row.demoNet ?? 0), 0);
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span><strong>{group.label}</strong><small>{group.rows.length} decisions · {resolved.length} resolved</small></span><span><b>{resolved.length ? signedR(totalR) : "Pending"}</b><em>{demoRows.length ? money(totalMoney) : "No demo"}</em><ChevronDown size={13} /></span></summary>
    {open ? <table><thead><tr><th>Time and setup</th><th>Decision</th><th>Model path</th><th>Demo account</th></tr></thead><tbody>{group.rows.map((row) => <JournalRecord key={row.key} row={row} savedNote={notesByKey.get(row.key) ?? null} notesLoading={notesLoading} saving={noteSavingKey === row.key} saveNote={saveNote} removeNote={removeNote} onGoToArrow={onGoToArrow} onGoToEvent={onGoToEvent} displayTimeMode={displayTimeMode} sourceTimeOffsetSeconds={sourceTimeOffsetSeconds} />)}</tbody></table> : null}
  </details>;
});

const JournalGroups = memo(function JournalGroups({
  rows,
  grouping,
  notesByKey,
  notesLoading,
  noteSavingKey,
  saveNote,
  removeNote,
  emptyTitle,
  emptyCopy,
  onGoToArrow,
  onGoToEvent,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  rows: JournalRow[];
  grouping: "day" | "week";
  notesByKey: Map<string, FmsReviewNote>;
  notesLoading: boolean;
  noteSavingKey: string | null;
  saveNote: SaveReviewNote;
  removeNote: RemoveReviewNote;
  emptyTitle: string;
  emptyCopy: string;
  onGoToArrow?: (market: string, signal: MacroSignalChartSignal) => void;
  onGoToEvent?: (market: string, eventTime: number) => void;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const groups = useMemo(
    () => groupJournalRows(rows, grouping, displayTimeMode, sourceTimeOffsetSeconds),
    [displayTimeMode, grouping, rows, sourceTimeOffsetSeconds],
  );
  const [visibleWeekCount, setVisibleWeekCount] = useState(26);
  const visibleGroups = grouping === "week" ? groups.slice(0, visibleWeekCount) : groups;
  const remainingWeeks = groups.length - visibleGroups.length;
  return <div className={`fms-journal-days${grouping === "week" ? " is-weekly" : ""}`}>
    {visibleGroups.length ? visibleGroups.map((group, index) => <JournalDisclosure key={group.key} group={group} initiallyOpen={grouping === "day" && index === 0} notesByKey={notesByKey} notesLoading={notesLoading} noteSavingKey={noteSavingKey} saveNote={saveNote} removeNote={removeNote} onGoToArrow={onGoToArrow} onGoToEvent={onGoToEvent} displayTimeMode={displayTimeMode} sourceTimeOffsetSeconds={sourceTimeOffsetSeconds} />) : <div className="fms-journal-empty"><strong>{emptyTitle}</strong><span>{emptyCopy}</span></div>}
    {remainingWeeks > 0 ? <button type="button" className="fms-journal-load-weeks" onClick={() => setVisibleWeekCount((current) => current + 26)}>Show 26 older weeks · {remainingWeeks} remaining</button> : null}
  </div>;
});

export const ChartFmsJournalCard = memo(function ChartFmsJournalCard({
  data,
  displayVersion = FMS_BASELINE_DISPLAY_VERSION,
  onGoToArrow,
  onGoToEvent,
}: {
  data: ChartMacroBiasRealtimeCardData;
  displayVersion?: FmsDisplayVersion;
  onGoToArrow?: (market: string, signal: MacroSignalChartSignal) => void;
  onGoToEvent?: (market: string, eventTime: number) => void;
}) {
  const [scope, setScope] = useState<JournalScope>("all");
  const allRows = useMemo(() => buildFmsJournalRows(data, displayVersion), [data, displayVersion]);
  const preRegistration = usePreRegistrationJournalRows(data, displayVersion);
  const { notesByKey, loading: notesLoading, savingKey: noteSavingKey, error: notesError, save: saveNote, remove: removeNote } = useFmsReviewNotes();
  const displayTimeMode = data.displayTimeMode ?? "local";
  const sourceTimeOffsetSeconds = data.sourceTimeOffsetSeconds ?? 0;
  const newestTime = Math.max(data.globalResponse?.generatedAt ?? 0, data.response.generatedAt ?? 0, Math.floor(Date.now() / 1_000));
  const currentDateParts = metadataDateParts(newestTime, displayTimeMode, sourceTimeOffsetSeconds);
  const currentWeekStart = weekStartOrdinal(currentDateParts);
  const rows = useMemo(() => allRows.filter((row) => (
    (() => {
      if (scope === "broker") return row.demoStatus != null;
      if (scope === "all") return true;
      const parts = feedDateParts(rowResolvedTime(row), displayTimeMode, sourceTimeOffsetSeconds);
      const ordinal = dateOrdinal(parts);
      if (scope === "this_week") return ordinal >= currentWeekStart && ordinal < currentWeekStart + 7;
      if (scope === "previous_week") return ordinal >= currentWeekStart - 7 && ordinal < currentWeekStart;
      if (scope === "month") return parts.year === currentDateParts.year && parts.month === currentDateParts.month;
      return parts.year === currentDateParts.year;
    })()
  )), [allRows, currentDateParts.month, currentDateParts.year, currentWeekStart, displayTimeMode, scope, sourceTimeOffsetSeconds]);
  const scopeCounts = useMemo(() => ({
    wins: rows.filter((row) => row.state === "TP reached").length,
    losses: rows.filter((row) => row.state === "SL reached").length,
    expired: rows.filter((row) => row.state === "Expired").length,
    ambiguous: rows.filter((row) => row.state === "Ambiguous").length,
    unavailable: rows.filter((row) => row.source !== "no_trade" && row.resultR == null).length,
  }), [rows]);
  const historicalCounts = useMemo(() => ({
    wins: preRegistration.rows.filter((row) => row.state === "TP reached").length,
    losses: preRegistration.rows.filter((row) => row.state === "SL reached").length,
    expired: preRegistration.rows.filter((row) => row.state === "Expired").length,
    ambiguous: preRegistration.rows.filter((row) => row.state === "Ambiguous").length,
  }), [preRegistration.rows]);
  const live = aggregate(rows, "live");
  const recovered = aggregate(rows, "recovered");
  const weekDays = Array.from({ length: 5 }, (_, index) => {
    const ordinal = currentWeekStart - (scope === "previous_week" ? 7 : 0) + index;
    const dayRows = allRows.filter((row) => dateOrdinal(feedDateParts(rowResolvedTime(row), displayTimeMode, sourceTimeOffsetSeconds)) === ordinal);
    return { ordinal, live: aggregate(dayRows, "live"), recovered: aggregate(dayRows, "recovered") };
  });
  const demo = data.globalResponse?.forwardValidation?.demoExecution ?? null;
  const portfolio = data.globalResponse?.forwardValidation?.portfolioReplay ?? null;
  const capture = demo?.captureStatus;
  const groupProps = {
    notesByKey,
    notesLoading,
    noteSavingKey,
    saveNote,
    removeNote,
    onGoToArrow,
    onGoToEvent,
    displayTimeMode,
    sourceTimeOffsetSeconds,
  };

  return (
    <section className="fms-journal-card">
      <header>
        <div><BookOpen size={14} /><span>FMS Journal</span></div>
        <small>{getDisplayTimezoneShortLabel(displayTimeMode)} · immutable provenance</small>
      </header>
      <div className="fms-journal-summary">
        <div><span>Prospective gross</span><strong>{signedR(live.total)}</strong><small>{live.count} resolved · {signedR(live.average)} average</small></div>
        <div><span>Recovered gross</span><strong>{signedR(recovered.total)}</strong><small>{recovered.count} counterfactual · {signedR(recovered.average)} average</small></div>
        <div><span>Tagged manual P/L</span><strong>{money(demo?.totalNetAccountResult)}</strong><small>{demo?.completedTrades ?? 0} completed MT5 trades</small></div>
        <div><span>MT5 demo account</span><strong>{capture?.accountLogin ? `#${capture.accountLogin}` : "Not verified"}</strong><small>{capture?.accountBalance == null ? capture?.status.replaceAll("_", " ") ?? "not checked" : `${balance(capture.accountBalance, capture.accountCurrency)} balance`}</small></div>
      </div>
      <div className="fms-journal-boundary">
        <strong>Separate ledgers</strong>
        <span>Prospective, recovered counterfactual, and tagged manual results stay separate. Fresh portfolio replay keeps overlapping signals and reports their combined gross drawdown{portfolio ? `; peak concurrency ${portfolio.maximumConcurrentTrades}, concentrated starts ${portfolio.concentratedCurrencyStarts}` : ""}.</span>
      </div>
      <div className="fms-journal-week" aria-label="Current five market days">
        {weekDays.map((day) => <div key={day.ordinal}><span>{new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", day: "2-digit" }).format(dateFromOrdinal(day.ordinal))}</span><strong>{day.live.count ? signedR(day.live.total) : "—"}</strong><small>{day.live.count} live · {day.recovered.count ? `${signedR(day.recovered.total)} recovered` : "no recovered"}</small></div>)}
      </div>
      {notesError ? <p role="alert" className="fms-action-warning">Audit notes: {notesError}</p> : null}
      <div className="fms-journal-toolbar">
        <label>Show<select value={scope} onChange={(event) => setScope(event.target.value as JournalScope)}><option value="all">All post-registration</option><option value="this_week">Current week</option><option value="previous_week">Previous week</option><option value="month">Current month</option><option value="year">Current year</option><option value="broker">Tagged manual only</option></select></label>
        <span>{rows.length} records · {scopeCounts.wins} wins · {scopeCounts.losses} losses · {scopeCounts.expired} expiry · {scopeCounts.ambiguous} ambiguous · {scopeCounts.unavailable} unavailable</span>
      </div>
      <JournalGroups rows={rows} grouping="day" emptyTitle="No journal records in this view." emptyCopy="Qualified releases will appear automatically; a broker result appears only after MT5 contains a matching tagged demo trade." {...groupProps} />
      <div className="fms-journal-history-heading">
        <strong>Before registration arrows</strong>
        <span>Immutable research replay only · these arrows were discovered retrospectively and were not available as live decisions.</span>
      </div>
      <div className="fms-journal-toolbar is-history">
        <strong>All pre-registration matches</strong>
        <span>{preRegistration.loading ? `Loading replay · ${preRegistration.rows.length} ready` : `${preRegistration.rows.length} records · ${historicalCounts.wins} wins · ${historicalCounts.losses} losses · ${historicalCounts.expired} expiry · ${historicalCounts.ambiguous} ambiguous`}</span>
      </div>
      {preRegistration.error ? <p role="alert" className="fms-action-warning">Some replay markets could not load: {preRegistration.error}</p> : null}
      <JournalGroups rows={preRegistration.rows} grouping="week" emptyTitle={preRegistration.loading ? "Loading pre-registration arrows…" : "No pre-registration arrows are stored."} emptyCopy={preRegistration.loading ? "Cached replay records appear here market by market." : "The immutable replay did not return an eligible arrow before its setup activation boundary."} {...groupProps} />
      <footer>All model performance is gross and excludes spread, slippage, commission, swap, and execution delay. Fyodor reads tagged demo history but cannot transmit or modify an MT5 order.</footer>
    </section>
  );
});
