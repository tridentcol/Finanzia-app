import { z } from 'zod'

/**
 * Persona de personalización del copiloto: señales honestas (no psicología) que
 * el usuario aporta en el onboarding y puede editar en Ajustes. Cada señal
 * produce al menos una línea de snapshot o un ajuste de tono medible. NADA de
 * fine-tuning: la personalización es por prompt.
 *
 * Módulo isomorfo (sin `server-only`): lo consumen el onboarding (cliente), el
 * snapshot y el system prompt (servidor), y las server actions.
 */

// ============ Opciones (enums) ============

export const LITERACY = ['basico', 'intermedio', 'avanzado'] as const
export const COMM_STYLE = ['directo', 'detallado', 'didactico'] as const
export const MONEY_STYLE = ['planificador', 'equilibrado', 'espontaneo'] as const
export const HORIZON = ['corto', 'medio', 'largo'] as const
export const FOCUS = [
  'salir_de_deudas',
  'crear_colchon',
  'ahorrar_meta',
  'invertir',
  'ordenar_gastos',
  'entender_a_donde_va',
] as const

export type Literacy = (typeof LITERACY)[number]
export type CommStyle = (typeof COMM_STYLE)[number]
export type MoneyStyle = (typeof MONEY_STYLE)[number]
export type Horizon = (typeof HORIZON)[number]
export type Focus = (typeof FOCUS)[number]
export type RiskTolerance = 'conservador' | 'moderado' | 'agresivo'

type Option<T extends string> = { value: T; label: string; desc?: string }

export const LITERACY_OPTIONS: Option<Literacy>[] = [
  { value: 'basico', label: 'Básico', desc: 'Prefiero que me expliquen los términos' },
  { value: 'intermedio', label: 'Intermedio', desc: 'Me manejo con lo esencial' },
  { value: 'avanzado', label: 'Avanzado', desc: 'Domino los conceptos, ve al fondo' },
]

export const COMM_STYLE_OPTIONS: Option<CommStyle>[] = [
  { value: 'directo', label: 'Directo', desc: 'Al grano, sin rodeos' },
  { value: 'detallado', label: 'Detallado', desc: 'Con contexto y matices' },
  { value: 'didactico', label: 'Didáctico', desc: 'Explícame el porqué' },
]

export const MONEY_STYLE_OPTIONS: Option<MoneyStyle>[] = [
  { value: 'planificador', label: 'Planificador' },
  { value: 'equilibrado', label: 'Equilibrado' },
  { value: 'espontaneo', label: 'Espontáneo' },
]

export const HORIZON_OPTIONS: Option<Horizon>[] = [
  { value: 'corto', label: 'Corto plazo' },
  { value: 'medio', label: 'Mediano plazo' },
  { value: 'largo', label: 'Largo plazo' },
]

export const FOCUS_OPTIONS: Option<Focus>[] = [
  { value: 'salir_de_deudas', label: 'Salir de deudas' },
  { value: 'crear_colchon', label: 'Crear un colchón' },
  { value: 'ahorrar_meta', label: 'Ahorrar para una meta' },
  { value: 'invertir', label: 'Empezar a invertir' },
  { value: 'ordenar_gastos', label: 'Ordenar mis gastos' },
  { value: 'entender_a_donde_va', label: 'Entender a dónde va mi plata' },
]

// ============ Mini-test de comportamiento (3 preguntas) ============
// El `score` 0|1|2 es la única fuente de la derivación determinista.

export type TestAnswerId = 'p1' | 'p2' | 'p3'

