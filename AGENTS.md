# AGENTS.md

Contexto para agentes de código que trabajen en este repositorio.

## El proyecto
Lotura (nombre técnico: BookmarkNet) es una aplicación local-first de marcadores y colecciones. El repositorio conserva la implementación, decisiones y roadmap del producto. No depende de Cognitive Systems ni de UAME.

## Antes de trabajar
- Lee este archivo, `README.md`, `docs/09-roadmap-mvp.md`, `docs/14-adrs.md` y la documentación de los módulos afectados.
- Comprueba rama, `git status`, commits recientes y estado de CI.
- Mantén cada tarea acotada; revisa los archivos afectados, ejecuta tests y `git diff --check` antes de cerrar.
- No afirmes resultados de tests/builds que no se hayan ejecutado realmente.
- El usuario prefiere cambios pequeños, pruebas unitarias/integración y commits atómicos; respeta el alcance solicitado.

## Comandos
- `npm test`: ejecuta `brittle-bare test/**/*.test.ts`.
- `npm run generate:assets`: genera `src/ui/assets.generated.js`.
- `npm run build`: genera el binario standalone.
- `bare src/main.ts`: arranca el nodo local.
- `npm run dev`: generación de assets + arranque.

## Reglas del runtime Bare
Bare ejecuta TypeScript directamente con `bare-type-stripper`; no es un transpilador completo:
- Usa siempre `import type` para tipos importados.
- Evita `enum`, `namespace` y parameter properties.
- Consulta `docs/20-stack-tecnico.md` para los detalles.

## Reglas de UI
- `src/ui/*.js` es JavaScript plano, no TypeScript.
- Regenera assets con `npm run generate:assets` antes de probar cambios visuales.
- `src/ui/assets.generated.js` está ignorado; no lo commits.
- Respeta Topbar + Sidebar + main con scroll propio y el arranque temprano de UI.

## Arquitectura
- `src/device-events.ts` y `src/device-fold.ts`: modelo `device_core` (MVP0).
- `src/events.ts` y `src/fold.ts`: modelo `collection_core` (MVP1+).
- `src/api/*`: handlers HTTP puros; devuelven `{ status, body }` y no mutan estado.
- `src/node/start.ts`: arranque del nodo y aplicación/persistencia de eventos.
- No mezcles responsabilidades de `device_core` y `collection_core`.

## Estado y roadmap
- El README raíz y [docs/09-roadmap-mvp.md](docs/09-roadmap-mvp.md) son las referencias para el estado del producto.
- La documentación del repositorio describe MVP1 como completado; MVP2 trata publicación y replicación. No anticipes dual-write, publicación ni replicación dentro del alcance MVP1.
- La suite, build y validación de empaquetados deben verificarse en el entorno real; no uses cifras antiguas como resultado actual.

## Límites
- No edites `package-lock.json` a mano; usa npm.
- No commitees `build/` ni `src/ui/assets.generated.js`.
- No modifiques `src/main.ts` sin entender 503 NOT_READY y el cierre con `pear-gracedown`.
- No añadas IA, comentarios, likes, karma ni funcionalidades sociales: no forman parte del producto.
- Para contexto profundo, lee los documentos propietarios en `docs/`; no dupliques aquí su contenido.

## Flujo transversal de implementación y auditoría

Este repositorio aplica el [protocolo transversal](https://github.com/miSultanato/cognitive-systems/blob/docs/independent-audit-workflow/docs/independent-development-and-audit.md): ChatGPT planifica e implementa; Pi en NEO audita independientemente el SHA exacto e intenta refutar la corrección sin modificar la implementación. Los hallazgos deben aportar evidencia reproducible. Cualquier cambio posterior al SHA auditado requiere reauditoría. Distingue diseño, implementación, tests escritos, tests ejecutados, CI y validación real. El usuario conserva la aceptación final y el merge requiere autorización explícita.

## Coordinación entre repositorios
- Índice global: [Cognitive Systems — PROJECTS.md](https://github.com/miSultanato/cognitive-systems/blob/main/PROJECTS.md).
- BookmarkNet/Lotura es independiente: no existe dependencia funcional de UAME, PMOS, Ollama Agent ni Cognitive Systems.
- Si una investigación transversal resulta útil, enlázala y registra la decisión aquí solo si afecta realmente a la arquitectura del producto. No importes contratos ni componentes por similitud conceptual.
