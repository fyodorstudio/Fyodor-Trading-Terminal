import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Database, X } from "lucide-react";
import { fetchFmsRawCases } from "@/app/lib/bridge";
import type { FmsExperiment, FmsRawCasesPage } from "@/app/types";

function time(value: number | null | undefined) {
  return value == null ? "—" : new Date(value * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function raw(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

export function FmsRawDataAudit({ experiment, open, onClose }: { experiment: FmsExperiment; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [data, setData] = useState<FmsRawCasesPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState("");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [inclusion, setInclusion] = useState("all");
  const [reliability, setReliability] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => { cancelAnimationFrame(frame); returnFocusRef.current?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchFmsRawCases(experiment.id, { page, pageSize: 50, contract, search, direction, inclusion, reliability, outcome })
      .then((next) => { if (!cancelled) { setData(next); setContract((current) => current || next.selectedContractKey); setError(null); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Raw audit unavailable"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, experiment.id, contract, search, direction, inclusion, reliability, outcome, page]);

  if (!open) return null;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)));
  const toggle = (caseId: string) => setExpanded((current) => { const next = new Set(current); if (next.has(caseId)) next.delete(caseId); else next.add(caseId); return next; });
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return createPortal(<div className="fms-raw-backdrop" role="presentation">
    <div ref={dialogRef} className="fms-raw-dialog" role="dialog" aria-modal="true" aria-labelledby="fms-raw-title" tabIndex={-1} onKeyDown={keyDown}>
      <header><div><span><Database size={14} />Raw experiment audit</span><h2 id="fms-raw-title">{experiment.friendlyName}</h2><p>{experiment.id} · immutable dataset {experiment.datasetFingerprint.slice(0, 12)}</p></div><button type="button" onClick={onClose} aria-label="Close raw data audit"><X /></button></header>
      <div className="fms-raw-toolbar">
        <label>Search<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Title, currency, or country" /></label>
        <label>Contract<select value={contract} onChange={(event) => { setContract(event.target.value); setPage(1); }}>{data?.contracts.map((item) => <option key={item.key} value={item.key}>{item.stopAtr} ATR SL · {item.targetR}R TP = {item.targetAtr} ATR · {item.holdingCandles} H4{item.key === data.selectedContractKey ? " · highlighted" : ""}</option>)}</select></label>
        <label>Direction<select value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); }}><option value="all">All</option><option value="long">Long</option><option value="short">Short</option></select></label>
        <label>Cases included<select value={inclusion} onChange={(event) => { setInclusion(event.target.value); setPage(1); }}><option value="all">Included + excluded</option><option value="included">Included</option><option value="excluded">Excluded</option></select></label>
        <label>Forecast<select value={reliability} onChange={(event) => { setReliability(event.target.value); setPage(1); }}><option value="all">All</option><option value="reliable">Not flagged</option><option value="unreliable">Unreliable</option></select></label>
        <label>Outcome<select value={outcome} onChange={(event) => { setOutcome(event.target.value); setPage(1); }}><option value="all">All</option><option value="target_hit">TP first</option><option value="stop_hit">SL first</option><option value="expired">Expired</option><option value="ambiguous">Ambiguous</option><option value="unavailable">Unavailable</option></select></label>
      </div>
      <main className="fms-raw-content">
        {error ? <div className="fms-raw-message is-error">{error}</div> : null}
        {loading && !data ? <div className="fms-raw-message">Loading raw experiment cases…</div> : null}
        <div className="fms-raw-table" role="table" aria-label="Raw experiment cases">
          <div className="fms-raw-head" role="row"><span>Release package</span><span>State</span><span>Direction</span><span>Entry</span><span>SL</span><span>TP</span><span>Duration</span><span>Outcome</span><span>Result</span></div>
          {data?.rows.map((row) => { const simulation = row.simulation; const isOpen = expanded.has(row.caseId); return <div className="fms-raw-package" key={row.caseId}>
            <button type="button" className="fms-raw-parent" onClick={() => toggle(row.caseId)} aria-expanded={isOpen}>
              <span>{isOpen ? <ChevronDown /> : <ChevronRight />}<b>{time(row.eventTime)}</b><small>{row.events.length} release{row.events.length === 1 ? "" : "s"}</small></span>
              <span className={row.included ? "is-included" : "is-excluded"}>{row.included ? "Included" : "Excluded"}<small>{row.inclusionReason}</small></span>
              <span>{row.direction.toUpperCase()}</span><span>{raw(simulation?.entry)}</span><span>{raw(simulation?.stop)}<small>{simulation ? `${simulation.stopAtr} ATR` : "—"}</small></span><span>{raw(simulation?.target)}<small>{simulation ? `${simulation.targetR}R = ${simulation.targetAtr} ATR` : "—"}</small></span><span>{simulation ? `${simulation.holdingCandles} H4` : "—"}</span><span>{simulation ? simulation.status.replaceAll("_", " ") : "Unavailable"}<small>{time(simulation?.exitTime)}</small></span><span>{simulation?.stressedResultR == null ? "—" : `${simulation.stressedResultR > 0 ? "+" : ""}${simulation.stressedResultR.toFixed(2)}R`}</span>
            </button>
            {isOpen ? <div className="fms-raw-events"><div className="fms-raw-event-head"><span>Release</span><span>A</span><span>F</span><span>P</span><span>S</span><span>M</span><span>Bonus</span><span>Score</span><span>Forecast</span></div>{row.events.map((event, index) => <div className="fms-raw-event" key={`${row.caseId}-${index}`}><span><b>{event.title || "Untitled release"}</b><small>{event.currency || "—"} · {event.countryCode || "—"}</small></span><span>{raw(event.actual)}</span><span>{raw(event.forecast)}</span><span>{raw(event.previous)}</span><span>{raw(event.surpriseRaw)}<small>vote {raw(event.surprisePoint)}</small></span><span>{raw(event.momentumRaw)}<small>vote {raw(event.momentumPoint)}</small></span><span>{raw(event.agreementBonus)}</span><span>{raw(event.score)}</span><span className={event.forecastSuspect ? "is-unreliable" : ""}>{event.forecastSuspect ? "Forecast unreliable" : "Not flagged"}{event.forecastSuspect ? <small>Gap {raw(event.forecastGap)} · threshold {raw(event.forecastAnomalyThreshold)}</small> : null}</span></div>)}</div> : null}
          </div>; })}
        </div>
        {!loading && data && !data.rows.length ? <div className="fms-raw-message">No raw cases match these filters.</div> : null}
      </main>
      <footer><span>{data?.total ?? 0} matching cases · page {page} of {pageCount}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
    </div>
  </div>, document.body);
}
