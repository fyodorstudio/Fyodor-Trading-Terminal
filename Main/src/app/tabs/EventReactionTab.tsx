import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, ChevronDown, FlaskConical } from "lucide-react";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { fetchHistoryRange } from "@/app/lib/bridge";
import {
  REACTION_WINDOWS,
  deriveAssetFirstStudy,
  deriveEventFirstStudy,
  discoverEventTemplates,
  getAllReactionFamilies,
  getMonthlyChunkKeys,
  getMonthlyChunkRange,
  getPairTemplateMap,
  getRankMetricLabel,
  getRelevantPairsForCurrency,
  getSampleQualityLabel,
  getTemplateEvents,
} from "@/app/lib/eventReaction";
import type {
  BridgeCandle,
  CalendarEvent,
  EventQualityFamily,
  EventReactionMode,
  EventTemplate,
  FxPairDefinition,
  ReactionStudyRow,
  ReactionStudySummary,
  ReactionWindow,
} from "@/app/types";

interface EventReactionTabProps {
  events: CalendarEvent[];
}

const MODE_OPTIONS: Array<{ id: EventReactionMode; label: string }> = [
  { id: "event-first", label: "Event-first" },
  { id: "asset-first", label: "Asset-first" },
];

const STORAGE_KEYS = {
  mode: "reaction-engine-mode",
  pair: "reaction-engine-pair",
  family: "reaction-engine-family",
  weak: "reaction-engine-show-weak",
  template: "reaction-engine-template",
};

function getInitialMode(): EventReactionMode {
  if (typeof window === "undefined") return "event-first";
  return window.localStorage.getItem(STORAGE_KEYS.mode) === "asset-first" ? "asset-first" : "event-first";
}

function getInitialPair(): FxPairDefinition {
  if (typeof window === "undefined") return FX_PAIRS[0];
  return getFxPairByName(window.localStorage.getItem(STORAGE_KEYS.pair) ?? "EURUSD") ?? FX_PAIRS[0];
}

function getInitialFamily(): EventQualityFamily | "all" {
  if (typeof window === "undefined") return "all";
  const saved = window.localStorage.getItem(STORAGE_KEYS.family);
  const families = new Set(getAllReactionFamilies().map((item) => item.id));
  return families.has((saved ?? "all") as EventQualityFamily | "all")
    ? ((saved ?? "all") as EventQualityFamily | "all")
    : "all";
}

function getInitialShowWeak(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEYS.weak) === "true";
}

