// finanzia — design tokens (TypeScript)
// Import: `import { tokens } from "./tokens"`

export const tokens = {
  color: {
    purple: {
      deepest: '#2D1370',
      deeper:  '#3B1781',
      deep:    '#4C1D95',   // mark center, primary buttons
      mid:     '#6D28D9',
      base:    '#7C3AED',   // mark rings, links, focus
      light:   '#A78BFA',
      pale:    '#DDD6FE',
      cream:   '#F2EDFF',
    },
    ink:      '#15102A',
    graphite: '#3A2F58',
    muted:    '#8478A0',
    rule:     '#EFEAF7',
    paper:    '#FFFFFF',
    warmGrey: '#FAFAFC',
  },

  font: {
    brand: '"Sora", system-ui, -apple-system, sans-serif',
  },

  wordmark: {
    weight: 500,
    tracking: '-0.05em',
    lineHeight: 1,
    case: 'lowercase' as const,
  },

  radius: {
    button: 6,
    card: 10,
    appIcon: 56,  // applied at 240px tile size — scale proportionally
  },

  shadow: {
    appIcon:
      '0 18px 48px rgba(76,29,149,0.32), 0 4px 12px rgba(20,15,40,0.06)',
    card:
      '0 12px 32px rgba(20,15,40,0.05)',
    tileSoft:
      '0 1px 2px rgba(20,15,40,0.04)',
  },

  lockup: {
    vertical: {
      heroMarkSize: 220,
      heroGap: 36,
      heroWordmarkSize: 52,
    },
    horizontal: {
      hero:  { mark: 72, gap: 18, wordmark: 48 },
      body:  { mark: 44, gap: 12, wordmark: 30 },
      nav:   { mark: 24, gap: 8,  wordmark: 16 },
    },
  },
} as const;

export type Tokens = typeof tokens;
