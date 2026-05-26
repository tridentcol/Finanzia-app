/**
 * Paleta muted para categorías y otros tokens visuales del usuario.
 * Sin saturación alta — alineado al mandato Noir.
 *
 * `accent-ai` está deliberadamente excluido (reservado a presencia de IA).
 */

export const categoryPalette = {
  slate: '#6B7280',
  stone: '#78716C',
  olive: '#93876B',
  sage: '#7FB89F',
  rose: '#D4938A',
  mauve: '#9D8AAB',
  sand: '#C2A776',
  steel: '#6B8294',
} as const

export type CategoryPaletteKey = keyof typeof categoryPalette

export const categoryPaletteEntries = Object.entries(categoryPalette) as Array<
  [CategoryPaletteKey, string]
>
