# API local

Toda operación pasa por una API local en \`localhost\`. La Web UI y la extensión usan exactamente la misma API.

## Base

\`http://localhost:<port>/api/v1\`

## Identidad

\`\`\`http
GET  /identity
POST /identity/create
POST /identity/import        # multipart: identity.bmn + password
POST /identity/export        # body: {password} → identity.bmn
POST /identity/device/add    # → {qr, code}
POST /identity/device/join   # body: {code}
GET  /identity/devices
\`\`\`

## Bookmarks

\`\`\`http
GET    /bookmarks                   # ?collection_id=&q=&tag=&inbox=true
POST   /bookmarks                   # {url, title?, description?, tags?, collection_id?}
GET    /bookmarks/:id
PATCH  /bookmarks/:id               # {title?, description?, tags?, notes?}
DELETE /bookmarks/:id
POST   /bookmarks/:id/reorder       # {group_id, position}
POST   /bookmarks/:id/move          # {collection_id?, group_id?}
\`\`\`

\`POST /bookmarks\` acepta \`collection_id\` opcional. Si no se pasa o es \`null\`, el bookmark va al Inbox global (\`collectionId: null\`). En ese caso, \`group_id\` debe ser \`null\`: el Inbox global no tiene grupos.

\`GET /bookmarks?inbox=true\` devuelve solo los bookmarks con \`collectionId: null\` (Inbox global).

\`POST /bookmarks/:id/move\` mueve el bookmark a otra colección, a otro grupo o al Inbox global. Si \`collection_id\` es \`null\`, \`group_id\` debe ser \`null\`. Devuelve \`200\` con el bookmark actualizado.

\`POST /bookmarks/:id/reorder\` genera un evento local \`device_reorder_bookmark\`.

## Grupos

\`\`\`http
GET    /groups                      # ?collection_id=
POST   /groups                      # {name, collection_id}
DELETE /groups/:id
POST   /groups/:id/move             # {bookmark_id} → 200 con el bookmark actualizado
\`\`\`

- \`POST /groups\` requiere \`{ name, collection_id }\`. El grupo pertenece a esa colección.
- \`GET /groups\` acepta \`?collection_id=\` (opcional). Si no se pasa, devuelve todos los grupos no eliminados.
- \`POST /groups/:id/move\` mueve al grupo \`:id\` únicamente bookmarks que ya pertenecen a la misma colección que ese grupo; devuelve \`200\` con el bookmark actualizado (\`group_id\` nuevo, \`position: null\`). Para mover un bookmark del Inbox global a un grupo, usa \`POST /bookmarks/:id/move\` con \`{ collection_id, group_id }\`.

**Nota:** en MVP los grupos no se renombran. Para cambiar el nombre, eliminar el grupo (sus bookmarks vuelven a la raíz de su colección, con \`group_id: null\`; no al Inbox global) y crear uno nuevo. El schema de eventos (doc 15) no define un evento \`update_group\`.

## Colecciones

\`\`\`http
GET    /collections                 # ?visibility=&owner= (respuesta incluye language)
POST   /collections                 # {name, description?, visibility?, language?}
GET    /collections/:id             # respuesta incluye language
PATCH  /collections/:id             # {name?, description?, visibility?, language?}
DELETE /collections/:id
POST   /collections/:id/publish
POST   /collections/:id/duplicate   # {name?, description?} → nueva colección con \`forked_from: <collection_id>\` en el génesis
POST   /collections/:id/follow      # {enlace_bmn}
POST   /collections/:id/unfollow
GET    /collections/:id/status      # {peers, last_sync, state}
\`\`\`

\`language\` es opcional en \`POST /collections\`; por defecto es \`'es'\`. Valores permitidos: \`es\` (español), \`en\` (inglés) y \`eu\` (euskera). Las respuestas de \`GET /collections\` y \`GET /collections/:id\` incluyen \`language\`.

El campo \`language\` indica el idioma principal de la colección. Se usa para la búsqueda multilingüe (ver [docs/25-busqueda-i18n.md](25-busqueda-i18n.md)) y para mostrar un badge de idioma en la UI.

**Nota:** \`POST /collections\` crea un borrador local en
el \`device_core\` mediante un evento \`device_create_collection\`. NO genera
\`collection_genesis\`. El \`collection_genesis\` se crea al publicar la colección
(creación del \`collection_core\`, MVP1+). Ver
[docs/02-modelo-datos.md](02-modelo-datos.md).

## Descubrimiento

\`\`\`http
GET /discover/featured
GET /discover/trending
GET /discover/most_duplicated
GET /discover/new
GET /discover/search                 # ?q=
\`\`\`

## Búsqueda local

\`\`\`http
GET /api/v1/search?q=<texto>
\`\`\`

Requiere una identidad local. Si no hay identidad, devuelve \`401 NO_IDENTITY\`.
Si \`q\` está ausente, vacío o contiene solo espacios, devuelve
\`400 INVALID_QUERY\`.

La búsqueda es literal, por substring y sin distinguir mayúsculas/minúsculas.
Busca en el estado local del nodo:

- **Colecciones:** nombre y descripción.
- **Grupos:** nombre.
- **Bookmarks:** título, descripción, tags y \`canonical_url\`.

Se excluyen colecciones, grupos y bookmarks eliminados. No se buscan tags como
categoría independiente y el endpoint no admite un parámetro \`type\`.

**Respuesta:**

\`\`\`json
{
  "collections": [
    {
      "collection_id": "...",
      "name": "...",
      "description": "...",
      "bookmarks_count": 12
    }
  ],
  "groups": [
    {
      "group_id": "...",
      "collection_id": "...",
      "name": "...",
      "bookmarks_count": 5
    }
  ],
  "bookmarks": [
    {
      "bookmark_id": "...",
      "title": "...",
      "url": "...",
      "collection_id": "...",
      "group_id": "..."
    }
  ]
}
\`\`\`

**Orden y límite de resultados:**

- Colecciones y grupos: \`bookmarks_count\` descendente.
- Bookmarks: fecha de creación descendente.
- Máximo de 50 resultados por categoría.

## Correspondencia API ↔ eventos

En MVP0, las operaciones que modifican el estado local generan eventos
\`device_*\` del modelo \`device_core\`:

| Endpoint | Evento generado en MVP0 |
|---|---|
| \`PATCH /profile\` | \`device_metadata\` |
| \`POST /collections\` | \`device_create_collection\` |
| \`PATCH /collections/:id\` | \`device_update_collection\` |
| \`DELETE /collections/:id\` | \`device_delete_collection\` |
| \`POST /bookmarks\` | \`device_add_bookmark\` |
| \`PATCH /bookmarks/:id\` | \`device_edit_bookmark\` |
| \`DELETE /bookmarks/:id\` | \`device_remove_bookmark\` |
| \`POST /bookmarks/:id/move\` | \`device_move_bookmark\` |
| \`POST /groups/:id/move\` | \`device_move_bookmark\` |
| \`POST /bookmarks/:id/reorder\` | \`device_reorder_bookmark\` |
| \`POST /groups\` | \`device_create_group\` |
| \`DELETE /groups/:id\` | \`device_delete_group\` |

La publicación y duplicación de colecciones mediante \`collection_genesis\`
pertenecen al modelo \`collection_core\` (MVP1+); no forman parte del flujo
de escritura local implementado en MVP0.

Las operaciones de lectura (GET) no escriben eventos.

## Convenciones

- JSON en request y response.
- Errores: \`{error: {code, message}}\`.
- La API es local y no utiliza tokens HTTP de autenticación. Las operaciones que requieren identidad comprueban que exista una identidad local.

**Seguridad:** la API local valida el header \`Host\` contra \`allowed_hosts\` (por defecto \`localhost\`, \`127.0.0.1\`, \`[::1]\`). Para acceso desde la LAN (ej. NAS), añadir la IP del NAS a \`allowed_hosts\`. Ver docs/22-configuracion.md.

**Content-Type:** las peticiones \`POST\`, \`PUT\` y \`PATCH\` deben incluir \`Content-Type: application/json\`. Las peticiones \`DELETE\` no requieren \`Content-Type\` (no tienen body), pero sí validan \`Origin\`.

## Escritura de eventos

En MVP0, el flujo de escritura es:

1. Validar la petición.
2. Construir el evento con el constructor correspondiente de \`src/device-events.ts\` (modelo del \`device_core\`).
3. \`await node.apply(event)\`: escribe el evento en el \`device_core\` y actualiza el estado en memoria con \`applyDeviceEvent\`.
4. Devolver la respuesta.

\`node.apply(event)\` es el único punto de escritura del nodo. Primero persiste
el evento mediante \`appendEvent\` y, solo si la escritura tiene éxito, actualiza
el estado en memoria mediante \`applyDeviceEvent\`. Si falla la persistencia,
el estado en memoria no se actualiza.

**Importante:** \`src/events.ts\` y \`src/fold.ts\` implementan el modelo del
\`collection_core\` (MVP1+). No se usan en MVP0. No mezcles ambos modelos.
