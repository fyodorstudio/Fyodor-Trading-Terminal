import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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

function getBasisValueDisplay(side: PairMatrixFactorComparison["base"] | PairMatrixFactorComparison["quote"] | null): { label: string; value: string } {
  if (!side) return { label: "B", value: "-" };
  if (side.basisLabel === "Actual vs forecast") return { label: "F", value: side.comparisonLabel };
  if (side.basisLabel === "Actual vs previous") return { label: "P", value: side.comparisonLabel };
  return { label: "B", value: side.comparisonLabel };
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

function formatSignedPointValue(value: number): string {
  const formatted = value.toFixed(1);
  return value > 0 ? `+${formatted}` : formatted;
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
}: {
  label: string;
  detail?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`chart-pair-matrix-summary-box ${className}`} title={title ?? `${label}${detail ? ` ${detail}` : ""}`}>
      <strong>{label}</strong>
      {detail ? <em>{detail}</em> : null}
    </span>
  );
}

type PairMatrixHeaderCountLine = {
  label: string;
  detail: string;
  title: string;
  className?: string;
};

function getMacroVoteCountLine(summary: PairMatrixComparisonSummary): PairMatrixHeaderCountLine {
  const base = summary.factorReads.filter((read) => read.state === "base_leads").length;
  const quote = summary.factorReads.filter((read) => read.state === "quote_leads").length;
  const outlier = Math.max(0, summary.factorReads.length - base - quote);
  const outlierTitle = summary.otherBreakdownLabel ? ` Outlier: ${summary.otherBreakdownLabel}.` : "";

  return {
    label: `Shock: ${base}/${quote}/${outlier}`,
    detail: "Base / Quote / Outlier",
    title: `${summary.modeLabel} / ${summary.winnerModeLabel}. Base ${base}, quote ${quote}, outlier ${outlier}.${outlierTitle} ${summary.detailLabel}`,
  };
}

function getLevelCountLine(rows: PairMatrixFactorViewRow[]): PairMatrixHeaderCountLine {
  const reads = rows.map((row) => row.comparison).filter((comparison): comparison is PairMatrixFactorComparison => Boolean(comparison));
  const base = reads.filter((read) => read.levelState === "base").length;
  const quote = reads.filter((read) => read.levelState === "quote").length;
  const outlier = Math.max(0, reads.length - base - quote);
  const mixed = reads.filter((read) => read.levelState === "mixed").length;
  const even = reads.filter((read) => read.levelState === "even").length;
  const unavailable = reads.filter((read) => read.levelState === "unavailable").length;
  const className =
    base > quote && base > outlier
      ? "is-level-base"
      : quote > base && quote > outlier
        ? "is-level-quote"
        : outlier > base && outlier > quote
          ? "is-level-outlier"
          : "is-level-mixed";

  return {
    label: `Level: ${base}/${quote}/${outlier}`,
    detail: "Base / Quote / Outlier",
    className,
    title: `Comparable actual-level reads: base ${base}, quote ${quote}, outlier ${outlier}. Outlier includes even ${even}, mixed ${mixed}, unavailable ${unavailable}.`,
  };
}

function getDriverAcceptanceSummary(rows: PairMatrixFactorViewRow[], activeRead: PairMatrixAlignmentRead | null): PairMatrixHeaderCountLine {
  const reads = rows.map((row) => row.summaryAlignment).filter((read): read is PairMatrixAlignmentRead => read != null);
  const aligned = reads.filter((read) => read.status === "aligned").length;
  const rejected = reads.filter((read) => read.status === "rejected").length;
  const muted = reads.filter((read) => read.status === "muted").length;
  const unclear = reads.filter((read) => read.status === "unclear").length;
  const outlier = muted + unclear;

  if (reads.length === 0) {
    return {
      label: "Reaction: 0/0/0",
      detail: "Green / Red / Outlier",
      className: "is-driver-outlier",
      title: "Driver acceptance needs loaded releases and loaded candles from release close to cursor close.",
    };
  }
  const driverClassName =
    aligned > rejected && aligned > outlier
      ? "is-driver-green"
      : rejected > aligned && rejected > outlier
        ? "is-driver-red"
        : outlier > aligned && outlier > rejected
          ? "is-driver-outlier"
          : "is-driver-mixed";

  return {
    label: `Reaction: ${aligned}/${rejected}/${outlier}`,
    detail: activeRead?.priceMoveLabel ?? "Green / Red / Outlier",
    className: driverClassName,
    title: `Release-to-cursor window reaction. Green ${aligned}, red ${rejected}, gray ${muted}, amber ${unclear}. Selected row move: ${activeRead?.priceMoveLabel ?? "not available"}.`,
  };
}