function formatMove(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`;
}

function formatCount(value: number): string {
  return value === 1 ? "1 sample" : `${value} samples`;
}

function mergeCandleArrays(arrays: BridgeCandle[][]): BridgeCandle[] {
  const byTime = new Map<number, BridgeCandle>();
  arrays.forEach((rows) => {
    rows.forEach((row) => {
      byTime.set(row.time, row);
    });
  });
  return [...byTime.values()].sort((left, right) => left.time - right.time);
}

function buildWindowMap(
  timeframeMap: Map<string, BridgeCandle[]>,
  symbol: string,
): Record<ReactionWindow, BridgeCandle[]> {
  return {
    "15m": timeframeMap.get(`${symbol}|M1`) ?? [],
    "1h": timeframeMap.get(`${symbol}|M1`) ?? [],
    "4h": timeframeMap.get(`${symbol}|M15`) ?? [],
    "1d": timeframeMap.get(`${symbol}|H1`) ?? [],
  };
}

function buildTemplateLabel(template: EventTemplate): string {
  return `${template.currency} | ${template.title}`;
}

function qualityTone(quality: ReactionStudyRow["quality"]): string {
  if (quality === "usable") return "is-usable";
  if (quality === "limited") return "is-limited";
  return "is-weak";
}

export function EventReactionTab({ events }: EventReactionTabProps) {
  const [mode, setMode] = useState<EventReactionMode>(() => getInitialMode());
  const [selectedPair, setSelectedPair] = useState<FxPairDefinition>(() => getInitialPair());
  const [family, setFamily] = useState<EventQualityFamily | "all">(() => getInitialFamily());
  const [showWeak, setShowWeak] = useState<boolean>(() => getInitialShowWeak());
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEYS.template) ?? "";
  });
  const [study, setStudy] = useState<ReactionStudySummary | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());

  const familyOptions = useMemo(() => getAllReactionFamilies(), []);
  const templates = useMemo(
    () =>
      discoverEventTemplates({
        events,
        family,
        includeWeak: showWeak,
      }),
    [events, family, showWeak],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.mode, mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.pair, selectedPair.name);
  }, [selectedPair]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.family, family);
  }, [family]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.weak, showWeak ? "true" : "false");
  }, [showWeak]);

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateKey("");
      return;
    }
    if (!templates.some((template) => template.key === selectedTemplateKey)) {
      setSelectedTemplateKey(templates[0].key);
    }
  }, [selectedTemplateKey, templates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedTemplateKey) window.localStorage.setItem(STORAGE_KEYS.template, selectedTemplateKey);
  }, [selectedTemplateKey]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedTemplateKey) ?? null,
    [selectedTemplateKey, templates],
  );

  const templateEvents = useMemo(
    () => (selectedTemplate ? getTemplateEvents({ events, templateKey: selectedTemplate.key }) : []),
    [events, selectedTemplate],
  );

  const pairTemplateMap = useMemo(
    () =>
      getPairTemplateMap({
        events,
        pair: selectedPair,
        family,
        includeWeak: showWeak,
      }),
    [events, family, selectedPair, showWeak],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (mode === "event-first" && (!selectedTemplate || templateEvents.length === 0)) {
        setStudy(null);
        setLoading(false);
        setLoadError(null);
        return;
      }

      if (mode === "asset-first" && pairTemplateMap.size === 0) {
        setStudy(null);
        setLoading(false);
        setLoadError(null);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const timeframeMap = new Map<string, BridgeCandle[]>();
        const specs = new Map<string, { symbol: string; timeframe: "M1" | "M15" | "H1"; chunkKey: string }>();

        const eventTimes =
          mode === "event-first" ? templateEvents.map((event) => event.time) : [...pairTemplateMap.values()].flatMap((entry) => entry.events.map((event) => event.time));

        const chunkKeys = getMonthlyChunkKeys(eventTimes);
        const symbols =
          mode === "event-first"
            ? getRelevantPairsForCurrency(selectedTemplate!.currency).map((pair) => pair.name)
            : [selectedPair.name];

        const timeframes = [...new Set(REACTION_WINDOWS.map((window) => window.timeframe))];

        symbols.forEach((symbol) => {
          timeframes.forEach((timeframe) => {
            chunkKeys.forEach((chunkKey) => {
              specs.set(`${symbol}|${timeframe}|${chunkKey}`, { symbol, timeframe, chunkKey });
            });
          });
        });

        const fetches = [...specs.values()].map(async (spec) => {
          const cacheKey = `${spec.symbol}|${spec.timeframe}|${spec.chunkKey}`;
          const existing = cacheRef.current.get(cacheKey);
          if (existing) {
            return existing.then((rows) => ({ spec, rows }));
          }

          const range = getMonthlyChunkRange(spec.chunkKey, spec.timeframe);
          const request = fetchHistoryRange({
            symbol: spec.symbol,
            tf: spec.timeframe,
            from: range.from,
            to: range.to,
          }).catch((error) => {
            cacheRef.current.delete(cacheKey);
            throw error;
          });

          cacheRef.current.set(cacheKey, request);
          return request.then((rows) => ({ spec, rows }));
        });

        const results = await Promise.all(fetches);
        if (cancelled) return;

        const grouped = new Map<string, BridgeCandle[][]>();
        results.forEach(({ spec, rows }) => {
          const key = `${spec.symbol}|${spec.timeframe}`;
          const list = grouped.get(key) ?? [];
          list.push(rows);
          grouped.set(key, list);
        });

        grouped.forEach((rows, key) => {
          timeframeMap.set(key, mergeCandleArrays(rows));
        });

        if (mode === "event-first") {
          const pairCandles = new Map<string, Record<ReactionWindow, BridgeCandle[]>>();
          getRelevantPairsForCurrency(selectedTemplate!.currency).forEach((pair) => {
            pairCandles.set(pair.name, buildWindowMap(timeframeMap, pair.name));
          });

          setStudy(
            deriveEventFirstStudy({
              template: selectedTemplate!,
              templateEvents,
              pairCandles,
            }),
          );
        } else {
          setStudy(
            deriveAssetFirstStudy({
              pair: selectedPair,
              templateMap: pairTemplateMap,
              candlesByWindow: buildWindowMap(timeframeMap, selectedPair.name),
            }),
          );
        }
      } catch (error) {
        if (cancelled) return;
        setStudy(null);
        setLoadError(error instanceof Error ? error.message : "Failed to load historical MT5 candles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [mode, pairTemplateMap, selectedPair, selectedTemplate, templateEvents]);

  useEffect(() => {
    if (!study || study.rows.length === 0) {
      setSelectedRowKey(null);
      return;
    }
    if (!study.rows.some((row) => row.key === selectedRowKey)) {
      setSelectedRowKey(study.rows[0].key);
    }
  }, [selectedRowKey, study]);

  const selectedRow = useMemo(
    () => study?.rows.find((row) => row.key === selectedRowKey) ?? study?.rows[0] ?? null,
    [selectedRowKey, study],
  );

  const selectedContextLabel =
    mode === "event-first"
      ? selectedTemplate
        ? buildTemplateLabel(selectedTemplate)
        : "No event template selected"
      : selectedPair.name;

  return (
    <section className="tab-panel reaction-panel">
      <section className="reaction-toolbar">
        <div className="reaction-toolbar-title">
          <div className="reaction-toolbar-icon">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2>Event Reaction Engine</h2>
            <p>Historical MT5 event surprise study across the 28 major FX pairs.</p>
          </div>
        </div>

        <div className="reaction-toolbar-actions">
          <div className="reaction-toggle-row">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`reaction-toggle-button ${mode === option.id ? "is-active" : ""}`}
                onClick={() => setMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="reaction-select-label">
            <span>Family filter</span>
            <select value={family} onChange={(event) => setFamily(event.target.value as EventQualityFamily | "all")}>
              {familyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {mode === "event-first" ? (
            <label className="reaction-select-label reaction-select-wide">
              <span>Event template</span>
              <select
                value={selectedTemplateKey}
                onChange={(event) => setSelectedTemplateKey(event.target.value)}
                disabled={templates.length === 0}
              >
                {templates.length === 0 ? (
                  <option value="">No matched templates</option>
                ) : (
                  templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {buildTemplateLabel(template)} ({template.sampleCount})
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <label className="reaction-select-label">
              <span>FX pair</span>
              <select
                value={selectedPair.name}
                onChange={(event) => setSelectedPair(getFxPairByName(event.target.value) ?? FX_PAIRS[0])}
              >
                {FX_PAIRS.map((pair) => (
                  <option key={pair.name} value={pair.name}>
                    {pair.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="reaction-checkbox">
            <input
              type="checkbox"
              checked={showWeak}
              onChange={(event) => setShowWeak(event.target.checked)}
            />
            <span>Include weak templates</span>
          </label>
        </div>
      </section>

      <div className="reaction-grid">
        <section className="reaction-summary-card">
          <div className="reaction-card-head">
            <div>
              <div className="reaction-kicker">Study Context</div>
              <h3>{selectedContextLabel}</h3>
              <p>{getRankMetricLabel()}</p>
            </div>
            <div className={`reaction-quality-pill ${selectedTemplate ? qualityTone(selectedTemplate.quality) : "is-weak"}`}>
              <Activity size={15} />
              <span>
                {mode === "event-first" && selectedTemplate
                  ? `${getSampleQualityLabel(selectedTemplate.quality)} template`
                  : mode === "asset-first"
                    ? `${pairTemplateMap.size} templates`
                    : "No selection"}
              </span>
            </div>
          </div>

          <div className="reaction-summary-metrics">
            <div>
              <span>Usable samples</span>
              <strong>{study?.usableSampleCount ?? 0}</strong>
            </div>
            <div>
              <span>Beat</span>
              <strong>{study?.beatCount ?? 0}</strong>
            </div>
            <div>
              <span>Inline</span>
              <strong>{study?.inlineCount ?? 0}</strong>
            </div>
            <div>
              <span>Miss</span>
              <strong>{study?.missCount ?? 0}</strong>
            </div>
          </div>

          {loading ? (
            <div className="reaction-note">Loading historical MT5 candles for the selected study…</div>
          ) : loadError ? (
            <div className="reaction-note is-danger">{loadError}</div>
          ) : study?.note ? (
            <div className="reaction-note">{study.note}</div>
          ) : (
            <div className="reaction-note">
              Surprise is defined as actual minus forecast. Weak samples stay visible only when you opt into them.
            </div>
          )}
        </section>

        <section className="reaction-method-card">
          <div className="reaction-card-head">
            <div>
              <div className="reaction-kicker">Methodology</div>
              <h3>How the study is measured</h3>
            </div>
          </div>

          <div className="reaction-method-list">
            <div className="reaction-method-row">
              <span>Data source</span>
              <strong>MT5 calendar + MT5 candles</strong>
            </div>
            <div className="reaction-method-row">
              <span>Surprise formula</span>
              <strong>Actual - Forecast</strong>
            </div>
            <div className="reaction-method-row">
              <span>Windows</span>
              <strong>15m / 1h / 4h / 1d</strong>
            </div>
            <div className="reaction-method-row">
              <span>Return type</span>
              <strong>Percent move</strong>
            </div>
            <div className="reaction-method-row">
              <span>Sample labels</span>
              <strong>Weak &lt; 8, Limited 8-14, Usable 15+</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="reaction-table-card">
        <div className="reaction-card-head">
          <div>
            <div className="reaction-kicker">Ranked Output</div>
            <h3>
              {mode === "event-first"
                ? "Relevant FX pairs for the selected event template"
                : "Relevant event templates for the selected FX pair"}
            </h3>
          </div>
          <div className="reaction-table-meta">
            <span>
              <FlaskConical size={14} />
              Statistical study only
            </span>
          </div>
        </div>

        {study && study.rows.length > 0 ? (
          <div className="reaction-table">
            <div className="reaction-table-head">
              <span>{mode === "event-first" ? "Pair" : "Event template"}</span>
              <span>Quality</span>
              <span>Samples</span>
              <span>15m</span>
              <span>1h</span>
              <span>4h</span>
              <span>1d</span>
            </div>
            {study.rows.map((row) => (
              <button
                key={row.key}
                type="button"
                className={`reaction-table-row ${selectedRow?.key === row.key ? "is-active" : ""}`}
                onClick={() => setSelectedRowKey(row.key)}
              >
                <div className="reaction-row-label">
                  <strong>{row.label}</strong>
                  <span>{mode === "asset-first" ? `${row.currency} | ${row.familyLabel ?? "Core macro"}` : "FX pair response"}</span>
                </div>
                <div className={`reaction-row-quality ${qualityTone(row.quality)}`}>{getSampleQualityLabel(row.quality)}</div>
                <div className="reaction-row-samples">{formatCount(row.sampleCount)}</div>
                {REACTION_WINDOWS.map((window) => (
                  <div key={window.id} className="reaction-row-window">
                    <strong>{formatMove(row.summaryWindows[window.id].medianAbsoluteReturn)}</strong>
                    <span>median abs</span>
                  </div>
                ))}
              </button>
            ))}
          </div>
        ) : (
          <div className="reaction-empty">
            {loading
              ? "Preparing the historical study…"
              : mode === "event-first"
                ? "No matched event template is ready for study."
                : "No matched event templates are available for this FX pair."}
          </div>
        )}
      </section>

      {selectedRow && (
        <section className="reaction-detail-card">
          <div className="reaction-card-head">
            <div>
              <div className="reaction-kicker">Selected Detail</div>
              <h3>{selectedRow.label}</h3>
              <p>
                {selectedRow.note ??
                  `${getSampleQualityLabel(selectedRow.quality)} sample quality. Ranked using 1h median absolute move.`}
              </p>
            </div>
            <div className={`reaction-quality-pill ${qualityTone(selectedRow.quality)}`}>
              <ChevronDown size={14} />
              <span>{getSampleQualityLabel(selectedRow.quality)}</span>
            </div>
          </div>

          <div className="reaction-bucket-grid">
            {selectedRow.bucketStats.map((bucket) => (
              <article key={bucket.bucket} className="reaction-bucket-card">
                <div className="reaction-bucket-head">
                  <strong>{bucket.label}</strong>
                </div>
                <div className="reaction-bucket-table">
                  {REACTION_WINDOWS.map((window) => {
                    const stats = bucket.windows[window.id];
                    return (
                      <div key={window.id} className="reaction-bucket-row">
                        <span>{window.label}</span>
                        <div>
                          <strong>{formatMove(stats.medianReturn)}</strong>
                          <small>
                            avg {formatMove(stats.averageReturn)} | sd {formatMove(stats.standardDeviation)} | n {stats.sampleSize}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="reaction-footnote-card">
        <p>
          The Event Reaction Engine is descriptive, not predictive. It shows how MT5-fed FX pairs reacted around similar releases in the retained history, and weak samples should be treated cautiously.
        </p>
        {selectedTemplate && (
          <p>
            Latest selected template in UTC: <strong>{selectedTemplate.title}</strong> ({selectedTemplate.currency}) with {selectedTemplate.sampleCount} retained historical releases.
          </p>
        )}
        {selectedRow && selectedRow.summaryWindows["1h"].sampleSize > 0 && (
          <p>
            Current selected row 1h median absolute move: <strong>{formatMove(selectedRow.summaryWindows["1h"].medianAbsoluteReturn)}</strong>.
          </p>
        )}
      </section>
    </section>
  );
}
