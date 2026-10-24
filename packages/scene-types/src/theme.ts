import type { ThemeName } from './schema.ts'

export const FONT_SANS =
  "'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
export const FONT_DISPLAY =
  "'Space Grotesk Variable', 'Space Grotesk', 'Inter Variable', -apple-system, sans-serif"
export const FONT_MONO =
  "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace"

export interface ThemeTokens {
  name: ThemeName
  isDark: boolean
  background: string
  backgroundAlt: string
  foreground: string
  muted: string
  subtle: string
  accent: string
  accentSoft: string
  accent2: string
  accent2Soft: string
  accent3: string
  border: string
  grid: string
  codeBackground: string
  codeForeground: string
  codeGutter: string
  chart: string[]
  fontSans: string
  fontDisplay: string
  fontMono: string
}

const dark: ThemeTokens = {
  name: 'dark',
  isDark: true,
  background: '#070B12',
  backgroundAlt: '#0B1220',
  foreground: '#F3F7FC',
  muted: '#9BA9BC',
  subtle: '#64748B',
  accent: '#38BDF8',
  accentSoft: 'rgba(56, 189, 248, 0.14)',
  accent2: '#A78BFA',
  accent2Soft: 'rgba(167, 139, 250, 0.14)',
  accent3: '#34D399',
  border: 'rgba(148, 163, 184, 0.18)',
  grid: 'rgba(148, 163, 184, 0.10)',
  codeBackground: 'rgba(2, 6, 23, 0.74)',
  codeForeground: '#E2E8F0',
  codeGutter: 'rgba(148, 163, 184, 0.45)',
  chart: ['#38BDF8', '#A78BFA', '#34D399', '#FBBF24', '#FB7185', '#22D3EE', '#C084FC', '#4ADE80'],
  fontSans: FONT_SANS,
  fontDisplay: FONT_DISPLAY,
  fontMono: FONT_MONO,
}

const light: ThemeTokens = {
  name: 'light',
  isDark: false,
  background: '#F5F8FC',
  backgroundAlt: '#FFFFFF',
  foreground: '#0A1220',
  muted: '#46576D',
  subtle: '#64748B',
  accent: '#0369A1',
  accentSoft: 'rgba(3, 105, 161, 0.12)',
  accent2: '#6D28D9',
  accent2Soft: 'rgba(109, 40, 217, 0.10)',
  accent3: '#047857',
  border: 'rgba(15, 23, 42, 0.14)',
  grid: 'rgba(15, 23, 42, 0.075)',
  codeBackground: '#0B1220',
  codeForeground: '#E2E8F0',
  codeGutter: 'rgba(148, 163, 184, 0.55)',
  chart: ['#0369A1', '#6D28D9', '#047857', '#B45309', '#BE123C', '#0891B2', '#7C3AED', '#15803D'],
  fontSans: FONT_SANS,
  fontDisplay: FONT_DISPLAY,
  fontMono: FONT_MONO,
}

export const THEMES: Record<ThemeName, ThemeTokens> = { dark, light }

export function getTheme(name: ThemeName): ThemeTokens {
  return THEMES[name]
}

export function themeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--lz-bg': tokens.background,
    '--lz-bg-alt': tokens.backgroundAlt,
    '--lz-fg': tokens.foreground,
    '--lz-muted': tokens.muted,
    '--lz-subtle': tokens.subtle,
    '--lz-accent': tokens.accent,
    '--lz-accent-soft': tokens.accentSoft,
    '--lz-accent-2': tokens.accent2,
    '--lz-accent-2-soft': tokens.accent2Soft,
    '--lz-accent-3': tokens.accent3,
    '--lz-border': tokens.border,
    '--lz-grid': tokens.grid,
    '--lz-code-bg': tokens.codeBackground,
    '--lz-code-fg': tokens.codeForeground,
    '--lz-code-gutter': tokens.codeGutter,
    '--lz-font-sans': tokens.fontSans,
    '--lz-font-display': tokens.fontDisplay,
    '--lz-font-mono': tokens.fontMono,
  }
}