type PairMatrixMacroHealthCounts = {
  good: number;
  bad: number;
  neutral: number;
  unknown: number;
  score: number;
  known: number;
  total: number;
};

function countMacroHealth(rows: PairMatrixFactorViewRow[], side: "base" | "quote"): PairMatrixMacroHealthCounts {
  return rows.reduce<PairMatrixMacroHealthCounts>(
    (current, row) => {
      const health = row.comparison?.[side]?.macroHealth ?? null;
      if (!health) return { ...current, unknown: current.unknown + 1, total: current.total + 1 };
      const score = health.score ?? 0;
      return {
        good: current.good + (health.state === "good" ? 1 : 0),
        bad: current.bad + (health.state === "bad" ? 1 : 0),
        neutral: current.neutral + (health.state === "neutral" ? 1 : 0),
        unknown: current.unknown + (health.state === "unknown" ? 1 : 0),
        score: current.score + score,
        known: current.known + (health.state === "unknown" ? 0 : 1),
        total: current.total + 1,
      };
    },
    { good: 0, bad: 0, neutral: 0, unknown: 0, score: 0, known: 0, total: 0 },
  );
}

function formatMacroHealthCounts(counts: PairMatrixMacroHealthCounts): string {
  return `${counts.good}G / ${counts.bad}B / ${counts.neutral}N / ${counts.unknown}U`;
}

function getMacroHealthCountLine(rows: PairMatrixFactorViewRow[], currency: string, side: "base" | "quote"): PairMatrixHeaderCountLine {
  const counts = countMacroHealth(rows, side);
  const className = counts.score > 0 ? "is-macro-good" : counts.score < 0 ? "is-macro-bad" : counts.unknown > counts.known ? "is-macro-unknown" : "is-macro-neutral";
  return {
    label: `${currency} Macro`,
    detail: formatMacroHealthCounts(counts),
    className,
    title: `${currency} FX-supportive macro health across loaded factor rows. Good ${counts.good}, Bad ${counts.bad}, Neutral ${counts.neutral}, Unknown ${counts.unknown}. Good means usually supportive for ${currency}; Bad means usually negative; Neutral means valid but no meaningful impulse; Unknown means missing, unparsable, future, no basis, incompatible, or no safe rule.`,
  };
}

