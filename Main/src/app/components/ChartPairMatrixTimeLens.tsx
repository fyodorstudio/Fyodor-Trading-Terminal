import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripHorizontal, SlidersHorizontal, Table2, X } from "lucide-react";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type {
  PairMatrixAlignmentRead,
  PairMatrixComparisonSummary,
  PairMatrixFactorComparison,
  PairMatrixFactorViewRow,
  PairMatrixPreferences,
  PairMatrixCalendarLookback,
  PairMatrixBundleDisplayMode,
  PairMatrixLayoutMode,
  PairMatrixSignalBiasMode,
  PairMatrixSignalWordingMode,
} from "@/app/lib/pairMatrixDriverAlignment";
import type { CalendarEvent } from "@/app/types";

export interface ChartPairMatrixTimeLensData {
  open: boolean;
  pairLabel: string;
  currencies: string[];
  rows: PairMatrixFactorViewRow[];
  comparisonSummary: PairMatrixComparisonSummary | null;
  preferences: PairMatrixPreferences;
  anchorLabel: string;
  anchorBasisLabel: string;
  coverageLabel: string;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  calendarDiagnostics: {
    lookbackLabel: string;
    loadStateLabel: string;
    loadedRangeLabel: string;
    anchorStatusLabel: string;
    canLoadOlder: boolean;
  };
  renderClosedButton?: boolean;
  onPreferenceChange: <K extends keyof PairMatrixPreferences>(key: K, value: PairMatrixPreferences[K]) => void;
  onLoadOlderCalendarContext: () => void;
  onToggleOpen: () => void;
  onClose: () => void;
}

interface ChartPairMatrixTimeLensProps {
  data: ChartPairMatrixTimeLensData;
  placement?: "overlay" | "bottom";
}

const READ_MODE_OPTIONS = [
  { value: "strongest", label: "Strongest", description: "Show the strongest loaded driver read for each factor row." },
  { value: "separate", label: "Separate", description: "Show base and quote driver reads separately when both are loaded." },
] as const;
const SENSITIVITY_OPTIONS = [
  { value: "low", label: "Low", description: "Accept smaller data surprises and smaller price moves." },
  { value: "normal", label: "Normal", description: "Use the default surprise and price-move thresholds." },
  { value: "high", label: "High", description: "Require larger data surprises and stronger price movement." },
] as const;
const SORT_OPTIONS = [
  { value: "factor", label: "Factor", description: "Keep the normal macro factor order." },
  { value: "driver_strength", label: "Drivers", description: "Bring accepted/rejected driver reads with larger moves upward." },
] as const;
const LOOKBACK_OPTIONS = [
  { value: "current_400d", label: "400d", description: "Use the current app calendar feed window." },
  { value: "two_year", label: "2y", description: "Load a Pair Matrix-owned two-year broker/MT5 calendar window." },
] as const;
const LAYOUT_OPTIONS = [
  { value: "signal_bands", label: "Bands", description: "Show seven one-line signal bands." },
  { value: "audit_lines", label: "Audit", description: "Show a little more row evidence for checking the numbers." },
  { value: "top_drivers", label: "Drivers", description: "Bring stronger driver rows to the top." },
] as const;
const SIGNAL_BIAS_OPTIONS = [
  { value: "macro_plus_acceptance", label: "Macro + price", description: "Use macro vote, then show whether price accepted or rejected it." },
  { value: "macro_vote", label: "Macro vote", description: "Use only the loaded macro vote for the headline direction." },
  { value: "accepted_drivers", label: "Drivers", description: "Use accepted/rejected driver reads for the headline." },
] as const;
const SIGNAL_WORDING_OPTIONS = [
  { value: "evidence_bias", label: "Evidence", description: "Use pair-direction wording such as EURUSD up bias." },
  { value: "trade_bias", label: "Trade bias", description: "Use Long bias or Short bias wording." },
] as const;
const BUNDLE_OPTIONS = [
  { value: "strongest_with_count", label: "Strongest +N", description: "Show the strongest same-time release and count the rest." },
  { value: "all_in_details", label: "All in details", description: "Keep bundled releases in row details instead of the signal band." },
] as const;

function formatEventTime(
  event: CalendarEvent | null,
  displayTimeMode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  if (!event) return "";
  return formatChartEventDisplayTime(event.time, displayTimeMode, sourceTimeOffsetSeconds);
}

function formatChartCoordinateTime(
  chartTime: number | null,
  displayTimeMode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  if (chartTime == null) return "-";
  return formatChartEventDisplayTime(chartTime - sourceTimeOffsetSeconds, displayTimeMode, sourceTimeOffsetSeconds);
}

function getYearFromLabel(label: string): string | null {
  return label.match(/\b(20\d{2})\b/)?.[1] ?? null;
}

