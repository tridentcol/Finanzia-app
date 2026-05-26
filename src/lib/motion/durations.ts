/**
 * Duraciones oficiales en milisegundos. Pickear según la escala del cambio:
 *   instant — feedback inmediato (hover, focus).
 *   fast    — micro-interacciones (toggle, dropdown).
 *   base    — transiciones de panel/dialog.
 *   slow    — entrada de pantalla completa.
 *   ambient — animaciones decorativas en idle.
 */

export const durations = {
  instant: 120,
  fast: 220,
  base: 320,
  slow: 480,
  ambient: 800,
} as const

export type Duration = keyof typeof durations

/** Convierte una duración a segundos (lo que pide Motion v12). */
export const seconds = (d: Duration): number => durations[d] / 1000
