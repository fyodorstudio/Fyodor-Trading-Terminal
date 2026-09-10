export type ChartDockPanelId = "fms" | "inspector" | "context";
export type ChartDockRegion = "left" | "right" | "bottom";

export interface ChartDockDefinition {
  id: ChartDockPanelId;
  label: string;
  allowedRegions: readonly ChartDockRegion[];
  defaultRegion: ChartDockRegion;
  defaultOrder: number;
  defaultSize: number;
  minimumSize: number;
}

export interface ChartDockLayout {
  version: 1;
  regions: Record<ChartDockPanelId, ChartDockRegion>;
}

export const CHART_DOCK_LAYOUT_KEY = "fyodor.charts.dock-layout-v1";

export const CHART_DOCK_REGISTRY: readonly ChartDockDefinition[] = [
  { id: "fms", label: "FMS workspace", allowedRegions: ["left"], defaultRegion: "left", defaultOrder: 10, defaultSize: 460, minimumSize: 340 },
  { id: "inspector", label: "Chart inspector", allowedRegions: ["left", "right"], defaultRegion: "right", defaultOrder: 20, defaultSize: 760, minimumSize: 360 },
  { id: "context", label: "Matrix / Lens / Calendar", allowedRegions: ["bottom"], defaultRegion: "bottom", defaultOrder: 30, defaultSize: 320, minimumSize: 240 },
] as const;

export function getChartDockDefinition(panelId: ChartDockPanelId): ChartDockDefinition {
  const definition = CHART_DOCK_REGISTRY.find((item) => item.id === panelId);
  if (!definition) throw new Error(`Unknown chart dock panel: ${panelId}`);
  return definition;
}

export const DEFAULT_CHART_DOCK_LAYOUT: ChartDockLayout = {
  version: 1,
  regions: { fms: "left", inspector: "right", context: "bottom" },
};

export function normalizeChartDockLayout(value: unknown): ChartDockLayout {
  const candidate = value && typeof value === "object" ? value as Partial<ChartDockLayout> : null;
  const savedRegions = candidate?.version === 1 && candidate.regions && typeof candidate.regions === "object"
    ? candidate.regions as Partial<Record<ChartDockPanelId, ChartDockRegion>>
    : {};
  const regions = { ...DEFAULT_CHART_DOCK_LAYOUT.regions };
  for (const definition of CHART_DOCK_REGISTRY) {
    const saved = savedRegions[definition.id];
    if (saved && definition.allowedRegions.includes(saved)) regions[definition.id] = saved;
  }
  return { version: 1, regions };
}

export function loadChartDockLayout(): ChartDockLayout {
  try {
    return normalizeChartDockLayout(JSON.parse(window.localStorage.getItem(CHART_DOCK_LAYOUT_KEY) ?? "null"));
  } catch {
    return DEFAULT_CHART_DOCK_LAYOUT;
  }
}

export function saveChartDockLayout(layout: ChartDockLayout): void {
  try {
    window.localStorage.setItem(CHART_DOCK_LAYOUT_KEY, JSON.stringify(normalizeChartDockLayout(layout)));
  } catch {
    // Layout persistence is optional; defaults remain recoverable.
  }
}
