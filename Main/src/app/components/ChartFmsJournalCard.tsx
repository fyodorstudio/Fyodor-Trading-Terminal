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
      if (signal.eventTime < market.modelActivatedAt) continue;
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
  return [...rows.values()].sort((left, right) => right.eventTime - left.eventTime || left.key.localeCompare(right.key));
}

export const ChartFmsJournalCard = memo(function ChartFmsJournalCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [scope, setScope] = useState<"all" | "seven_days" | "broker">("all");
  const allRows = useMemo(() => buildFmsJournalRows(data), [data]);
  const newestTime = Math.max(data.globalResponse?.generatedAt ?? 0, data.response.generatedAt ?? 0, Math.floor(Date.now() / 1_000));
  const rows = useMemo(() => allRows.filter((row) => (
    scope === "broker" ? row.demoStatus != null
      : scope === "seven_days" ? row.eventTime >= newestTime - 7 * 86_400
        : true
  )), [allRows, newestTime, scope]);
  const days = useMemo(() => {
    const grouped = new Map<string, JournalRow[]>();
    rows.forEach((row) => grouped.set(dayKey(row.eventTime), [...(grouped.get(dayKey(row.eventTime)) ?? []), row]));
    return [...grouped.entries()].map(([key, dayRows]) => ({ key, rows: dayRows }));
  }, [rows]);
  const resolved = allRows.filter((row) => row.resultR != null);
  const averageR = resolved.length ? resolved.reduce((sum, row) => sum + Number(row.resultR), 0) / resolved.length : null;
  const demo = data.globalResponse?.forwardValidation?.demoExecution ?? null;
  const capture = demo?.captureStatus;

  return (
    <section className="fms-journal-card">
      <header>
        <div><BookOpen size={14} /><span>FMS Journal</span></div>
        <small>Asia/Jakarta · immutable provenance</small>
      </header>
      <div className="fms-journal-summary">
        <div><span>Post-registration cases</span><strong>{allRows.length}</strong><small>{resolved.length} resolved</small></div>
        <div><span>Model result</span><strong>{signedR(averageR)}</strong><small>average resolved path</small></div>
        <div><span>Captured demo P/L</span><strong>{money(demo?.totalNetAccountResult)}</strong><small>{demo?.completedTrades ?? 0} completed trades</small></div>
        <div><span>MT5 demo account</span><strong>{capture?.accountLogin ? `#${capture.accountLogin}` : "Not verified"}</strong><small>{capture?.accountBalance == null ? capture?.status.replaceAll("_", " ") ?? "not checked" : `${balance(capture.accountBalance, capture.accountCurrency)} balance`}</small></div>
      </div>
      <div className="fms-journal-boundary">
        <strong>Two ledgers, never mixed</strong>
        <span>Model R includes live-captured and explicitly labelled recovered MT5 paths. Dollar P/L appears only from a tagged trade actually found in the connected demo account.</span>
      </div>
      <div className="fms-journal-toolbar">
        <label>Show<select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="all">All post-registration</option><option value="seven_days">Latest 7 days</option><option value="broker">Broker demo only</option></select></label>
        <span>{rows.length} records · {days.length} Jakarta days</span>
      </div>
      <div className="fms-journal-days">
        {days.length ? days.map((day, index) => {
          const dayResolved = day.rows.filter((row) => row.resultR != null);
          const dayR = dayResolved.reduce((sum, row) => sum + Number(row.resultR), 0);
          const dayDemo = day.rows.filter((row) => row.demoStatus != null);
          const dayMoney = dayDemo.reduce((sum, row) => sum + Number(row.demoNet ?? 0), 0);
          return <details key={day.key} open={index === 0}>
            <summary><span><strong>{jakartaDayLabel.format(new Date(day.rows[0].eventTime * 1_000))}</strong><small>{day.rows.length} decisions · {dayResolved.length} resolved</small></span><span><b>{dayResolved.length ? signedR(dayR) : "Pending"}</b><em>{dayDemo.length ? money(dayMoney) : "No demo"}</em><ChevronDown size={13} /></span></summary>
            <table><thead><tr><th>Time and setup</th><th>Decision</th><th>Model path</th><th>Demo account</th></tr></thead><tbody>{day.rows.map((row) => <tr key={row.key}>
              <td><strong>{formatJakartaDisplayDateTime(row.eventTime)}</strong><span>{row.market} · {row.label}</span><small className={`is-${row.source}`}>{row.source === "live" ? "Live captured" : row.source === "recovered" ? "Recovered path" : "No trade"}</small></td>
              <td><strong>{row.direction ? `${row.direction === "long" ? "Long" : "Short"} ${row.market}` : "No position"}</strong><span>{row.state}</span>{row.signalTag ? <code>{row.signalTag}</code> : null}</td>
              <td><strong>{signedR(row.resultR)}</strong><span>Entry {price(row.entry)}</span><small>SL {price(row.stop)} · TP {price(row.target)}</small></td>
              <td><strong>{row.demoStatus ? money(row.demoNet) : "Not placed"}</strong><span>{row.demoStatus?.replaceAll("_", " ") ?? "No matching tagged MT5 trade"}</span><small>{row.demoNetR == null ? "Actual broker result unavailable" : `${signedR(row.demoNetR)} net`}</small></td>
            </tr>)}</tbody></table>
          </details>;
        }) : <div className="fms-journal-empty"><strong>No journal records in this view.</strong><span>Qualified releases will appear automatically; a broker result appears only after MT5 contains a matching tagged demo trade.</span></div>}
      </div>
      <footer>Fyodor reads tagged demo history but cannot transmit or modify an MT5 order. Recovered paths remain useful audits, not broker fills.</footer>
    </section>
  );
});
