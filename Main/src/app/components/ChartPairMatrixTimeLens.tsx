import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, CornerDownRight, Crosshair, Info, MoveHorizontal, Table2, X } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import {
  PairMatrixAuditOverlay,
  getPairMatrixAuditContextKey,
  getPairMatrixAuditKey,
  handlePairMatrixAuditEscape,
  togglePairMatrixActiveAudit,
  type MetricAudit,
  type PairMatrixActiveAudit,
} from "@/app/components/ChartPairMatrixAuditOverlay";
import { ChartPairMatrixScoringGuide } from "@/app/components/ChartPairMatrixScoringGuide";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type { PairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import type {
  PairMatrixCurrencyMomentumRead,
  PairMatrixEconomyState,
  PairMatrixInflationState,
  PairMatrixMomentumSnapshot,
  PairMatrixPolicyState,
} from "@/app/lib/pairMatrixMomentum";
import {
  PAIR_MATRIX_BEFORE_MAX_DAYS,
  normalizePairMatrixBeforeDays,
  type PairMatrixCurrencyTimeline,
  type PairMatrixSeriesSnapshot,
  type PairMatrixTimelineSnapshot,
} from "@/app/lib/pairMatrixSnapshot";
import {
  buildPairMatrixEconomyFactorGroups,
  buildPairMatrixTimelineGroups,
  getPairMatrixTimelineExpansionKey,
  isPairMatrixTimelineGroupExpandable,
  togglePairMatrixTimelineExpansion,
  type PairMatrixTimelineGroup,
  type PairMatrixTimelineGroupingMode,
  type PairMatrixTimelineSection,
} from "@/app/lib/pairMatrixTimelineGrouping";

export type PairMatrixLoadState = "idle" | "loading" | "ready" | "error";

export interface ChartPairMatrixTimeLensData {
  open: boolean;
  supported: boolean;
  pairLabel: string;
  currencies: readonly string[];
  timeline: PairMatrixTimelineSnapshot;
  momentum: PairMatrixMomentumSnapshot;
  rangeLabel: string;
  rangeMoveLabel: string | null;
  rangeBasisLabel: "Hovered candle" | "Latest candle" | "Locked range";
  rangeOpenTimeSeconds: number | null;
  loadState: PairMatrixLoadState;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  beforeDays: number;
  rangeSelectionArmed: boolean;
  hasLockedRange: boolean;
  onBeforeDaysChange: (days: number) => void;
  onStartRangeSelection: () => void;
  onReturnToCursor: () => void;
  onToggleOpen: () => void;
  onClose: () => void;
  cursorRuntime?: {
    hover: PairMatrixHoverRuntime;
    resolve: (anchor: number | null) => ChartPairMatrixTimeLensData;
  };
}

interface ChartPairMatrixTimeLensProps {
  data: ChartPairMatrixTimeLensData;
}

const ECONOMY_LABELS: Record<PairMatrixEconomyState, string> = {
  improving: "IMPROVING",
  weakening: "WEAKENING",
  net_zero: "NET 0",
  no_scored_data: "NO SCORED DATA",
};

const INFLATION_LABELS: Record<PairMatrixInflationState, string> = {
  heating: "HEATING",
  cooling: "COOLING",
  net_zero: "NET 0",
  no_scored_data: "NO SCORED DATA",
};

const POLICY_LABELS: Record<PairMatrixPolicyState, string> = {
  tightening: "TIGHTENING",
  holding: "HOLDING",
  easing: "EASING",
  no_decision: "NO NEW DECISION",
  no_policy_data: "NO POLICY DATA",
};

const ECONOMY_HEADLINE_LABELS: Record<PairMatrixEconomyState, string> = {
  improving: "Improving",
  weakening: "Weakening",
  net_zero: "Net 0",
  no_scored_data: "No scored data",
};

const METRIC_HELP = {
  economy: "Economy arrows count factor votes. Up means an improving factor; down means a weakening factor. Each factor receives at most one vote.",
  inflation: "Inflation arrows count capped inflation groups. Up means heating; down means cooling. Inflation remains separate from the Economy vote.",
  policy: "Policy compares the latest canonical rate decision Actual with its Previous value. Statement guidance is not scored as the decision value.",
} as const;

const METRIC_FORMULA = {
  economy: "Formula: each registered exact series receives equal-weight Surprise and Momentum direction points; agreeing nonzero directions receive one matching bonus point. Related groups are capped at +/-3 and each economic factor casts at most one vote.",
  inflation: "Formula: each registered inflation series receives equal-weight Surprise and Momentum heating/cooling points; agreeing nonzero directions receive one matching bonus point and related groups are capped at +/-3.",
  policy: "Formula: the latest canonical policy-rate Actual is compared only with Previous. Higher is Tightening, equal is Holding, and lower is Easing.",
} as const;

function formatEconomyRead(read: PairMatrixCurrencyMomentumRead): string {
  const label = ECONOMY_LABELS[read.economy.state];
  if (read.economy.state === "no_scored_data") return label;
  return `${label} · ${read.economy.upCount}↑ ${read.economy.downCount}↓`;
}

function formatInflationRead(read: PairMatrixCurrencyMomentumRead): string {
  const label = INFLATION_LABELS[read.inflation.state];
  if (read.inflation.state === "no_scored_data") return label;
  return `${label} · ${read.inflation.upCount}↑ ${read.inflation.downCount}↓`;
}

function MetricHeading({ label, help, side, helpVisible, onRevealHelp, onHideHelp }: { label: string; help: string; side: "base" | "quote"; helpVisible: boolean; onRevealHelp: () => void; onHideHelp: () => void }) {
  return (
    <span className={`relative inline-flex min-w-0 items-center gap-1 text-[9px] font-black uppercase leading-[12px] tracking-[0.08em] text-slate-500 ${side === "quote" ? "justify-end text-right" : "justify-start text-left"}`}>
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="flex-none rounded text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        aria-label={`${label} scoring help`}
        aria-expanded={helpVisible}
        data-pair-matrix-help-trigger=""
        data-pair-matrix-help-hitbox="icon-only"
        onMouseEnter={onRevealHelp}
        onMouseLeave={onHideHelp}
        onFocus={onRevealHelp}
        onBlur={onHideHelp}
      >
        <Info size={11} />
      </button>
      <span role="tooltip" className={`pointer-events-none absolute inset-x-0 top-full z-20 mt-1 w-auto rounded-lg bg-slate-950 p-2 text-left text-[11px] font-semibold normal-case leading-4 tracking-normal text-white shadow-xl ${helpVisible ? "block" : "hidden"}`}>{help}</span>
    </span>
  );
}

function MetricValue({ value, audit, side, period, metric, activeAuditKey, onSelectAudit }: {
  value: string;
  audit: MetricAudit;
  side: "base" | "quote";
  period: "during" | "before";
  metric: "economy" | "inflation" | "policy";
  activeAuditKey: string | null;
  onSelectAudit: (audit: PairMatrixActiveAudit) => void;
}) {
  const target = { side, period, metric, audit } satisfies PairMatrixActiveAudit;
  const targetKey = getPairMatrixAuditKey(target);
  const available = audit.readingState !== "no_scored_data"
    && audit.readingState !== "no_decision"
    && audit.readingState !== "no_policy_data";
  return (
    <button
      type="button"
      className={`block w-full min-w-0 appearance-none truncate border-0 bg-transparent p-0 text-[18px] font-black leading-[22px] tracking-normal focus:outline-none focus:ring-1 focus:ring-blue-400 ${available ? "text-blue-900" : "text-slate-400"} ${side === "quote" ? "text-right" : "text-left"}`}
      aria-label={audit.accessibleText}
      aria-expanded={activeAuditKey === targetKey}
      aria-controls={`pair-matrix-audit-overlay-${side}`}
      data-pair-matrix-audit-trigger={targetKey}
      data-pair-matrix-audit-interaction="press"
      data-pair-matrix-result-availability={available ? "available" : "unavailable"}
      onClick={() => onSelectAudit(target)}
    >
      {value}
    </button>
  );
}

function metricAudit(read: PairMatrixCurrencyMomentumRead, metric: "economy" | "inflation" | "policy", context: string): MetricAudit {
  const contributors = read.contributors.filter((event) => event.rule.pillar === metric).map((event) => event.audit);
  const summary = metric === "economy" ? read.economy.audit : metric === "inflation" ? read.inflation.audit : read.policy.audit;
  const heading = `${context} ${metric[0].toUpperCase()}${metric.slice(1)}`;
  return {
    heading,
    formula: METRIC_FORMULA[metric],
    result: summary,
    contributors,
    readingState: metric === "economy" ? read.economy.state : metric === "inflation" ? read.inflation.state : read.policy.state,
    accessibleText: `${heading}. ${METRIC_FORMULA[metric]} ${summary}${contributors.length ? ` Contributors: ${contributors.join(" ")}` : ""}`,
    economyBreakdown: metric === "economy" && read.economy.factors.length > 0 ? {
      upCount: read.economy.upCount,
      downCount: read.economy.downCount,
      zeroCount: read.economy.zeroCount,
      netVotes: read.economy.netVotes,
      factors: read.economy.factors.map((factor) => ({
        label: factor.factor === "activity" ? "Activity" : factor.factor === "labor" ? "Labor" : factor.factor === "retail" ? "Retail" : factor.factor === "sentiment" ? "Sentiment" : "Trade",
        direction: factor.vote > 0 ? "up" : factor.vote < 0 ? "down" : "neutral",
        score: factor.score,
      })),
    } : undefined,
  };
}

function MomentumMetricLane({
  label,
  metric,
  during,
  before,
  currency,
  side,
  divided,
  helpVisible,
  onRevealHelp,
  onHideHelp,
  activeAuditKey,
  onSelectAudit,
}: {
  label: string;
  metric: "economy" | "inflation" | "policy";
  during: PairMatrixCurrencyMomentumRead;
  before: PairMatrixCurrencyMomentumRead;
  currency: string;
  side: "base" | "quote";
  divided: boolean;
  helpVisible: boolean;
  onRevealHelp: () => void;
  onHideHelp: () => void;
  activeAuditKey: string | null;
  onSelectAudit: (audit: PairMatrixActiveAudit) => void;
}) {
  const display = (read: PairMatrixCurrencyMomentumRead) => metric === "economy"
    ? formatEconomyRead(read)
    : metric === "inflation"
      ? formatInflationRead(read)
      : POLICY_LABELS[read.policy.state];
  return (
    <div className={`grid min-w-0 grid-rows-[12px_24px_24px] items-center gap-y-1 px-2 ${divided ? "border-l border-slate-300" : ""}`} data-pair-matrix-summary-lane={metric}>
      <MetricHeading label={label} help={METRIC_HELP[metric]} side={side} helpVisible={helpVisible} onRevealHelp={onRevealHelp} onHideHelp={onHideHelp} />
      <MetricValue value={display(during)} audit={metricAudit(during, metric, `${currency} During`)} side={side} period="during" metric={metric} activeAuditKey={activeAuditKey} onSelectAudit={onSelectAudit} />
      <MetricValue value={display(before)} audit={metricAudit(before, metric, `${currency} Before`)} side={side} period="before" metric={metric} activeAuditKey={activeAuditKey} onSelectAudit={onSelectAudit} />
    </div>
  );
}

function CurrencyMomentumHeader({
  currency,
  countryCode,
  during,
  background,
  side,
  helpVisible,
  onRevealHelp,
  onHideHelp,
  activeAuditKey,
  onSelectAudit,
}: {
  currency: string;
  countryCode: string;
  during: PairMatrixCurrencyMomentumRead;
  background: PairMatrixCurrencyMomentumRead;
  side: "base" | "quote";
  helpVisible: boolean;
  onRevealHelp: () => void;
  onHideHelp: () => void;
  activeAuditKey: string | null;
  onSelectAudit: (audit: PairMatrixActiveAudit) => void;
}) {
  const metricOrder = side === "base"
    ? (["economy", "inflation", "policy"] as const)
    : (["policy", "inflation", "economy"] as const);
  const metricLabels = { economy: "Economy", inflation: "Inflation", policy: "Policy" } as const;
  const content = (
    <div className={`grid min-w-0 flex-1 items-stretch ${side === "base" ? "grid-cols-[58px_1.2fr_1fr_1fr]" : "grid-cols-[58px_1fr_1fr_1.2fr]"}`} data-pair-matrix-summary-lanes="separated" data-pair-matrix-summary-side={side}>
      <div className="grid min-w-0 grid-rows-[12px_24px_24px] items-center gap-y-1 pr-2">
        <span aria-hidden="true" />
        <span className={`truncate text-[10px] font-black uppercase tracking-[0.06em] text-blue-700 ${side === "quote" ? "text-right" : "text-left"}`}>During</span>
        <span className={`truncate text-[10px] font-black uppercase tracking-[0.06em] text-slate-500 ${side === "quote" ? "text-right" : "text-left"}`}>Before</span>
      </div>
      {metricOrder.map((metric, index) => (
        <MomentumMetricLane key={metric} label={metricLabels[metric]} metric={metric} during={during} before={background} currency={currency} side={side} divided={index > 0} helpVisible={helpVisible} onRevealHelp={onRevealHelp} onHideHelp={onHideHelp} activeAuditKey={activeAuditKey} onSelectAudit={onSelectAudit} />
      ))}
    </div>
  );
  return (
    <div className="flex h-[80px] min-w-0 items-center gap-2 px-3 py-1">
      {side === "base" ? <><FlagIcon countryCode={countryCode} className="h-5 w-8 shrink-0 border border-slate-200" /><span className="shrink-0 text-[18px] font-black leading-5 text-slate-700">{currency}</span>{content}</> : <>{content}<span className="shrink-0 text-[18px] font-black leading-5 text-slate-700">{currency}</span><FlagIcon countryCode={countryCode} className="h-5 w-8 shrink-0 border border-slate-200" /></>}
    </div>
  );
}

function SnapshotEventValues({ series }: { series: PairMatrixSeriesSnapshot }) {
  const valueClassName = "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap";
  return (
    <>
      <b className={valueClassName} title={`Actual. Broker raw value: ${series.event.actual || "missing"}.`}>A {series.actualLabel}</b>
      <b className={valueClassName} title={`Forecast. Broker raw value: ${series.event.forecast || "missing"}.`}>F {series.forecastLabel}</b>
      <b className={valueClassName} title={`Previous. Broker raw value: ${series.event.previous || "missing"}. This value may already contain a broker revision.`}>P {series.previousLabel}</b>
      <b className={valueClassName} title={series.surprise.title}>S {series.surprise.label}</b>
      <b className={valueClassName} title={series.momentum.title}>M {series.momentum.label}</b>
    </>
  );
}

function formatAge(anchorTimeSeconds: number | null, releaseTimeSeconds: number): string {
  if (anchorTimeSeconds == null) return "";
  const seconds = Math.max(0, anchorTimeSeconds - releaseTimeSeconds);
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)}m old`;
  if (seconds < 48 * 60 * 60) return `${Math.floor(seconds / (60 * 60))}h old`;
  return `${Math.floor(seconds / (24 * 60 * 60))}d old`;
}

function formatElapsed(rangeOpen: number | null, releaseTime: number): string {
  if (rangeOpen == null) return "";
  const seconds = Math.max(0, releaseTime - rangeOpen);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `+${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `+${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

export function PairMatrixTimelineEntry({
  series,
  side,
  mode,
  data,
  hideFactor = false,
}: {
  series: PairMatrixSeriesSnapshot;
  side: "base" | "quote";
  mode: "during" | "before";
  data: ChartPairMatrixTimeLensData;
  hideFactor?: boolean;
}) {
  const secondaryTime = mode === "during"
    ? formatElapsed(data.rangeOpenTimeSeconds, series.event.time)
    : formatAge(data.rangeOpenTimeSeconds, series.event.time);
  const time = (
    <time
      className={`block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] font-bold text-slate-500 ${side === "base" ? "text-right" : "text-left"}`}
      title={`${series.event.title}. ${mode === "during" ? "Released during the selected candle range" : "Latest loaded release of this exact series before the range"}${secondaryTime ? `; ${secondaryTime}` : ""}.`}
    >
      {formatChartEventDisplayTime(series.event.time, data.displayTimeMode, data.sourceTimeOffsetSeconds)}
      {secondaryTime ? ` · ${secondaryTime}` : ""}
    </time>
  );
  const factor = hideFactor ? (
    <span className={`inline-flex w-full min-w-0 items-center text-slate-300 ${side === "quote" ? "justify-end" : "justify-start"}`} aria-hidden="true"><CornerDownRight size={13} /></span>
  ) : (
    <span className="inline-flex w-full min-w-0 items-center gap-1 overflow-hidden text-[11px] font-black uppercase tracking-[0.04em] text-slate-500">
      <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={series.factor.label}>{series.factor.label}</span>
      <span className="flex-none" title={series.factor.helpText} aria-label={`${series.factor.label} interpretation help: ${series.factor.helpText}`}>
        <Info size={10} aria-hidden="true" />
      </span>
    </span>
  );
  const title = <strong className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-black text-slate-900 ${side === "quote" ? "text-right" : ""}`} title={series.event.title}>{series.event.title}</strong>;
  const values = <span className="contents text-[13px] font-extrabold text-slate-600"><SnapshotEventValues series={series} /></span>;

  return side === "base" ? (
    <div className="grid min-h-[38px] grid-cols-[88px_minmax(80px,1fr)_64px_64px_64px_72px_72px_168px] items-center gap-1 overflow-hidden border-b border-slate-100 px-2 last:border-b-0" data-pair-matrix-timeline-entry="base">
      {factor}{title}{values}{time}
    </div>
  ) : (
    <div className="grid min-h-[38px] grid-cols-[168px_64px_64px_64px_72px_72px_minmax(80px,1fr)_88px] items-center gap-1 overflow-hidden border-b border-slate-100 px-2 last:border-b-0" data-pair-matrix-timeline-entry="quote">
      {time}{values}{title}<span className="min-w-0 justify-self-stretch overflow-hidden">{factor}</span>
    </div>
  );
}

