import { parseNumericValue } from "@/app/lib/format";

type Release = {
  title: string; actual: string | null; forecast: string | null; previous: string | null;
  surprisePoint?: number | null; momentumPoint?: number | null; score?: number | null;
  currency?: string; countryCode?: string; forecastSuspect?: boolean;
};
function signed(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "?" : `${value > 0 ? "+" : ""}${value}`;
}
function difference(actual: string | null, reference: string | null) {
  const a = parseNumericValue(actual ?? "");
  const b = parseNumericValue(reference ?? "");
  return a == null || b == null ? "?" : signed(Number((a - b).toPrecision(8)));
}
export function FmsReleaseCards({ releases }: { releases: Release[] }) {
  return <div className="chart-macro-bias-events">{releases.map((event, index) => <div key={`${event.title}:${index}`}>
    <strong>{event.title}</strong><small>{event.currency ?? "?"}/{event.countryCode ?? "?"}</small>
    <span>A {event.actual || "?"} ? F {event.forecast || "?"} ? P {event.previous || "?"} ? Surprise {difference(event.actual, event.forecast)} ({signed(event.surprisePoint)}) ? Momentum {difference(event.actual, event.previous)} ({signed(event.momentumPoint)})</span>
    <b>Score {signed(event.score)}{event.forecastSuspect ? <small>Forecast excluded by guard</small> : null}</b>
  </div>)}</div>;
}
