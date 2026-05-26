/**
 * Easings oficiales del sistema. `smooth` es el default — no usar otros sin
 * justificación. Sin overshoot, sin spring bouncy (regla 3).
 */

export const easings = {
  smooth: [0.32, 0.72, 0, 1] as const,
  /** Solo para salidas: arranca rápido, termina lento. */
  exit: [0.4, 0, 1, 1] as const,
  /** Solo para entradas: arranca lento, termina rápido. */
  enter: [0, 0, 0.2, 1] as const,
} as const

export type Easing = keyof typeof easings

/** Spring oficial. Físico pero no bouncy — damping alto. */
export const spring = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 32,
  mass: 1,
}
