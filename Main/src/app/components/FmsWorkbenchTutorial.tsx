import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X } from "lucide-react";

interface FmsWorkbenchTutorialProps {
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export function FmsWorkbenchTutorial({ open, onClose }: FmsWorkbenchTutorialProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
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
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fms-guide-backdrop" role="presentation">
      <div ref={dialogRef} className="fms-guide" role="dialog" aria-modal="true" aria-labelledby="fms-guide-title">
        <header>
          <div><BookOpen size={18} /><div><span>FMS research tutorial</span><h2 id="fms-guide-title">How to use FMS Experiment Workbench</h2></div></div>
          <button type="button" onClick={onClose} aria-label="Close FMS Experiment Workbench tutorial"><X size={18} /></button>
        </header>
        <main>
          <section className="fms-guide-stage-intro">
            <span>The short version</span>
            <h3><strong>E</strong> = test it <i>→</i> <strong>C</strong> = shortlist it <i>→</i> <strong>M</strong> = approve it for Charts</h3>
            <p>These letters describe where an idea is in the research workflow. They are not scores, signal strength, or grades. Most experiments should never become a Charts model.</p>
          </section>
          <section className="fms-guide-steps">
            <article><b>E</b><div><span>Test</span><h3>Recorded experiment</h3><p>Created whenever you press <strong>Run recorded experiment</strong>. It permanently saves exactly what was tested and the result—even if it failed.</p><small>Example: <code>FMS-EURUSD-H4-E014</code></small><em>Does not change Charts or Shadow Trader.</em></div></article>
            <article><b>C</b><div><span>Shortlist</span><h3>Frozen candidate</h3><p>Created only when you freeze an E result that looks worth reviewing. It points back to that exact experiment and keeps every passed or failed check.</p><small>Example: <code>FMS-EURUSD-H4-C003</code></small><em>Still does not change Charts or Shadow Trader.</em></div></article>
            <article><b>M</b><div><span>Use</span><h3>Reviewed Charts model</h3><p>A rule set deliberately reviewed and implemented for Charts. The Lab cannot create or promote this automatically; it requires a separate review and code change.</p><small>Future example: <code>FMS-EURUSD-H4-M001</code></small><em>This is the stage that may power current Charts signals.</em></div></article>
          </section>

          <section className="fms-guide-table fms-guide-stage-notes">
            <div><strong>E → C</strong><span>You decide a completed experiment deserves closer review. Freezing copies nothing loosely: the C record references that exact immutable E record.</span></div>
            <div><strong>C → M</strong><span>Codex and the user review the evidence, failed checks, overfitting risk, and rule meaning. Promotion is a separate implementation task—not a Lab button.</span></div>
            <div><strong>Numbering</strong><span>E014, C003, and M001 are separate counters. A larger number is newer within that record type; it does not mean better performance.</span></div>
          </section>

          <section><h3>Reading the evidence</h3><div className="fms-guide-grid">
            <article><h4>Exact signature</h4><p>Currency, country/region, scoring family, direction, and exact package identity. Different titles are never averaged as raw values.</p></article>
            <article><h4>Surprise / Momentum</h4><p>Surprise compares Actual with Forecast. Momentum compares Actual with Previous. Forecast Guard can exclude an historically anomalous Forecast while retaining Momentum.</p></article>
            <article><h4>Relative magnitude</h4><p>A 94th-percentile Surprise means its absolute Actual-versus-Forecast gap was larger than about 94% of earlier releases of that exact series. It never compares unlike indicators, and it uses no future rows.</p></article>
            <article><h4>Continuation / rejection</h4><p>Continuation tests price in the evidence direction. Rejection deliberately tests the opposite direction. It is a historical treatment, not a causal claim.</p></article>
            <article><h4>Cases included</h4><p>A filter selects one understandable subset of otherwise matching historical cases—for example agreement, revisions, package completeness, Before alignment, or score magnitude.</p></article>
          </div></section>

          <section><h3>Reading the trade contract</h3><div className="fms-guide-table">
            <div><strong>ATR</strong><span>H4 Average True Range. A 1 ATR stop is one completed pre-entry H4 ATR away from entry.</span></div>
            <div><strong>SL (ATR)</strong><span>The stop-loss distance in completed pre-entry H4 ATR units.</span></div>
            <div><strong>TP (R + ATR)</strong><span>R is the SL risk unit. ATR-equivalent TP distance equals SL ATR × TP R; for example, SL 2 ATR and TP 2R means TP 4 ATR away.</span></div>
            <div><strong>Expiry</strong><span>Maximum completed H4 candles before the simulation closes at market.</span></div>
            <div><strong>MFE / MAE</strong><span>Maximum favorable/adverse movement observed after entry. These are audit statistics known only afterward.</span></div>
          </div></section>

          <section><h3>Single Contract versus Combined Contracts</h3><div className="fms-guide-grid">
            <article><h4>Single Contract</h4><p>Tests exactly one SL, TP, and maximum duration.</p></article>
            <article><h4>Combined Contracts</h4><p>Tests every selected SL × TP × duration combination as an independent full-position simulation. It does not create partial take-profits. Development highlights one contract; every tested contract remains visible.</p></article>
          </div></section>

          <section><h3>Raw data audit</h3><p>After an experiment completes, <strong>View raw data</strong> shows each included or excluded release package, its A/F/P/S/M values, Forecast Guard flag, score, simulated SL/TP, outcome, and result. This is the audit source behind the summaries.</p></section>

          <section><h3>Reading the result</h3><div className="fms-guide-table">
            <div><strong>Development</strong><span>Older data used to choose a matrix configuration.</span></div>
            <div><strong>Holdout</strong><span>Later data withheld from configuration selection.</span></div>
            <div><strong>Recent</strong><span>Latest fixed research window; useful for detecting deterioration.</span></div>
            <div><strong>Lower 95%</strong><span>Uncertainty bound for average R. Above zero is stronger evidence than a positive average alone.</span></div>
            <div><strong>Stability</strong><span>Whether nearby stop, target, and expiry choices behave similarly instead of depending on one lucky grid point.</span></div>
            <div><strong>Positive years</strong><span>How many evaluable calendar years produced positive stressed average R.</span></div>
          </div></section>

          <section className="fms-guide-warning"><h3>Research discipline</h3><p>Every button-triggered run receives an E identifier, including failures. Trying many rules increases overfitting risk. Historical outcomes exclude spread, commission, slippage, and swap, do not prove that a release caused price movement, and do not guarantee future trades.</p><p>Use <strong>Copy AI summary</strong> for a concise Codex review and <strong>Download JSON</strong> when the complete configuration, fingerprints, checks, and result are needed.</p></section>
        </main>
      </div>
    </div>,
    document.body,
  );
}
