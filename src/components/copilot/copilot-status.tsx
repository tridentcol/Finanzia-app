const DEFAULT_LABEL = 'Pensando…'
const IDLE_LABEL = 'No obtuve una respuesta.'

/**
 * Estado humano y discreto del copiloto.
 *
 * - Mientras genera (`idle` falso): un punto lavanda (`--accent-ai` — presencia
 *   de IA) que late con el keyframe `copilot-typing`, seguido de una frase que
 *   dice QUÉ está haciendo Finanzia. La frase hace un fade-in suave en cada
 *   cambio (`key={text}` remonta el span y `tw-animate-css` reproduce el
 *   `fade-in`; el punto NO lleva key, así su pulso da continuidad). Bajo
 *   `prefers-reduced-motion` el bloque global de globals.css neutraliza la
 *   animación → swap instantáneo, punto estático.
 * - Estado terminal (`idle` verdadero): cuando el stream terminó sin contenido
 *   renderable (Detener, error o límite de pasos). Punto estático neutro (no
 *   lavanda: ya no hay IA trabajando) + frase honesta. Nunca seguimos latiendo
 *   un estado de "trabajando" que ya acabó.
 *
 * Texto en `text-secondary` (no `tertiary`) para cumplir contraste AA: es el
 * único canal textual de progreso del copiloto. `role="status"` para lectores;
 * `aria-live` sólo en el estado vivo (el terminal no necesita re-anunciarse).
 * Sin emojis, sin spinner, sin shimmer, sin gradiente.
 */
export function CopilotStatus({ label, idle = false }: { label?: string; idle?: boolean }) {
  if (idle) {
    return (
      <div className="flex items-center gap-2 py-1" role="status">
        <span className="bg-text-tertiary size-1.5 shrink-0 rounded-full" aria-hidden="true" />
        <span className="text-text-secondary text-[13px]">{label ?? IDLE_LABEL}</span>
      </div>
    )
  }

  const text = label ?? DEFAULT_LABEL
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-live="polite">
      <span
        className="copilot-typing-dot size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: 'var(--accent-ai)' }}
        aria-hidden="true"
      />
      <span
        key={text}
        className="text-text-secondary animate-in fade-in-0 text-[13px] duration-200"
        style={{ animationTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {text}
      </span>
    </div>
  )
}
