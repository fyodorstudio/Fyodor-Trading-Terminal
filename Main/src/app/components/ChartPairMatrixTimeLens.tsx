import { Table2, X } from "lucide-react";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import { MACRO_FACTOR_DEFINITIONS, type MacroFactorRow } from "@/app/lib/macroDrivers";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type { CalendarEvent } from "@/app/types";

export interface ChartPairMatrixTimeLensData {
  open: boolean;
  pairLabel: string;
  currencies: string[];
  rows: MacroFactorRow[];
  anchorLabel: string;
  anchorBasisLabel: string;
  coverageLabel: string;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  onToggleOpen: () => void;
  onClose: () => void;
}

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
      <strong>{event.title}</strong>
      <span>Actual {actual} / Forecast {forecast} / Previous {previous}</span>
      <em>{formatEventTime(event, displayTimeMode, sourceTimeOffsetSeconds)}</em>
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
      <strong>{formatEventName(event)}</strong>
      <em>{formatEventTime(event, displayTimeMode, sourceTimeOffsetSeconds)}</em>
    </span>
  );
}

export function ChartPairMatrixTimeLens({ data }: { data: ChartPairMatrixTimeLensData }) {
  const rowsByCurrencyAndFactor = new Map(data.rows.map((row) => [`${row.currency}:${row.factor.id}`, row]));

  return (
    <section className={`chart-pair-matrix-lens ${data.open ? "is-open" : ""}`} aria-label="Pair Matrix Time Lens">
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
                  </tr>
                </thead>
                <tbody>
                  {MACRO_FACTOR_DEFINITIONS.map((factor) => (
                    <tr key={factor.id}>
                      <th scope="row">{factor.label}</th>
                      {data.currencies.map((currency) => {
                        const row = rowsByCurrencyAndFactor.get(`${currency}:${factor.id}`) ?? null;
                        return [
                          <td key={`${currency}-${factor.id}-latest`}>
                            <MatrixLatestCell
                              event={row?.latestEvent ?? null}
                              displayTimeMode={data.displayTimeMode}
                              sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
                            />
                          </td>,
                          <td key={`${currency}-${factor.id}-next`}>
                            <MatrixNextCell
                              event={row?.nextEvent ?? null}
                              displayTimeMode={data.displayTimeMode}
                              sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds}
                            />
                          </td>,
                        ];
                      })}
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
