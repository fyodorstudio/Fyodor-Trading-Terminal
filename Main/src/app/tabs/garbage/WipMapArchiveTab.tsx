import { motion } from "framer-motion";
import { FlaskConical } from "lucide-react";

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

const CURRENT_DATA_ROWS: CurrentDataRow[] = [
  {
    capability: "Pair shortlist",
    whatCurrentDataSupports:
      "Use candles and calendar-derived context to narrow the major FX universe into pairs worth checking first.",
    practicalOutputNow:
      "A watchlist that helps decide where to spend chart time, not a trade signal.",
  },
  {
    capability: "Currency strength from candles",
    whatCurrentDataSupports:
      "Aggregate movement across pairs so a currency can be read as broadly strong, broadly weak, or mixed.",
    practicalOutputNow:
      "A way to tell whether EURUSD is mainly EUR strength, USD weakness, both, or neither.",
  },
  {
    capability: "Calendar surprise pressure",
    whatCurrentDataSupports:
      "Compare actual, forecast, previous, currency, impact, and event family for scheduled releases.",
    practicalOutputNow:
      "A recent-event pressure read such as USD-positive, EUR-negative, mixed, or unavailable.",
  },
  {
    capability: "Upcoming event risk",
    whatCurrentDataSupports:
      "Find high-impact events for either side of a selected pair within a chosen time window.",
    practicalOutputNow:
      "A warning that a setup may be exposed to CPI, rate decisions, labor data, or similar catalysts.",
  },
  {
    capability: "Event reaction replay",
    whatCurrentDataSupports:
      "Replay historical candles around previous releases when the app has both event rows and matching price history.",
    practicalOutputNow:
      "A study tool for seeing how a pair behaved around similar scheduled events.",
  },
  {
    capability: "Pair backdrop explanation",
    whatCurrentDataSupports:
      "Combine pair strength, recent event pressure, structural macro snapshots, and event risk into readable evidence blocks.",
    practicalOutputNow:
      "A short brief explaining why a pair is worth watching, waiting on, or avoiding.",
  },
  {
    capability: "Basic structural macro backdrop",
    whatCurrentDataSupports:
      "Use policy rate, inflation, previous values, directional change, and a simple real-rate proxy where available.",
    practicalOutputNow:
      "A slow-moving context layer that can support the brief but should not dominate the whole watchlist.",
  },
  {
    capability: "Calendar event explanation",
    whatCurrentDataSupports:
      "Explain what the print is, why traders care, and whether the release could reinforce or challenge the current macro read.",
    practicalOutputNow:
      "A structured manual-thinking aid instead of scrolling headlines and random commentary.",
  },
  {
    capability: "Historical event archive",
    whatCurrentDataSupports:
      "Measure past release reactions across pairs using stored event rows plus bridge price history.",
    practicalOutputNow:
      "A reusable evidence base for later validation and event studies.",
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

export function WipMapArchiveTab() {
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
            Archived Planning Map
          </div>
          <h2 className="text-3xl font-black tracking-tight">WORK IN PROGRESS</h2>
          <p className="mt-3 max-w-4xl text-sm text-blue-100/90">
            Historical capability notes. Keep this available for reference, but use Event Replay and the active checklist as the current direction.
          </p>
        </div>
      </motion.section>

      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="border-b border-gray-100 px-8 py-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Possible With Current Data</h3>
          <p className="mt-1 text-sm text-slate-600">
            What candles and the economic calendar can support without pretending the app has institutional data.
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
