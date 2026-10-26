# Branding de Lotura

## Narrativa

«Los enlaces se agrupan en colecciones, y las colecciones construyen Lotura.»

Lotura es una biblioteca personal de enlaces organizada mediante colecciones. Su identidad visual expresa esa idea con módulos que se conectan para formar una L.

## Geometría del símbolo

- Cinco módulos cuadrados de **90 × 90 px** con esquinas redondeadas de **20 px** de radio (aproximadamente el 22 % del lado).
- Separación de **10 px** entre módulos.
- Composición en una cuadrícula de 3 × 3: tres módulos en la columna izquierda y dos módulos adicionales en la fila inferior.
- Proporción del lienzo: **1:1**, con `viewBox="0 0 300 300"`.
- Los SVG no tienen fondo: deben conservar la transparencia sobre superficies claras u oscuras.

## Colores

El símbolo principal utiliza un gradiente diagonal, aplicado de nuevo en cada módulo:

- `#3BC0F0` — azul cielo
- `#2E7BF6` — azul
- `#3B5BDB` — azul índigo
- `#5B4FD6` — violeta
- `#8B4FE8` — violeta luminoso

La versión monocroma utiliza `#1A1D23`.

Fondos de la aplicación:
- Claro: `#F5F6F8`
- Oscuro: `#1A1D23`

Paleta de acentos de interfaz:
- Azul: `#3B82F6`, sobre fondo suave `#EEF2FF`
- Violeta: `#8B5CF6`, sobre fondo suave `#F3E8FF`
- Verde: `#22C55E`, sobre fondo suave `#DCFCE7`

## Tipografía

- Familia preferida: **Inter**; alternativa: `system-ui, sans-serif`.
- Wordmark «Lotura»: peso **800**, tamaño de referencia **96 px**, `letter-spacing="-2"`.
- Tagline: peso **500**, tamaño de referencia **24 px**.
- Texto descriptivo de marca: peso **400**.

Tagline: **Guarda enlaces. Comparte colecciones.**

Descripción: **Crea, comparte y descubre colecciones de enlaces.**

## Usos de los archivos

- `logo.svg`: símbolo principal a color.
- `logo-monochrome.svg`: impresión y contextos monocromos.
- `favicon.svg`: versión simplificada para la pestaña del navegador.
- `logo-with-wordmark.svg`: portada, documentación y README.

`docs/branding/logo.svg` es la fuente canónica. Las copias `src/ui/assets/logo.svg` y `src/ui/logo.svg` contienen el mismo SVG: la primera conserva los recursos de marca organizados bajo `assets/`, y la segunda es la copia que sirve el servidor actual.

El favicon se conserva en `src/ui/assets/favicon.svg` como recurso de marca y se copia idénticamente a `src/ui/favicon.svg` para servirlo. El HTML enlaza `/assets/favicon.svg` y `/assets/logo.svg`; el servidor actual resuelve `/assets/<archivo>` directamente contra `src/ui/<archivo>` (no contra `src/ui/assets/`). Por eso hacen falta las copias en la raíz de `src/ui/`, sin modificar `src/api/server.ts`.

## Uso correcto

- Mantener las proporciones y la transparencia del símbolo.
- No recolorear los módulos individualmente ni añadir contornos o sombras.
- Usar la versión monocroma cuando el proceso de impresión o el contexto no admita gradientes.
- Mantener contraste suficiente entre el wordmark, la tagline y su fondo.
