import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  ChartPairMatrixRangeOverlayData,
  PairMatrixRangePreview,
} from "@/app/features/pair-matrix/chartPairMatrixContracts";

export const ChartPairMatrixRangeOverlay = memo(function ChartPairMatrixRangeOverlay({
  data,
}: {
  data: ChartPairMatrixRangeOverlayData;
}) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PairMatrixRangePreview | null>(null);
  const draggingRef = useRef(false);
  const previewRef = useRef<PairMatrixRangePreview | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingXRef = useRef<number | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (animationFrameRef.current != null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  useEffect(() => {
    if (animationFrameRef.current != null) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    pendingXRef.current = null;
    previewRef.current = null;
    draggingRef.current = false;
    setPreview(null);
    setDragging(false);
  }, [data.cancelRevision]);

  useEffect(() => {
    const runtime = data.geometryRuntime;
    if (!runtime || !data.lockedRange) return;
    const update = () => {
      if (draggingRef.current || previewRef.current) return;
      const band = bandRef.current;
      if (!band) return;
      const next = runtime.resolveRange(data.lockedRange!);
      if (!next) {
        band.style.visibility = "hidden";
        return;
      }
      band.style.visibility = "visible";
      band.style.left = "0px";
      band.style.transform = `translate3d(${next.left}px, 0, 0)`;
      const width = `${Math.max(2, next.right - next.left)}px`;
      if (band.style.width !== width) band.style.width = width;
    };
    update();
    return runtime.subscribe(update);
  }, [data.geometryRuntime, data.lockedRange]);

  const localX = (event: ReactPointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.closest(".chart-plot-region")?.getBoundingClientRect();
    return bounds ? event.clientX - bounds.left : 0;
  };
  const applyPreview = (next: PairMatrixRangePreview | null) => {
    if (!next || previewRef.current?.key === next.key) return;
    previewRef.current = next;
    setPreview(next);
  };
  const begin = (event: ReactPointerEvent<HTMLElement>, edge: "new" | "start" | "end") => {
    const next = data.startPreview(localX(event), edge);
    if (!next) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    previewRef.current = next;
    setPreview(next);
    data.onInteractionChange(true);
    event.preventDefault();
    event.stopPropagation();
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current || !previewRef.current) return;
    pendingXRef.current = localX(event);
    if (animationFrameRef.current == null) {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        const x = pendingXRef.current;
        const current = previewRef.current;
        if (x == null || !current) return;
        applyPreview(data.updatePreview(x, current.originTime));
      });
    }
    event.preventDefault();
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current || !previewRef.current) return;
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const finalPreview = data.updatePreview(localX(event), previewRef.current.originTime) ?? previewRef.current;
    draggingRef.current = false;
    setDragging(false);
    setPreview(null);
    previewRef.current = null;
    pendingXRef.current = null;
    data.onInteractionChange(false);
    data.onCommit(finalPreview.range);
    event.preventDefault();
    event.stopPropagation();
  };
  const cancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    if (animationFrameRef.current != null) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    draggingRef.current = false;
    previewRef.current = null;
    pendingXRef.current = null;
    setDragging(false);
    setPreview(null);
    data.onInteractionChange(false);
    data.onCancel();
    event.preventDefault();
    event.stopPropagation();
  };
  const bounds = preview?.bounds
    ?? data.lockedBounds
    ?? (data.lockedRange && data.geometryRuntime ? data.geometryRuntime.resolveRange(data.lockedRange) : null);
  if (!bounds && !data.lockedRange && !data.armed && !dragging) return null;
  const left = bounds?.left ?? 0;
  const width = bounds ? Math.max(2, bounds.right - bounds.left) : 0;
  const bandStyle = {
    left: "0px",
    width: `${width}px`,
    visibility: bounds ? "visible" : "hidden",
    transform: `translate3d(${left}px, 0, 0)`,
  } as CSSProperties;

  return (
    <div
      className={`absolute inset-0 z-[35] ${data.armed ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
      aria-label={data.armed ? "Drag to select a Pair Matrix candle range" : "Locked Pair Matrix candle range"}
      onPointerDown={data.armed ? (event) => begin(event, "new") : undefined}
      onPointerMove={data.armed ? move : undefined}
      onPointerUp={data.armed ? end : undefined}
      onPointerCancel={data.armed ? cancel : undefined}
    >
      {bounds || data.lockedRange ? (
        <div ref={bandRef} className="pointer-events-none absolute inset-y-0 will-change-transform border-x-[3px] border-blue-600 bg-blue-400/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]" style={bandStyle} data-pair-matrix-range-band="">
          <button
            type="button"
            className="pointer-events-auto absolute inset-y-0 -left-2 w-4 cursor-ew-resize bg-transparent"
            aria-label="Adjust Pair Matrix range start"
            onPointerDown={(event) => begin(event, "start")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
          ><span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600" /></button>
          <button
            type="button"
            className="pointer-events-auto absolute inset-y-0 -right-2 w-4 cursor-ew-resize bg-transparent"
            aria-label="Adjust Pair Matrix range end"
            onPointerDown={(event) => begin(event, "end")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
          ><span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600" /></button>
        </div>
      ) : null}
      {data.armed && !dragging ? <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-slate-900/85 px-2 py-1 text-[10px] font-black text-white">Drag across complete candles</span> : null}
    </div>
  );
});
