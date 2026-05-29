import 'server-only'

import type { CategorySlot } from '../../intents/types'
import { listAvailableCategories } from '@/lib/db/queries/transactions'
import { normalize, singularize } from '../normalize'
import { similarity } from '../levenshtein'

/**
 * Sinónimos CO/LATAM → nombre canónico de categoría sembrada. El valor debe
 * coincidir (normalizado) con el `name` de una categoría del usuario para que
 * el match resuelva. Si la categoría no existe en su cuenta, el sinónimo se
 * ignora silenciosamente.
 */
const SYNONYMS: Record<string, string> = {
  supermercado: 'Mercado',
  super: 'Mercado',
  despensa: 'Mercado',
  comida: 'Restaurantes',
  almuerzo: 'Restaurantes',
  cena: 'Restaurantes',
  restaurante: 'Restaurantes',
  domicilio: 'Domicilios',
  rappi: 'Domicilios',
  gasolina: 'Combustible',
  nafta: 'Combustible',
  gas: 'Combustible',
  uber: 'Movilidad',
  taxi: 'Movilidad',
  transporte: 'Movilidad',
  bus: 'Transporte público',
  celular: 'Telefonía',
  telefono: 'Telefonía',
  movil: 'Telefonía',
  internet: 'Internet',
  wifi: 'Internet',
  arriendo: 'Arriendo o hipoteca',
  alquiler: 'Arriendo o hipoteca',
  renta: 'Arriendo o hipoteca',
  hipoteca: 'Arriendo o hipoteca',
  servicios: 'Servicios públicos',
  luz: 'Servicios públicos',
  agua: 'Servicios públicos',
  streaming: 'Streaming',
  netflix: 'Streaming',
  spotify: 'Streaming',
  suscripcion: 'Suscripciones',
  suscripciones: 'Suscripciones',
  gym: 'Gimnasio',
  gimnasio: 'Gimnasio',
  salud: 'Médicos y especialistas',
  medico: 'Médicos y especialistas',
  doctor: 'Médicos y especialistas',
  farmacia: 'Medicamentos',
  medicamento: 'Medicamentos',
  ropa: 'Ropa',
  vestuario: 'Ropa',
  cafe: 'Café',
  mascota: 'Mascotas',
  mascotas: 'Mascotas',
  viaje: 'Viajes',
  viajes: 'Viajes',
  educacion: 'Cursos y formación',
  curso: 'Cursos y formación',
  cine: 'Cine y cultura',
  entretenimiento: 'Entretenimiento',
  salario: 'Salario',
  sueldo: 'Salario',
  nomina: 'Salario',
  freelance: 'Freelance',
}

type Cat = { id: string; name: string }

function bestSimilarity(term: string, words: string[], stems: string[]): number {
  let best = 0
  for (const w of [...words, ...stems]) {
    const s = similarity(term, w)
    if (s > best) best = s
  }
  return best
}

/**
 * Resuelve la categoría aludida en la utterance contra las categorías reales
 * del usuario. Estrategia: exacto → sinónimo → fuzzy Levenshtein (>0.75). Si
 * el top-2 queda ambiguo (Δ <0.1) devuelve candidatos para disambiguation.
 */
export async function extractCategory(
  input: string,
  userId: string,
): Promise<{ match?: CategorySlot; candidates?: CategorySlot[] } | null> {
  const cats: Cat[] = await listAvailableCategories(userId)
  if (cats.length === 0) return null

  const n = normalize(input)
  const words = n.split(' ').filter(Boolean)
  const stems = words.map(singularize)

  const scored: Array<{ cat: Cat; score: number }> = []

  for (const cat of cats) {
    const catNorm = normalize(cat.name)
    let score = 0

    if (n.includes(catNorm)) {
      score = 1
    } else {
      // fuzzy por palabra de la categoría contra las de la utterance
      const catWords = catNorm.split(' ')
      for (const cw of catWords) {
        const s = bestSimilarity(cw, words, stems)
        if (s > score) score = s
      }
    }
    if (score > 0.5) scored.push({ cat, score })
  }

  // Sinónimos: si un sinónimo aparece, ata a su categoría canónica.
  for (const [syn, canonical] of Object.entries(SYNONYMS)) {
    if (words.includes(syn) || stems.includes(singularize(syn))) {
      const target = cats.find((c) => normalize(c.name) === normalize(canonical))
      if (target) scored.push({ cat: target, score: 0.95 })
    }
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)

  const top = scored[0] as { cat: Cat; score: number }
  if (top.score < 0.75) return null

  // dedup por id conservando el mejor score
  const seen = new Map<string, number>()
  for (const s of scored) {
    const prev = seen.get(s.cat.id) ?? 0
    if (s.score > prev) seen.set(s.cat.id, s.score)
  }
  const unique = [...seen.entries()]
    .map(([id, score]) => ({ cat: cats.find((c) => c.id === id) as Cat, score }))
    .sort((a, b) => b.score - a.score)

  const first = unique[0] as { cat: Cat; score: number }
  const second = unique[1]
  if (second && first.score - second.score < 0.1 && second.score >= 0.75) {
    return {
      candidates: [
        { id: first.cat.id, name: first.cat.name },
        { id: second.cat.id, name: second.cat.name },
      ],
    }
  }

  return { match: { id: first.cat.id, name: first.cat.name } }
}
