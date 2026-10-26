# API local

Toda operación pasa por una API local en `localhost`. La Web UI y la extensión usan exactamente la misma API.

## Base

`http://localhost:<port>/api/v1`

## Identidad

```http
GET  /identity
POST /identity/create
POST /identity/import        # multipart: identity.bmn + password
POST /identity/export        # body: {password} → identity.bmn
POST /identity/device/add    # → {qr, code}
POST /identity/device/join   # body: {code}
GET  /identity/devices
```

## Bookmarks

```http
GET    /bookmarks                   # ?collection_id=&q=&tag=&inbox=true
POST   /bookmarks                   # {url, title?, description?, tags?, collection_id?}
GET    /bookmarks/:id
PATCH  /bookmarks/:id               # {title?, description?, tags?, notes?}
DELETE /bookmarks/:id
POST   /bookmarks/:id/reorder       # {group_id, position}
POST   /bookmarks/:id/move          # {collection_id?, group_id?}
```

`POST /bookmarks` acepta `collection_id` opcional. Si no se pasa o es `null`, el bookmark va al Inbox global (`collectionId: null`). En ese caso, `group_id` debe ser `null`: el Inbox global no tiene grupos.

`GET /bookmarks?inbox=true` devuelve solo los bookmarks con `collectionId: null` (Inbox global).

`POST /bookmarks/:id/move` mueve el bookmark a otra colección, a otro grupo o al Inbox global. Si `collection_id` es `null`, `group_id` debe ser `null`. Devuelve `200` con el bookmark actualizado.

`POST /bookmarks/:id/reorder` genera un evento `reorder_bookmark`.

## Grupos

```http
GET    /groups                      # ?collection_id=
POST   /groups                      # {name, collection_id}
DELETE /groups/:id
POST   /groups/:id/move             # {bookmark_id} → 200 con el bookmark actualizado
```

- `POST /groups` requiere `{ name, collection_id }`. El grupo pertenece a esa colección.
- `GET /groups` acepta `?collection_id=` (opcional). Si no se pasa, devuelve todos los grupos no eliminados.
- `POST /groups/:id/move` mueve al grupo `:id` únicamente bookmarks que ya pertenecen a la misma colección que ese grupo; devuelve `200` con el bookmark actualizado (`group_id` nuevo, `position: null`). Para mover un bookmark del Inbox global a un grupo, usa `POST /bookmarks/:id/move` con `{ collection_id, group_id }`.

**Nota:** en MVP los grupos no se renombran. Para cambiar el nombre, eliminar el grupo (sus bookmarks vuelven a la raíz de su colección, con `group_id: null`; no al Inbox global) y crear uno nuevo. El schema de eventos (doc 15) no define un evento `update_group`.

## Colecciones

```http
GET    /collections                 # ?visibility=&owner= (respuesta incluye language)
POST   /collections                 # {name, description?, visibility?, language?}
GET    /collections/:id             # respuesta incluye language
PATCH  /collections/:id             # {name?, description?, visibility?, language?}
DELETE /collections/:id
POST   /collections/:id/publish
POST   /collections/:id/duplicate   # {name?, description?} → nueva colección con `forked_from: <collection_id>` en el génesis
POST   /collections/:id/follow      # {enlace_bmn}
POST   /collections/:id/unfollow
GET    /collections/:id/status      # {peers, last_sync, state}
```

`language` es opcional en `POST /collections`; por defecto es `'es'`. Valores permitidos: `es` (español), `en` (inglés) y `eu` (euskera). Las respuestas de `GET /collections` y `GET /collections/:id` incluyen `language`.

El campo `language` indica el idioma principal de la colección. Se usa para la búsqueda multilingüe (ver [docs/25-busqueda-i18n.md](25-busqueda-i18n.md)) y para mostrar un badge de idioma en la UI.

**Nota:** `POST /collections` crea un borrador local en
el `device_core`. NO genera `collection_genesis` todavía.
El `collection_genesis` se crea al publicar la colección
(creación del `collection_core`). Ver
[docs/02-modelo-datos.md](02-modelo-datos.md).