function formatGroupTime(time: number, data: ChartPairMatrixTimeLensData): string {
  return formatChartEventDisplayTime(time, data.displayTimeMode, data.sourceTimeOffsetSeconds);
}

function TimelineGroupParent({ group, side, expanded, data, onToggle, nested = false }: { group: PairMatrixTimelineGroup; side: "base" | "quote"; expanded: boolean; data: ChartPairMatrixTimeLensData; onToggle: () => void; nested?: boolean }) {
  const times = group.entries.map((entry) => entry.event.time);
  const firstTime = Math.min(...times);
  const lastTime = Math.max(...times);
  const timeLabel = firstTime === lastTime ? formatGroupTime(firstTime, data) : `${formatGroupTime(firstTime, data)} → ${formatGroupTime(lastTime, data)}`;
  const title = group.kind === "context" ? group.layer.label : group.kind === "factor" ? group.factor.label : `${group.entries.length} releases`;
  const detail = group.kind === "release_time"
    ? group.factors.map((factor) => factor.label).join(" · ")
    : `${group.entries.length} ${group.entries.length === 1 ? "release" : "releases"}`;
  const help = group.kind === "context" ? group.layer.helpText : group.kind === "factor" ? group.factor.helpText : `All ${group.entries.length} releases share this exact broker timestamp.`;
  const identity = (
    <span className={`flex min-w-0 items-center gap-2 ${side === "quote" ? "flex-row-reverse text-right" : "text-left"}`}>
      {expanded ? <ChevronDown size={14} className="flex-none" /> : <ChevronRight size={14} className="flex-none" />}
      <span className="min-w-0"><strong className="block truncate text-[13px] font-black text-slate-900">{title}</strong><small className="block truncate text-[10px] font-bold text-slate-500">{detail}</small></span>
      <Info size={11} className="flex-none text-slate-400" aria-hidden="true" />
    </span>
  );
  const time = <time className={`min-w-0 truncate font-mono text-[11px] font-bold text-slate-500 ${side === "quote" ? "text-left" : "text-right"}`}>{timeLabel}</time>;
  return (
    <button
      type="button"
      className={`grid min-h-[42px] w-full grid-cols-[minmax(0,1fr)_minmax(150px,auto)] items-center gap-3 border-b border-slate-200 px-3 text-left hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300 ${nested ? "bg-white pl-6" : group.kind === "context" ? "bg-slate-100" : "bg-slate-50"}`}
      onClick={onToggle}
      aria-expanded={expanded}
      title={help}
      data-pair-matrix-group-parent={group.kind}
      data-pair-matrix-group-side={side}
    >
      {side === "base" ? <>{identity}{time}</> : <>{time}{identity}</>}
    </button>
  );
}

