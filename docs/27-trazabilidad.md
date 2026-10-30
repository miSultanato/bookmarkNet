# Trazabilidad (MVP0)

Este documento relaciona cada funcionalidad con su especificación, su implementación en código, sus tests y su estado real. Es la referencia para saber qué existe y qué es solo diseño.

| Funcionalidad | Documentación | Código | Tests | Estado |
|---|---|---|---|---|
| Identidad (claves, firma) | `docs/03-identidad.md`, `docs/16-identificadores-y-firmas.md` | `src/identity.ts` | `test/identity.test.ts` | Implementado |
| Export/Import de identidad | `docs/03-identidad.md`, `docs/07-api-local.md` | `src/identity/export.ts`, `src/api/identity.ts` | `test/identity-export.test.ts`, `test/identity-api.test.ts` | Implementado |
| Identificadores (ULID, IDs) | `docs/16-identificadores-y-firmas.md` | `src/ids.ts`, `src/ulid.ts` | `test/ids.test.ts`, `test/ulid.test.ts` | Implementado |
| Canonicalización de URL | `docs/04-canonicalizacion-url.md` | `src/canonicalize.ts` | `test/canonicalize.test.ts` | Implementado |
| Eventos de dispositivo | `docs/03-identidad.md` | `src/device-events.ts` | `test/device-events.test.ts` | Implementado |
| Fold de dispositivo | `docs/03-identidad.md` | `src/device-fold.ts` | `test/device-fold.test.ts` | Implementado |
| Eventos de colección | `docs/15-schema-eventos.md` | `src/events.ts` | `test/events.test.ts` | Implementado (modelo) |
| Fold de colección | `docs/15-schema-eventos.md` | `src/fold.ts` | `test/fold.test.ts` | Implementado (modelo) |
| Derivación de claves de colección | `docs/05-arquitectura-p2p.md`, `docs/16-identificadores-y-firmas.md` | `src/keys.ts` | `test/keys.test.ts` | Implementado |
| Almacenamiento (Hypercore) | `docs/05-arquitectura-p2p.md` | `src/storage/device-core.ts` | `test/device-core.test.ts` | Implementado |
| API local (HTTP) | `docs/07-api-local.md` | `src/api/server.ts`, `src/api/*.ts` | `test/api.test.ts`, `test/*-api.test.ts` | Implementado |
| Búsqueda local | `docs/07-api-local.md` | `src/api/search.ts` | `test/search-api.test.ts` | Implementado |
| Importación HTML | `docs/19-onboarding.md` | `src/import/netscape.ts`, `src/api/import.ts` | `test/netscape.test.ts`, `test/import-api.test.ts` | Implementado |
| Configuración | `docs/22-configuracion.md` | `src/node/config.ts` | `test/config.test.ts` | Implementado |
| UI Web (pantallas) | `docs/13-ui-ux.md`, `docs/24-ui-vision.md` | `src/ui/*.js`, `src/ui/style.css` | `test/ui.test.ts` | Implementado |
| Empaquetado (AppImage/Docker) | `docs/21-distribucion.md` | `Dockerfile`, `.github/workflows/release.yml`, `.github/workflows/docker-publish.yml` | — | Implementado |
| CI (tests en push) | — | `.github/workflows/ci.yml` | — | Implementado |
| Replicación P2P (`bmn://`) | `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md` | — | — | Pendiente (MVP1+) |
| Publicación / Escritura dual | `docs/05-arquitectura-p2p.md` | — | — | Pendiente (MVP1+) |
| Multidispositivo / Seguir / Duplicar | `docs/05-arquitectura-p2p.md`, `docs/09-roadmap-mvp.md` | — | — | Pendiente (MVP1+) |
| Búsqueda multilingüe | `docs/25-busqueda-i18n.md` | — | — | Pendiente (MVP3+) |
| Seed pack | `docs/18-seed-pack.md`, `docs/19-onboarding.md` | — | — | Pendiente (MVP4) |

Las filas marcadas como "Implementado (modelo)" tienen los tipos, constructores y fold, pero no persistencia ni red (ver `docs/15-schema-eventos.md`).

> Esta matriz debe actualizarse cuando se incorporen funcionalidades nuevas.
