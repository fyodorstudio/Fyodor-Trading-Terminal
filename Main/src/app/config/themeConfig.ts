export type ThemeId = 'neo-quant' | 'bloomberg' | 'swiss';

export interface ThemeColors {
  bg: string;
  panel: string;
  panelStrong: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  accent: string;
  primary: string;
  // Navigation Specific
  navBg: string;
  tabActiveBg: string;
  tabActiveText: string;
  tabInactiveText: string;
  fontFamily: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemeColors> = {
  'neo-quant': {
    bg: '#ffffff',
    panel: '#f8fafc',
    panelStrong: '#ffffff',
    line: '#e2e8f0',
    lineStrong: '#cbd5e1',
    text: '#0f172a',
    muted: '#64748b',
    accent: '#4f46e5',
    primary: '#4f46e5',
    navBg: 'rgba(255, 255, 255, 0.4)',
    tabActiveBg: '#ffffff',
    tabActiveText: '#0f172a',
    tabInactiveText: '#64748b',
    fontFamily: '"Inter", "Geist", sans-serif',
  },
  'bloomberg': {
    bg: '#000000',
    panel: '#0a0a0a',
    panelStrong: '#121212',
    line: '#1a1a1a',
    lineStrong: '#2a2a2a',
    text: '#ffffff',
    muted: '#808080',
    accent: '#22c55e',
    primary: '#22c55e',
    navBg: 'rgba(18, 18, 18, 0.8)',
    tabActiveBg: '#22c55e',
    tabActiveText: '#000000',
    tabInactiveText: '#808080',
    fontFamily: '"IBM Plex Sans", "Roboto Mono", monospace',
  },
  'swiss': {
    bg: '#f1f5f9',
    panel: '#ffffff',
    panelStrong: '#ffffff',
    line: '#e2e8f0',
    lineStrong: '#cbd5e1',
    text: '#1e293b',
    muted: '#475569',
    accent: '#0ea5e9',
    primary: '#0ea5e9',
    navBg: 'rgba(255, 255, 255, 0.6)',
    tabActiveBg: '#0ea5e9',
    tabActiveText: '#ffffff',
    tabInactiveText: '#475569',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
  }
};