export const TEST_QUESTIONS: {
  id: TestAnswerId
  prompt: string
  options: { value: string; label: string; score: 0 | 1 | 2 }[]
}[] = [
  {
    id: 'p1',
    prompt: 'Te cae un gasto inesperado importante este mes. ¿Qué haces?',
    options: [
      { value: 'fondo', label: 'Lo cubro con mi fondo de emergencia', score: 0 },
      { value: 'reacomodo', label: 'Reacomodo los gastos del mes para cubrirlo', score: 1 },
      { value: 'como_pueda', label: 'Lo pago como pueda y reviso después', score: 2 },
    ],
  },
  {
    id: 'p2',
    prompt: 'Cuando decides sobre tu dinero, ¿en qué piensas?',
    options: [
      { value: 'mes', label: 'En este mes y el corto plazo', score: 0 },
      { value: 'anio', label: 'En el próximo año', score: 1 },
      { value: 'anios', label: 'En varios años, en mi futuro', score: 2 },
    ],
  },
  {
    id: 'p3',
    prompt: '¿Cómo te sientes más cómodo manejando tu plata?',
    options: [
      { value: 'reglas', label: 'Con reglas y presupuestos claros', score: 0 },
      { value: 'medio', label: 'Con un punto medio', score: 1 },
      { value: 'flexible', label: 'Con flexibilidad, sin reglas rígidas', score: 2 },
    ],
  },
]

// ============ Zod ============

/** Valores válidos de una pregunta del test, derivados de TEST_QUESTIONS (sin drift). */
function testValues(id: TestAnswerId): [string, ...string[]] {
  const opts = TEST_QUESTIONS.find((q) => q.id === id)?.options.map((o) => o.value) ?? []
  return opts as [string, ...string[]]
}

/** Respuestas del mini-test restringidas a los valores reales del catálogo. */
export const testAnswersSchema = z
  .object({
    p1: z.enum(testValues('p1')),
    p2: z.enum(testValues('p2')),
    p3: z.enum(testValues('p3')),
  })
  .partial()

export const personaSchema = z.object({
  literacy: z.enum(LITERACY).optional(),
  commStyle: z.enum(COMM_STYLE).optional(),
  moneyStyle: z.enum(MONEY_STYLE).optional(),
  horizon: z.enum(HORIZON).optional(),
  focus: z.array(z.enum(FOCUS)).max(2).optional(),
  testAnswers: testAnswersSchema.optional(),
  updatedAt: z.string().optional(),
})
export type Persona = z.infer<typeof personaSchema>

/** Lee una persona desde `aiProfile.persona` de forma tolerante (o null). */
export function parsePersona(value: unknown): Persona | null {
  if (value == null) return null
  const r = personaSchema.safeParse(value)
  return r.success ? r.data : null
}

// ============ Derivación determinista (auditable) ============

function scoreOf(qid: TestAnswerId, value: string | undefined): 0 | 1 | 2 | null {
  if (!value) return null
  const q = TEST_QUESTIONS.find((x) => x.id === qid)
  const opt = q?.options.find((o) => o.value === value)
  return opt ? opt.score : null
}

/**
 * Deriva moneyStyle (P1+P3: preparación + control), horizon (P2) y
 * riskTolerance (P2+P3: horizonte + tolerancia a la flexibilidad). Pura: las
 * mismas respuestas dan siempre el mismo resultado. Campos ausentes se omiten.
 */
export function derivePersona(answers: { p1?: string; p2?: string; p3?: string }): {
  moneyStyle?: MoneyStyle
  horizon?: Horizon
  riskTolerance?: RiskTolerance
} {
  const s1 = scoreOf('p1', answers.p1)
  const s2 = scoreOf('p2', answers.p2)
  const s3 = scoreOf('p3', answers.p3)
  const out: { moneyStyle?: MoneyStyle; horizon?: Horizon; riskTolerance?: RiskTolerance } = {}

  if (s2 !== null) out.horizon = s2 === 0 ? 'corto' : s2 === 1 ? 'medio' : 'largo'
  if (s1 !== null && s3 !== null) {
    const t = s1 + s3
    out.moneyStyle = t <= 1 ? 'planificador' : t === 2 ? 'equilibrado' : 'espontaneo'
  }
  if (s2 !== null && s3 !== null) {
    const t = s2 + s3
    out.riskTolerance = t <= 1 ? 'conservador' : t === 2 ? 'moderado' : 'agresivo'
  }
  return out
}

