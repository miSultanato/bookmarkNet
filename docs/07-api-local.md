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
```

## Grupos

```http
GET    /groups
POST   /groups                      # {name}
PATCH  /groups/:id
DELETE /groups/:id
POST   /groups/:id/move             # {bookmark_id}
```

## Colecciones

```http
GET    /collections                 # ?visibility=&owner=
POST   /collections                 # {name, description?}
GET    /collections/:id
PATCH  /collections/:id
DELETE /collections/:id
POST   /collections/:id/publish
POST   /collections/:id/duplicate   # → nueva colección
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

## Convenciones

- JSON en request y response.
- Errores: `{error: {code, message}}`.
- La API es local; sin autenticación en el MVP. En el futuro, token local generado en la primera ejecución.
