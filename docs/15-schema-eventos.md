# Schema de eventos (v1)

Este documento define el contrato más importante del sistema: el
formato exacto de cada evento que se escribe en un Hypercore de
colección. Es append-only e inmutable. Cualquier cambio aquí
requiere versionado y migración.

## Principios

- Append-only. Los bloques no se reescriben.
- Replicamos eventos, no estados. El estado actual se obtiene
  haciendo fold del log.
- Cada bloque incluye `schema_version` desde el día 1.
- El log es autocontenido: la primera vez que aparece un resource
  en la colección, se embebe su URL canónica completa. Así la
  colección se puede replicar sin depender de ningún registry
  global.

## Estructura de un bloque

Cada bloque del Hypercore es un objeto JSON con esta forma:

```json
{
  "schema_version": 1,
  "event_id": "01J8XK...",
  "event_type": "add_bookmark",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T14:32:00Z",
  "payload": { ... }
}
