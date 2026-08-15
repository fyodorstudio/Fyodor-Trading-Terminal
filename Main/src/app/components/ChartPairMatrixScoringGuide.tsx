import { useEffect, useId, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, ChevronRight, MousePointer2, MoveHorizontal, Scale, Table2, X } from "lucide-react";
import {
  PAIR_MATRIX_MOMENTUM_REGISTRY,
  PAIR_MATRIX_MOMENTUM_SOURCE_REFERENCES,
  type PairMatrixMomentumDirection,
} from "@/app/lib/pairMatrixMomentumRegistry";

const DIRECTION_LABELS: Record<PairMatrixMomentumDirection, string> = {
  higher_is_better: "Higher is improving",
  lower_is_better: "Lower is improving",
  higher_is_hotter: "Higher is hotter",
  policy_action: "Actual versus Previous",
};

const RAW_FIELDS = [
  ["A", "Actual", "The released broker value."],
  ["F", "Forecast", "The broker calendar consensus value."],
  ["P", "Previous", "The prior broker value; it may already be revised."],
  ["S", "Surprise", "Actual minus Forecast. Missing Forecast stays unavailable."],
  ["M", "Momentum", "Actual minus Previous. It never borrows Forecast."],
] as const;

const WORKFLOW_STEPS = [
  ["Hover a candle", "Cursor mode follows one candle and anchors the view at that candle’s opening time."],
  ["Select a range", "Drag across complete candles to lock a wider event window."],
  ["Read During", "These releases arrived while the selected candle or range was forming."],
  ["Read Known before", "These were the latest loaded exact-series readings already known at the opening boundary."],
  ["Adjust the view", "Change the background lookback or drag the panel’s top edge upward for more room."],
  ["Return to Cursor", "Clear the locked range and resume single-candle hover updates."],
] as const;