function getMacroCompareLine(rows: PairMatrixFactorViewRow[], baseCurrency: string, quoteCurrency: string): PairMatrixHeaderCountLine {
  const baseCounts = countMacroHealth(rows, "base");
  const quoteCounts = countMacroHealth(rows, "quote");
  const lowConfidence = baseCounts.known < Math.ceil(Math.max(1, baseCounts.total) / 2) || quoteCounts.known < Math.ceil(Math.max(1, quoteCounts.total) / 2);
  const delta = baseCounts.score - quoteCounts.score;
  let detail = "Low confidence";
  let className = "is-compare-low";

  if (!lowConfidence) {
    if (baseCounts.score > 0 && quoteCounts.score > 0) {
      detail = delta === 0 ? "Both strong" : delta > 0 ? `Both strong - ${baseCurrency} edges` : `Both strong - ${quoteCurrency} edges`;
      className = "is-compare-strong";
    } else if (baseCounts.score < 0 && quoteCounts.score < 0) {
      detail = delta === 0 ? "Both weak" : delta > 0 ? `Both weak - ${baseCurrency} less bad` : `Both weak - ${quoteCurrency} less bad`;
      className = "is-compare-weak";
    } else if (delta === 0) {
      detail = "No clean edge";
      className = "is-compare-neutral";
    } else {
      detail = delta > 0 ? `${baseCurrency} stronger` : `${quoteCurrency} stronger`;
      className = delta > 0 ? "is-compare-base" : "is-compare-quote";
    }
  }

  return {
    label: "Compare",
    detail,
    className,
    title: `${baseCurrency} macro ${formatMacroHealthCounts(baseCounts)}; ${quoteCurrency} macro ${formatMacroHealthCounts(quoteCounts)}. Compare uses Good minus Bad counts and marks Low confidence when either side has too many Unknown rows.`,
  };
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

function compactLabelAgainstAnchor(label: string, anchorLabel: string): string {
  const anchorYear = getYearFromLabel(anchorLabel);
  const labelYear = getYearFromLabel(label);
  if (anchorYear && labelYear === anchorYear) return label.replace(` ${labelYear}`, "");
  return label;
}

function getEvidenceWindowLabels(
  cell: PairMatrixFactorViewRow["cells"][number] | null,
  data: Pick<ChartPairMatrixTimeLensData, "displayTimeMode" | "sourceTimeOffsetSeconds" | "anchorLabel" | "anchorBasisLabel">,
): { releaseLabel: string; untilLabel: string; title: string } {
  const releaseFull = cell?.latestEvent
    ? formatEventTime(cell.latestEvent, data.displayTimeMode, data.sourceTimeOffsetSeconds)
    : "-";
  const nextFull = cell?.nextEvent
    ? formatEventTime(cell.nextEvent, data.displayTimeMode, data.sourceTimeOffsetSeconds)
    : null;
  const cursorFull = data.anchorLabel;
  const releaseLabel = releaseFull === "-" ? "Rel -" : `Rel ${compactLabelAgainstAnchor(releaseFull, data.anchorLabel)}`;
  const untilLabel = nextFull
    ? `Next ${compactLabelAgainstAnchor(nextFull, data.anchorLabel)}`
    : `Cursor ${compactLabelAgainstAnchor(cursorFull, data.anchorLabel)}`;

  return {
    releaseLabel,
    untilLabel,
    title: nextFull
      ? `Evidence window: latest release ${releaseFull} until next matching loaded release ${nextFull}.`
      : `Evidence window: latest release ${releaseFull} until ${data.anchorBasisLabel} ${cursorFull}.`,
  };
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
  activeRow,
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
  activeRow: PairMatrixFactorViewRow | null;
  onPreferenceChange: ChartPairMatrixTimeLensData["onPreferenceChange"];
  onLoadOlderCalendarContext: ChartPairMatrixTimeLensData["onLoadOlderCalendarContext"];
  onClose: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const baseCurrency = summary?.baseCurrency ?? rows[0]?.cells[0]?.currency ?? pairLabel.slice(0, 3).toUpperCase() ?? "Base";
  const quoteCurrency = summary?.quoteCurrency ?? rows[0]?.cells[1]?.currency ?? pairLabel.slice(3, 6).toUpperCase() ?? "Quote";
  const baseMacroLine = getMacroHealthCountLine(rows, baseCurrency, "base");
  const quoteMacroLine = getMacroHealthCountLine(rows, quoteCurrency, "quote");
  const compareLine = getMacroCompareLine(rows, baseCurrency, quoteCurrency);
  const macroVoteLine = summary ? getMacroVoteCountLine(summary) : null;
  const levelLine = getLevelCountLine(rows);
  const activeMoveRead = activeRow?.summaryAlignment ?? null;
  const driverSummary = getDriverAcceptanceSummary(rows, activeMoveRead);
  const moveRangeLabel = getMoveRangeLabel(activeMoveRead, displayTimeMode, sourceTimeOffsetSeconds);
  const compactMoveRangeLabel = getCompactMoveRangeLabel(activeMoveRead, displayTimeMode, sourceTimeOffsetSeconds);
  const anchorMonthLabel = getMonthYearFromLabel(anchorLabel);

  return (
    <div className="chart-pair-matrix-head-summary" aria-label="Pair Matrix summary">
      <PairMatrixSummaryBox label={baseMacroLine.label} detail={baseMacroLine.detail} className={`is-macro ${baseMacroLine.className ?? ""}`} title={baseMacroLine.title} />
      <PairMatrixSummaryBox label={quoteMacroLine.label} detail={quoteMacroLine.detail} className={`is-macro ${quoteMacroLine.className ?? ""}`} title={quoteMacroLine.title} />
      <PairMatrixSummaryBox label={compareLine.label} detail={compareLine.detail} className={`is-compare ${compareLine.className ?? ""}`} title={compareLine.title} />
      <PairMatrixSummaryBox label={anchorLabel} detail={`${anchorBasisLabel} / ${anchorMonthLabel}`} className="is-anchor" />
      {summary && macroVoteLine ? (
        <>
          <PairMatrixSummaryBox
            label={macroVoteLine.label}
            detail={macroVoteLine.detail}
            className={`is-state is-vote is-${summary.state}`}
            title={macroVoteLine.title}
          />
          <PairMatrixSummaryBox
            label={levelLine.label}
            detail={levelLine.detail}
            className={`is-state is-level ${levelLine.className ?? "is-level-mixed"}`}
            title={levelLine.title}
          />
          <PairMatrixSummaryBox
            label={driverSummary.label}
            detail={driverSummary.detail}
            className={`is-state is-driver ${driverSummary.className ?? "is-driver-mixed"}`}
            title={driverSummary.title}
          />
          <PairMatrixSummaryBox
            label="Window"
            detail={compactMoveRangeLabel}
            className="is-range"
            title={`${activeRow?.factor.label ?? "Selected factor"} price move window. Pips and percent are measured from release-close candle to cursor-close candle: ${moveRangeLabel}.`}
          />
        </>
      ) : null}
      <button
        type="button"
        className={`chart-pair-matrix-hierarchy-toggle ${preferences.layoutMode === "top_drivers" ? "is-active" : ""}`}
        onClick={() =>
          onPreferenceChange("layoutMode", preferences.layoutMode === "top_drivers" ? "signal_bands" : "top_drivers")
        }
        title="Toggle hierarchy view. When active, stronger accepted/rejected evidence rows move upward."
        aria-pressed={preferences.layoutMode === "top_drivers"}
      >
        Hierarchy
      </button>
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
            <p>Macro boxes grade each currency first. Good means FX-supportive, Bad means FX-negative, Neutral means valid but no meaningful impulse, and Unknown means Pair Matrix cannot honestly classify the loaded row.</p>
            <div className="chart-pair-matrix-signal-legend" aria-label="Evidence Signal color guide">
              <span className="is-green" title="Row tint means the loaded economic evidence implies EURUSD up."><b />Green row: EURUSD up bias</span>
              <span className="is-red" title="Row tint means the loaded economic evidence implies EURUSD down."><b />Red row: EURUSD down bias</span>
              <span className="is-green" title="Reaction stripe means price moved with the data-implied pair direction."><b />Green reaction: accepted</span>
              <span className="is-red" title="Reaction stripe means price moved against the data-implied pair direction."><b />Red reaction: rejected</span>
              <span className="is-gray" title="Price move was below the configured sensitivity threshold."><b />Gray: move too small</span>
              <span className="is-amber" title="The loaded data cannot honestly infer a direction."><b />Amber: no clear directional read</span>
              <span className="is-blue" title="Base side scores stronger than quote side."><b />Blue: base side stronger</span>
              <span className="is-purple" title="Quote side scores stronger than base side."><b />Purple: quote side stronger</span>
            </div>
            <p title="Shock uses actual versus forecast/previous surprise. Level compares the per-currency macro-health reads first, then only uses raw actual levels when the comparison is honest. Reaction is price movement from release-close candle to cursor-close candle.">
              Shock = surprise. Level = grounded macro-health comparison. Reaction = release-to-cursor price response.
            </p>
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
  const basis = getBasisValueDisplay(side);
  const bundleSuffix = formatBundleSuffix(cell?.latestBundleCount ?? 0, data.preferences.bundleDisplayMode);
  const windowLabels = getEvidenceWindowLabels(cell, data);
  const title = `Latest: ${getBundleTitle(cell?.latestBundleEvents ?? [], data)}. Next: ${getBundleTitle(
    cell?.nextBundleEvents ?? [],
    data,
  )}. ${windowLabels.title} ${side?.formulaLabel ?? cell?.latestReasonDetail ?? ""} ${side?.macroHealth.title ?? ""}`;
  const healthLabel = side?.macroHealth.label ?? "Unknown";

  if (!event) {
    return (
      <span className="chart-pair-matrix-signal-read is-empty" title={title}>
        <strong>{currency} - {healthLabel}</strong>
        <span>{cell?.latestReasonLabel ?? "no loaded release"}</span>
        <time title={windowLabels.title}>
          <b>{windowLabels.releaseLabel}</b>
          <em>{windowLabels.untilLabel}</em>
        </time>
      </span>
    );
  }

  return (
    <span className="chart-pair-matrix-signal-read" title={title}>
      <strong>{currency} {getEventFamilyLabel(factorId, event.title)}{bundleSuffix} - {healthLabel}</strong>
      <span className="chart-pair-matrix-signal-values">
        <b>A {fields.actual}</b>
        <b>{basis.label} {basis.value}</b>
        <b>Surp {side?.rawSurpriseLabel ?? "-"}</b>
      </span>
      <time title={windowLabels.title}>
        <b>{windowLabels.releaseLabel}</b>
        <em>{windowLabels.untilLabel}</em>
      </time>
    </span>
  );
}

function SignalLevelCell({ comparison }: { comparison: PairMatrixFactorComparison | null }) {
  if (!comparison) return <span className="chart-pair-matrix-signal-level is-empty">No level</span>;
  return (
    <span className={`chart-pair-matrix-signal-level is-level-${comparison.levelState}`} title={comparison.levelTitle}>
      <strong>{comparison.levelLabel}</strong>
      <em>{comparison.levelDetailLabel}</em>
    </span>
  );
}

function SignalShockCell({ comparison }: { comparison: PairMatrixFactorComparison | null }) {
  if (!comparison) return <span className="chart-pair-matrix-signal-shock is-empty">No shock</span>;
  const baseCurrency = comparison.base?.currency ?? "Base";
  const quoteCurrency = comparison.quote?.currency ?? "Quote";
  const baseScore = comparison.base?.score;
  const quoteScore = comparison.quote?.score;
  const hasDifferential = baseScore != null && quoteScore != null;
  const differential = hasDifferential ? baseScore - quoteScore : null;
  const leaderLabel =
    differential == null
      ? "Shock: N/A"
      : differential > 0
        ? `Shock: ${baseCurrency} +${Math.abs(differential).toFixed(1)} pts`
        : differential < 0
          ? `Shock: ${quoteCurrency} +${Math.abs(differential).toFixed(1)} pts`
          : "Shock: Even 0.0 pts";
  const differentialLabel =
    differential == null
      ? `${baseCurrency} - ${quoteCurrency}: N/A`
      : `${baseCurrency} - ${quoteCurrency}: ${formatSignedPointValue(differential)} pts`;
  return (
    <span className={`chart-pair-matrix-signal-shock is-${comparison.state}`} title={`${differentialLabel}. ${comparison.detailLabel}. Shock uses actual versus forecast/previous surprise; it does not compare raw absolute levels.`}>
      <strong>{leaderLabel}</strong>
      <em>{differentialLabel}</em>
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
  const secondaryLine = read.status === "unclear" ? "No expected/price match" : directionLabel;

  return (
    <span className={`chart-pair-matrix-signal-reaction is-${read.status}`} title={`${read.reason} Range ${rangeLabel}.`}>
      {read.status === "unclear" ? (
        <strong>No directional read</strong>
      ) : (
        <strong className="chart-pair-matrix-move-stack">
          <b>{read.pipsLabel}</b>
          <em>{read.percentLabel}</em>
        </strong>
      )}
      <em>{secondaryLine}</em>
    </span>
  );
}

function getPairDirectionRowClass(row: PairMatrixFactorViewRow): string {
  if (row.comparison?.levelState === "base" || row.comparison?.state === "base_leads") return "is-bullish-bias";
  if (row.comparison?.levelState === "quote" || row.comparison?.state === "quote_leads") return "is-bearish-bias";
  return "is-mixed-bias";
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
      className={`chart-pair-matrix-row is-signal-band ${selected ? "is-selected" : ""} ${getPairDirectionRowClass(row)} layout-${data.preferences.layoutMode}`}
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
      <SignalLevelCell comparison={row.comparison} />
      <SignalShockCell comparison={row.comparison} />
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
  const activeHeaderRow = selectedRow ?? readableRows[0] ?? null;

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
              rows={readableRows}
              pairLabel={data.pairLabel}
              anchorLabel={data.anchorLabel}
              anchorBasisLabel={data.anchorBasisLabel}
              coverageLabel={data.coverageLabel}
              calendarDiagnostics={data.calendarDiagnostics}
              displayTimeMode={data.displayTimeMode}
              sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
              preferences={data.preferences}
              activeRow={activeHeaderRow}
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
                <span>Level</span>
                <span>Shock</span>
                <span>Price</span>
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
