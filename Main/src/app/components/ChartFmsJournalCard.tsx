import { BookOpen, ChevronDown } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
import type { MacroSignalChartSignal } from "@/app/types";

type JournalSource = "live" | "recovered" | "no_trade";

type JournalRow = {
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
};

type JournalScope = "this_week" | "previous_week" | "month" | "year" | "all" | "broker";
const JAKARTA_OFFSET_SECONDS = 7 * 3_600;

function jakartaDayStart(time: number): number {
  return Math.floor((time + JAKARTA_OFFSET_SECONDS) / 86_400) * 86_400 - JAKARTA_OFFSET_SECONDS;
}

function jakartaWeekStart(time: number): number {
  const start = jakartaDayStart(time);
  const weekday = new Date((start + JAKARTA_OFFSET_SECONDS) * 1_000).getUTCDay();
  return start - ((weekday + 6) % 7) * 86_400;
}

function rowResolvedTime(row: JournalRow): number {
  return row.exitTime ?? row.eventTime;
}

function aggregate(rows: JournalRow[], source: JournalSource) {
  const resolved = rows.filter((row) => row.source === source && row.resultR != null);
  const total = resolved.reduce((sum, row) => sum + Number(row.resultR), 0);
  return { count: resolved.length, total, average: resolved.length ? total / resolved.length : null };
}

const jakartaDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const jakartaDayLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function dayKey(time: number): string {
  return jakartaDateKey.format(new Date(time * 1_000));
}

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
  if (signal.outcomeStatus === "pending") return signal.entry == null ? "Waiting for entry" : "Running";
  if (signal.outcomeStatus === "ambiguous") return "Ambiguous";
  return signal.outcomeReason ?? "Unavailable";
}

export function buildFmsJournalRows(data: ChartMacroBiasRealtimeCardData): JournalRow[] {
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const demoTrades = data.globalResponse?.forwardValidation?.demoExecution?.trades ?? [];
  const demoBySignal = new Map(demoTrades.map((trade) => [`${trade.market}:${trade.patternId}:${trade.eventTime}`, trade]));
  const rows = new Map<string, JournalRow>();
  for (const market of markets) {
    const patterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
    for (const signal of [...market.signals, ...(market.recoveredSignals ?? [])]) {
      if (signal.eventTime < market.modelActivatedAt || signal.outcomeStatus === "pending") continue;
      const key = `${market.symbol}:${signal.patternId}:${signal.eventTime}`;
      const demo = demoBySignal.get(key) ?? null;
      rows.set(key, {
        key,
        market: market.symbol,
        label: patterns.get(signal.patternId)?.label ?? signal.label,
        patternId: signal.patternId,
        eventTime: signal.eventTime,
        direction: signal.direction,
        source: signal.observationMode === "live_captured" ? "live" : "recovered",
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
      });
    }
  }
  for (const decision of data.globalResponse?.liveDecisions ?? []) {
    if (decision.status !== "no_trade" || decision.eventTime < data.response.modelActivatedAt) continue;
    const key = `${decision.market}:${decision.patternId}:${decision.eventTime}`;
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
    });
  }
  return [...rows.values()].sort((left, right) => rowResolvedTime(right) - rowResolvedTime(left) || left.key.localeCompare(right.key));
}

