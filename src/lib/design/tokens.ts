/**
 * Tokens del sistema Finanzia Noir, expuestos a TypeScript.
 *
 * Los valores son la fuente de verdad para uso en JS (gráficos, animaciones,
 * lógica que no puede leer CSS). En CSS los mismos valores viven en
 * `src/app/globals.css` bajo `:root` y `.dark`. Si actualizas uno, actualiza
 * el otro — los tests visuales fallan si divergen.
 */

export const palette = {
  dark: {
    bg: '#0A0A0B',
    surface: '#141416',
    surfaceElevated: '#1C1C1F',
    surfaceHover: '#222226',
    borderDefault: '#26262A',
    borderEmphasis: '#34343A',
    text: '#FAFAFA',
    textSecondary: '#A1A1A8',
    textTertiary: '#6B6B72',
    accentAi: '#B8A6F5',
    positive: '#7FB89F',
    negative: '#D4938A',
    warning: '#D4B58A',
  },
  light: {
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHover: '#F5F5F4',
    borderDefault: '#E7E5E4',
    borderEmphasis: '#D6D3D1',
    text: '#0A0A0B',
    textSecondary: '#52525B',
    textTertiary: '#71717A',
    accentAi: '#7C6FCD',
    positive: '#5A9279',
    negative: '#B57167',
    warning: '#B5945F',
  },
} as const

export type ThemeMode = keyof typeof palette
export type ColorToken = keyof typeof palette.dark

export const radius = {
  chip: 4,
  control: 8,
  card: 12,
  modal: 16,
  pill: 9999,
} as const

export const spacing = {
  rail: 56,
  topbar: 56,
  cmdk: 640,
  contentMax: 1240,
} as const

export const motion = {
  easing: {
    smooth: [0.32, 0.72, 0, 1] as const,
  },
  duration: {
    instant: 120,
    fast: 220,
    base: 320,
    slow: 480,
    ambient: 800,
  },
  spring: {
    stiffness: 320,
    damping: 32,
    mass: 1,
  },
} as const
