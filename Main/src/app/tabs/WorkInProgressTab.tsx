import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, ChevronRight, X } from "lucide-react";

interface CurrentDataRow {
  capability: string;
  whatCurrentDataSupports: string;
  practicalOutputNow: string;
}

interface ExtraDataRow {
  extraData: string;
  whatItUnlocks: string;
  whyItMatters: string;
}

const TARGET_WORKFLOW = [
  "Open Watchlist Engine to see which pairs deserve attention.",
  "Move to TradingView and do the full discretionary top-down read and setup planning.",
  "Return to Macro State to verify whether the setup aligns with the current pair backdrop.",
  "Use Event Replay Lab before major catalysts to review how the pair has behaved around similar releases.",
];

const CURRENT_DATA_ROWS: CurrentDataRow[] = [
  {
    capability: "Step 1: Watchlist shortlist",
    whatCurrentDataSupports:
      "Rank pairs by current base-versus-quote macro divergence using policy rate, inflation, previous prints, and the existing differential logic.",
    practicalOutputNow:
      "A focused list of pairs worth opening in TradingView first.",
  },
  {
    capability: "Step 2: Currency state building blocks",
    whatCurrentDataSupports:
      "Build per-currency state from current policy rate, inflation, previous values, directional change, and a simple real-rate proxy.",
    practicalOutputNow:
      "A clean base input layer for later pair comparison without guessing beyond the available data.",
  },
  {
    capability: "Step 3: Pair macro state",
    whatCurrentDataSupports:
      "Compare base and quote currency state to label the pair as bullish base, bullish quote, or mixed.",
    practicalOutputNow:
      "A deterministic macro-state panel you can check after finishing manual TA.",
  },
  {
    capability: "Step 3: Short explanation beside macro state",
    whatCurrentDataSupports:
      "Explain the label using transparent macro facts such as rate advantage, inflation pressure, and direction versus previous release.",
    practicalOutputNow:
      "A short reason block that says why the pair currently leans one way instead of another.",
  },
  {
    capability: "Step 3: Soft regime hint",
    whatCurrentDataSupports:
      "A cautious read such as policy-led, inflation-led, or mixed inferred from the macro configuration and event mix.",
    practicalOutputNow:
      "A context hint only, useful for orientation but not strong enough yet to be treated as institutional regime detection.",
  },
  {
    capability: "Step 4: Event replay",
    whatCurrentDataSupports:
      "Replay historical candles around releases and compare how selected pairs reacted to event families.",
    practicalOutputNow:
      "A replay lab for studying how the selected pair behaved when similar events were released before.",
  },
  {
    capability: "Step 4: Upcoming event brief",
    whatCurrentDataSupports:
      "Show what the event is, when it occurs, and the forecast, previous, and actual fields when available.",
    practicalOutputNow:
      "A compact event panel beside replay so you can think through what the release may do to your setup.",
  },
  {
    capability: "Step 4: Event interpretation support",
    whatCurrentDataSupports:
      "Explain what the print is, why traders care, and whether the release could reinforce or challenge the current macro read.",
    practicalOutputNow:
      "A structured manual-thinking aid instead of scrolling headlines and random commentary.",
  },
  {
    capability: "Cross-workflow historical archive",
    whatCurrentDataSupports:
      "Measure past release reactions across pairs using stored event rows plus bridge price history.",
    practicalOutputNow:
      "A reusable evidence base for both watchlist review and event replay.",
  },
  {
    capability: "Current hard limit",
    whatCurrentDataSupports:
      "Not enough to compute hold, cut, or hike probabilities honestly with the current inputs alone.",
    practicalOutputNow:
      "Keep the app honest: qualitative macro pressure is possible now, true market-implied probabilities are not.",
  },
];

