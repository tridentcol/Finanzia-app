# Handoff: finanzia · sistema de marca

## Resumen

Sistema de identidad visual para **finanzia**, plataforma moderna de gestión financiera impulsada por IA. Este paquete contiene la marca finalizada (símbolo + wordmark + paleta + tipografía) lista para aplicar en código.

## Sobre los archivos de diseño

Los archivos `reference/*.html` y `reference/*.jsx` de este bundle son **referencias de diseño** — prototipos en HTML/React que muestran el aspecto final esperado, **no código de producción para copiar directamente**.

Tu tarea es **recrear estos diseños en el entorno del codebase objetivo** (React, Vue, SwiftUI, etc.) siguiendo sus patrones, librerías y design system existentes — o, si no hay entorno aún, elegir el framework apropiado e implementar.

Los archivos directamente reutilizables son:
- **`assets/*.svg`** — el símbolo de marca en sus 3 variantes, listo para servir como recurso estático.
- **`tokens.css`** y **`tokens.ts`** — los design tokens (colores, tipografía) listos para importar.

## Fidelidad

**Hi-fi.** Todos los valores (colores, tipografía, geometría, proporciones) son finales. Recrear con fidelidad pixel.

---

## La marca

El símbolo se llama internamente **"Horizonte"** — dos anillos abiertos concéntricos coronados por un disco central sólido. Lectura: capas, profundidad, foco. Tiene una silueta ownable y minimalista a la vez.

### Geometría

- Construido en un **viewBox de 200×200**.
- Centrado verticalmente (línea base en `y=140`, ocupa de `y=58` a `y=140`).
- Compuesto de **3 paths SVG**:
  1. Anillo exterior: radio exterior 82, radio interior 68 (grosor 14).
  2. Anillo medio: radio exterior 52, radio interior 38 (grosor 14).
  3. Disco interior: medio disco macizo de radio 22.

### Variantes

| Variante | Anillos | Centro | Fondo | Uso |
|---|---|---|---|---|
| **Color** (canónica) | `#7C3AED` Base | `#4C1D95` Deep | Claro | Web, app, marketing |
| **Mono** | `#4C1D95` Deep | `#4C1D95` Deep | Claro | Impresión 1 tinta, contextos sobrios |
| **Inverso** | `#FFFFFF` | `#FFFFFF` | `#4C1D95` Deep | Sobre morado, modo oscuro |

Los archivos SVG correspondientes están en `assets/`:
- `mark-color.svg`
- `mark-mono.svg`
- `mark-inverse.svg`

### Área de protección

Mantener un padding mínimo equivalente al **radio del disco interior (22 unidades en viewBox)**. Es decir: 11% del ancho del símbolo en cada lado.

### Cuándo usar cada variante

- **Color**: por defecto en superficies claras.
- **Mono**: cuando solo hay una tinta disponible, en lugares donde el tono Deep mejora el contraste, o cuando el símbolo es decorativo (ejemplo: ícono inline en texto).
- **Inverso**: sobre fondos morados (Deep, Deeper, Deepest) o modo oscuro saturado. NO usar sobre grises medios — el contraste cae.

---

## Wordmark

```
finanzia
```

| Atributo | Valor |
|---|---|
| Familia | **Sora** (Google Fonts) |
| Peso | **500** (Medium) |
| Caja | minúsculas, siempre |
| `letter-spacing` | **−0.05em** (tracking −5%) |
| `line-height` | **1.0** |
| Color | `#15102A` Ink (sobre claro) · `#FFFFFF` (sobre morado) |
| Tamaño hero | 52–92px |
| Tamaño body | 28–32px |
| Tamaño nav / footer | 16–18px |

**Importante**: el tracking negativo y el peso 500 son críticos. Sora a peso 600+ se vuelve pesada y pierde el aire premium; con tracking 0 el wordmark se desarma.

Fallback CSS:
```css
font-family: "Sora", system-ui, -apple-system, sans-serif;
```

---

## Lockups

### Lockup vertical (hero)
- Símbolo arriba (220px).
- Gap de **36px**.
- Wordmark debajo (52px).
- Alineación centrada.

### Lockup horizontal
| Tamaño | Símbolo | Gap | Wordmark |
|---|---|---|---|
| Hero | 72px | 18px | 48px |
| Body | 44px | 12px | 30px |
| Nav | 24px | 8px | 16px |

El gap horizontal aproximado: `gap ≈ wordmark_size × 0.4`.

---

## Paleta de color

Toda la paleta es **una sola familia de morados** + neutros fríos. Sin colores saturados secundarios — el morado es la firma.