function CurrencyTimeline({ timeline, side, mode, data, groupBy, expandedGroups, onToggleGroup }: {
  timeline: PairMatrixCurrencyTimeline | null;
  side: "base" | "quote";
  mode: PairMatrixTimelineSection;
  data: ChartPairMatrixTimeLensData;
  groupBy: PairMatrixTimelineGroupingMode;
  expandedGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
}) {
  const entries = timeline?.entries ?? [];
  const groups = useMemo(() => buildPairMatrixTimelineGroups(entries, groupBy), [entries, groupBy]);
  if (!timeline || timeline.entries.length === 0) {
    return <p className={`m-0 px-3 py-3 text-[11px] font-bold text-slate-400 ${side === "quote" ? "text-right" : ""}`}>{mode === "during" ? "No loaded releases during this range" : `No loaded releases in the prior ${data.beforeDays} days`}</p>;
  }
  return <>{groups.map((group) => {
    if (!isPairMatrixTimelineGroupExpandable(group)) {
      const entry = group.entries[0];
      return <PairMatrixTimelineEntry key={`${mode}:${entry.event.id}:${entry.event.time}:${entry.event.title}`} series={entry} side={side} mode={mode} data={data} />;
    }
    const expansionKey = getPairMatrixTimelineExpansionKey({ section: mode, currency: timeline.currency, mode: groupBy, groupId: group.id });
    const expanded = expandedGroups.has(expansionKey);
    if (group.kind === "context") {
      const economyFactors = group.layer.id === "economy" ? buildPairMatrixEconomyFactorGroups(group.entries) : [];
      return (
        <div key={expansionKey} data-pair-matrix-group={expansionKey} data-pair-matrix-context-layer={group.layer.id}>
          <TimelineGroupParent group={group} side={side} expanded={expanded} data={data} onToggle={() => onToggleGroup(expansionKey)} />
          {expanded && group.layer.id !== "economy" ? group.entries.map((entry) => (
            <PairMatrixTimelineEntry key={`${mode}:${entry.event.id}:${entry.event.time}:${entry.event.title}`} series={entry} side={side} mode={mode} data={data} hideFactor />
          )) : null}
          {expanded && group.layer.id === "economy" ? economyFactors.map((factorGroup) => {
            const factorKey = getPairMatrixTimelineExpansionKey({ section: mode, currency: timeline.currency, mode: groupBy, groupId: `${group.id}:${factorGroup.id}` });
            const factorExpanded = expandedGroups.has(factorKey);
            return (
              <div key={factorKey} data-pair-matrix-group={factorKey} data-pair-matrix-economy-factor={factorGroup.id}>
                <TimelineGroupParent group={factorGroup} side={side} expanded={factorExpanded} data={data} nested onToggle={() => onToggleGroup(factorKey)} />
                {factorExpanded ? factorGroup.entries.map((entry) => (
                  <PairMatrixTimelineEntry key={`${mode}:${entry.event.id}:${entry.event.time}:${entry.event.title}`} series={entry} side={side} mode={mode} data={data} hideFactor />
                )) : null}
              </div>
            );
          }) : null}
        </div>
      );
    }
    return (
      <div key={expansionKey} data-pair-matrix-group={expansionKey}>
        <TimelineGroupParent group={group} side={side} expanded={expanded} data={data} onToggle={() => onToggleGroup(expansionKey)} />
        {expanded ? group.entries.map((entry) => <PairMatrixTimelineEntry key={`${mode}:${entry.event.id}:${entry.event.time}:${entry.event.title}`} series={entry} side={side} mode={mode} data={data} hideFactor={group.kind === "factor"} />) : null}
      </div>
    );
  })}</>;
}

