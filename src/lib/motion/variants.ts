/**
 * Variants reutilizables para Motion. Cero bouncy springs, cero overshoot.
 * Compatibles con `prefers-reduced-motion: reduce` — Motion lee ese setting
 * y reduce las transiciones automáticamente cuando se usan estos presets.
 */

import { easings } from './easings'
import { seconds } from './durations'

type Variants = Record<string, Record<string, unknown>>

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: seconds('fast'), ease: easings.smooth },
  },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: seconds('base'), ease: easings.smooth },
  },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: seconds('base'), ease: easings.smooth },
  },
}

/** Stagger para listas. El padre orquesta, los hijos heredan. */
export const listContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: seconds('fast'), ease: easings.smooth },
  },
}

/** Para panels/dialogs que entran desde la derecha. */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: seconds('base'), ease: easings.smooth },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: seconds('fast'), ease: easings.exit },
  },
}
