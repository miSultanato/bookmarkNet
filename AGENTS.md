# AGENTS.md

Contexto para agentes de código que trabajen en este repositorio.

## El proyecto

Lotura (nombre técnico: BookmarkNet) es un nodo local de bookmarks. MVP0 no tiene red P2P; todo vive en un `device_core` local de Hypercore. El stack es Bare + TypeScript, sin Node.js.

## Comandos

- `npm test`: ejecuta `brittle-bare test/**/*.test.ts`.
- `npm run generate:assets`: genera `src/ui/assets.generated.js` embebiendo HTML/CSS/JS.
- `npm run build`: genera el binario standalone en `build/lotura`.
- `bare src/main.ts`: arranca el nodo en local (puerto 7575).
- `npm run dev`: alias de `generate:assets` + `bare src/main.ts`.

## Reglas del runtime (Bare)

Bare ejecuta `.ts` directamente con `bare-type-stripper`, un lexer heurístico. **No es un transpilador completo**:

- Usa siempre `import type` para tipos importados. `import { Foo }` cuando `Foo` es solo un tipo rompe en runtime.
- Evita `enum`, `namespace` y parameter properties. Lanza `SyntaxError`.
- Detalles en `docs/20-stack-tecnico.md`.

## Reglas de la UI

- `src/ui/*.js` son JavaScript plano (módulos ES), ejecutados en el navegador. No son TypeScript.
- Los assets (HTML, CSS, JS, SVG) se embeben en `src/ui/assets.generated.js` mediante `npm run generate:assets`. **Regenera antes de probar cambios visuales.**
- `src/ui/assets.generated.js` está en `.gitignore`. No lo commitees.
- El layout es Topbar + Sidebar fijo + `main` con scroll propio. No rompas la estructura de `index.html`.

## Arquitectura

- `src/device-events.ts` y `src/device-fold.ts`: modelo del `device_core` (eventos `device_*`, fold a `DeviceState`). Es lo que usa MVP0.
- `src/events.ts` y `src/fold.ts`: modelo del `collection_core` (MVP1+). No se usan en MVP0.
- `src/api/*`: handlers HTTP puros. Devuelven `{ status, body }`. No mutan el estado; eso lo hace `node.apply(event)`.
- `src/node/start.ts`: arranque del nodo (`startNode`), `Node.apply` (persiste el evento y luego actualiza `state`).

## Límites

- No toques `package-lock.json` a mano. Usa `npm install` (lo hace el humano).
- No commitees `build/` ni `src/ui/assets.generated.js`.
- No modifiques `src/main.ts` sin entender el arranque temprano de la UI (503 NOT_READY) y el cierre con `pear-gracedown`.
- Para contexto profundo, lee `docs/` (24+ documentos). No dupliques su contenido aquí.