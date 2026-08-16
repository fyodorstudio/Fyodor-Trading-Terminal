import { X } from "lucide-react";

export interface MetricAudit {
  heading: string;
  formula: string;
  result: string;
  contributors: string[];
  accessibleText: string;
  economyBreakdown?: {
    upCount: number;
    downCount: number;
    zeroCount: number;
    netVotes: number;
    factors: Array<{ label: string; direction: "up" | "down" | "neutral"; score: number }>;
  };
}

export interface PairMatrixActiveAudit {
  side: "base" | "quote";
  period: "during" | "before";
  metric: "economy" | "inflation" | "policy";
  audit: MetricAudit;
}

export function getPairMatrixAuditKey(audit: Pick<PairMatrixActiveAudit, "side" | "period" | "metric">): string {
  return `${audit.side}:${audit.period}:${audit.metric}`;
}

export function togglePairMatrixActiveAudit(current: PairMatrixActiveAudit | null, next: PairMatrixActiveAudit): PairMatrixActiveAudit | null {
  return current && getPairMatrixAuditKey(current) === getPairMatrixAuditKey(next) ? null : next;
}

export function getPairMatrixAuditContextKey(data: { open: boolean; pairLabel: string; rangeLabel: string; loadState: string }): string {
  return `${data.open}:${data.pairLabel}:${data.rangeLabel}:${data.loadState}`;
}

export function handlePairMatrixAuditEscape(event: Pick<KeyboardEvent, "key" | "preventDefault" | "stopPropagation">, onClose: () => void): boolean {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopPropagation();
  onClose();
  return true;
}

export interface PairMatrixAuditContributorCells {
  series: string;
  forecast: string;
  previous: string;
  agreement: string;
  score: string;
}

export function parsePairMatrixAuditContributor(contributor: string): PairMatrixAuditContributorCells {
  const separator = contributor.indexOf(":");
  const series = separator >= 0 ? contributor.slice(0, separator).trim() : contributor.trim();
  const clauses = (separator >= 0 ? contributor.slice(separator + 1) : "")
    .replace(/\.$/, "")
    .split(";")
    .map((clause) => clause.trim())
    .filter(Boolean);
  const find = (prefix: string) => clauses.find((clause) => clause.toLowerCase().startsWith(prefix));
  const policyPrevious = find("actual versus previous");
  return {
    series,
    forecast: clauses.find((clause) => /forecast/i.test(clause)) ?? "—",
    previous: clauses.find((clause) => /previous/i.test(clause)) ?? policyPrevious ?? "—",
    agreement: find("agreement bonus")?.replace(/^agreement bonus\s*/i, "") ?? "—",
    score: (find("event score")?.replace(/^event score\s*/i, "") ?? find("policy action")?.replace(/^policy action\s*/i, "")) || "—",
  };
}