const EXTRA_DATA_ROWS: ExtraDataRow[] = [
  {
    extraData: "OIS curves",
    whatItUnlocks:
      "Real policy-path pricing and better understanding of what rates market participants expect over coming meetings.",
    whyItMatters:
      "This is one of the cleanest bridges between macro facts and what the market is actually pricing.",
  },
  {
    extraData: "Fed funds, SOFR, and other short-rate futures",
    whatItUnlocks:
      "Hold, cut, and hike probability models plus repricing analysis after major data.",
    whyItMatters:
      "This is the missing layer for moving from qualitative policy pressure to market-implied probabilities.",
  },
  {
    extraData: "Front-end bond yields",
    whatItUnlocks:
      "Much stronger policy-led and inflation-led regime detection, especially for USD pairs.",
    whyItMatters:
      "Front-end yield moves often show whether rates are actually driving the currency right now.",
  },
  {
    extraData: "Equity indexes, vol, and credit spreads",
    whatItUnlocks:
      "Risk-on versus risk-off regime confirmation and better understanding of when macro is being overridden by broader sentiment.",
    whyItMatters:
      "Pairs can stop trading on rates and start trading on risk very quickly.",
  },
  {
    extraData: "Commodity prices and related curves",
    whatItUnlocks:
      "Commodity-linked regime detection for currencies such as CAD, AUD, and NZD.",
    whyItMatters:
      "Without commodity data, a big part of those currencies' macro state remains invisible.",
  },
  {
    extraData: "FX options vol and skew",
    whatItUnlocks:
      "Asymmetry, event premium, and a better view of where the market sees directional risk.",
    whyItMatters:
      "Options data helps show what is feared or priced beyond spot alone.",
  },
  {
    extraData: "Positioning and flow proxies",
    whatItUnlocks:
      "Crowding detection, squeeze risk, and a read on when the obvious macro view may already be over-owned.",
    whyItMatters:
      "A good macro view can still fail if everyone is already on the same side.",
  },
  {
    extraData: "Central-bank statement, speech, and minutes NLP",
    whatItUnlocks:
      "More adaptive central-bank reaction-function modeling.",
    whyItMatters:
      "The same inflation print matters differently depending on what the central bank is signaling it cares about most.",
  },
  {
    extraData: "Real-time headline and geopolitical feeds",
    whatItUnlocks:
      "Shock-layer detection and faster adaptation when the market suddenly stops caring about the usual macro script.",
    whyItMatters:
      "This is the layer that helps when regime changes are driven by headlines rather than scheduled data.",
  },
  {
    extraData: "Long-horizon validation and review store",
    whatItUnlocks:
      "Adaptive model weighting, score decay tracking, and learning from which regime calls were actually useful.",
    whyItMatters:
      "Without feedback loops, even a strong rules engine eventually goes stale.",
  },
];

interface WorkInProgressTabProps {
  onOpenWatchlistTab: () => void;
  onOpenPrototypeTab: () => void;
  onOpenLegacyOverviewTab: () => void;
  onOpenDashboardTab: () => void;
  onOpenStrengthMeterTab: () => void;
  onOpenEventToolsTab: () => void;
}

