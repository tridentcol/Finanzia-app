/**
 * Tipado laxo de los `parts` de un UIMessage del AI SDK (`@ai-sdk/react` v6) y
 * narrowing de tool parts, COMPARTIDO entre el adaptador (`llm-to-ast`) y la
 * derivación de fase (`render/copilot-phase`). El SDK añade campos según
 * versión, así que tipamos sólo lo que consumimos.
 *
 * Forma confirmada en `ai@6` (`ToolUIPart` / `DynamicToolUIPart`):
 * - Tool tipado:   `type: 'tool-<NAME>'`
 * - Tool dinámico: `type: 'dynamic-tool'` + `toolName: string`
 * - `state`: 'input-streaming' | 'input-available' | 'output-available' |
 *            'output-error' | 'approval-requested' | 'approval-responded' |
 *            'output-denied'
 */
export type LoosePart = {
  type?: string
  text?: string
  data?: unknown
  /** Estado del tool (ver doc arriba). Presente sólo en tool parts. */
  state?: string
  /** Salida de un tool (cuando `state === 'output-available'`). */
  output?: unknown
  /** Nombre del tool en parts `dynamic-tool`. */
  toolName?: string
}

const TOOL_PREFIX = 'tool-'

/**
 * Nombre del tool de un part: `tool-<name>` (tipado) o el `toolName` de un
 * `dynamic-tool`. Devuelve null si el part no es un tool.
 */
export function toolNameOf(part: LoosePart): string | null {
  if (typeof part.type === 'string' && part.type.startsWith(TOOL_PREFIX)) {
    return part.type.slice(TOOL_PREFIX.length)
  }
  if (part.type === 'dynamic-tool' && typeof part.toolName === 'string') {
    return part.toolName
  }
  return null
}

/** ¿Este part corresponde al tool `name`? */
export function isTool(part: LoosePart, name: string): boolean {
  return toolNameOf(part) === name
}
