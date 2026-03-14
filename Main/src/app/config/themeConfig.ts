export type FontId = 'geist' | 'inter' | 'jakarta' | 'plex';
export type ColorPaletteId = 'sovereign-blue' | 'emerald-slate' | 'swiss-azure' | 'crimson-light';

export interface FontOption {
  id: FontId;
  label: string;
  family: string;
}

export interface ColorPalette {
  id: ColorPaletteId;
  label: string;
  colors: {
    bg: string;
    panel: string;
    panelStrong: string;
    line: string;
    text: string;
    muted: string;
    accent: string;
    primary: string;
    navBg: string;
    tabActiveBg: string;
    tabActiveText: string;
    tabInactiveText: string;
  };
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'geist', label: 'Geist Sans', family: '"Geist", "Inter", sans-serif' },
  { id: 'inter', label: 'Inter Pro', family: '"Inter", sans-serif' },
  { id: 'jakarta', label: 'Plus Jakarta', family: '"Plus Jakarta Sans", sans-serif' },
  { id: 'plex', label: 'IBM Plex', family: '"IBM Plex Sans", sans-serif' },
];

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'sovereign-blue',
    label: 'Sovereign Blue',
    colors: {
      bg: '#f8fafc',
      panel: '#ffffff',
      panelStrong: '#ffffff',
      line: '#e2e8f0',
      text: '#0f172a',
      muted: '#64748b',
      accent: '#3b82f6',
      primary: '#1e40af',
      navBg: 'rgba(255, 255, 255, 0.8)',
      tabActiveBg: '#3b82f6',
      tabActiveText: '#ffffff',
      tabInactiveText: '#64748b',
    }
  },
  {
    id: 'swiss-azure',
    label: 'Swiss Azure',
    colors: {
      bg: '#f1f5f9',
      panel: '#ffffff',
      panelStrong: '#ffffff',
      line: '#cbd5e1',
      text: '#1e293b',
      muted: '#475569',
      accent: '#0ea5e9',
      primary: '#0ea5e9',
      navBg: 'rgba(255, 255, 255, 0.6)',
      tabActiveBg: '#0ea5e9',
      tabActiveText: '#ffffff',
      tabInactiveText: '#475569',
    }
  },
  {
    id: 'emerald-slate',
    label: 'Emerald Slate',
    colors: {
      bg: '#f9fafb',
      panel: '#ffffff',
      panelStrong: '#ffffff',
      line: '#e5e7eb',
      text: '#111827',
      muted: '#6b7280',
      accent: '#10b981',
      primary: '#065f46',
      navBg: 'rgba(255, 255, 255, 0.7)',
      tabActiveBg: '#10b981',
      tabActiveText: '#ffffff',
      tabInactiveText: '#6b7280',
    }
  },
  {
    id: 'crimson-light',
    label: 'Crimson Slate',
    colors: {
      bg: '#fffafb',
      panel: '#ffffff',
      panelStrong: '#ffffff',
      line: '#fee2e2',
      text: '#450a0a',
      muted: '#991b1b',
      accent: '#ef4444',
      primary: '#991b1b',
      navBg: 'rgba(255, 255, 255, 0.8)',
      tabActiveBg: '#ef4444',
      tabActiveText: '#ffffff',
      tabInactiveText: '#991b1b',
    }
  }
];
