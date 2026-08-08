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
  renderClosedButton?: boolean;
  onPreferenceChange: <K extends keyof PairMatrixPreferences>(key: K, value: PairMatrixPreferences[K]) => void;
  onToggleOpen: () => void;
  onClose: () => void;
}

const READ_MODE_OPTIONS = [
  { value: "strongest", label: "Strongest" },
  { value: "separate", label: "Separate" },
] as const;
const SENSITIVITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;
const SORT_OPTIONS = [
  { value: "factor", label: "Factor" },
  { value: "driver_strength", label: "Drivers" },
] as const;

function formatEventTime(
  event: CalendarEvent | null,
  displayTimeMode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  if (!event) return "";
  return formatChartEventDisplayTime(event.time, displayTimeMode, sourceTimeOffsetSeconds);
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
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  event: CalendarEvent | null;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  const fields = getEventDisplayFields(event);
  const timeLabel = event ? formatEventTime(event, displayTimeMode, sourceTimeOffsetSeconds) : "-";
  const formula = event
    ? `${event.title}. Actual ${fields.actual}, Forecast ${fields.forecast}, Previous ${fields.previous}. ${timeLabel}.`
    : "No loaded event for this side.";

  return (
    <span className={`chart-pair-matrix-evidence-run ${event ? "" : "is-empty"}`} title={formula}>
      <span>A: {fields.actual}</span>
      <span>F: {fields.forecast}</span>
      <span>P: {fields.previous}</span>
      <time>{timeLabel}</time>
    </span>
  );
}

function PairMatrixControl<K extends keyof PairMatrixPreferences>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: PairMatrixPreferences[K];
  options: ReadonlyArray<{ value: PairMatrixPreferences[K]; label: string }>;
  onChange: (value: PairMatrixPreferences[K]) => void;
}) {
  return (
    <div className="chart-pair-matrix-control">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={option.value === value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DriverRead({ read }: { read: PairMatrixAlignmentRead }) {
  return (
    <span className={`chart-pair-matrix-driver-read is-${read.status}`} title={read.reason}>
      <span className="chart-pair-matrix-driver-top">
        <strong>{read.statusLabel}</strong>
        <em>{read.currency}</em>
      </span>
      <span className="chart-pair-matrix-driver-line">{read.surpriseLabel}</span>
      <span className="chart-pair-matrix-driver-line">{read.priceMoveLabel}</span>
      <span className="chart-pair-matrix-driver-line">{read.expectedDirectionLabel} / {read.actualDirectionLabel}</span>
    </span>
  );
}

function DriverAlignmentCell({
  row,
  mode,
}: {
  row: PairMatrixFactorViewRow;
  mode: PairMatrixPreferences["driverReadMode"];
}) {
  const reads = mode === "separate" ? row.alignmentReads.filter((read) => read.eventTime != null) : [];
  if (mode === "separate" && reads.length > 0) {
    return (
      <div className="chart-pair-matrix-driver-stack">
        {reads.map((read) => (
          <DriverRead key={`${read.currency}:${read.eventTime}:${read.eventTitle}`} read={read} />
        ))}
      </div>
    );
  }

  if (row.summaryAlignment) return <DriverRead read={row.summaryAlignment} />;
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

function PairMatrixHeaderSummary({
  summary,
  anchorLabel,
  anchorBasisLabel,
  coverageLabel,
  preferences,
  onPreferenceChange,
  onClose,
}: {
  summary: PairMatrixComparisonSummary | null;
  anchorLabel: string;
  anchorBasisLabel: string;
  coverageLabel: string;
  preferences: PairMatrixPreferences;
  onPreferenceChange: ChartPairMatrixTimeLensData["onPreferenceChange"];
  onClose: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="chart-pair-matrix-head-summary" aria-label="Pair Matrix summary">
      <PairMatrixSummaryBox label={anchorLabel} detail={anchorBasisLabel} className="is-anchor" />
      {summary ? (
        <>
          <PairMatrixSummaryBox
            label={summary.stateLabel}
            detail={summary.voteLabel}
            className={`is-state is-${summary.state}`}
            title={summary.detailLabel}
          />
          <PairMatrixSummaryBox
            label={summary.modeLabel}
            detail={summary.winnerModeLabel}
            className="is-mode"
            title={`${summary.modeLabel} / ${summary.winnerModeLabel}`}
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
            <span>{coverageLabel}</span>
            <span>Loaded broker/MT5 rows only</span>
          </div>
            <PairMatrixControl
              label="Read"
              value={preferences.driverReadMode}
              options={READ_MODE_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("driverReadMode", value as PairMatrixPreferences["driverReadMode"])
              }
            />
            <PairMatrixControl
              label="Sensitivity"
              value={preferences.surpriseSensitivity}
              options={SENSITIVITY_OPTIONS}
              onChange={(value) =>
                onPreferenceChange("surpriseSensitivity", value as PairMatrixPreferences["surpriseSensitivity"])
              }
            />
            <PairMatrixControl
              label="Sort"
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
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
          <span className="chart-pair-matrix-divider" aria-hidden="true">|</span>
          <EvidenceRun
            event={baseCell?.nextEvent ?? null}
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
        </div>
        <div className="chart-pair-matrix-currency-band">
          <strong>{quoteCurrency}</strong>
          <EvidenceRun
            event={quoteCell?.latestEvent ?? null}
            displayTimeMode={data.displayTimeMode}
            sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
          />
          <span className="chart-pair-matrix-divider" aria-hidden="true">|</span>
          <EvidenceRun
            event={quoteCell?.nextEvent ?? null}
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
        <DriverAlignmentCell row={row} mode={data.preferences.driverReadMode} />
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
              anchorLabel={data.anchorLabel}
              anchorBasisLabel={data.anchorBasisLabel}
              coverageLabel={data.coverageLabel}
              preferences={data.preferences}
              onPreferenceChange={data.onPreferenceChange}
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
