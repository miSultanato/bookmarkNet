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
GET    /bookmarks                   # ?collection_id=&q=&tag=
POST   /bookmarks                   # {url, title?, description?, tags?, collection_id?}
GET    /bookmarks/:id
PATCH  /bookmarks/:id               # {title?, description?, tags?, notes?}
DELETE /bookmarks/:id
POST   /bookmarks/:id/reorder       # {group_id, position}
```

Este endpoint genera un evento `reorder_bookmark`.

## Grupos

```http
GET    /groups
POST   /groups                      # {name}
DELETE /groups/:id
POST   /groups/:id/move             # {bookmark_id}
```

**Nota:** en MVP los grupos no se renombran. Para cambiar el nombre, eliminar el grupo (sus bookmarks vuelven a Inbox) y crear uno nuevo. El schema de eventos (doc 15) no define un evento `update_group`.

## Colecciones

```http
GET    /collections                 # ?visibility=&owner=
POST   /collections                 # {name, description?}
GET    /collections/:id
PATCH  /collections/:id
DELETE /collections/:id
POST   /collections/:id/publish
POST   /collections/:id/duplicate   # {name?, description?} → nueva colección con `forked_from: <collection_id>` en el génesis
POST   /collections/:id/follow      # {enlace_bmn}
POST   /collections/:id/unfollow
GET    /collections/:id/status      # {peers, last_sync, state}
```

## Descubrimiento

```http
GET /discover/featured
GET /discover/trending
GET /discover/most_duplicated
GET /discover/new
GET /discover/search                 # ?q=
```

## Búsqueda local

`GET /search?q=` → `{bookmarks, collections, tags}`

Sin búsqueda semántica, IA ni NLP.

## Correspondencia API ↔ eventos

| Endpoint | Evento generado |
|---|---|
| `POST /collections` | `collection_genesis` |
| `POST /bookmarks` | `add_bookmark` |
| `PATCH /bookmarks/:id` | `edit_bookmark` |
| `DELETE /bookmarks/:id` | `remove_bookmark` |
| `POST /groups/:id/move` | `move_bookmark` |
| `POST /bookmarks/:id/reorder` | `reorder_bookmark` |
| `PATCH /collections/:id` | `update_metadata` |
| `POST /groups` | `create_group` |
| `DELETE /groups/:id` | `delete_group` |
| `POST /collections/:id/duplicate` | `collection_genesis` (con `forked_from`) |

Ninguna otra operación de la API genera eventos. Las operaciones de lectura (GET), identidad, export/import y device no escriben en el log de colecciones.

## Convenciones

- JSON en request y response.
- Errores: `{error: {code, message}}`.
- La API es local; sin autenticación en el MVP. En el futuro, token local generado en la primera ejecución.