function getMonthYearFromLabel(label: string): string {
  const match = label.match(/\b([A-Z][a-z]{2,4})\s+(20\d{2})\b/);
  return match ? `${match[1]} ${match[2]}` : label;
}

function formatCompactEventTime(
  event: CalendarEvent | null,
  data: Pick<ChartPairMatrixTimeLensData, "displayTimeMode" | "sourceTimeOffsetSeconds" | "anchorLabel">,
): string {
  if (!event) return "-";
  const full = formatEventTime(event, data.displayTimeMode, data.sourceTimeOffsetSeconds);
  const anchorYear = getYearFromLabel(data.anchorLabel);
  const eventYear = getYearFromLabel(full);
  if (anchorYear && eventYear === anchorYear) {
    return full.replace(` ${anchorYear}`, "");
  }
  return full;
}

function getEventFamilyLabel(factorId: string, title: string): string {
  const normalized = title.toLowerCase();
  if (factorId === "policy" || normalized.includes("rate")) return "Rates";
  if (normalized.includes("cpi")) return "CPI";
  if (normalized.includes("pce")) return "PCE";
  if (normalized.includes("ppi")) return "PPI";
  if (normalized.includes("payroll") || normalized.includes("nfp")) return "Jobs";
  if (normalized.includes("jobless") || normalized.includes("claims")) return "Claims";
  if (normalized.includes("unemployment")) return "Unemp";
  if (factorId === "retail") return "Retail";
  if (normalized.includes("pmi")) return "PMI";
  if (normalized.includes("ism")) return "ISM";
  if (factorId === "sentiment" || normalized.includes("confidence") || normalized.includes("sentiment")) return "Sentiment";
  if (factorId === "trade") return "Trade";
  return title.split(/\s+/).slice(0, 2).join(" ");
}

function formatBasisShort(side: PairMatrixFactorComparison["base"] | PairMatrixFactorComparison["quote"] | null): string {
  if (!side) return "basis -";
  if (side.basisLabel === "Actual vs forecast") return `F ${side.comparisonLabel}`;
  if (side.basisLabel === "Actual vs previous") return `P ${side.comparisonLabel}`;
  return side.basisLabel;
}

function formatBundleSuffix(count: number, mode: PairMatrixBundleDisplayMode): string {
  if (count <= 1 || mode === "all_in_details") return "";
  return ` +${count - 1}`;
}

function getReadableRows(rows: PairMatrixFactorViewRow[], layoutMode: PairMatrixLayoutMode): PairMatrixFactorViewRow[] {
  if (layoutMode !== "top_drivers") return rows;
  const statusRank: Record<string, number> = { aligned: 0, rejected: 1, muted: 2, unclear: 3 };
  return [...rows].sort((left, right) => {
    const leftRead = left.summaryAlignment;
    const rightRead = right.summaryAlignment;
    if (!leftRead && !rightRead) return 0;
    if (!leftRead) return 1;
    if (!rightRead) return -1;
    return statusRank[leftRead.status] - statusRank[rightRead.status] || rightRead.strengthScore - leftRead.strengthScore;
  });
}

function getSignalHeadline(
  pairLabel: string,
  summary: PairMatrixComparisonSummary | null,
  rows: PairMatrixFactorViewRow[],
  preferences: PairMatrixPreferences,
): { label: string; detail: string; className: string; title: string } {
  const reads = rows.map((row) => row.summaryAlignment).filter((read): read is PairMatrixAlignmentRead => Boolean(read));
  const aligned = reads.filter((read) => read.status === "aligned").length;
  const rejected = reads.filter((read) => read.status === "rejected").length;
  const strongest = reads[0] ?? null;
  const macroDirection =
    summary?.state === "base_leads"
      ? "up"
      : summary?.state === "quote_leads"
        ? "down"
        : null;
  const driverDirection =
    strongest?.expectedDirectionLabel.includes(" expected up")
      ? "up"
      : strongest?.expectedDirectionLabel.includes(" expected down")
        ? "down"
        : null;
  const direction =
    preferences.signalBiasMode === "accepted_drivers"
      ? driverDirection
      : preferences.signalBiasMode === "macro_vote"
        ? macroDirection
        : macroDirection ?? driverDirection;
  const reaction =
    preferences.signalBiasMode === "macro_vote"
      ? "macro vote"
      : aligned > rejected
        ? "price accepted"
        : rejected > aligned
          ? "price rejected"
          : "reaction mixed";
  const pair = pairLabel.toUpperCase();
  const directionLabel =
    !direction
      ? `${pair} mixed bias`
      : preferences.signalWordingMode === "trade_bias"
        ? direction === "up"
          ? "Long bias"
          : "Short bias"
        : `${pair} ${direction} bias`;

  return {
    label: `${directionLabel} - ${reaction}`,
    detail:
      preferences.signalBiasMode === "macro_vote"
        ? "Macro vote only"
        : preferences.signalBiasMode === "accepted_drivers"
          ? "Driver read only"
          : "Bias + reaction",
    className: direction === "up" ? "is-up" : direction === "down" ? "is-down" : "is-mixed",
    title: `${summary?.detailLabel ?? "No macro summary yet"} Driver reads: ${aligned} aligned, ${rejected} rejected.`,
  };
}

