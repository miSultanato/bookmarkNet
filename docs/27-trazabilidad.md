# Trazabilidad (MVP0)

Este documento relaciona cada funcionalidad con su especificación, su implementación en código, sus tests y su estado real. Es la referencia para saber qué existe y qué es solo diseño.

| Funcionalidad | Documentación | Código | Tests | Estado |
|---|---|---|---|---|
| Identidad (claves, firma) | `docs/03-identidad.md`, `docs/16-identificadores-y-firmas.md` | `src/identity.ts` | `test/identity.test.ts` | Implementado |
| Export/Import de identidad | `docs/03-identidad.md`, `docs/07-api-local.md` | `src/identity/export.ts`, `src/api/identity.ts` | `test/identity-export.test.ts`, `test/identity-api.test.ts` | Implementado |
| Recuperación de identidad por frase BIP39 | `docs/14-adrs.md` (ADR-019), `docs/07-api-local.md` | `src/identity/recovery.ts`, `src/api/identity.ts`, `src/identity/store.ts` | `test/identity-recovery.test.ts`, `test/identity-recovery-api.test.ts` | Implementado (MVP1) |
| Identificadores (ULID, IDs) | `docs/16-identificadores-y-firmas.md` | `src/ids.ts`, `src/ulid.ts` | `test/ids.test.ts`, `test/ulid.test.ts` | Implementado |
| Canonicalización de URL | `docs/04-canonicalizacion-url.md` | `src/canonicalize.ts` | `test/canonicalize.test.ts` | Implementado |
| Eventos de dispositivo | `docs/03-identidad.md` | `src/device-events.ts` | `test/device-events.test.ts` | Implementado |
| Fold de dispositivo | `docs/03-identidad.md` | `src/device-fold.ts` | `test/device-fold.test.ts` | Implementado |
| Eventos de colección | `docs/15-schema-eventos.md` | `src/events.ts` | `test/events.test.ts` | Implementado (modelo) |
| Fold de colección | `docs/15-schema-eventos.md` | `src/fold.ts` | `test/fold.test.ts` | Implementado (modelo) |
| Derivación de claves de colección | `docs/05-arquitectura-p2p.md`, `docs/16-identificadores-y-firmas.md` | `src/keys.ts` | `test/keys.test.ts` | Implementado |
| Almacenamiento (Hypercore) | `docs/05-arquitectura-p2p.md` | `src/storage/device-core.ts` | `test/device-core.test.ts` | Implementado |
| Persistencia de `collection_core` | `docs/05-arquitectura-p2p.md`, `docs/15-schema-eventos.md` | `src/storage/collection-core.ts` | `test/collection-core-e2e.test.ts`, `test/start.test.ts` | Implementado (MVP1; creación y génesis. La escritura de cambios posteriores y la replicación son MVP2) |
| Vista materializada de `collection_core` | `docs/14-adrs.md` (ADR-016), `docs/23-migraciones.md` | `src/storage/materialized-view.ts`, `src/node/start.ts`, `src/api/collections.ts`, `src/api/import.ts` | `test/collection-core-e2e.test.ts`, `test/start.test.ts` | Implementado (MVP1) |
| Persistencia de `node_id` | ADR-014 (`docs/14-adrs.md`) | `src/node/node-id.ts` | `test/start.test.ts` | Implementado (MVP1) |
| Derivación de clave de `device_core` | ADR-014 (`docs/14-adrs.md`), `docs/03-identidad.md` | — | — | Pendiente (MVP2) |
| API local (HTTP) | `docs/07-api-local.md` | `src/api/server.ts`, `src/api/*.ts` | `test/api.test.ts`, `test/*-api.test.ts` | Implementado |
| Backup manual (POST /backup) | ADR-019 (`docs/14-adrs.md`) | `src/backup/backup.ts`, `src/api/server.ts` | `test/backup-api.test.ts` | Implementado (MVP1) |
| Backup automático | ADR-019 (`docs/14-adrs.md`) | `src/backup/backup.ts`, `src/node/start.ts`, `src/node/config.ts` | `test/start.test.ts` | Implementado (MVP1) |
| Búsqueda local | `docs/07-api-local.md` | `src/api/search.ts` | `test/search-api.test.ts` | Implementado |
| Importación HTML | `docs/19-onboarding.md` | `src/import/netscape.ts`, `src/api/import.ts` | `test/netscape.test.ts`, `test/import-api.test.ts` | Implementado |
| Configuración | `docs/22-configuracion.md` | `src/node/config.ts` | `test/config.test.ts` | Implementado |
| UI Web (pantallas) | `docs/13-ui-ux.md`, `docs/24-ui-vision.md` | `src/ui/*.js`, `src/ui/style.css` | `test/ui.test.ts` | Implementado |
| Empaquetado (AppImage/Docker) | `docs/21-distribucion.md` | `Dockerfile`, `.github/workflows/release.yml`, `.github/workflows/docker-publish.yml` | — | Implementado |
| CI (tests en push) | — | `.github/workflows/ci.yml` | — | Implementado |
| Replicación P2P (`bmn://`) | `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md` | — | — | Pendiente (MVP2) |
| Publicación / Escritura dual | `docs/05-arquitectura-p2p.md` | — | — | Pendiente (MVP2) |
| Multidispositivo (añadir dispositivo, replicar entre dispositivos propios) | `docs/03-identidad.md`, `docs/09-roadmap-mvp.md` | — | — | Pendiente (MVP2) |
| Seguir colección por enlace | `docs/05-arquitectura-p2p.md`, `docs/09-roadmap-mvp.md` | — | — | Pendiente (MVP2) |
| Duplicar colección | `docs/02-modelo-datos.md`, `docs/15-schema-eventos.md` | — | — | Pendiente (MVP2) |
| Búsqueda multilingüe | `docs/25-busqueda-i18n.md` | — | — | Pendiente (MVP3+) |
| Seed pack | `docs/18-seed-pack.md`, `docs/19-onboarding.md` | — | — | Pendiente (MVP4) |

Las filas marcadas como "Implementado (modelo)" tienen los tipos, constructores y fold, pero no persistencia ni red (ver `docs/15-schema-eventos.md`). En MVP1 están implementadas la persistencia local de `collection_core` (creación y génesis), las vistas materializadas Hyperbee de `device_core` y de cada `collection_core`, y la persistencia de `node_id`. La vista de cada `collection_core` se reconstruye desde su propio log y contiene el génesis y los bookmarks/grupos iniciales; no proyecta los cambios posteriores de `device_core`. Estos cambios siguen escribiéndose solo en `device_core`; la escritura dual, la publicación y la replicación corresponden a MVP2. Las filas marcadas como «Pendiente (MVP2)» incluyen también multidispositivo, seguir, duplicar y derivación de la clave de `device_core`.

> Esta matriz debe actualizarse cuando se incorporen funcionalidades nuevas.
