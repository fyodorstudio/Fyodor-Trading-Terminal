import { useCallback, useState } from "react";
import {
  CHART_DOCK_REGISTRY,
  DEFAULT_CHART_DOCK_LAYOUT,
  loadChartDockLayout,
  saveChartDockLayout,
  type ChartDockPanelId,
  type ChartDockRegion,
} from "@/app/features/chart-viewport/chartDockRegistry";

export function useChartDockLayout() {
  const [layout, setLayout] = useState(loadChartDockLayout);

  const setPanelRegion = useCallback((panelId: ChartDockPanelId, region: ChartDockRegion) => {
    const definition = CHART_DOCK_REGISTRY.find((item) => item.id === panelId);
    if (!definition?.allowedRegions.includes(region)) return;
    setLayout((current) => {
      const next = { ...current, regions: { ...current.regions, [panelId]: region } };
      saveChartDockLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_CHART_DOCK_LAYOUT);
    saveChartDockLayout(DEFAULT_CHART_DOCK_LAYOUT);
  }, []);

  return { layout, resetLayout, setPanelRegion };
}
