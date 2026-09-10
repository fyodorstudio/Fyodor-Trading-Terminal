import { useCallback, useState } from "react";
import type { ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import {
  DEFAULT_CHART_PREFERENCES,
  loadChartDisplayTimeMode,
  loadChartPreferences,
  saveChartDisplayTimeMode,
  saveChartPreferences,
  type ChartAppearancePreferences,
  type ChartCursorReadoutMode,
  type ChartDisplayTimeMode,
  type ChartEventOverlayPreferences,
  type ChartPreferences,
} from "@/app/lib/chartView";

export function useChartPreferencesController(onPreserveZoomDisabled: () => void) {
  const [displayTimeMode, setDisplayTimeMode] = useState<ChartDisplayTimeMode>(loadChartDisplayTimeMode);
  const [chartPreferences, setChartPreferences] = useState<ChartPreferences>(loadChartPreferences);
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<ChartDrawerMode>("chart");

  const changeDisplayTimeMode = useCallback((next: ChartDisplayTimeMode) => {
    setDisplayTimeMode(next);
    saveChartDisplayTimeMode(next);
    setTimezoneMenuOpen(false);
  }, []);

  const updatePreferences = useCallback((updater: (current: ChartPreferences) => ChartPreferences) => {
    setChartPreferences((current) => {
      const next = updater(current);
      saveChartPreferences(next);
      return next;
    });
  }, []);

  const updateAppearance = useCallback(
    <K extends keyof ChartAppearancePreferences>(key: K, value: ChartAppearancePreferences[K]) => {
      updatePreferences((current) => ({
        ...current,
        appearance: { ...current.appearance, [key]: value },
      }));
    },
    [updatePreferences],
  );

  const changeCursorMode = useCallback(
    (mode: ChartCursorReadoutMode) => updatePreferences((current) => ({ ...current, cursorReadoutMode: mode })),
    [updatePreferences],
  );

  const updateEventOverlay = useCallback(
    <K extends keyof ChartEventOverlayPreferences>(key: K, value: ChartEventOverlayPreferences[K]) => {
      updatePreferences((current) => ({
        ...current,
        eventOverlay: { ...current.eventOverlay, [key]: value },
      }));
    },
    [updatePreferences],
  );

  const changePreserveZoom = useCallback((preserve: boolean) => {
    if (!preserve) onPreserveZoomDisabled();
    updatePreferences((current) => ({ ...current, preserveZoomOnMarketChange: preserve }));
  }, [onPreserveZoomDisabled, updatePreferences]);

  const changeDefaultFocusBars = useCallback(
    (defaultFocusBars: number) => updatePreferences((current) => ({ ...current, defaultFocusBars })),
    [updatePreferences],
  );

  const resetPreferences = useCallback(() => {
    setChartPreferences(DEFAULT_CHART_PREFERENCES);
    saveChartPreferences(DEFAULT_CHART_PREFERENCES);
  }, []);

  const openDrawer = useCallback((mode: ChartDrawerMode) => {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }, []);

  return {
    changeCursorMode,
    changeDefaultFocusBars,
    changeDisplayTimeMode,
    changePreserveZoom,
    chartPreferences,
    displayTimeMode,
    drawerMode,
    drawerOpen,
    openDrawer,
    resetPreferences,
    setDrawerMode,
    setDrawerOpen,
    setTimezoneMenuOpen,
    timezoneMenuOpen,
    updateAppearance,
    updateEventOverlay,
  };
}
