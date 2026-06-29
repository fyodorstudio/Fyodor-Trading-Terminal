import { ChevronRight, Compass, HelpCircle } from "lucide-react";
import type { TabId } from "@/app/types";

interface TerminalQuestion {
  question: string;
  currentAnswer: string;
  honestLimit: string;
  primaryTab: TabId;
  primaryLabel: string;
  primaryStatus: "Primary" | "Prototype" | "Deprecated";
  secondaryTab?: TabId;
  secondaryLabel?: string;
  secondaryStatus?: "Primary" | "Prototype" | "Deprecated";
}

const TERMINAL_QUESTIONS: TerminalQuestion[] = [
  {
    question: "Can I trust the app right now?",
    currentAnswer: "Check bridge health, MT5 connection, calendar freshness, market status, and whether missing data is being shown honestly.",
    honestLimit: "Trust only covers the app inputs. It does not prove that the market read is correct.",
    primaryTab: "overview",
    primaryLabel: "Open Overview",
    primaryStatus: "Primary",
    secondaryTab: "calendar",
    secondaryLabel: "Audit Calendar",
    secondaryStatus: "Primary",
  },
  {
    question: "What deserves attention right now?",
    currentAnswer: "Use pair shortlist logic, candle-derived currency strength, event risk, and macro coverage to narrow the board.",
    honestLimit: "This can prioritize chart review. It should not become an automatic trade signal.",
    primaryTab: "watchlist-engine-prototype",
    primaryLabel: "Open Watchlist",
    primaryStatus: "Prototype",
    secondaryTab: "strength-meter",
    secondaryLabel: "Open Strength",
    secondaryStatus: "Deprecated",
  },
  {
    question: "Is the macro backdrop supportive, hostile, or unclear?",
    currentAnswer: "Compare central-bank snapshots, rate and inflation direction, recent event pressure, and pair-specific macro divergence.",
    honestLimit: "With only candles and calendar data, this is a pressure map, not true market-implied policy pricing.",
    primaryTab: "macro-state-prototype",
    primaryLabel: "Open Macro State",
    primaryStatus: "Prototype",
    secondaryTab: "central-banks",
    secondaryLabel: "Open Central Banks",
    secondaryStatus: "Primary",
  },
  {
    question: "Is event risk close enough to invalidate a clean setup?",
    currentAnswer: "Find high-impact events for either side of the pair, show timing, explain the event family, and mark near-term danger.",
    honestLimit: "The calendar can warn about scheduled risk. It cannot see unscheduled news shocks.",
    primaryTab: "calendar",
    primaryLabel: "Open Calendar",
    primaryStatus: "Primary",
    secondaryTab: "event-tools",
    secondaryLabel: "Open Event Replay",
    secondaryStatus: "Primary",
  },
  {
    question: "Which side is winning, and why?",
    currentAnswer: "Combine candle strength, pair direction, macro snapshots, recent event pressure, and upcoming risk into a readable base-vs-quote brief.",
    honestLimit: "The app can explain evidence alignment. TradingView structure still decides entry quality.",
    primaryTab: "legacy-overview",
    primaryLabel: "Open Deprecated Overview",
    primaryStatus: "Deprecated",
    secondaryTab: "currency-candle-strength",
    secondaryLabel: "Open Candle Strength",
    secondaryStatus: "Prototype",
  },
  {
    question: "Should I watch, study, prepare, wait, or ignore?",
    currentAnswer: "Translate the evidence into workflow language so the next step is inspection, preparation, or avoidance instead of impulsive execution.",
    honestLimit: "This is decision support. It must stop before buy/sell certainty.",
    primaryTab: "overview",
    primaryLabel: "Open Overview",
    primaryStatus: "Primary",
    secondaryTab: "prototyping",
    secondaryLabel: "Review Prototypes",
    secondaryStatus: "Prototype",
  },
];

interface SixQuestionsDraftTabProps {
  onNavigate: (tab: TabId) => void;
}

export function SixQuestionsDraftTab({ onNavigate }: SixQuestionsDraftTabProps) {
  const renderRouteButton = (tab: TabId, label: string, status: TerminalQuestion["primaryStatus"]) => (
    <button
      type="button"
      className={
        status === "Primary"
          ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-slate-800"
          : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-left text-sm font-black text-slate-800 transition-colors hover:bg-slate-50"
      }
      onClick={() => onNavigate(tab)}
    >
      <span className="block">{label}</span>
      <span
        className={
          status === "Primary"
            ? "mt-1 block text-[10px] uppercase tracking-widest text-slate-300"
            : "mt-1 block text-[10px] uppercase tracking-widest text-slate-400"
        }
      >
        {status}
      </span>
    </button>
  );

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-xl">
        <div className="bg-slate-950 px-8 py-8 text-white">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]">
            <Compass className="h-3.5 w-3.5" />
            Deprecated Draft
          </div>
          <h2 className="text-3xl font-black tracking-tight">SIX QUESTIONS</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-200">
            This was an early product map. Keep it as historical routing context, but do not treat it as the current source of truth for new work.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
        <div className="mb-4 px-3 pt-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
            <HelpCircle className="h-4 w-4" />
            Expandable Workflow
          </div>
          <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">What The App Must Answer</h3>
        </div>

        <div className="flex flex-col gap-3">
          {TERMINAL_QUESTIONS.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-xl border border-slate-200 bg-white px-5 py-4 open:border-blue-200 open:bg-blue-50/35"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span className="text-base font-black text-slate-900">{item.question}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-90" />
              </summary>

              <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-[1fr_1fr_auto] md:items-start">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current answer</div>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.currentAnswer}</p>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Honest limit</div>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.honestLimit}</p>
                </div>
                <div className="flex flex-col gap-2 md:min-w-[180px]">
                  {renderRouteButton(item.primaryTab, item.primaryLabel, item.primaryStatus)}
                  {item.secondaryTab && item.secondaryLabel ? (
                    renderRouteButton(item.secondaryTab, item.secondaryLabel, item.secondaryStatus ?? "Prototype")
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
        <h3 className="text-sm font-black uppercase tracking-widest text-amber-800">Session boundary</h3>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          With OHLCV and the broker calendar, the app can build a disciplined briefing layer: shortlist pairs, explain scheduled event risk,
          replay reactions, and describe evidence alignment. It cannot honestly know positioning, option pricing, surprise expectations, or
          unscheduled headline shocks without extra data.
        </p>
      </section>
    </div>
  );
}
