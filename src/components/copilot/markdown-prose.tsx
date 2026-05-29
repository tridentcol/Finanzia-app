import Markdown, { defaultUrlTransform, type Components, type UrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renderiza el markdown del LLM con un map Noir restringido. SOLO el camino LLM
 * lo usa (el heurístico mantiene bloques estructurados del answer-ast).
 *
 * Disciplina Noir: sin HTML crudo (no usamos rehype-raw → react-markdown no
 * parsea HTML), sin imágenes (`img` vetado), sin color de acento en el contenido
 * (el contenido es contenido, no presencia de IA). Listas ordenadas con números
 * en Geist Mono tabular vía contadores CSS (`.md-prose` en globals.css), lo que
 * conserva la semántica nativa `ol`/`li` para lectores de pantalla. Las URLs se
 * filtran a http/https/mailto (anti `javascript:`).
 */

/** Restringe a esquemas seguros tras el saneado por defecto de react-markdown. */
const urlTransform: UrlTransform = (url) => {
  const safe = defaultUrlTransform(url)
  if (!safe) return safe
  // Relativos (sin esquema) → permitidos. Con esquema → sólo http/https/mailto.
  if (/^[a-z][a-z0-9+.-]*:/i.test(safe)) {
    return /^(https?:|mailto:)/i.test(safe) ? safe : ''
  }
  return safe
}

/** Encabezados degradados a eyebrow: el chat no necesita títulos grandes. */
function Eyebrow({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-text-secondary text-[11px] font-medium tracking-[0.08em] uppercase">
      {children}
    </p>
  )
}

const components: Components = {
  p: ({ children }) => (
    <p className="text-text-secondary text-[14px] leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => <strong className="text-text font-medium">{children}</strong>,
  em: ({ children }) => <em className="text-text-secondary italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-text underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const text = typeof children === 'string' ? children : ''
    const isBlock = (typeof className === 'string' && className.includes('language-')) || text.includes('\n')
    if (isBlock) return <code className="font-mono">{children}</code>
    return (
      <code className="bg-surface-elevated text-text-secondary rounded-[4px] px-1 py-0.5 font-mono text-[12.5px]">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="bg-surface-elevated border-border-default text-text-secondary overflow-x-auto rounded-[8px] border p-3 text-[12.5px] leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-border-emphasis text-text-secondary border-l-2 pl-3 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border-default" />,
  h1: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  h2: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  h3: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  h4: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  h5: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  h6: ({ children }) => <Eyebrow>{children}</Eyebrow>,
  // Tablas GFM: borde 1px, celdas compactas, números mono tabular.
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="border-border-default w-full border-collapse border text-[13px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-border-default text-text bg-surface-elevated border px-2.5 py-1.5 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border-default text-text-secondary border px-2.5 py-1.5 tabular-nums">
      {children}
    </td>
  ),
}

export function MarkdownProse({ body }: { body: string }) {
  return (
    <div className="md-prose text-text-secondary space-y-2.5 text-[14px] leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        disallowedElements={['img', 'iframe', 'script', 'style', 'video', 'audio', 'object', 'embed', 'svg', 'input']}
        unwrapDisallowed
        components={components}
      >
        {body}
      </Markdown>
    </div>
  )
}
