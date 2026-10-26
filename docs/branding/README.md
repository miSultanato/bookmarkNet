# Branding de Lotura

## Narrativa

«Los enlaces se agrupan en colecciones, y las colecciones construyen Lotura.»

La identidad visual expresa esa idea con cinco módulos cuadrados que se conectan para formar una L.

## Geometría

- Cinco módulos cuadrados de 90 × 90 px, con radio de esquina de 20 px (aproximadamente el 22 % del lado).
- Los módulos forman una L en una cuadrícula de 3 × 3: tres módulos apilados en la columna izquierda y tres posiciones en la fila inferior, compartiendo el módulo de la esquina.
- Separación mínima entre módulos (3 px en el símbolo principal); la forma general conserva una proporción 1:1.
- El símbolo usa `viewBox="0 0 300 300"` y fondo transparente.

## Colores

Gradiente diagonal de arriba a la izquierda hacia abajo a la derecha, aplicado por módulo:

- `#3BC0F0` — azul cielo
- `#2E7BF6` — azul
- `#3B5BDB` — azul índigo
- `#5B4FD6` — violeta azulado
- `#8B4FE8` — violeta

Versiones monocromáticas sobre fondo transparente:

- Oscuro: `#1A1D23`
- Claro: `#C4C7CC` (para fondos oscuros; puede aplicarse con el mismo patrón geométrico).

Fondos de referencia para iconos de aplicación:

- Claro: `#F5F6F8`
- Oscuro: `#1A1D23`

El favicon incorpora fondo blanco y una versión simplificada del gradiente para conservar el contraste a 16 × 16, 32 × 32 y 48 × 48 px.

## Tipografía

- Nombre «Lotura»: Inter (o `system-ui`), peso 800, `letter-spacing: -2px`, color `#1A1D23`.
- Tagline «Guarda enlaces. Comparte colecciones.»: Inter, peso 500–600, color `#1A1D23` o `#374151`.
- Descripción «Crea, comparte y descubre colecciones de enlaces.»: Inter, peso 400, color `#6B7280`.

## Usos

- `logo.svg`: símbolo principal.
- `logo-monochrome.svg`: impresión y usos monocromáticos (oscuro).
- `favicon.svg`: pestaña del navegador; SVG escalable para tamaños 16, 32 y 48 px.
- `logo-with-wordmark.svg`: composición vertical para portada y README, con símbolo arriba, nombre y dos líneas de texto debajo.
- `src/ui/assets/logo.svg`: copia idéntica del símbolo canónico para servirlo en la UI.
- `src/ui/assets/favicon.svg`: favicon para la UI.

El servidor sirve `/assets/*` desde `src/ui/assets/` (con fallback a `src/ui/` para el resto de la UI). Los SVG viven solo en `src/ui/assets/`.

## Iconos de portada

- **Enlaces:** marcador; fondo `#EEF2FF`, icono `#3B82F6`.
- **Colecciones:** cuadrícula de cuatro cuadrados; fondo `#F3E8FF`, icono `#8B5CF6`.
- **Compartir:** nodos conectados; fondo `#DCFCE7`, icono `#22C55E`.

## Paleta de acentos

- Azul: `#3B82F6` — fondo suave `#EEF2FF`.
- Violeta: `#8B5CF6` — fondo suave `#F3E8FF`.
- Verde: `#22C55E` — fondo suave `#DCFCE7`.
