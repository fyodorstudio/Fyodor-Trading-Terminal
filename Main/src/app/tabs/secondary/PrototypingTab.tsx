import { ChevronRight, FlaskConical } from "lucide-react";
import type { TabId } from "@/app/types";

interface PrototypeLink {
  id: TabId;
  label: string;
  description: string;
}

const IGNORE_LINKS: PrototypeLink[] = [
  {
    id: "currency-candle-strength",
    label: "Currency Strength From Candles",
    description: "Candle-only currency strength board based on base/quote pair returns.",
  },
  {
    id: "watchlist-engine-prototype",
    label: "Watchlist Engine",
    description: "Experimental pair shortlist and macro-gap view.",
  },
  {
    id: "macro-state-prototype",
    label: "Macro State",
    description: "Experimental selected-pair macro backdrop view.",
  },
  {
    id: "terminal-questions",
    label: "Six Questions Draft",
    description: "Deprecated product map kept as historical context, not current build direction.",
  },
  {
    id: "work-in-progress",
    label: "WIP Map Archive",
    description: "Archived planning map kept for reference only.",
  },
  {
    id: "strength-meter",
    label: "Strength Meter",
    description: "Deprecated strength surface kept available while its logic is reviewed.",
  },
  {
    id: "dashboard",
    label: "Differential Calculator",
    description: "Older rate and inflation differential calculator.",
  },
  {
    id: "legacy-overview",
    label: "Deprecated Overview",
    description: "Older overview surface kept available for reference.",
  },
];

interface PrototypingTabProps {
  onNavigate: (tab: TabId) => void;
}

function ToolGrid({
  items,
  kicker,
  title,
  description,
  onNavigate,
}: {
  items: PrototypeLink[];
  kicker: string;
  title: string;
  description: string;
  onNavigate: (tab: TabId) => void;
}) {
  return (
    <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">{kicker}</div>
        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{title}</h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className="flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex flex-col gap-2">
              <span className="text-base font-black text-slate-900">{item.label}</span>
              <span className="text-sm leading-6 text-slate-600">{item.description}</span>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function PrototypingTab({ onNavigate }: PrototypingTabProps) {
  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]">
            <FlaskConical className="h-3.5 w-3.5" />
            Experimental Area
          </div>
          <h2 className="text-3xl font-black tracking-tight">PROTOTYPING</h2>
          <p className="mt-3 max-w-4xl text-sm text-blue-100/90">
            Garbage drawer for unfinished or ignored tools. Future AI sessions should not treat these as the main workflow unless explicitly asked.
          </p>
        </div>
      </section>

      <ToolGrid
        kicker="Ignore"
        title="Garbage Drawer"
        description="Old, unstable, or unfinished screens kept only so nothing useful is lost. Do not treat these as current product direction."
        items={IGNORE_LINKS}
        onNavigate={onNavigate}
      />
    </div>
  );
}
