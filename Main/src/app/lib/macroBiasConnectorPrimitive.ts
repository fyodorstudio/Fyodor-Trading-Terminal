import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitiveHoveredItem,
  Time,
} from "lightweight-charts";

export interface MacroBiasConnectorDatum {
  signalId: string;
  direction: "long" | "short";
  releaseTime: number;
  releasePrice: number;
  activationTime: number;
  activationPrice: number;
}

interface MacroBiasConnectorPoint {
  signalId: string;
  color: string;
  releaseX: number;
  releaseY: number;
  activationX: number;
  activationY: number;
}

type PrimitiveAttachment = Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0];
type PrimitiveCanvasTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

function drawConnector(context: CanvasRenderingContext2D, point: MacroBiasConnectorPoint): void {
  const curve = Math.max(10, Math.abs(point.activationX - point.releaseX) * 0.35);
  context.beginPath();
  context.moveTo(point.releaseX, point.releaseY);
  context.bezierCurveTo(
    point.releaseX + curve,
    point.releaseY,
    point.activationX - curve,
    point.activationY,
    point.activationX,
    point.activationY,
  );
  context.setLineDash([3, 3]);
  context.lineCap = "round";
  context.lineWidth = 1.25;
  context.strokeStyle = "rgba(148, 163, 184, 0.9)";
  context.stroke();
  context.setLineDash([]);

  context.beginPath();
  context.arc(point.releaseX, point.releaseY, 4, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = "#94a3b8";
  context.stroke();

  context.beginPath();
  context.arc(point.releaseX, point.releaseY, 2, 0, Math.PI * 2);
  context.fillStyle = point.color;
  context.fill();
}

class MacroBiasConnectorRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly readPoints: () => readonly MacroBiasConnectorPoint[]) {}

  draw(target: PrimitiveCanvasTarget): void {
    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      for (const point of this.readPoints()) drawConnector(context, point);
      context.restore();
    });
  }
}

class MacroBiasConnectorPaneView implements IPrimitivePaneView {
  private readonly paneRenderer: MacroBiasConnectorRenderer;

  constructor(readPoints: () => readonly MacroBiasConnectorPoint[]) {
    this.paneRenderer = new MacroBiasConnectorRenderer(readPoints);
  }

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this.paneRenderer;
  }
}

/**
 * Draws release links inside Lightweight Charts' own pane render cycle.
 * This keeps the release ring and connector synchronized with candles while
 * the time scale is actively panning or zooming.
 */
export class MacroBiasConnectorPrimitive implements ISeriesPrimitive<Time> {
  private attachment: PrimitiveAttachment | null = null;
  private data: readonly MacroBiasConnectorDatum[];
  private points: MacroBiasConnectorPoint[] = [];
  private readonly view = new MacroBiasConnectorPaneView(() => this.points);

  constructor(data: readonly MacroBiasConnectorDatum[]) {
    this.data = data;
  }

  attached(attachment: PrimitiveAttachment): void {
    this.attachment = attachment;
    this.updateAllViews();
  }

  detached(): void {
    this.attachment = null;
    this.points = [];
  }

  updateAllViews(): void {
    const attachment = this.attachment;
    if (!attachment) return;
    const next: MacroBiasConnectorPoint[] = [];
    for (const datum of this.data) {
      const releaseX = attachment.chart.timeScale().timeToCoordinate(datum.releaseTime as Time);
      const activationX = attachment.chart.timeScale().timeToCoordinate(datum.activationTime as Time);
      const releasePriceY = attachment.series.priceToCoordinate(datum.releasePrice);
      const activationPriceY = attachment.series.priceToCoordinate(datum.activationPrice);
      if (releaseX == null || activationX == null || releasePriceY == null || activationPriceY == null) continue;
      const directionOffset = datum.direction === "long" ? 13 : -13;
      next.push({
        signalId: datum.signalId,
        color: datum.direction === "long" ? "#2563eb" : "#7c3aed",
        releaseX: Number(releaseX),
        releaseY: Number(releasePriceY) + directionOffset,
        activationX: Number(activationX),
        activationY: Number(activationPriceY) + directionOffset,
      });
    }
    this.points = next;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    for (let index = this.points.length - 1; index >= 0; index -= 1) {
      const point = this.points[index];
      if (Math.hypot(x - point.releaseX, y - point.releaseY) <= 7) {
        return {
          externalId: `macro-bias-release:${point.signalId}`,
          cursorStyle: "pointer",
          zOrder: "top",
        };
      }
    }
    return null;
  }
}