export function WorkInProgressTab({
  onOpenWatchlistTab,
  onOpenPrototypeTab,
  onOpenLegacyOverviewTab,
  onOpenDashboardTab,
  onOpenStrengthMeterTab,
  onOpenEventToolsTab,
}: WorkInProgressTabProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl"
      >
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]">
            <FlaskConical className="h-3.5 w-3.5" />
            Specialist Tool Blueprint
          </div>
          <h2 className="text-3xl font-black tracking-tight">WORK IN PROGRESS</h2>
          <p className="mt-3 max-w-4xl text-sm text-blue-100/90">
            This tab exists as the product blueprint for the final-state app: what current data can already support,
            what still needs additional market inputs, and how the end-to-end workflow should feel once the specialist tools are coherent.
          </p>
        </div>
      </motion.section>

      <div className="flex justify-end">
        <button type="button" onClick={() => setPanelOpen(true)} className="charts-history-button">
          Open Prototype Panel
        </button>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <div className="charts-history-overlay" onClick={() => setPanelOpen(false)}>
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Work in progress prototype navigation"
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="charts-history-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="charts-history-head">
                <div>
                  <h2>Prototype navigation</h2>
                  <p>Fresh specialist screens will be entered from here instead of being exposed in the main dropdown too early.</p>
                </div>
                <button type="button" className="charts-history-close" onClick={() => setPanelOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="charts-history-body">
                <section className="charts-history-section">
                  <h3>Next specialist tab</h3>
                  <p>
                    The first fresh screen will be the prototype branch for the new macro workflow. It stays hidden from the normal navigation until the flow is good enough to replace older specialist surfaces.
                  </p>
                </section>

                <section className="charts-history-section">
                  <h3>Entry point</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelOpen(false);
                      onOpenWatchlistTab();
                    }}
                    className="mb-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-black uppercase tracking-widest text-blue-600">Prototype Tab</span>
                      <span className="text-sm font-bold text-slate-900">Open Watchlist Engine</span>
                      <span className="text-sm leading-6 text-slate-600">
                        Start with the shortlist-first workflow and rank which FX pairs deserve chart time first.
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelOpen(false);
                      onOpenPrototypeTab();
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-black uppercase tracking-widest text-blue-600">Prototype Tab</span>
                      <span className="text-sm font-bold text-slate-900">Open Macro State Prototype</span>
                      <span className="text-sm leading-6 text-slate-600">
                        Enter the fresh specialist tab that will hold the new workflow once implementation begins.
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  </button>
                </section>

                <section className="charts-history-section">
                  <h3>Older specialist tools</h3>
                  <p>
                    These older tools are still accessible, but they now live behind this panel until they are rebuilt or replaced by cleaner flows.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPanelOpen(false);
                        onOpenLegacyOverviewTab();
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Legacy Tool</span>
                        <span className="text-sm font-bold text-slate-900">Legacy Overview Tab</span>
                      </div>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelOpen(false);
                        onOpenDashboardTab();
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Legacy Tool</span>
                        <span className="text-sm font-bold text-slate-900">Differential Calculator</span>
                      </div>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelOpen(false);
                        onOpenStrengthMeterTab();
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Legacy Tool</span>
                        <span className="text-sm font-bold text-slate-900">Strength Meter</span>
                      </div>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelOpen(false);
                        onOpenEventToolsTab();
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Legacy Tool</span>
                        <span className="text-sm font-bold text-slate-900">Event Tools</span>
                      </div>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    </button>
                  </div>
                </section>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Target Workflow</h3>
        <ol className="mt-5 space-y-3">
          {TARGET_WORKFLOW.map((item, index) => (
            <li key={item} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-slate-700">{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="border-b border-gray-100 px-8 py-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Possible With Current Data</h3>
          <p className="mt-1 text-sm text-slate-600">
            Exhaustive view of what the current bridge, calendar, and historical-price stack can already support without inventing extra data.
          </p>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-gray-200 bg-white px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Capability</th>
                <th className="border-b border-gray-200 bg-white px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">What Current Data Supports</th>
                <th className="border-b border-gray-200 bg-white px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Practical Output Now</th>
              </tr>
            </thead>
            <tbody>
              {CURRENT_DATA_ROWS.map((row) => (
                <tr key={row.capability} className="align-top">
                  <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-4 text-sm font-bold text-slate-900">
                    {row.capability}
                  </td>
                  <td className="border-b border-gray-100 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                    {row.whatCurrentDataSupports}
                  </td>
                  <td className="border-b border-gray-100 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                    {row.practicalOutputNow}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="border-b border-gray-100 px-8 py-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">What Extra Data Unlocks The Next Level</h3>
          <p className="mt-1 text-sm text-slate-600">
            These are the extra data layers needed if the app later grows from deterministic macro companion into a more adaptive market-state engine.
          </p>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-gray-200 bg-white px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Extra Data</th>
                <th className="border-b border-gray-200 bg-white px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">What It Unlocks</th>
                <th className="border-b border-gray-200 bg-white px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Why It Matters</th>
              </tr>
            </thead>
            <tbody>
              {EXTRA_DATA_ROWS.map((row) => (
                <tr key={row.extraData} className="align-top">
                  <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-4 text-sm font-bold text-slate-900">
                    {row.extraData}
                  </td>
                  <td className="border-b border-gray-100 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                    {row.whatItUnlocks}
                  </td>
                  <td className="border-b border-gray-100 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                    {row.whyItMatters}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
