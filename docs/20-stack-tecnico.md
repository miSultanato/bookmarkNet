# Stack técnico

Este documento define el lenguaje, runtime y arquitectura de empaquetado de BookmarkNet.

## Lenguaje y runtime

- **Lenguaje:** TypeScript.
- **Runtime:** Bare (Holepunch).

Bare es un runtime de JavaScript "zero-core" diseñado para embeber y compilar a binario standalone. Es el entorno nativo del stack Hyper* (Hypercore, Hyperswarm, Corestore, Autobase). El mismo código corre en desktop, móvil y terminal sin forks específicos.

## Por qué Bare y no Node.js

- **Multiplataforma real:** binarios precompilados para macOS, iOS, Linux, Android y Windows.
- **Binario pequeño:** el runtime completo pesa menos de 3 MB. Un nodo BookmarkNet empaquetado con `bare-build` queda en ~5-15 MB, frente a ~30-50 MB de Node.js con `pkg`.
- **Móvil en el horizonte:** el core P2P se escribe una vez y corre igual en desktop y móvil. El shell cambia; el core no.
- **Ecosistema Hyper nativo:** es el runtime para el que Holepunch diseña Hypercore, Hyperswarm y Autobase.

## Arquitectura: Pear-end + UI web local

El código se estructura en dos capas:

1. **Core P2P (Pear-end):** un worker Bare que contiene toda la lógica peer-to-peer:
   - Identidad (generación de claves, firma).
   - Hypercore, Hyperbee, Hyperswarm, Corestore, Autobase.
   - Lógica de colecciones, publicación, escritura dual.
   - Descubrimiento, búsqueda, métricas.
   - Servidor web local que sirve la UI.
2. **UI web local:** servida por el core en `localhost`. El usuario abre el navegador y apunta a `http://localhost:<puerto>`. No hay app nativa en desktop. No hay Electron.

El core no importa frameworks de UI. La UI es HTML/CSS/JS estático servido por el core. Se comunica con el core vía la API local (`/api/v1/...`).

## Empaquetado (desktop)

- **Binario único:** `bare-build` con `--standalone` genera un ejecutable único por plataforma (Mach-O en macOS, ELF en Linux, PE en Windows) que contiene el core + los assets web estáticos.
- **Arranque:** al ejecutar el binario, arranca el servidor web local y (opcionalmente) abre el navegador del usuario en `http://localhost:<puerto>`.
- **Instaladores:** `bare-build` con `--package` genera `.pkg`/`.AppImage`/`.msix` según plataforma.

## Móvil (fase posterior)

- `pear-mobile` + `react-native-bare-kit` para embeber el core Bare en una app móvil.
- La UI web local se sirve desde el core y se abre en un WebView (o en el navegador del móvil).
- El core es el mismo. Solo cambia el contenedor de la UI.
- `bare-pack` genera el bundle del worker para móvil.

## Librerías principales

- `hypercore`, `hyperbee`, `hyperswarm`, `corestore`, `autobase` (si se usa para user_core).
- `libsodium` o `sodium-native` para criptografía (Ed25519).
- `bare-build` / `bare-pack` para empaquetado.
- `pear-runtime` (desktop) o `pear-mobile` (móvil) para integración con el sistema.

## Lo que NO se usa

- **Node.js:** descartado por tamaño de binario y por falta de soporte móvil realista.
- **Rust:** descartado porque el ecosistema Hyper* en Rust no está maduro y reescribir el core costaría meses.
- **Deno / Bun:** descartados por no ser el entorno nativo de Hypercore y añadir capas de compatibilidad innecesarias.
- **Electron ni apps nativas en desktop:** la UI es web local servida por el core. Sin Electron, sin Tauri, sin Qt.
- **Frameworks de UI en el core:** el core solo sirve assets estáticos. La UI es HTML/CSS/JS plano o el framework que se elija, pero vive en la carpeta de assets, no en el core.

## Migración desde Node.js (si se hubiera elegido)

Si en algún momento se necesita migrar código Node.js a Bare, la documentación oficial de Holepunch cubre el proceso de port. El código TypeScript es portable; los cambios son principalmente en la capa de módulos (Bare tiene su propia librería estándar opt-in).

## Limitaciones del soporte de TypeScript en Bare

Bare v1.30.0 añadió soporte de TypeScript, pero **no es un transpilador completo**. Usa `bare-type-stripper`, un lexer heurístico que elimina la sintaxis de TypeScript y produce JavaScript plano [citation:1][citation:7]. Ese stripper funciona por eliminación léxica, no por análisis semántico, así que algunas construcciones no se pueden eliminar sin cambiar el comportamiento en runtime.

### Lo que se elimina correctamente

- `import type { Foo } from 'mod'` — se elimina entero.
- `interface`, `type`, anotaciones de tipo simples (`const x: string = ...`).
- Genéricos en call sites (`foo<number>()`), type assertions (`x as Foo`, `x satisfies Foo`).
- Modificadores de clase (`public`, `private`, `readonly`), `implements`.

### Lo que falla en runtime

- **`import { Foo }` sin `type` cuando `Foo` es solo un tipo.** El stripper no sabe si `Foo` es un tipo o un valor, lo deja como está, y en runtime se intenta resolver como módulo y falla. **Regla: usar siempre `import type` para tipos importados.**
- **`enum` / `const enum`.** Emiten un objeto en runtime que el stripper no puede eliminar. Lanza `SyntaxError`.
- **`namespace` / `module` con cuerpo.** Emiten código en runtime. Lanza `SyntaxError`.
- **Parameter properties** (`constructor(public x: number)`). Implican una asignación `this.x = x` que el stripper perdería. Lanza `SyntaxError`.
- **Type assertions con angle brackets** (`<Foo>expr`). Indistinguibles de JSX. Lanza `SyntaxError`.

### Reglas prácticas para BookmarkNet

- Siempre `import type` para tipos. Nunca `import { SomeType }` si es solo un tipo.
- Evitar `enum` y `namespace`. Usar `const` objects con `as const` y tipo derivado.
- Evitar parameter properties en clases.
- Las anotaciones de tipo simples (`const x: string = ...`) son seguras. El problema no es la anotación en sí, sino que el tipo referenciado no se importe como `type`.