## Descubrimiento

```http
GET /discover/featured
GET /discover/trending
GET /discover/most_duplicated
GET /discover/new
GET /discover/search                 # ?q=
```

## Búsqueda local

```http
GET /search?q=<texto>&type=<bookmark|collection|tag>
```

Búsqueda literal, sin IA, sin NLP. Substring, case-insensitive.

**Campos que se buscan:**

- Bookmarks: título, descripción, tags, URL.
- Colecciones: nombre, descripción.
- Tags: el propio tag.

**Alcance:** todo lo que el nodo tiene localmente (colecciones propias + seguidas + seed pack).

**Respuesta:**

```json
{
  "collections": [
    {
      "collection_id": "...",
      "title": "...",
      "description": "...",
      "bookmarks_matching": 23
    }
  ],
  "bookmarks": [
    {
      "bookmark_id": "...",
      "title": "...",
      "url": "...",
      "collection_count": 142,
      "collection_id": "..."
    }
  ],
  "tags": ["..."]
}
```

**Orden de resultados:**

1. Colecciones primero (ordenadas por `bookmarks_matching` descendente).
2. Bookmarks después (ordenados por `collection_count` descendente).
3. Tags al final.

**Filtro por tipo:** si `type` está presente, solo se devuelve ese tipo. Si no, se devuelven los tres.

**Nota sobre `collection_count`:** es el número de colecciones que el nodo tiene localmente que contienen ese resource. No es una cifra global. La UI debe mostrarlo como "en tu red" o "que conoces".

## Correspondencia API ↔ eventos

| Endpoint | Evento generado |
|---|---|
| `POST /collections` | Ninguno (borrador local en `device_core`) |
| `POST /collections/:id/publish` | `collection_genesis` (en el `collection_core`) |
| `POST /bookmarks` | `add_bookmark` |
| `PATCH /bookmarks/:id` | `edit_bookmark` |
| `DELETE /bookmarks/:id` | `remove_bookmark` |
| `POST /groups/:id/move` | `move_bookmark` |
| `POST /bookmarks/:id/reorder` | `reorder_bookmark` |
| `POST /bookmarks/:id/move` | `device_move_bookmark` |
| `PATCH /collections/:id` | `update_metadata` |
| `POST /groups` | `create_group` |
| `DELETE /groups/:id` | `delete_group` |
| `POST /collections/:id/duplicate` | `collection_genesis` (con `forked_from`) |

Ninguna otra operación de la API genera eventos. Las operaciones de lectura (GET), identidad, export/import y device no escriben en el log de colecciones.

## Convenciones

- JSON en request y response.
- Errores: `{error: {code, message}}`.
- La API es local; sin autenticación en el MVP. En el futuro, token local generado en la primera ejecución.

**Seguridad:** la API local valida el header `Host` contra `allowed_hosts` (por defecto `localhost`, `127.0.0.1`, `[::1]`). Para acceso desde la LAN (ej. NAS), añadir la IP del NAS a `allowed_hosts`. Ver docs/22-configuracion.md.

**Content-Type:** las peticiones `POST`, `PUT` y `PATCH` deben incluir `Content-Type: application/json`. Las peticiones `DELETE` no requieren `Content-Type` (no tienen body), pero sí validan `Origin`.

## Escritura de eventos

Cada endpoint que muta estado (bookmarks, grupos, colecciones) sigue este flujo:

1. Validar la petición.
2. Construir el evento con el constructor de `src/events.ts`.
3. `await node.apply(event)` — escribe en el `device_core` y actualiza el estado en memoria.
4. Devolver la respuesta.

`node.apply(event)` es el único punto de escritura. Encapsula `appendEvent(core, event)` y `applyEvent(state, event)`. Es async: primero escribe en el `device_core` y, solo si eso va bien, actualiza `state`. Si `appendEvent` falla, el estado no se actualiza. El estado de `Node` es inmutable desde fuera; solo `apply` lo cambia.

Este flujo es el mismo para todos los endpoints de mutación. Las operaciones de lectura (GET) no escriben en el log.
