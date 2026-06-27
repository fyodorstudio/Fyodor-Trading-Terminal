import { useEffect, useState } from "react";
import { COLOR_PALETTES, FONT_OPTIONS, type ColorPaletteId, type FontId } from "@/app/config/themeConfig";

const DEFAULT_FONT: FontId = "geist";
const DEFAULT_COLOR: ColorPaletteId = "sovereign-blue";

function getStoredFont(): FontId {
  const saved = localStorage.getItem("terminal-font") as FontId | null;
  return saved && FONT_OPTIONS.some((font) => font.id === saved) ? saved : DEFAULT_FONT;
}

function getStoredColor(): ColorPaletteId {
  const saved = localStorage.getItem("terminal-color") as ColorPaletteId | null;
  return saved && COLOR_PALETTES.some((palette) => palette.id === saved) ? saved : DEFAULT_COLOR;
}

export function useTerminalTheme() {
  const [currentFont, setCurrentFont] = useState<FontId>(getStoredFont);
  const [currentColor, setCurrentColor] = useState<ColorPaletteId>(getStoredColor);

  useEffect(() => {
    const font = FONT_OPTIONS.find((item) => item.id === currentFont) ?? FONT_OPTIONS[0];
    const palette = COLOR_PALETTES.find((item) => item.id === currentColor) ?? COLOR_PALETTES[0];
    const theme = palette.colors;
    const root = document.documentElement;

    root.style.setProperty("--bg", theme.bg);
    root.style.setProperty("--panel", theme.panel);
    root.style.setProperty("--panel-strong", theme.panelStrong);
    root.style.setProperty("--line", theme.line);
    root.style.setProperty("--text", theme.text);
    root.style.setProperty("--muted", theme.muted);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--nav-bg", theme.navBg);
    root.style.setProperty("--tab-active-bg", theme.tabActiveBg);
    root.style.setProperty("--tab-active-text", theme.tabActiveText);
    root.style.setProperty("--tab-inactive-text", theme.tabInactiveText);
    root.style.setProperty("--font-main", font.family);

    localStorage.setItem("terminal-font", currentFont);
    localStorage.setItem("terminal-color", currentColor);
  }, [currentFont, currentColor]);

  return {
    currentFont,
    currentColor,
    setCurrentFont,
    setCurrentColor,
  };
}
