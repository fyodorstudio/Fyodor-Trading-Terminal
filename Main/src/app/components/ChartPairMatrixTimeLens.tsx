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

function EvidenceRun({
  event,
  reasonLabel,
  reasonDetail,
  bundleCount,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  event: CalendarEvent | null;
  reasonLabel: string;
  reasonDetail: string;
  bundleCount: number;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const fields = getEventDisplayFields(event);
  const timeLabel = event ? formatEventTime(event, displayTimeMode, sourceTimeOffsetSeconds) : "-";
  const visibleTimeLabel = event && bundleCount > 1 ? `${timeLabel} x${bundleCount}` : timeLabel;
  const formula = event
    ? `${event.title}. Actual ${fields.actual}, Forecast ${fields.forecast}, Previous ${fields.previous}. ${timeLabel}.${bundleCount > 1 ? ` Same-time bundle: ${bundleCount} matching rows.` : ""}`
    : reasonDetail;

  return (
    <span className={`chart-pair-matrix-evidence-run ${event ? "" : "is-empty"} ${bundleCount > 1 ? "is-bundled" : ""}`} title={formula}>
      <span>A: {fields.actual}</span>
      <span>F: {fields.forecast}</span>
      <span>P: {fields.previous}</span>
      <time>{event ? visibleTimeLabel : reasonLabel}</time>
    </span>
  );
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

function DriverRead({
  read,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  read: PairMatrixAlignmentRead;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const hasMoveRange = read.releaseChartTime != null && read.cursorChartTime != null;
  const moveRangeLabel =
    hasMoveRange
      ? `${formatChartCoordinateTime(read.releaseChartTime, displayTimeMode, sourceTimeOffsetSeconds)} -> ${formatChartCoordinateTime(
          read.cursorChartTime,
          displayTimeMode,
          sourceTimeOffsetSeconds,
        )}`
      : read.reasonLabel;
  const title = `${read.reason} Move range: ${moveRangeLabel}.`;

  return (
    <span className={`chart-pair-matrix-driver-read is-${read.status}`} title={title}>
      <span className="chart-pair-matrix-driver-top">
        <strong>{read.statusLabel}</strong>
        <em>{read.currency}</em>
      </span>
      <span className="chart-pair-matrix-driver-line">{read.status === "unclear" ? read.reasonLabel : read.surpriseLabel}</span>
      <span className="chart-pair-matrix-driver-line">Range {moveRangeLabel}</span>
      <span className="chart-pair-matrix-driver-line">{read.status === "unclear" ? read.reason : read.priceMoveLabel}</span>
      <span className="chart-pair-matrix-driver-line">
        {read.status === "unclear" ? read.reasonLabel : `${read.expectedDirectionLabel} / ${read.actualDirectionLabel}`}
      </span>
    </span>
  );
}

function DriverAlignmentCell({
  row,
  mode,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  row: PairMatrixFactorViewRow;
  mode: PairMatrixPreferences["driverReadMode"];
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const reads = mode === "separate" ? row.alignmentReads.filter((read) => read.eventTime != null) : [];
  if (mode === "separate" && reads.length > 0) {
    return (
      <div className="chart-pair-matrix-driver-stack">
        {reads.map((read) => (
          <DriverRead
            key={`${read.currency}:${read.eventTime}:${read.eventTitle}`}
            read={read}
            displayTimeMode={displayTimeMode}
            sourceTimeOffsetSeconds={sourceTimeOffsetSeconds}
          />
        ))}
      </div>
    );
  }

  if (row.summaryAlignment) {
    return (
      <DriverRead
        read={row.summaryAlignment}
        displayTimeMode={displayTimeMode}
        sourceTimeOffsetSeconds={sourceTimeOffsetSeconds}
      />
    );
  }
  return <span className="chart-pair-matrix-empty">No driver read</span>;
}

function PairComparisonSide({ side }: { side: NonNullable<PairMatrixFactorComparison["base"]> }) {
  return (
    <span className="chart-pair-matrix-compare-side" title={side.formulaLabel}>
      <strong>{side.currency}</strong>
      <span>{side.scoreLabel}</span>
    </span>
  );
}

function PairComparisonCell({ comparison }: { comparison: PairMatrixFactorComparison | null }) {
  if (!comparison) return <span className="chart-pair-matrix-empty">No base/quote read</span>;

  return (
    <span className={`chart-pair-matrix-compare-read is-${comparison.state}`}>
      <span className="chart-pair-matrix-compare-top">
        <strong>{comparison.stateLabel}</strong>
        <em>{comparison.detailLabel}</em>
        {comparison.contextLabel ? <small title={comparison.contextTitle ?? comparison.contextLabel}>{comparison.contextLabel}</small> : null}
        {comparison.reasonCodes.length > 0 ? <small title={comparison.reasonCodes.join(", ")}>{comparison.reasonCodes.length} reason-coded limitation</small> : null}
      </span>
      {comparison.base ? <PairComparisonSide side={comparison.base} /> : null}
      {comparison.quote ? <PairComparisonSide side={comparison.quote} /> : null}
    </span>
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

function getDriverAcceptanceSummary(rows: PairMatrixFactorViewRow[]): { label: string; detail: string; title: string } {
  const reads = rows.map((row) => row.summaryAlignment).filter((read): read is PairMatrixAlignmentRead => read != null);
  const aligned = reads.filter((read) => read.status === "aligned").length;
  const rejected = reads.filter((read) => read.status === "rejected").length;
  const muted = reads.filter((read) => read.status === "muted").length;
  const unclear = reads.filter((read) => read.status === "unclear").length;
  const other = muted + unclear;

  if (reads.length === 0) {
    return {
      label: "Driver read",
      detail: "No loaded read",
      title: "Driver acceptance needs loaded releases and loaded candles from release close to cursor close.",
    };
  }

  return {
    label: "Driver read",
    detail: `${aligned} aligned / ${rejected} rejected${other > 0 ? ` / ${other} other` : ""}`,
    title: `Driver acceptance counts visible factor rows: aligned ${aligned}, rejected ${rejected}, muted ${muted}, unclear ${unclear}.`,
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

function PairMatrixHeaderSummary({
  summary,
  rows,
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

  return (
    <div className="chart-pair-matrix-head-summary" aria-label="Pair Matrix summary">
      <PairMatrixSummaryBox label={anchorLabel} detail={anchorBasisLabel} className="is-anchor" />
      {summary ? (
        <>
          <PairMatrixSummaryBox
            label="Macro vote"
            detail={`${summary.stateLabel} - ${summary.voteBreakdownLabel}`}
            className={`is-state is-vote is-${summary.state}`}
            title={`${summary.modeLabel} / ${summary.winnerModeLabel}. ${summary.detailLabel}${summary.otherBreakdownLabel ? ` Other: ${summary.otherBreakdownLabel}.` : ""}`}
          />
          <PairMatrixSummaryBox
            label={driverSummary.label}
            detail={driverSummary.detail}
            className="is-driver"
            title={driverSummary.title}
          />
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
            detail={moveRangeLabel}
            className="is-range"
            title={`Pips and percent are measured over this release-close to cursor-close range: ${moveRangeLabel}.`}
          />
          <PairMatrixSummaryBox
            label={summary.baseScoreLabel}
            detail={summary.baseCurrency ?? "Base"}
            className="is-score"
          />
          <PairMatrixSummaryBox
            label={summary.quoteScoreLabel}
            detail={summary.quoteCurrency ?? "Quote"}
            className="is-score"
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
            <span title="How many base/quote factor cells currently have loaded latest or next release evidence.">{coverageLabel}</span>
            <span title="Pair Matrix v1 only reads local MT5 candles and loaded broker/MT5 calendar rows.">Loaded broker/MT5 rows only</span>
            <span title="Current Pair Matrix calendar lookback mode.">{calendarDiagnostics.lookbackLabel}</span>
            <span title="Current Pair Matrix calendar fetch state.">{calendarDiagnostics.loadStateLabel}</span>
            <span title="Oldest and newest broker/MT5 calendar rows currently available to Pair Matrix.">{calendarDiagnostics.loadedRangeLabel}</span>
            <span title="Whether the cursor anchor is inside the loaded Pair Matrix calendar range.">{calendarDiagnostics.anchorStatusLabel}</span>
            <p>Evidence Signal combines macro vote, expected pair direction, and release-to-cursor price acceptance.</p>
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

function PairMatrixFactorRow({
  row,
  data,
}: {
  row: PairMatrixFactorViewRow;
  data: ChartPairMatrixTimeLensData;
}) {
  const baseCurrency = data.currencies[0] ?? "Base";
  const quoteCurrency = data.currencies[1] ?? "Quote";
  const baseCell = row.cells.find((cell) => cell.currency === baseCurrency) ?? row.cells[0] ?? null;
  const quoteCell = row.cells.find((cell) => cell.currency === quoteCurrency) ?? (data.currencies.length > 1 ? row.cells[1] : null);
  const eventNames = [
    { currency: baseCurrency, latest: baseCell?.latestEvent?.title ?? "-", next: baseCell?.nextEvent?.title ?? "-" },
    { currency: quoteCurrency, latest: quoteCell?.latestEvent?.title ?? "-", next: quoteCell?.nextEvent?.title ?? "-" },
  ];

  return (
    <article className={`chart-pair-matrix-row ${row.summaryAlignment ? `is-${row.summaryAlignment.status}` : ""}`}>
      <div className="chart-pair-matrix-factor">
        <strong>{row.factor.label}</strong>
        {eventNames.map((item) => (
          <span key={item.currency} title={`${item.currency}: ${item.latest} | ${item.next}`}>
            <b>{item.currency}</b> {item.latest} <i>|</i> {item.next}
          </span>
        ))}
      </div>
      <div className="chart-pair-matrix-evidence-band">
        <div className="chart-pair-matrix-currency-band">
          <strong>{baseCurrency}</strong>
          <EvidenceRun
            event={baseCell?.latestEvent ?? null}
            reasonLabel={baseCell?.latestReasonLabel ?? "no loaded matching release"}
            reasonDetail={baseCell?.latestReasonDetail ?? "No loaded broker/MT5 row matched this side."}
            bundleCount={baseCell?.latestBundleCount ?? 0}
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
          <span className="chart-pair-matrix-divider" aria-hidden="true">|</span>
          <EvidenceRun
            event={baseCell?.nextEvent ?? null}
            reasonLabel={baseCell?.nextReasonLabel ?? "no loaded matching release"}
            reasonDetail={baseCell?.nextReasonDetail ?? "No loaded broker/MT5 row matched this side."}
            bundleCount={baseCell?.nextBundleCount ?? 0}
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
        </div>
        <div className="chart-pair-matrix-currency-band">
          <strong>{quoteCurrency}</strong>
          <EvidenceRun
            event={quoteCell?.latestEvent ?? null}
            reasonLabel={quoteCell?.latestReasonLabel ?? "no loaded matching release"}
            reasonDetail={quoteCell?.latestReasonDetail ?? "No loaded broker/MT5 row matched this side."}
            bundleCount={quoteCell?.latestBundleCount ?? 0}
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
          <span className="chart-pair-matrix-divider" aria-hidden="true">|</span>
          <EvidenceRun
            event={quoteCell?.nextEvent ?? null}
            reasonLabel={quoteCell?.nextReasonLabel ?? "no loaded matching release"}
            reasonDetail={quoteCell?.nextReasonDetail ?? "No loaded broker/MT5 row matched this side."}
            bundleCount={quoteCell?.nextBundleCount ?? 0}
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
        </div>
      </div>
      <div className="chart-pair-matrix-read-slot">
        <span>Compare</span>
        <PairComparisonCell comparison={row.comparison} />
      </div>
      <div className="chart-pair-matrix-read-slot">
        <span>Driver</span>
        <DriverAlignmentCell
          row={row}
          mode={data.preferences.driverReadMode}
          displayTimeMode={data.displayTimeMode}
          sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
        />
      </div>
    </article>
  );
}

export function ChartPairMatrixTimeLens({ data }: { data: ChartPairMatrixTimeLensData }) {
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
    [data.open, dragOffset.x, dragOffset.y],
  );

  if (!data.open && data.renderClosedButton === false) return null;

  const lensStyle = data.open
    ? ({
        "--pair-matrix-drag-x": `${dragOffset.x}px`,
        "--pair-matrix-drag-y": `${dragOffset.y}px`,
      } as CSSProperties)
    : undefined;

  return (
    <section
      ref={lensRef}
      className={`chart-pair-matrix-lens ${data.open ? "is-open" : ""} ${isDragging ? "is-dragging" : ""} density-${data.preferences.displayDensity}`}
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
              <span><GripHorizontal size={13} /> Pair Matrix Time Lens</span>
              <strong>{data.pairLabel}</strong>
            </div>
            <PairMatrixHeaderSummary
              summary={data.comparisonSummary}
              rows={data.rows}
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
                <span>Evidence <b>Latest</b> <i>|</i> <b>Next</b></span>
                <span>Compare</span>
                <span>Driver</span>
              </div>
              <div className="chart-pair-matrix-row-list">
                {data.rows.map((row) => (
                  <PairMatrixFactorRow key={row.factor.id} row={row} data={data} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