function TimelineSection({ mode, data, groupBy, expandedGroups, onToggleGroup }: { mode: PairMatrixTimelineSection; data: ChartPairMatrixTimeLensData; groupBy: PairMatrixTimelineGroupingMode; expandedGroups: ReadonlySet<string>; onToggleGroup: (key: string) => void }) {
  const source = data.timeline[mode];
  const base = source.find((item) => item.currency === data.currencies[0]) ?? null;
  const quote = source.find((item) => item.currency === data.currencies[1]) ?? null;
  return (
    <div className="grid grid-cols-2 divide-x divide-slate-300">
      <div className="min-w-0"><CurrencyTimeline timeline={base} side="base" mode={mode} data={data} groupBy={groupBy} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} /></div>
      <div className="min-w-0"><CurrencyTimeline timeline={quote} side="quote" mode={mode} data={data} groupBy={groupBy} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} /></div>
    </div>
  );
}

export const ChartPairMatrixTimeLens = memo(function ChartPairMatrixTimeLens({ data }: ChartPairMatrixTimeLensProps) {
  const [lookbackInput, setLookbackInput] = useState(String(data.beforeDays));
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [metricHelpVisible, setMetricHelpVisible] = useState(false);
  const [groupBy, setGroupBy] = useState<PairMatrixTimelineGroupingMode>("factor");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [activeAudit, setActiveAudit] = useState<PairMatrixActiveAudit | null>(null);
  const closeTutorial = useCallback(() => setTutorialOpen(false), []);
  const toggleTimelineGroup = useCallback((key: string) => setExpandedGroups((current) => togglePairMatrixTimelineExpansion(current, key)), []);
  const closeAudit = useCallback(() => setActiveAudit(null), []);
  const selectAudit = useCallback((audit: PairMatrixActiveAudit) => setActiveAudit((current) => togglePairMatrixActiveAudit(current, audit)), []);
  const auditContextKey = getPairMatrixAuditContextKey(data);
  useEffect(() => setLookbackInput(String(data.beforeDays)), [data.beforeDays]);
  useEffect(() => {
    closeAudit();
  }, [auditContextKey, closeAudit]);
  if (!data.open) return null;

  const baseCurrency = data.currencies[0] ?? "Base";
  const quoteCurrency = data.currencies[1] ?? "Quote";
  const baseCountryCode = CURRENCY_TO_COUNTRY_CODE[baseCurrency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? "";
  const quoteCountryCode = CURRENCY_TO_COUNTRY_CODE[quoteCurrency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? "";
  const baseDuring = data.momentum.during.find((read) => read.currency === baseCurrency);
  const quoteDuring = data.momentum.during.find((read) => read.currency === quoteCurrency);
  const baseBackground = data.momentum.background.find((read) => read.currency === baseCurrency);
  const quoteBackground = data.momentum.background.find((read) => read.currency === quoteCurrency);
  const commitLookback = () => {
    const normalized = normalizePairMatrixBeforeDays(lookbackInput);
    setLookbackInput(String(normalized));
    data.onBeforeDaysChange(normalized);
  };

  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white"
      aria-label="Pair Matrix Time Lens"
      onKeyDownCapture={(event) => {
        if (activeAudit) handlePairMatrixAuditEscape(event, closeAudit);
      }}
    >
      <header className="flex min-h-[50px] items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"><Table2 size={15} /></span>
          <div className="min-w-0">
            <p className="m-0 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Pair Matrix - Economic timeline</p>
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-black text-slate-950">{data.pairLabel}</h2>
              <button
                type="button"
                onClick={data.onStartRangeSelection}
                disabled={!data.supported || data.rangeOpenTimeSeconds == null}
                className={`inline-flex h-6 flex-none items-center gap-1 rounded-md border px-2 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-50 ${data.rangeSelectionArmed ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                aria-pressed={data.rangeSelectionArmed}
                title={data.hasLockedRange ? "Drag across the chart to replace the locked range" : "Drag across the chart to select complete candles"}
              >
                <MoveHorizontal size={12} /> {data.rangeSelectionArmed ? "Drag on chart" : data.hasLockedRange ? "Replace range" : "Select range"}
              </button>
              <button
                type="button"
                onClick={data.onReturnToCursor}
                className={`inline-flex h-6 flex-none items-center gap-1 rounded-md border px-2 text-[10px] font-black ${!data.hasLockedRange && !data.rangeSelectionArmed ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                aria-pressed={!data.hasLockedRange && !data.rangeSelectionArmed}
                title="Clear the selected range and return Pair Matrix to candle hover"
              >
                <Crosshair size={12} /> Cursor
              </button>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="inline-flex h-6 flex-none items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-black text-slate-700 hover:bg-slate-100"
                aria-haspopup="dialog"
                aria-expanded={tutorialOpen}
              >
                <BookOpen size={12} /> How scoring works
              </button>
              <label className="inline-flex h-6 flex-none items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-black text-slate-600">
                Group by
                <select className="h-5 border-0 bg-transparent pr-1 text-[10px] font-black text-slate-800 outline-none" aria-label="Group Pair Matrix timeline by" value={groupBy} onChange={(event) => setGroupBy(event.target.value as PairMatrixTimelineGroupingMode)}>
                  <option value="factor">Factor</option>
                  <option value="release_time">Release time</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="ml-auto min-w-0 text-right">
          <strong className="flex min-w-0 items-center justify-end gap-2 whitespace-nowrap text-[12px] font-black text-slate-800">
            {data.rangeMoveLabel ? <span className="flex-none border-r border-slate-300 pr-2 font-mono text-blue-700" data-pair-matrix-range-move="">{data.rangeMoveLabel}</span> : null}
            <span className="min-w-0 overflow-hidden text-ellipsis">{data.rangeLabel}</span>
          </strong>
          <span className="block text-[10px] font-bold text-slate-500">{data.rangeBasisLabel}</span>
        </div>
        <button className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100" type="button" onClick={data.onClose} aria-label="Close Pair Matrix Time Lens"><X size={15} /></button>
      </header>

      {!data.supported ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-slate-600">Pair Matrix currently supports forex pairs only.</div>
      ) : data.loadState === "idle" ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-slate-600" aria-live="polite">Waiting for a loaded chart candle.</div>
      ) : data.loadState === "loading" ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-slate-600" aria-live="polite">Loading economic data for this candle range...</div>
      ) : data.loadState === "error" ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-red-700" role="status">Historical calendar data could not be loaded.</div>
      ) : (
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
            {baseDuring && quoteDuring && baseBackground && quoteBackground ? (
            <div
              className="sticky top-0 z-[3] w-full min-w-0 border-b border-slate-300 bg-slate-100 uppercase tracking-[0.04em] text-slate-500"
              data-pair-matrix-shared-help={metricHelpVisible ? "visible" : "hidden"}
              onMouseLeave={() => setMetricHelpVisible(false)}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (!(next instanceof Element) || !next.closest("[data-pair-matrix-help-trigger]")) setMetricHelpVisible(false);
              }}
            >
              <div className="h-[18px] border-b border-slate-200 text-center text-[11px] font-black leading-[18px] tracking-[0.04em] text-slate-700" title="The pair headline uses During Economy factor votes only; inflation and policy remain separate.">
                During-{data.hasLockedRange ? "range" : "candle"} economic evidence: {baseCurrency} {ECONOMY_HEADLINE_LABELS[baseDuring.economy.state]} <span className="mx-1 text-slate-400">|</span> {quoteCurrency} {ECONOMY_HEADLINE_LABELS[quoteDuring.economy.state]}
              </div>
              <div className="grid min-w-0 grid-cols-2 divide-x divide-slate-300">
                <CurrencyMomentumHeader currency={baseCurrency} countryCode={baseCountryCode} during={baseDuring} background={baseBackground} side="base" helpVisible={metricHelpVisible} onRevealHelp={() => setMetricHelpVisible(true)} onHideHelp={() => setMetricHelpVisible(false)} activeAuditKey={activeAudit ? getPairMatrixAuditKey(activeAudit) : null} onSelectAudit={selectAudit} />
                <CurrencyMomentumHeader currency={quoteCurrency} countryCode={quoteCountryCode} during={quoteDuring} background={quoteBackground} side="quote" helpVisible={metricHelpVisible} onRevealHelp={() => setMetricHelpVisible(true)} onHideHelp={() => setMetricHelpVisible(false)} activeAuditKey={activeAudit ? getPairMatrixAuditKey(activeAudit) : null} onSelectAudit={selectAudit} />
              </div>
            </div>
            ) : null}
            <div className="w-full min-w-0">
            <div className="border-b border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-800">During this {data.hasLockedRange ? "selected range" : "candle"}</div>
            <TimelineSection mode="during" data={data} groupBy={groupBy} expandedGroups={expandedGroups} onToggleGroup={toggleTimelineGroup} />
            <div className="sticky top-[98px] z-[2] flex items-center justify-between gap-4 border-y-2 border-slate-400 bg-slate-100 px-3 py-1.5">
              <strong className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-700">Before {data.hasLockedRange ? "range" : "candle"}</strong>
              <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                Lookback
                <input
                  className="h-6 w-16 rounded border border-slate-300 bg-white px-2 text-right font-mono text-[11px] font-black text-slate-800"
                  aria-label="Before range lookback days"
                  inputMode="numeric"
                  min={1}
                  max={PAIR_MATRIX_BEFORE_MAX_DAYS}
                  step={1}
                  value={lookbackInput}
                  onChange={(event) => setLookbackInput(event.target.value)}
                  onBlur={commitLookback}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                />
                days
              </label>
            </div>
            <TimelineSection mode="before" data={data} groupBy={groupBy} expandedGroups={expandedGroups} onToggleGroup={toggleTimelineGroup} />
            </div>
          </div>
          {activeAudit ? <PairMatrixAuditOverlay activeAudit={activeAudit} onClose={closeAudit} /> : null}
        </div>
      )}
      <ChartPairMatrixScoringGuide open={tutorialOpen} onClose={closeTutorial} />
    </section>
  );
});