// ============ Snapshot ============

const LITERACY_SNAPSHOT: Record<Literacy, string> = {
  basico: 'básico (conviene definir términos).',
  intermedio: 'intermedio.',
  avanzado: 'avanzado (usa términos sin definir).',
}
const COMM_SNAPSHOT: Record<CommStyle, string> = {
  directo: 'directo, al grano.',
  detallado: 'detallado, con contexto.',
  didactico: 'didáctico, agradece el porqué.',
}
const MONEY_SNAPSHOT: Record<MoneyStyle, string> = {
  planificador: 'planificador; valora reglas y metas claras.',
  equilibrado: 'equilibrado.',
  espontaneo: 'espontáneo; prefiere guías flexibles.',
}
const HORIZON_SNAPSHOT: Record<Horizon, string> = {
  corto: 'corto plazo (este mes / pocos meses).',
  medio: 'mediano plazo (alrededor de un año).',
  largo: 'largo plazo (varios años); valora proyecciones.',
}
export const FOCUS_LABEL: Record<Focus, string> = {
  salir_de_deudas: 'salir de deudas',
  crear_colchon: 'crear un colchón de emergencia',
  ahorrar_meta: 'ahorrar para una meta',
  invertir: 'empezar a invertir',
  ordenar_gastos: 'ordenar sus gastos',
  entender_a_donde_va: 'entender a dónde se va su plata',
}

/** Líneas de snapshot (bullets es-CO) para inyectar en el perfil del prompt. */
export function personaToSnapshotLines(p: Persona): string[] {
  const lines: string[] = []
  if (p.literacy) lines.push(`- Conocimiento financiero: ${LITERACY_SNAPSHOT[p.literacy]}`)
  if (p.commStyle) lines.push(`- Estilo de comunicación preferido: ${COMM_SNAPSHOT[p.commStyle]}`)
  if (p.moneyStyle) lines.push(`- Relación con el dinero: ${MONEY_SNAPSHOT[p.moneyStyle]}`)
  if (p.horizon) lines.push(`- Horizonte: ${HORIZON_SNAPSHOT[p.horizon]}`)
  if (p.focus && p.focus.length > 0) {
    lines.push(`- Foco actual: ${p.focus.map((f) => FOCUS_LABEL[f]).join(', ')}.`)
  }
  return lines
}

// ============ Tono (instrucciones condicionales del prompt) ============

export type ToneHints = {
  verbosity: 'low' | 'medium' | 'high'
  explainTerms: boolean
  assumeKnowledge: boolean
  explainReasoning: boolean
  moneyStyle?: MoneyStyle
  focusOrder: string[]
}

export function personaToToneHints(p: Persona): ToneHints {
  let verbosity: ToneHints['verbosity'] = 'medium'
  if (p.commStyle === 'directo') verbosity = 'low'
  else if (p.commStyle === 'detallado' || p.commStyle === 'didactico') verbosity = 'high'
  return {
    verbosity,
    explainTerms: p.literacy === 'basico',
    assumeKnowledge: p.literacy === 'avanzado',
    explainReasoning: p.commStyle === 'didactico',
    moneyStyle: p.moneyStyle,
    focusOrder: (p.focus ?? []).map((f) => FOCUS_LABEL[f]),
  }
}

/** ¿La persona aporta alguna señal de tono? (evita inyectar un bloque vacío). */
export function hasToneSignal(h: ToneHints): boolean {
  return (
    h.verbosity !== 'medium' ||
    h.explainTerms ||
    h.assumeKnowledge ||
    h.explainReasoning ||
    h.moneyStyle !== undefined ||
    h.focusOrder.length > 0
  )
}