### Morados (principales)

| Token | Hex | Rol |
|---|---|---|
| `purple-deepest` | `#2D1370` | Fondos premium / dark mode |
| `purple-deeper` | `#3B1781` | Hover / pressed states |
| `purple-deep` | `#4C1D95` | **Disco central del símbolo, fondos morados, botones primarios** |
| `purple-mid` | `#6D28D9` | Transiciones, gradientes |
| `purple-base` | `#7C3AED` | **Anillos del símbolo, links, foco** |
| `purple-light` | `#A78BFA` | Accentos suaves, illustraciones |
| `purple-pale` | `#DDD6FE` | Backgrounds tintados, bordes acentuados |
| `purple-cream` | `#F2EDFF` | Backgrounds muy suaves |

### Neutros

| Token | Hex | Rol |
|---|---|---|
| `ink` | `#15102A` | **Texto principal** |
| `graphite` | `#3A2F58` | Texto secundario |
| `muted` | `#8478A0` | Texto terciario, metadata, captions |
| `rule` | `#EFEAF7` | Bordes, separadores |
| `paper` | `#FFFFFF` | Background principal |
| `warm-grey` | `#FAFAFC` | Background alternativo |

Ver `tokens.css` y `tokens.ts` para los valores listos para importar.

---

## Aplicaciones de referencia

### App icon (iOS)

- Tile de **240×240** con `border-radius: 56px` (proporciones iOS).
- Background: `purple-deep` (`#4C1D95`).
- Símbolo: variante **inversa**, 160px de ancho, centrado.
- Sombra: `0 18px 48px rgba(76,29,149,0.32), 0 4px 12px rgba(20,15,40,0.06)`.

### Favicon

- Usar `mark-color.svg` directamente, el navegador lo escalará.
- Para PNG: 32×32 y 16×16.
- A 16px la marca sigue legible — los 3 elementos del símbolo siguen distinguibles.

### Web header

- Altura: 64px.
- Padding horizontal: 32px.
- Símbolo en lockup horizontal nav: 28px + 20px wordmark + 12px gap.
- Border-bottom: `1px solid var(--rule)`.

### Email signature / tarjeta

- Card de 380px de ancho con padding `32px 36px`.
- Header: lockup horizontal (símbolo 42px + wordmark 22px + 14px gap).
- Separador: `1px solid var(--rule)` debajo del lockup.

### Botón primario

- Background: `var(--purple-deep)`.
- Color texto: `#FFFFFF`.
- Padding: `8px 14px`.
- `border-radius: 6px`.
- Tipografía: Sora 500, 12-13px.

---

## Do's & Don'ts

✅ Hacer:
- Usar la marca en su escala mínima (16px+).
- Respetar el tracking del wordmark.
- Combinar Color y Mono según contexto.
- Mantener el área de protección.

❌ No hacer:
- Cambiar los colores del símbolo a otros tonos (no morados).
- Rotar, sesgar o distorsionar el símbolo.
- Reemplazar Sora por otra tipografía sin coordinación.
- Aplicar gradientes a la marca (la profundidad ya está en la composición de anillos).
- Usar la variante color sobre fondos saturados — usar siempre la inversa o mono.
- Cambiar el peso del wordmark (siempre 500).

---

## Estructura del paquete

```
design_handoff_finanzia_brand/
├── README.md                       (este archivo)
├── assets/
│   ├── mark-color.svg              (símbolo color, anillos base + centro deep)
│   ├── mark-mono.svg               (una tinta, deep)
│   └── mark-inverse.svg            (blanco, para sobre morado)
├── tokens.css                      (variables CSS listas para importar)
├── tokens.ts                       (tokens TypeScript)
└── reference/
    ├── finanzia marca final.html   (vista del sistema, abrir en navegador)
    ├── logos-final.jsx             (componentes React de referencia)
    └── design-canvas.jsx           (componente de presentación, NO usar en prod)
```

---

## Cómo usar este paquete desde Claude Code

1. **Lee este README primero** — los valores y reglas son la verdad.
2. **Importa los tokens** desde `tokens.css` o `tokens.ts` al codebase objetivo.
3. **Convierte los SVG en un componente nativo** del framework usado (React: convertir paths a JSX; Vue: idem en template; SwiftUI: redibujar con `Path`; etc.).
4. **Usa `reference/logos-final.jsx`** como guía de proporciones y composición — no copies el código tal cual, recréalo siguiendo las convenciones del codebase.
5. **Abre `reference/finanzia marca final.html`** en el navegador si necesitas ver el resultado esperado.