export const ChartFmsJournalCard = memo(function ChartFmsJournalCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [scope, setScope] = useState<JournalScope>("this_week");
  const allRows = useMemo(() => buildFmsJournalRows(data), [data]);
  const newestTime = Math.max(data.globalResponse?.generatedAt ?? 0, data.response.generatedAt ?? 0, Math.floor(Date.now() / 1_000));
  const weekStart = jakartaWeekStart(newestTime);
  const monthStart = Date.UTC(new Date((newestTime + JAKARTA_OFFSET_SECONDS) * 1_000).getUTCFullYear(), new Date((newestTime + JAKARTA_OFFSET_SECONDS) * 1_000).getUTCMonth(), 1) / 1_000 - JAKARTA_OFFSET_SECONDS;
  const yearStart = Date.UTC(new Date((newestTime + JAKARTA_OFFSET_SECONDS) * 1_000).getUTCFullYear(), 0, 1) / 1_000 - JAKARTA_OFFSET_SECONDS;
  const rows = useMemo(() => allRows.filter((row) => (
    scope === "broker" ? row.demoStatus != null
      : scope === "this_week" ? rowResolvedTime(row) >= weekStart
        : scope === "previous_week" ? rowResolvedTime(row) >= weekStart - 7 * 86_400 && rowResolvedTime(row) < weekStart
          : scope === "month" ? rowResolvedTime(row) >= monthStart
            : scope === "year" ? rowResolvedTime(row) >= yearStart
        : true
  )), [allRows, monthStart, scope, weekStart, yearStart]);
  const days = useMemo(() => {
    const grouped = new Map<string, JournalRow[]>();
    rows.forEach((row) => grouped.set(dayKey(rowResolvedTime(row)), [...(grouped.get(dayKey(rowResolvedTime(row))) ?? []), row]));
    return [...grouped.entries()].map(([key, dayRows]) => ({ key, rows: dayRows }));
  }, [rows]);
  const scopeCounts = useMemo(() => ({
    wins: rows.filter((row) => row.state === "TP reached").length,
    losses: rows.filter((row) => row.state === "SL reached").length,
    expired: rows.filter((row) => row.state === "Expired").length,
    ambiguous: rows.filter((row) => row.state === "Ambiguous").length,
    unavailable: rows.filter((row) => row.source !== "no_trade" && row.resultR == null).length,
  }), [rows]);
  const live = aggregate(allRows, "live");
  const recovered = aggregate(allRows, "recovered");
  const weekDays = Array.from({ length: 5 }, (_, index) => {
    const start = weekStart + index * 86_400;
    const dayRows = allRows.filter((row) => rowResolvedTime(row) >= start && rowResolvedTime(row) < start + 86_400);
    return { start, rows: dayRows, live: aggregate(dayRows, "live"), recovered: aggregate(dayRows, "recovered") };
  });
  const demo = data.globalResponse?.forwardValidation?.demoExecution ?? null;
  const portfolio = data.globalResponse?.forwardValidation?.portfolioReplay ?? null;
  const capture = demo?.captureStatus;

  return (
    <section className="fms-journal-card">
      <header>
        <div><BookOpen size={14} /><span>FMS Journal</span></div>
        <small>Asia/Jakarta · immutable provenance</small>
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
        {weekDays.map((day) => <div key={day.start}><span>{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short", day: "2-digit" }).format(new Date(day.start * 1_000))}</span><strong>{day.live.count ? signedR(day.live.total) : "—"}</strong><small>{day.live.count} live · {day.recovered.count ? `${signedR(day.recovered.total)} recovered` : "no recovered"}</small></div>)}
      </div>
      <div className="fms-journal-toolbar">
        <label>Show<select value={scope} onChange={(event) => setScope(event.target.value as JournalScope)}><option value="this_week">Current week</option><option value="previous_week">Previous week</option><option value="month">Current month</option><option value="year">Current year</option><option value="all">All post-registration</option><option value="broker">Tagged manual only</option></select></label>
        <span>{rows.length} records · {scopeCounts.wins} wins · {scopeCounts.losses} losses · {scopeCounts.expired} expiry · {scopeCounts.ambiguous} ambiguous · {scopeCounts.unavailable} unavailable</span>
      </div>
      <div className="fms-journal-days">
        {days.length ? days.map((day, index) => {
          const dayResolved = day.rows.filter((row) => row.resultR != null);
          const dayR = dayResolved.reduce((sum, row) => sum + Number(row.resultR), 0);
          const dayDemo = day.rows.filter((row) => row.demoStatus != null);
          const dayMoney = dayDemo.reduce((sum, row) => sum + Number(row.demoNet ?? 0), 0);
          return <details key={day.key} open={index === 0}>
            <summary><span><strong>{jakartaDayLabel.format(new Date(rowResolvedTime(day.rows[0]) * 1_000))}</strong><small>{day.rows.length} decisions · {dayResolved.length} resolved</small></span><span><b>{dayResolved.length ? signedR(dayR) : "Pending"}</b><em>{dayDemo.length ? money(dayMoney) : "No demo"}</em><ChevronDown size={13} /></span></summary>
            <table><thead><tr><th>Time and setup</th><th>Decision</th><th>Model path</th><th>Demo account</th></tr></thead><tbody>{day.rows.map((row) => <tr key={row.key}>
              <td><strong>{formatJakartaDisplayDateTime(row.eventTime)}</strong><span>{row.market} · {row.label}</span><small className={`is-${row.source}`}>{row.source === "live" ? "Live captured" : row.source === "recovered" ? "Recovered path" : "No trade"}</small></td>
              <td><strong>{row.direction ? `${row.direction === "long" ? "Long" : "Short"} ${row.market}` : "No position"}</strong><span>{row.state}</span>{row.signalTag ? <code>{row.signalTag}</code> : null}</td>
              <td><strong>{signedR(row.resultR)}</strong><span>Entry {price(row.entry)}</span><small>SL {price(row.stop)} · TP {price(row.target)}</small></td>
              <td><strong>{row.demoStatus ? money(row.demoNet) : "Not placed"}</strong><span>{row.demoStatus?.replaceAll("_", " ") ?? "No matching tagged MT5 trade"}</span><small>{row.demoNetR == null ? "Actual broker result unavailable" : `${signedR(row.demoNetR)} net`}</small></td>
            </tr>)}</tbody></table>
          </details>;
        }) : <div className="fms-journal-empty"><strong>No journal records in this view.</strong><span>Qualified releases will appear automatically; a broker result appears only after MT5 contains a matching tagged demo trade.</span></div>}
      </div>
      <footer>All model performance is gross and excludes spread, slippage, commission, swap, and execution delay. Fyodor reads tagged demo history but cannot transmit or modify an MT5 order.</footer>
    </section>
  );
});
