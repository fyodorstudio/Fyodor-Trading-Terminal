import { Table2, X } from "lucide-react";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type {
  PairMatrixAlignmentRead,
  PairMatrixFactorViewRow,
  PairMatrixPreferences,
} from "@/app/lib/pairMatrixDriverAlignment";
import type { CalendarEvent } from "@/app/types";

export interface ChartPairMatrixTimeLensData {
  open: boolean;
  pairLabel: string;
  currencies: string[];
  rows: PairMatrixFactorViewRow[];
  preferences: PairMatrixPreferences;
  anchorLabel: string;
  anchorBasisLabel: string;
  coverageLabel: string;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
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
const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfort" },
] as const;

function formatEventName(event: CalendarEvent | null): string {
  if (!event) return "No loaded event";
  return event.title;
}

function formatEventTime(
  event: CalendarEvent | null,
  displayTimeMode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  if (!event) return "";
  return formatChartEventDisplayTime(event.time, displayTimeMode, sourceTimeOffsetSeconds);
}

function MatrixLatestCell({
  event,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  event: CalendarEvent | null;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  if (!event) {
    return <span className="chart-pair-matrix-empty">No loaded release</span>;
  }

  const actual = getEventValueDisplay(event.actual, event.title).display;
  const forecast = getEventValueDisplay(event.forecast, event.title).display;
  const previous = getEventValueDisplay(event.previous, event.title).display;

  return (
    <span className="chart-pair-matrix-evidence">
      <strong className="chart-pair-matrix-event-title">{event.title}</strong>
      <span className="chart-pair-matrix-values">
        <span>A {actual}</span>
        <span>F {forecast}</span>
        <span>P {previous}</span>
      </span>
      <em className="chart-pair-matrix-time">{formatEventTime(event, displayTimeMode, sourceTimeOffsetSeconds)}</em>
    </span>
  );
}

function MatrixNextCell({
  event,
  displayTimeMode,
  sourceTimeOffsetSeconds,
}: {
  event: CalendarEvent | null;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
}) {
  if (!event) {
    return <span className="chart-pair-matrix-empty">No loaded event</span>;
  }

  return (
    <span className="chart-pair-matrix-evidence">
      <strong className="chart-pair-matrix-event-title">{formatEventName(event)}</strong>
      <em className="chart-pair-matrix-time">{formatEventTime(event, displayTimeMode, sourceTimeOffsetSeconds)}</em>
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
    <span className={`chart-pair-matrix-driver-read is-${read.status}`}>
      <span className="chart-pair-matrix-driver-top">
        <strong>{read.statusLabel}</strong>
        <em>{read.currency}</em>
      </span>
      <span className="chart-pair-matrix-driver-event">{read.eventTitle}</span>
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

export function ChartPairMatrixTimeLens({ data }: { data: ChartPairMatrixTimeLensData }) {
  return (
    <section
      className={`chart-pair-matrix-lens ${data.open ? "is-open" : ""} density-${data.preferences.displayDensity}`}
      aria-label="Pair Matrix Time Lens"
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
            <div>
              <span>Pair Matrix Time Lens</span>
              <strong>{data.pairLabel}</strong>
              <small>{data.anchorLabel} / {data.anchorBasisLabel}</small>
            </div>
            <button type="button" onClick={data.onClose} aria-label="Close Pair Matrix Time Lens">
              <X size={15} />
            </button>
          </div>

          <div className="chart-pair-matrix-meta">
            <span>{data.coverageLabel}</span>
            <span>Loaded broker/MT5 rows only</span>
          </div>

          <div className="chart-pair-matrix-controls">
            <PairMatrixControl
              label="Read"
              value={data.preferences.driverReadMode}
              options={READ_MODE_OPTIONS}
              onChange={(value) =>
                data.onPreferenceChange("driverReadMode", value as PairMatrixPreferences["driverReadMode"])
              }
            />
            <PairMatrixControl
              label="Sensitivity"
              value={data.preferences.surpriseSensitivity}
              options={SENSITIVITY_OPTIONS}
              onChange={(value) =>
                data.onPreferenceChange("surpriseSensitivity", value as PairMatrixPreferences["surpriseSensitivity"])
              }
            />
            <PairMatrixControl
              label="Sort"
              value={data.preferences.rowSortMode}
              options={SORT_OPTIONS}
              onChange={(value) =>
                data.onPreferenceChange("rowSortMode", value as PairMatrixPreferences["rowSortMode"])
              }
            />
            <PairMatrixControl
              label="Density"
              value={data.preferences.displayDensity}
              options={DENSITY_OPTIONS}
              onChange={(value) =>
                data.onPreferenceChange("displayDensity", value as PairMatrixPreferences["displayDensity"])
              }
            />
          </div>

          {data.currencies.length === 0 ? (
            <p className="chart-pair-matrix-note">No base/quote currency context is available for this symbol.</p>
          ) : data.rows.length === 0 ? (
            <p className="chart-pair-matrix-note">Move the cursor over a loaded candle, or wait for chart history to load.</p>
          ) : (
            <div className="chart-pair-matrix-scroll">
              <table className="chart-pair-matrix-table">
                <thead>
                  <tr>
                    <th>Factor</th>
                    {data.currencies.map((currency) => (
                      [
                        <th key={`${currency}-latest`}>{currency} latest</th>,
                        <th key={`${currency}-next`}>{currency} next</th>,
                      ]
                    ))}
                    <th>Driver alignment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.factor.id} className={row.summaryAlignment ? `is-${row.summaryAlignment.status}` : ""}>
                      <th scope="row">{row.factor.label}</th>
                      {row.cells.map((cell) => {
                        return [
                          <td key={`${cell.currency}-${row.factor.id}-latest`}>
                            <MatrixLatestCell
                              event={cell.latestEvent}
                              displayTimeMode={data.displayTimeMode}
                              sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
                            />
                          </td>,
                          <td key={`${cell.currency}-${row.factor.id}-next`}>
                            <MatrixNextCell
                              event={cell.nextEvent}
                              displayTimeMode={data.displayTimeMode}
                              sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
                            />
                          </td>,
                        ];
                      })}
                      <td className="chart-pair-matrix-driver-cell">
                        <DriverAlignmentCell row={row} mode={data.preferences.driverReadMode} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