export function PairMatrixAuditOverlay({ activeAudit, onClose }: {
  activeAudit: PairMatrixActiveAudit;
  onClose: () => void;
}) {
  const { audit, side, period, metric } = activeAudit;
  return (
    <aside
      id={`pair-matrix-audit-overlay-${side}`}
      className={`absolute bottom-0 top-[98px] z-30 flex w-1/2 flex-col overflow-hidden border-slate-700 bg-slate-950 text-white shadow-2xl ${side === "base" ? "left-0 border-r" : "right-0 border-l"}`}
      role="region"
      aria-label={`${audit.heading} calculation audit`}
      data-pair-matrix-audit-overlay=""
      data-pair-matrix-audit-side={side}
      data-pair-matrix-audit-period={period}
      data-pair-matrix-audit-metric={metric}
      data-pair-matrix-audit-persistence="explicit-close"
    >
      <header className="sticky top-0 z-10 flex min-h-11 items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-2">
        <div className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-blue-300">Calculation audit</span>
          <strong className="block truncate text-[16px] font-black leading-[22px] text-white">{audit.heading}</strong>
        </div>
        <button type="button" className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={onClose} aria-label={`Close ${audit.heading} audit`}><X size={16} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3" data-pair-matrix-audit-scroll="internal">
        <div className="grid gap-3 text-left normal-case tracking-normal">
          <section className="grid gap-1 text-[14px] leading-5 text-slate-200">
            <h3 className="m-0 text-[11px] font-black uppercase tracking-[0.1em] text-blue-300">Formula</h3>
            <p className="m-0">{audit.formula.replace(/^Formula:\s*/i, "")}</p>
          </section>
          <section className="grid gap-1 text-[14px] leading-5 text-slate-200">
            <h3 className="m-0 text-[11px] font-black uppercase tracking-[0.1em] text-blue-300">Result</h3>
            {audit.economyBreakdown ? (
              <div className="grid gap-2" data-pair-matrix-economy-result="structured">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-slate-800 bg-slate-900/55 px-3 py-2">
                  <span><b className="mr-2 text-[11px] uppercase tracking-[0.08em] text-slate-400">Votes</b>{audit.economyBreakdown.upCount}↑ &nbsp; {audit.economyBreakdown.downCount}↓ &nbsp; {audit.economyBreakdown.zeroCount} neutral</span>
                  <span><b className="mr-2 text-[11px] uppercase tracking-[0.08em] text-slate-400">Net</b><strong className="text-white">{audit.economyBreakdown.netVotes > 0 ? "+" : ""}{audit.economyBreakdown.netVotes}</strong></span>
                </div>
                {audit.economyBreakdown.factors.length > 0 ? (
                  <div className="grid overflow-hidden rounded-lg border border-slate-800 bg-slate-900/55" style={{ gridTemplateColumns: `repeat(${audit.economyBreakdown.factors.length}, minmax(0, 1fr))` }} role="list" aria-label={`${audit.heading} factor votes`} data-pair-matrix-factor-result-table="">
                    {audit.economyBreakdown.factors.map((factor, index) => (
                      <div key={factor.label} className={`min-w-0 px-3 py-2.5 text-center ${index > 0 ? "border-l border-slate-800" : ""}`} role="listitem">
                        <span className="block truncate text-[11px] font-black uppercase tracking-[0.07em] text-slate-400" title={factor.label}>{factor.label}</span>
                        <strong className="mt-1 block text-[16px] font-black text-white">{factor.direction === "up" ? "↑" : factor.direction === "down" ? "↓" : "0"} {factor.score > 0 ? "+" : ""}{factor.score}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : <p className="m-0">{audit.result}</p>}
          </section>
          {audit.contributors.length > 0 ? (
            <section className="grid gap-2 text-[14px] leading-5 text-slate-200">
              <h3 className="m-0 text-[11px] font-black uppercase tracking-[0.1em] text-blue-300">Contributors · {audit.contributors.length}</h3>
              <div className="overflow-hidden rounded-lg border border-slate-800" role="table" aria-label={`${audit.heading} contributors`} data-pair-matrix-contributor-table="">
                <div className="grid grid-cols-[26%_22%_22%_16%_14%] border-b border-slate-700 bg-slate-900/80 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400" role="row">
                  <span className="min-w-0 px-3 py-2" role="columnheader">Series</span>
                  <span className="min-w-0 border-l border-slate-800 px-3 py-2" role="columnheader">Forecast</span>
                  <span className="min-w-0 border-l border-slate-800 px-3 py-2" role="columnheader">Previous</span>
                  <span className="min-w-0 border-l border-slate-800 px-3 py-2 text-center" role="columnheader">Agreement</span>
                  <span className="min-w-0 border-l border-slate-800 px-3 py-2 text-center" role="columnheader">Score</span>
                </div>
                <div className="divide-y divide-slate-800" role="rowgroup">
                  {audit.contributors.map((contributor, index) => {
                    const cells = parsePairMatrixAuditContributor(contributor);
                    return (
                      <div key={`${index}:${contributor}`} className="grid grid-cols-[26%_22%_22%_16%_14%] bg-slate-900/55" role="row">
                        <strong className="min-w-0 break-words px-3 py-2.5 text-white" role="cell">{cells.series}</strong>
                        <span className="min-w-0 break-words border-l border-slate-800 px-3 py-2.5" role="cell">{cells.forecast}</span>
                        <span className="min-w-0 break-words border-l border-slate-800 px-3 py-2.5" role="cell">{cells.previous}</span>
                        <span className="min-w-0 border-l border-slate-800 px-3 py-2.5 text-center font-bold" role="cell">{cells.agreement}</span>
                        <span className="min-w-0 border-l border-slate-800 px-3 py-2.5 text-center font-black text-white" role="cell">{cells.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
