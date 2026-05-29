/**
 * Constantes compartidas para la integración bancaria. Vive fuera de actions.ts
 * porque ese archivo es 'use server' — exportar constantes desde un módulo
 * server-only convierte cada export en un RPC stub durante build, así que en
 * cliente `SUPPORTED_BANKS.map(...)` truena con "X.map is not a function".
 *
 * Regla: archivos `'use server'` SÓLO exportan funciones async (server
 * actions). Constantes, tipos y helpers puros viven aquí o en módulos
 * separados sin esa directive.
 */

export const SUPPORTED_BANKS = [
  'bancolombia',
  'nequi',
  'davivienda',
  'bbva',
] as const

export type SupportedBank = (typeof SUPPORTED_BANKS)[number]

export const BANK_LABELS: Record<SupportedBank, string> = {
  bancolombia: 'Bancolombia',
  nequi: 'Nequi',
  davivienda: 'Davivienda',
  bbva: 'BBVA Colombia',
}