function getEventDisplayFields(event: CalendarEvent | null) {
  if (!event) {
    return {
      actual: "-",
      forecast: "-",
      previous: "-",
    };
  }

  return {
    actual: getEventValueDisplay(event.actual, event.title).display,
    forecast: getEventValueDisplay(event.forecast, event.title).display,
    previous: getEventValueDisplay(event.previous, event.title).display,
  };
}

function PairMatrixControl<K extends keyof PairMatrixPreferences>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: PairMatrixPreferences[K];
  options: ReadonlyArray<{ value: PairMatrixPreferences[K]; label: string; description: string }>;
  onChange: (value: PairMatrixPreferences[K]) => void;
}) {
  return (
    <div className="chart-pair-matrix-control">
      <span title={description}>{label}</span>
      <small>{description}</small>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={option.value === value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PairMatrixSummaryBox({
  label,
  detail,
  className = "",
  title,
  children,
}: {
  label: string;
  detail?: string;
  className?: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`chart-pair-matrix-summary-box ${className}`} title={title ?? `${label}${detail ? ` ${detail}` : ""}`}>
      <strong>{label}</strong>
      {children ?? (detail ? <em>{detail}</em> : null)}
    </span>
  );
}

type PairMatrixHeaderCounter = {
  label: string;
  value: number;
  title: string;
  tone?: "base" | "quote" | "green" | "red" | "outlier";
};

function SummaryCounterGroup({ counters }: { counters: PairMatrixHeaderCounter[] }) {
  return (
    <span className="chart-pair-matrix-counter-group">
      {counters.map((counter) => (
        <span key={counter.label} className={`chart-pair-matrix-counter ${counter.tone ? `is-${counter.tone}` : ""}`} title={counter.title}>
          <em>{counter.label}</em>
          <b>{counter.value}</b>
        </span>
      ))}
    </span>
  );
}

function getMacroVoteCounters(summary: PairMatrixComparisonSummary): PairMatrixHeaderCounter[] {
  const base = summary.factorReads.filter((read) => read.state === "base_leads").length;
  const quote = summary.factorReads.filter((read) => read.state === "quote_leads").length;
  const outlier = Math.max(0, summary.factorReads.length - base - quote);
  const outlierTitle = summary.otherBreakdownLabel
    ? `Outlier factors: ${summary.otherBreakdownLabel}.`
    : "Outlier factors are split, mixed, both supportive, both weak, no-surprise, partial, or unclear reads.";

  return [
    { label: "Base", value: base, tone: "base", title: `${summary.baseCurrency ?? "Base"} side leads in ${base} visible factor reads.` },
    { label: "Quote", value: quote, tone: "quote", title: `${summary.quoteCurrency ?? "Quote"} side leads in ${quote} visible factor reads.` },
    { label: "Outlier", value: outlier, tone: "outlier", title: outlierTitle },
  ];
}

function getDriverAcceptanceSummary(rows: PairMatrixFactorViewRow[]): { counters: PairMatrixHeaderCounter[]; title: string } {
  const reads = rows.map((row) => row.summaryAlignment).filter((read): read is PairMatrixAlignmentRead => read != null);
  const aligned = reads.filter((read) => read.status === "aligned").length;
  const rejected = reads.filter((read) => read.status === "rejected").length;
  const muted = reads.filter((read) => read.status === "muted").length;
  const unclear = reads.filter((read) => read.status === "unclear").length;
  const outlier = muted + unclear;

  if (reads.length === 0) {
    return {
      counters: [
        { label: "Green", value: 0, tone: "green", title: "Green counts price accepting the data-implied read." },
        { label: "Red", value: 0, tone: "red", title: "Red counts price rejecting the data-implied read." },
        { label: "Outlier", value: 0, tone: "outlier", title: "Outlier counts muted or unclear driver reads." },
      ],
      title: "Driver acceptance needs loaded releases and loaded candles from release close to cursor close.",
    };
  }

  return {
    counters: [
      { label: "Green", value: aligned, tone: "green", title: `Green: ${aligned} factor reads where price accepted the data-implied direction.` },
      { label: "Red", value: rejected, tone: "red", title: `Red: ${rejected} factor reads where price moved against the data-implied direction.` },
      { label: "Outlier", value: outlier, tone: "outlier", title: `Outlier: gray ${muted} muted reads plus amber ${unclear} unclear reads.` },
    ],
    title: `Driver color counts visible factor rows: green ${aligned}, red ${rejected}, gray ${muted}, amber ${unclear}.`,
  };
}

function getTopMoveRead(rows: PairMatrixFactorViewRow[]): PairMatrixAlignmentRead | null {
  return rows
    .map((row) => row.summaryAlignment)
    .filter((read): read is PairMatrixAlignmentRead => read != null && read.releaseChartTime != null && read.cursorChartTime != null)
    .reduce<PairMatrixAlignmentRead | null>((strongest, read) => {
      if (!strongest) return read;
      return read.strengthScore > strongest.strengthScore ? read : strongest;
    }, null);
}

function getMoveRangeLabel(
  read: PairMatrixAlignmentRead | null,
  displayTimeMode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  if (!read) return "no release-to-cursor candle window";
  return `${formatChartCoordinateTime(read.releaseChartTime, displayTimeMode, sourceTimeOffsetSeconds)} -> ${formatChartCoordinateTime(
    read.cursorChartTime,
    displayTimeMode,
    sourceTimeOffsetSeconds,
  )}`;
}

function getCompactMoveRangeLabel(
  read: PairMatrixAlignmentRead | null,
  displayTimeMode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  if (!read) return "no release-to-cursor window";
  const start = formatChartCoordinateTime(read.releaseChartTime, displayTimeMode, sourceTimeOffsetSeconds);
  const end = formatChartCoordinateTime(read.cursorChartTime, displayTimeMode, sourceTimeOffsetSeconds);
  const startYear = getYearFromLabel(start);
  const endYear = getYearFromLabel(end);
  if (startYear && endYear === startYear) {
    return `${start.replace(` ${startYear}`, "")} -> ${end.replace(` ${endYear}`, "")}`;
  }
  return `${start} -> ${end}`;
}

function PairMatrixHeaderSummary({
  summary,
  rows,
  pairLabel,
  anchorLabel,
  anchorBasisLabel,
  coverageLabel,
  calendarDiagnostics,
  displayTimeMode,
  sourceTimeOffsetSeconds,
  preferences,
  onPreferenceChange,
  onLoadOlderCalendarContext,
  onClose,
}: {
  summary: PairMatrixComparisonSummary | null;
  rows: PairMatrixFactorViewRow[];
  pairLabel: string;
  anchorLabel: string;
  anchorBasisLabel: string;
  coverageLabel: string;
  calendarDiagnostics: ChartPairMatrixTimeLensData["calendarDiagnostics"];
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  preferences: PairMatrixPreferences;
  onPreferenceChange: ChartPairMatrixTimeLensData["onPreferenceChange"];
  onLoadOlderCalendarContext: ChartPairMatrixTimeLensData["onLoadOlderCalendarContext"];
  onClose: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const driverSummary = getDriverAcceptanceSummary(rows);
  const topMoveRead = getTopMoveRead(rows);
  const moveRangeLabel = getMoveRangeLabel(topMoveRead, displayTimeMode, sourceTimeOffsetSeconds);
  const compactMoveRangeLabel = getCompactMoveRangeLabel(topMoveRead, displayTimeMode, sourceTimeOffsetSeconds);
  const headline = getSignalHeadline(pairLabel, summary, rows, preferences);
  const anchorMonthLabel = getMonthYearFromLabel(anchorLabel);

  return (
    <div className="chart-pair-matrix-head-summary" aria-label="Pair Matrix summary">
      <PairMatrixSummaryBox label={headline.label} detail={headline.detail} className={`is-signal ${headline.className}`} title={headline.title} />
      <PairMatrixSummaryBox label={anchorLabel} detail={`${anchorBasisLabel} / ${anchorMonthLabel}`} className="is-anchor" />
      {summary ? (
        <>
          <PairMatrixSummaryBox
            label="Macro vote"
            className={`is-state is-vote is-${summary.state}`}
            title={`${summary.modeLabel} / ${summary.winnerModeLabel}. ${summary.detailLabel}${summary.otherBreakdownLabel ? ` Outlier: ${summary.otherBreakdownLabel}.` : ""}`}
          >
            <SummaryCounterGroup counters={getMacroVoteCounters(summary)} />
          </PairMatrixSummaryBox>
          <PairMatrixSummaryBox
            label="Driver read"
            className="is-driver"
            title={driverSummary.title}
          >
            <SummaryCounterGroup counters={driverSummary.counters} />
          </PairMatrixSummaryBox>
          <PairMatrixSummaryBox
            label="Move size"
            detail={topMoveRead ? topMoveRead.priceMoveLabel : "no release-to-cursor candle window"}
            className="is-move"
            title={
              topMoveRead
                ? `Largest visible driver move. ${topMoveRead.eventTitle}: ${topMoveRead.priceMoveLabel}.`
                : "Move size needs loaded candles from release close to cursor close."
            }
          />
          <PairMatrixSummaryBox
            label="Range"
            detail={compactMoveRangeLabel}
            className="is-range"
            title={`Pips and percent are measured over this release-close to cursor-close range: ${moveRangeLabel}.`}
          />
        </>
      ) : null}
      <div className="chart-pair-matrix-settings">
        <button
          type="button"
          onClick={() => setSettingsOpen((current) => !current)}
          aria-label="Pair Matrix settings"
          aria-expanded={settingsOpen}
          title="Pair Matrix settings"
        >
          <SlidersHorizontal size={15} />
        </button>
        <div className="chart-pair-matrix-settings-popover" hidden={!settingsOpen}>
          <div className="chart-pair-matrix-settings-details">
            <strong>Evidence Signal settings</strong>
            <p>Evidence Signal combines macro vote, expected pair direction, and release-to-cursor price acceptance.</p>
            <div className="chart-pair-matrix-signal-legend" aria-label="Evidence Signal color guide">
              <span className="is-green" title="Price moved with the data-implied pair direction."><b />Green: price accepted the read</span>
              <span className="is-red" title="Price moved against the data-implied pair direction."><b />Red: price rejected the read</span>
              <span className="is-gray" title="Price move was below the configured sensitivity threshold."><b />Gray: move too small</span>
              <span className="is-amber" title="The loaded data cannot honestly infer a direction."><b />Amber: no clear directional read</span>
              <span className="is-blue" title="Base side scores stronger than quote side."><b />Blue: base side stronger</span>
              <span className="is-purple" title="Quote side scores stronger than base side."><b />Purple: quote side stronger</span>
            </div>
            <div className="chart-pair-matrix-settings-meta">
              <span title="How many base/quote factor cells currently have loaded latest or next release evidence.">{coverageLabel}</span>
              <span title="Pair Matrix v1 only reads local MT5 candles and loaded broker/MT5 calendar rows.">Loaded broker/MT5 rows only</span>
              <span title="Current Pair Matrix calendar lookback mode.">{calendarDiagnostics.lookbackLabel}</span>
              <span title="Current Pair Matrix calendar fetch state.">{calendarDiagnostics.loadStateLabel}</span>
              <span title="Oldest and newest broker/MT5 calendar rows currently available to Pair Matrix.">{calendarDiagnostics.loadedRangeLabel}</span>
              <span title="Whether the cursor anchor is inside the loaded Pair Matrix calendar range.">{calendarDiagnostics.anchorStatusLabel}</span>
            </div>
            {calendarDiagnostics.canLoadOlder ? (
              <button
                type="button"
                className="chart-pair-matrix-load-older"
                onClick={onLoadOlderCalendarContext}
                title="Load a Pair Matrix-owned two-year broker/MT5 calendar window. This does not expand the global app feed."
              >
                Load 2y calendar context
              </button>
            ) : null}
          </div>
            <PairMatrixControl
              label="Layout"
              description="Choose the default signal bands, two-line audit rows, or top-driver focus order."
              value={preferences.layoutMode}
              options={LAYOUT_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("layoutMode", value as PairMatrixLayoutMode)
              }
            />
            <PairMatrixControl
              label="Signal"
              description="Choose how the header bias is derived from macro vote and accepted/rejected driver reads."
              value={preferences.signalBiasMode}
              options={SIGNAL_BIAS_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("signalBiasMode", value as PairMatrixSignalBiasMode)
              }
            />
            <PairMatrixControl
              label="Wording"
              description="Choose pair-direction evidence wording or trade-bias wording for the headline."
              value={preferences.signalWordingMode}
              options={SIGNAL_WORDING_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("signalWordingMode", value as PairMatrixSignalWordingMode)
              }
            />
            <PairMatrixControl
              label="Bundles"
              description="Choose whether bundled same-time releases show as strongest plus count or only inside details."
              value={preferences.bundleDisplayMode}
              options={BUNDLE_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("bundleDisplayMode", value as PairMatrixBundleDisplayMode)
              }
            />
            <PairMatrixControl
              label="Lookback"
              description="Choose the Pair Matrix-owned calendar lookback. Deeper context loads only for Pair Matrix."
              value={preferences.calendarLookback}
              options={LOOKBACK_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("calendarLookback", value as PairMatrixCalendarLookback)
              }
            />
            <PairMatrixControl
              label="Read"
              description="Choose whether each factor shows the strongest driver read or separate base/quote reads."
              value={preferences.driverReadMode}
              options={READ_MODE_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("driverReadMode", value as PairMatrixPreferences["driverReadMode"])
              }
            />
            <PairMatrixControl
              label="Sensitivity"
              description="Controls how much data surprise and price movement are needed before a read is treated as active."
              value={preferences.surpriseSensitivity}
              options={SENSITIVITY_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("surpriseSensitivity", value as PairMatrixPreferences["surpriseSensitivity"])
              }
            />
            <PairMatrixControl
              label="Sort"
              description="Choose normal factor order or bring stronger accepted/rejected driver reads upward."
              value={preferences.rowSortMode}
              options={SORT_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("rowSortMode", value as PairMatrixPreferences["rowSortMode"])
              }
            />
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close Pair Matrix Time Lens">
        <X size={15} />
      </button>
    </div>
  );
}

function getBundleTitle(events: CalendarEvent[], data: ChartPairMatrixTimeLensData): string {
  if (events.length === 0) return "none";
  return events
    .map((event) => {
      const fields = getEventDisplayFields(event);
      return `${event.title}: A ${fields.actual}, F ${fields.forecast}, P ${fields.previous}, ${formatEventTime(
        event,
        data.displayTimeMode,
        data.sourceTimeOffsetSeconds,
      )}`;
    })
    .join(" / ");
}

function SignalSideRead({
  currency,
  cell,
  side,
  factorId,
  data,
}: {
  currency: string;
  cell: PairMatrixFactorViewRow["cells"][number] | null;
  side: PairMatrixFactorComparison["base"] | PairMatrixFactorComparison["quote"] | null;
  factorId: string;
  data: ChartPairMatrixTimeLensData;
}) {
  const event = cell?.latestEvent ?? null;
  const fields = getEventDisplayFields(event);
  const bundleSuffix = formatBundleSuffix(cell?.latestBundleCount ?? 0, data.preferences.bundleDisplayMode);
  const title = `Latest: ${getBundleTitle(cell?.latestBundleEvents ?? [], data)}. Next: ${getBundleTitle(
    cell?.nextBundleEvents ?? [],
    data,
  )}. ${side?.formulaLabel ?? cell?.latestReasonDetail ?? ""}`;

  if (!event) {
    return (
      <span className="chart-pair-matrix-signal-read is-empty" title={title}>
        <strong>{currency}</strong>
        <span>{cell?.latestReasonLabel ?? "no loaded release"}</span>
        <time>-</time>
      </span>
    );
  }

  return (
    <span className="chart-pair-matrix-signal-read" title={title}>
      <strong>{currency} {getEventFamilyLabel(factorId, event.title)}{bundleSuffix}</strong>
      <span>A {fields.actual} / {formatBasisShort(side)} / Surp {side?.rawSurpriseLabel ?? "-"}</span>
      <time>{formatCompactEventTime(event, data)}</time>
    </span>
  );
}

function SignalWinnerCell({ comparison }: { comparison: PairMatrixFactorComparison | null }) {
  if (!comparison) return <span className="chart-pair-matrix-signal-winner is-empty">No read</span>;
  return (
    <span className={`chart-pair-matrix-signal-winner is-${comparison.state}`} title={`${comparison.detailLabel}. ${comparison.contextTitle ?? ""}`}>
      <strong>{comparison.detailLabel}</strong>
      <span>{comparison.base?.scoreLabel ?? "-"} / {comparison.quote?.scoreLabel ?? "-"}</span>
      {comparison.contextLabel ? <em>{comparison.contextLabel}</em> : null}
    </span>
  );
}

function SignalReactionCell({
  read,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  read: PairMatrixAlignmentRead | null;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  if (!read) return <span className="chart-pair-matrix-signal-reaction is-empty">No driver</span>;
  const hasRange = read.releaseChartTime != null && read.cursorChartTime != null;
  const rangeLabel = hasRange
    ? `${formatChartCoordinateTime(read.releaseChartTime, displayTimeMode, sourceTimeOffsetSeconds)} -> ${formatChartCoordinateTime(
        read.cursorChartTime,
        displayTimeMode,
        sourceTimeOffsetSeconds,
      )}`
    : read.reasonLabel;
  const expectedShortLabel = read.expectedDirectionLabel.replace(/^[A-Z0-9]+ expected /, "Expected ");
  const directionLabel = read.status === "unclear" ? read.reasonLabel : `${expectedShortLabel} / ${read.actualDirectionLabel}`;
  const primaryLine = read.status === "unclear" ? "No directional read" : read.priceMoveLabel;
  const secondaryLine = read.status === "unclear" ? "No expected/price match" : directionLabel;

  return (
    <span className={`chart-pair-matrix-signal-reaction is-${read.status}`} title={`${read.reason} Range ${rangeLabel}.`}>
      <strong>{primaryLine}</strong>
      <em>{secondaryLine}</em>
    </span>
  );
}

function PairMatrixFactorRow({
  row,
  data,
  selected,
  onToggleDetails,
}: {
  row: PairMatrixFactorViewRow;
  data: ChartPairMatrixTimeLensData;
  selected: boolean;
  onToggleDetails: () => void;
}) {
  const baseCurrency = data.currencies[0] ?? "Base";
  const quoteCurrency = data.currencies[1] ?? "Quote";
  const baseCell = row.cells.find((cell) => cell.currency === baseCurrency) ?? row.cells[0] ?? null;
  const quoteCell = row.cells.find((cell) => cell.currency === quoteCurrency) ?? (data.currencies.length > 1 ? row.cells[1] : null);
  const title = `${row.factor.label}. ${baseCurrency}: latest ${baseCell?.latestEvent?.title ?? baseCell?.latestReasonLabel ?? "-"}; next ${
    baseCell?.nextEvent?.title ?? baseCell?.nextReasonLabel ?? "-"
  }. ${quoteCurrency}: latest ${quoteCell?.latestEvent?.title ?? quoteCell?.latestReasonLabel ?? "-"}; next ${
    quoteCell?.nextEvent?.title ?? quoteCell?.nextReasonLabel ?? "-"
  }.`;

  return (
    <article
      className={`chart-pair-matrix-row is-signal-band ${selected ? "is-selected" : ""} ${row.summaryAlignment ? `is-${row.summaryAlignment.status}` : ""} layout-${data.preferences.layoutMode}`}
      title={title}
      role="button"
      tabIndex={0}
      onClick={onToggleDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleDetails();
        }
      }}
    >
      <div className="chart-pair-matrix-factor">
        <strong>{row.factor.label}</strong>
        <span>Details available</span>
      </div>
      <SignalSideRead
        currency={baseCurrency}
        cell={baseCell}
        side={row.comparison?.base ?? null}
        factorId={row.factor.id}
        data={data}
      />
      <SignalSideRead
        currency={quoteCurrency}
        cell={quoteCell}
        side={row.comparison?.quote ?? null}
        factorId={row.factor.id}
        data={data}
      />
      <SignalWinnerCell comparison={row.comparison} />
      <SignalReactionCell
        read={row.summaryAlignment}
        displayTimeMode={data.displayTimeMode}
        sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
      />
    </article>
  );
}

function PairMatrixDetailsPanel({
  row,
  data,
  onClose,
}: {
  row: PairMatrixFactorViewRow;
  data: ChartPairMatrixTimeLensData;
  onClose: () => void;
}) {
  const renderEvents = (label: string, events: CalendarEvent[], emptyReason: string) => (
    <div>
      <strong>{label}</strong>
      {events.length > 0 ? (
        events.map((event) => {
          const fields = getEventDisplayFields(event);
          return (
            <span key={`${label}:${event.id}:${event.time}`} title={event.title}>
              {event.currency} {event.title}: A {fields.actual} / F {fields.forecast} / P {fields.previous} / {formatEventTime(event, data.displayTimeMode, data.sourceTimeOffsetSeconds)}
            </span>
          );
        })
      ) : (
        <span>{emptyReason}</span>
      )}
    </div>
  );

  return (
    <aside className="chart-pair-matrix-detail-panel" aria-label={`${row.factor.label} details`}>
      <button type="button" onClick={onClose} aria-label="Close Pair Matrix factor details">
        <X size={13} />
      </button>
      <h3>{row.factor.label}</h3>
      {row.cells.map((cell) => (
        <section key={cell.currency}>
          <h4>{cell.currency}</h4>
          {renderEvents("Latest", cell.latestBundleEvents, cell.latestReasonLabel)}
          {renderEvents("Next", cell.nextBundleEvents, cell.nextReasonLabel)}
        </section>
      ))}
      {row.comparison ? (
        <p title={row.comparison.contextTitle ?? row.comparison.detailLabel}>
          {row.comparison.detailLabel}
          {row.comparison.contextLabel ? ` / ${row.comparison.contextLabel}` : ""}
        </p>
      ) : null}
      {row.summaryAlignment ? <p title={row.summaryAlignment.reason}>{row.summaryAlignment.reason}</p> : null}
    </aside>
  );
}

export function ChartPairMatrixTimeLens({ data, placement = "overlay" }: ChartPairMatrixTimeLensProps) {
  const lensRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);

  const handleDragMove = useCallback((event: PointerEvent) => {
    const start = dragStartRef.current;
    if (!start || event.pointerId !== start.pointerId) return;
    const nextX = Math.min(start.maxX, Math.max(start.minX, start.startOffsetX + event.clientX - start.startClientX));
    const nextY = Math.min(start.maxY, Math.max(start.minY, start.startOffsetY + event.clientY - start.startClientY));
    setDragOffset({ x: nextX, y: nextY });
  }, []);

  const stopDrag = useCallback((event?: PointerEvent) => {
    if (event && dragStartRef.current && event.pointerId !== dragStartRef.current.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return undefined;
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [handleDragMove, isDragging, stopDrag]);

  const handleDragStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (placement === "bottom") return;
      if (!data.open || event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button, input, select, textarea, a, [role='button'], [role='group']")
      ) {
        return;
      }
      const lens = lensRef.current;
      const parent = lens?.parentElement;
      if (!lens || !parent) return;
      const lensRect = lens.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const baseLeft = lensRect.left - dragOffset.x;
      const baseRight = lensRect.right - dragOffset.x;
      const baseTop = lensRect.top - dragOffset.y;
      const baseBottom = lensRect.bottom - dragOffset.y;

      dragStartRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: dragOffset.x,
        startOffsetY: dragOffset.y,
        minX: parentRect.left - baseLeft,
        maxX: parentRect.right - baseRight,
        minY: parentRect.top - baseTop,
        maxY: parentRect.bottom - baseBottom,
      };
      setIsDragging(true);
      event.preventDefault();
    },
    [data.open, dragOffset.x, dragOffset.y, placement],
  );

  if (!data.open && data.renderClosedButton === false) return null;

  const lensStyle = data.open
    ? ({
        "--pair-matrix-drag-x": `${dragOffset.x}px`,
        "--pair-matrix-drag-y": `${dragOffset.y}px`,
      } as CSSProperties)
    : undefined;
  const readableRows = getReadableRows(data.rows, data.preferences.layoutMode);
  const selectedRow = readableRows.find((row) => row.factor.id === selectedFactorId) ?? null;

  return (
    <section
      ref={lensRef}
      className={`chart-pair-matrix-lens ${data.open ? "is-open" : ""} ${placement === "bottom" ? "is-bottom-pane" : ""} ${isDragging ? "is-dragging" : ""} density-${data.preferences.displayDensity}`}
      aria-label="Pair Matrix Time Lens"
      style={lensStyle}
      onPointerDown={handleDragStart}
    >
      {!data.open ? (
        <button
          type="button"
          className="chart-pair-matrix-bookmark"
          title="Open Pair Matrix Time Lens"
          aria-label="Open Pair Matrix Time Lens"
          onClick={data.onToggleOpen}
          aria-expanded={false}
        >
          <Table2 size={15} />
        </button>
      ) : (
        <div className="chart-pair-matrix-popover">
          <div className="chart-pair-matrix-head">
            <div className="chart-pair-matrix-title">
              <span>{placement === "overlay" ? <GripHorizontal size={13} /> : null} Pair Matrix Time Lens</span>
              <strong>{data.pairLabel}</strong>
            </div>
            <PairMatrixHeaderSummary
              summary={data.comparisonSummary}
              rows={data.rows}
              pairLabel={data.pairLabel}
              anchorLabel={data.anchorLabel}
              anchorBasisLabel={data.anchorBasisLabel}
              coverageLabel={data.coverageLabel}
              calendarDiagnostics={data.calendarDiagnostics}
              displayTimeMode={data.displayTimeMode}
              sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
              preferences={data.preferences}
              onPreferenceChange={data.onPreferenceChange}
              onLoadOlderCalendarContext={data.onLoadOlderCalendarContext}
              onClose={data.onClose}
            />
          </div>

          {data.currencies.length === 0 ? (
            <p className="chart-pair-matrix-note">No base/quote currency context is available for this symbol.</p>
          ) : data.rows.length === 0 ? (
            <p className="chart-pair-matrix-note">Move the cursor over a loaded candle, or wait for chart history to load.</p>
          ) : (
            <div className="chart-pair-matrix-scroll">
              <div className="chart-pair-matrix-row-head" aria-hidden="true">
                <span>Factor</span>
                <span>{data.currencies[0] ?? "Base"} read</span>
                <span>{data.currencies[1] ?? "Quote"} read</span>
                <span>Winner</span>
                <span>Reaction</span>
              </div>
              <div className="chart-pair-matrix-row-list">
                {readableRows.map((row) => (
                  <PairMatrixFactorRow
                    key={row.factor.id}
                    row={row}
                    data={data}
                    selected={selectedFactorId === row.factor.id}
                    onToggleDetails={() => setSelectedFactorId((current) => (current === row.factor.id ? null : row.factor.id))}
                  />
                ))}
              </div>
              {selectedRow ? (
                <PairMatrixDetailsPanel row={selectedRow} data={data} onClose={() => setSelectedFactorId(null)} />
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
