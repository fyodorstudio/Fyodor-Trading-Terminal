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
    fontFamily: '"Inter", "Geist", sans-serif',
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
    fontFamily: '"Plus Jakarta Sans", sans-serif',
  }
};