function GuideSectionTitle({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{step}</span>
      <div>
        <h2 className="m-0 text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export function PairMatrixScoringGuideContent() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-5 py-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <GuideSectionTitle step="1" title="Start with when the evidence was known" description="The timeline never mixes new releases with background information." />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">During candle / range</span>
            <strong className="mt-2 block text-lg font-black text-slate-950">New evidence</strong>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Every loaded pair-currency release that occurred from the opening boundary up to, but not including, the closing boundary.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Known before</span>
            <strong className="mt-2 block text-lg font-black text-slate-950">Background context</strong>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">The latest loaded release for each exact series inside the chosen lookback, frozen at the opening boundary.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <GuideSectionTitle step="2" title="Read three separate outputs" description="Only Economy participates in the pair headline; Inflation and Policy stay adjacent and independent." />
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Economy</span>
            <strong className="mt-2 block text-xl font-black text-slate-950">Improving · 2↑ 1↓</strong>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600"><b>↑</b> counts improving factor votes. <b>↓</b> counts weakening factor votes. More up than down produces Improving; the reverse produces Weakening.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Inflation</span>
            <strong className="mt-2 block text-xl font-black text-slate-950">Heating · 1↑ 0↓</strong>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600"><b>↑</b> counts heating inflation groups. <b>↓</b> counts cooling groups. Hotter inflation is not automatically positive for a currency.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Policy</span>
            <strong className="mt-2 block text-xl font-black text-slate-950">Holding</strong>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">The latest canonical policy-rate Actual is compared only with its Previous value: Tightening, Holding, or Easing.</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-slate-300 bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">
          During-range economy: EUR Improving <span className="mx-2 text-slate-400">|</span> USD Weakening
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <GuideSectionTitle step="3" title="Read the raw event first" description="A/F/P remain the source values. S/M are transparent arithmetic, not a cross-country comparison." />
        <div className="grid gap-2 sm:grid-cols-5">
          {RAW_FIELDS.map(([letter, label, description]) => (
            <div key={letter} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white font-mono text-sm font-black text-slate-950 shadow-sm">{letter}</span>
              <strong className="ml-2 text-sm font-black text-slate-950">{label}</strong>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <GuideSectionTitle step="4" title="Follow the deterministic score" description="Forecast and Previous have equal weight. Numeric size never crosses from one exact series into another." />
        <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">Worked GDP example</span>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Actual", "2.0"], ["Forecast", "1.5"], ["Previous", "1.0"]].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white p-3"><small className="block text-[10px] font-black uppercase text-slate-400">{label}</small><strong className="mt-1 block text-xl font-black text-slate-950">{value}</strong></div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm font-black text-slate-800">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">Surprise +1</span><ChevronRight size={16} />
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">Momentum +1</span><ChevronRight size={16} />
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">Agreement +1</span><ChevronRight size={16} />
              <span className="rounded-lg bg-slate-950 px-3 py-2 text-white">Event +3</span>
            </div>
            <p className="mt-3 text-center text-xs font-bold text-slate-500">A beats F, A improves from P, and both nonzero directions agree.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-slate-200 p-4">
              <strong className="block text-sm font-black text-slate-950">Conflicting evidence = 0</strong>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">GDP A 1.5 beats F 1.0 (+1), but weakens from P 2.0 (−1). There is no agreement bonus, so the event score is 0.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <strong className="block text-sm font-black text-slate-950">Lower-is-better is inverted</strong>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Unemployment A 4.0 is below F 4.2 and P 4.3. Both comparisons become improving (+1 each), plus agreement (+1): event +3.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid items-center gap-2 text-center text-sm font-black text-slate-700 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <span className="rounded-lg border border-slate-200 p-3">Exact event score</span><ChevronRight className="mx-auto rotate-90 md:rotate-0" size={16} />
          <span className="rounded-lg border border-slate-200 p-3">Related family capped −3…+3</span><ChevronRight className="mx-auto rotate-90 md:rotate-0" size={16} />
          <span className="rounded-lg border border-slate-200 p-3">One vote per factor</span><ChevronRight className="mx-auto rotate-90 md:rotate-0" size={16} />
          <span className="rounded-lg bg-slate-950 p-3 text-white">2↑ 1↓ = Improving</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <GuideSectionTitle step="5" title="Know what the result does not claim" description="The score compresses economic evidence so you can inspect it faster; it does not remove market uncertainty." />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Comparisons stay inside the same normalized exact series.",
            "Missing Forecast or Previous contributes nothing; neither substitutes for the other.",
            "Inflation and policy remain outside the Economy vote.",
            "Broker impact level does not change the arithmetic score.",
            "Unregistered releases remain visible but unscored.",
            "The result does not prove why price moved and is not a trade signal.",
          ].map((text) => <div key={text} className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-none text-slate-500" />{text}</div>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><MousePointer2 className="h-6 w-6 text-blue-700" /><div><h2 className="m-0 text-xl font-black text-slate-950">Use Pair Matrix on the chart</h2><p className="mt-1 text-sm font-semibold text-slate-600">Once the scoring path is familiar, the workflow is six short steps.</p></div></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {WORKFLOW_STEPS.map(([title, description], index) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">Step {index + 1}</span>
              <strong className="mt-1 block text-base font-black text-slate-950">{title}</strong>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600"><span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5"><MoveHorizontal size={13} /> Select range</span><span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5"><Scale size={13} /> Resize panel</span><span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5"><Table2 size={13} /> Inspect raw rows</span></div>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-4 text-base font-black text-slate-950">What gets scored? <span className="ml-2 text-xs font-bold text-slate-500">Exclusive registry · collapsed by default</span></summary>
        <div className="border-t border-slate-200 p-5">
          <p className="mb-4 text-sm font-semibold leading-6 text-slate-600">A broker title must match one of these rules. Everything else remains visible in the timeline without affecting a score.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {PAIR_MATRIX_MOMENTUM_REGISTRY.map((rule) => (
              <article key={rule.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{rule.pillar}{rule.factor ? ` · ${rule.factor}` : ""}</span><h3 className="mt-1 text-base font-black text-slate-950">{rule.label}</h3></div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">{DIRECTION_LABELS[rule.direction]}</span></div>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">{rule.rationale}</p>
                <dl className="mt-3 grid gap-2 text-xs text-slate-600">
                  <div><dt className="inline font-black text-slate-800">Currencies: </dt><dd className="inline font-semibold">{rule.currencies?.join(", ") ?? "All supported fiat currencies"}</dd></div>
                  <div><dt className="inline font-black text-slate-800">Matches: </dt><dd className="inline font-mono">{rule.includeAny.join(" · ")}</dd></div>
                  <div><dt className="inline font-black text-slate-800">Excludes: </dt><dd className="inline font-mono">{rule.excludeAny?.join(" · ") ?? "None configured"}</dd></div>
                </dl>
                <a className="mt-3 inline-flex text-xs font-black text-blue-700 underline decoration-blue-200 underline-offset-2" href={PAIR_MATRIX_MOMENTUM_SOURCE_REFERENCES[rule.sourceKey]} target="_blank" rel="noreferrer">Official reference</a>
              </article>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export function handlePairMatrixGuideEscape(event: Pick<KeyboardEvent, "key" | "preventDefault" | "stopImmediatePropagation">, onClose: () => void): boolean {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  onClose();
  return true;
}

export function PairMatrixScoringGuideDialog({
  onClose,
  dialogRef,
  closeRef,
}: {
  onClose: () => void;
  dialogRef?: RefObject<HTMLDivElement>;
  closeRef?: RefObject<HTMLButtonElement>;
}) {
  const titleId = useId();
  return (
    <div ref={dialogRef} className="fixed inset-0 z-[1600] flex flex-col overflow-hidden bg-slate-100" role="dialog" aria-modal="true" aria-labelledby={titleId} data-pair-matrix-scoring-guide="">
      <header className="z-[1] flex min-h-[64px] flex-none items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 shadow-sm lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-950 text-white"><BookOpen size={19} /></span><div><p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Pair Matrix tutorial</p><h1 id={titleId} className="m-0 text-xl font-black text-slate-950">How scoring works</h1></div></div>
        <button ref={closeRef} type="button" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300" aria-label="Close Pair Matrix scoring guide"><X size={17} /> Close</button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto"><PairMatrixScoringGuideContent /></main>
    </div>
  );
}

export function ChartPairMatrixScoringGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (handlePairMatrixGuideEscape(event, onClose)) return;
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <PairMatrixScoringGuideDialog onClose={onClose} dialogRef={dialogRef} closeRef={closeRef} />,
    document.body,
  );
}
