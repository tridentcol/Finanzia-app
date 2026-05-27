# Imágenes del catálogo de tarjetas

Las imágenes que vivan acá las consume `<CardVisual>` resolviendo el path
declarado en `src/lib/cards/catalog.ts`.

## Naming convention

```
{bankSlug}-{kind}-{productSlug}.{ext}
```

Donde:
- `bankSlug` es el slug del banco en el catálogo (`bancolombia`, `davivienda`, etc.).
- `kind` es `credit` o `debit`.
- `productSlug` es el slug del producto dentro del banco.
- `ext` cualquiera que Next/Image acepte (recomendado `.avif` o `.png`).

Ejemplo: `bancolombia-credit-mastercard-black.avif`

## Especificaciones

- Aspecto **1.585 : 1** (CR-80, estándar ISO/IEC 7810).
- Resolución sugerida: **600 × 380** mínimo (suficiente para todos los
  contextos de la app; Next/Image servirá tamaños menores según viewport).
- Formato preferido: **AVIF** (50-70% más liviano que PNG con misma calidad).
- Fondo: NO transparente — la imagen es la tarjeta completa.
- Sin texto encima (`<CardVisual>` no escribe sobre la imagen — los datos
  del usuario se renderizan SEPARADOS, debajo de la imagen).

## ¿Qué pasa si no existe el archivo?

`<CardVisual>` cae graceful al placeholder neutral con el wordmark del
banco — la app no rompe. Podés agregar imágenes progresivamente.

## ¿Cómo agrego una tarjeta nueva al catálogo?

1. Editá `src/lib/cards/catalog.ts` y agregá la entrada (banco o producto).
2. Decidí el path: `/cards/{bankSlug}-{kind}-{productSlug}.avif`.
3. Drop la imagen en este directorio con ese nombre.
4. Listo — el dropdown del NewAccountDialog ya la muestra.
