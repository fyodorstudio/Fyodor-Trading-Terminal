import { useEffect, useState } from "react";
import {
  OverviewCurrencyChip,
  OverviewMacroCard,
  OverviewPairDriverSnapshot,
  OverviewPairWorkbench,
} from "@/app/components/OverviewPairSummary";
import { OverviewReleasePopover } from "@/app/components/OverviewPopovers";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { buildMacroFactorRows } from "@/app/lib/macroDrivers";
import type { CalendarEvent, CentralBankSnapshot, MarketStatusResponse } from "@/app/types";

interface OverviewPlaceholderTabProps {
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  snapshots: CentralBankSnapshot[];
  marketStatus: MarketStatusResponse | null;
  currentTime: Date;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

function resolvePair(symbol: string) {
  return getFxPairByName(symbol) ?? FX_PAIRS[0];
}

function findSnapshot(currency: string, snapshots: CentralBankSnapshot[]): CentralBankSnapshot | null {
  return snapshots.find((snapshot) => snapshot.currency === currency) ?? null;
}

function getPairEvents(events: CalendarEvent[], currencies: string[]) {
  return events.filter((event) => currencies.includes(event.currency));
}

export function OverviewPlaceholderTab({
  selectedSymbol,
  onSelectedSymbolChange,
  events,
  snapshots,
  marketStatus,
  currentTime,
  onOpenCalendarEvent,
}: OverviewPlaceholderTabProps) {
  const [releasePopoverOpen, setReleasePopoverOpen] = useState(false);
  const pair = resolvePair(selectedSymbol);
  const pairCurrencies = [pair.base, pair.quote];
  const pairEvents = getPairEvents(events, pairCurrencies);
  const nowSeconds = currentTime.getTime() / 1000;
  const upcomingEvents = pairEvents
    .filter((event) => event.time >= nowSeconds)
    .sort((left, right) => left.time - right.time);
  const recentEvents = pairEvents
    .filter((event) => event.time < nowSeconds)
    .sort((left, right) => right.time - left.time);
  const nextEvent = upcomingEvents[0] ?? null;
  const baseNextEvent = upcomingEvents.find((event) => event.currency === pair.base) ?? null;
  const quoteNextEvent = upcomingEvents.find((event) => event.currency === pair.quote) ?? null;
  const upcomingReleaseGroups = [
    { label: `${pair.base}/XXX`, events: upcomingEvents.filter((event) => event.currency === pair.base).slice(0, 4) },
    { label: `${pair.quote}/XXX`, events: upcomingEvents.filter((event) => event.currency === pair.quote).slice(0, 4) },
  ];
  const recentReleaseGroups = [
    { label: `${pair.base}/XXX`, events: recentEvents.filter((event) => event.currency === pair.base).slice(0, 4) },
    { label: `${pair.quote}/XXX`, events: recentEvents.filter((event) => event.currency === pair.quote).slice(0, 4) },
  ];
  const baseSnapshot = findSnapshot(pair.base, snapshots);
  const quoteSnapshot = findSnapshot(pair.quote, snapshots);
  const factorRows = buildMacroFactorRows({ events, currencies: pairCurrencies, nowSeconds });
  const baseFactorRows = factorRows.filter((row) => row.currency === pair.base);
  const quoteFactorRows = factorRows.filter((row) => row.currency === pair.quote);
  const sessionLabel =
    marketStatus?.session_state === "open"
      ? "Market open"
      : marketStatus?.session_state === "closed"
        ? "Market closed"
        : "Session unknown";

  useEffect(() => {
    if (!releasePopoverOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setReleasePopoverOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [releasePopoverOpen]);

  return (
    <div className="workspace-page workspace-page-compact flex h-[calc(100vh-98px)] min-h-[560px] flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(280px,0.85fr)_minmax(260px,1fr)_minmax(260px,1fr)_minmax(330px,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Pair Brief</div>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{pair.name}</h2>
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
                {sessionLabel}
              </span>
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Pair</span>
              <select
                value={pair.name}
                onChange={(event) => onSelectedSymbolChange(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-black text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
              >
                {FX_PAIRS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <OverviewCurrencyChip label="Base" currency={pair.base} snapshot={baseSnapshot} />
              <OverviewCurrencyChip label="Quote" currency={pair.quote} snapshot={quoteSnapshot} />
            </div>
          </div>

          <OverviewMacroCard
            side="Base"
            currency={pair.base}
            snapshot={baseSnapshot}
            nextEvent={baseNextEvent}
            currentTime={currentTime}
            onOpenEvent={onOpenCalendarEvent}
          />
          <OverviewMacroCard
            side="Quote"
            currency={pair.quote}
            snapshot={quoteSnapshot}
            nextEvent={quoteNextEvent}
            currentTime={currentTime}
            onOpenEvent={onOpenCalendarEvent}
          />

          <OverviewPairDriverSnapshot
            pairName={pair.name}
            nextEvent={nextEvent}
            upcomingEvents={upcomingEvents}
            factorRows={factorRows}
            currentTime={currentTime}
            onOpenEvent={onOpenCalendarEvent}
            onOpenReleases={() => setReleasePopoverOpen(true)}
          />
        </section>

        <OverviewPairWorkbench
          pairName={pair.name}
          baseCurrency={pair.base}
          quoteCurrency={pair.quote}
          baseRows={baseFactorRows}
          quoteRows={quoteFactorRows}
          upcomingEvents={upcomingEvents}
          recentEvents={recentEvents}
          currentTime={currentTime}
          onOpenEvent={onOpenCalendarEvent}
          onOpenReleases={() => setReleasePopoverOpen(true)}
        />
      </div>

      {releasePopoverOpen ? (
        <OverviewReleasePopover
          pairName={pair.name}
          upcomingEvents={upcomingEvents}
          recentEvents={recentEvents}
          upcomingReleaseGroups={upcomingReleaseGroups}
          recentReleaseGroups={recentReleaseGroups}
          currentTime={currentTime}
          onOpenEvent={onOpenCalendarEvent}
          onClose={() => setReleasePopoverOpen(false)}
        />
      ) : null}

    </div>
  );
}
