# API local

Toda operación pasa por una API local en \`localhost\`. La Web UI y la extensión usan exactamente la misma API.

## Base

\`http://localhost:<port>/api/v1\`

## Identidad

\`\`\`http
GET  /identity
POST /identity/create
POST /identity/import        # JSON: {identity_blob, password}
POST /identity/export        # JSON: {password} → objeto identity_blob
POST /identity/recovery/generate # → {phrase, words} (24 palabras BIP39)
POST /identity/recovery/validate # JSON: {phrase} → {valid}
POST /identity/recovery/import   # JSON: {phrase, profile?} → identidad restaurada
POST /identity/device/add    # → {qr, code}
POST /identity/device/join   # body: {code}
GET  /identity/devices
\`\`\`


**Exportar identidad — `POST /identity/export`:** recibe un body JSON `{ "password": "..." }` y devuelve el objeto de exportación directamente como JSON, con `Content-Type: application/json; charset=utf-8`. No descarga un archivo `identity.bmn`. El objeto contiene `version`, `salt`, `nonce`, los parámetros de Argon2 (`opslimit`, `memlimit`, `alg`) y `ciphertext`.

**Recuperación de identidad — frase BIP39 de 24 palabras:**

- `POST /identity/recovery/generate` no genera una clave nueva: convierte el `user_master_key` existente (32 bytes) a una frase BIP39 de 24 palabras. La misma identidad produce siempre la misma frase.
- `POST /identity/recovery/validate` recibe `{ "phrase": "..." }` y devuelve `{ "valid": boolean }`.
- `POST /identity/recovery/import` recibe `{ "phrase": "...", "profile": {} }` (el perfil es opcional), valida el checksum y crea `identity.bmn` si todavía no existe. Devuelve `201`; si ya existe una identidad, devuelve `409`.
- Las 24 palabras codifican los 256 bits de `user_master_key` y 8 bits de checksum. La frase recupera solo la identidad portable, no los datos locales ni `node_id`. QR no está implementado.

**Importar identidad — `POST /identity/import`:** recibe `Content-Type: application/json` y un body con `identity_blob` (el objeto devuelto por export) y `password`. No utiliza multipart ni recibe un archivo separado. Ejemplo de estructura:

```json
{
  "identity_blob": {
    "version": 1,
    "salt": "...",
    "nonce": "...",
    "opslimit": 2,
    "memlimit": 67108864,
    "alg": 2,
    "ciphertext": "..."
  },
  "password": "..."
}
```

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

**Nota:** \`POST /collections\` crea la colección local en el \`device_core\`
mediante un evento \`device_create_collection\`. En MVP1, ese mismo flujo crea
también su \`collection_core\` e inicializa el log con \`collection_genesis\` y
\`visibility: "unlisted"\` mientras la colección no esté publicada. Publicar no
crea el core: en MVP2 se anuncia su topic y se habilitan la escritura dual y la
replicación. Ver ADR-015 en [docs/14-adrs.md](14-adrs.md) y
[docs/05-arquitectura-p2p.md](05-arquitectura-p2p.md).

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

La creación del \`collection_core\` y su \`collection_genesis\` pertenece a MVP1:
se produce al crear la colección en \`device_core\`, dentro del flujo
\`device_create_collection\`, con \`visibility: "unlisted"\` (ADR-015). La
publicación, la duplicación y la escritura dual son capacidades de MVP2; no
forman parte del flujo de escritura local implementado en MVP0.

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
\`collection_core\` (MVP1). No se usan en MVP0. No mezcles ambos modelos.

## Estado de implementación por endpoint

La tabla distingue el estado implementado en el código de la fase prevista para cada endpoint. La matriz de referencia es [docs/27-trazabilidad.md](27-trazabilidad.md); las funcionalidades aún no implementadas se clasifican según esa matriz y el roadmap.

| Método | Ruta | Estado | Fase | Notas |
|---|---|---|---|---|
| GET | `/api/v1/node/id` | implementado | MVP1 | Devuelve el `node_id` persistido del dispositivo local (ADR-017). |
| GET | `/api/v1/identity` | implementado | MVP0 | Consulta la identidad local. |
| POST | `/api/v1/identity/create` | implementado | MVP0 | Creación de identidad local. |
| POST | `/api/v1/identity/import` | implementado | MVP0 | Importación JSON cifrada; funcionalidad Export/Import de identidad de docs/27. |
| POST | `/api/v1/identity/export` | implementado | MVP0 | Exportación JSON cifrada; funcionalidad Export/Import de identidad de docs/27. |
| POST | `/api/v1/identity/recovery/generate` | implementado | MVP1 | Codifica el `user_master_key` existente en 24 palabras BIP39. |
| POST | `/api/v1/identity/recovery/validate` | implementado | MVP1 | Valida las 24 palabras y el checksum BIP39. |
| POST | `/api/v1/identity/recovery/import` | implementado | MVP1 | Restaura la identidad portable sin sobrescribir una identidad existente. |
| POST | `/api/v1/identity/device/add` | futuro | MVP2 | Corresponde a «Multidispositivo (añadir dispositivo, replicar entre dispositivos propios)» de docs/27. |
| POST | `/api/v1/identity/device/join` | futuro | MVP2 | Corresponde a «Multidispositivo (añadir dispositivo, replicar entre dispositivos propios)» de docs/27. |
| GET | `/api/v1/identity/devices` | futuro | MVP2 | Corresponde a «Multidispositivo (añadir dispositivo, replicar entre dispositivos propios)» de docs/27. |
| GET | `/api/v1/bookmarks` | implementado | MVP0 | Listado y filtros locales; API local de docs/27. |
| POST | `/api/v1/bookmarks` | implementado | MVP0 | Crea un bookmark en `device_core`. |
| GET | `/api/v1/bookmarks/:id` | implementado | MVP0 | Consulta un bookmark local. |
| PATCH | `/api/v1/bookmarks/:id` | implementado | MVP0 | Edita un bookmark mediante eventos de `device_core`. |
| DELETE | `/api/v1/bookmarks/:id` | implementado | MVP0 | Elimina un bookmark mediante eventos de `device_core`. |
| POST | `/api/v1/bookmarks/:id/reorder` | implementado | MVP0 | Reordena un bookmark mediante `device_reorder_bookmark`. |
| POST | `/api/v1/bookmarks/:id/move` | implementado | MVP0 | Mueve un bookmark entre Inbox, colecciones y grupos. |
| GET | `/api/v1/groups` | implementado | MVP0 | Listado local, opcionalmente filtrado por colección. |
| POST | `/api/v1/groups` | implementado | MVP0 | Crea un grupo mediante `device_create_group`. |
| DELETE | `/api/v1/groups/:id` | implementado | MVP0 | Elimina un grupo mediante `device_delete_group`. |
| POST | `/api/v1/groups/:id/move` | implementado | MVP0 | Mueve al grupo un bookmark de la misma colección. |
| GET | `/api/v1/collections` | implementado | MVP0 | Listado local de colecciones. |
| POST | `/api/v1/collections` | implementado | MVP0 | Crea la colección local en `device_core` y, en MVP1, su `collection_core` en el mismo flujo (`device_create_collection`), con génesis `visibility: "unlisted"` (ADR-015). No publica; el anuncio del topic corresponde a MVP2. |
| GET | `/api/v1/collections/:id` | implementado | MVP0 | Consulta una colección local. |
| PATCH | `/api/v1/collections/:id` | implementado | MVP0 | Actualiza una colección mediante `device_update_collection`. |
| DELETE | `/api/v1/collections/:id` | implementado | MVP0 | Elimina una colección mediante `device_delete_collection`. |
| POST | `/api/v1/collections/:id/publish` | futuro | MVP2 | Corresponde a «Publicación / Escritura dual» de docs/27, pendiente MVP2. |
| POST | `/api/v1/collections/:id/duplicate` | futuro | MVP2 | Corresponde a «Duplicar colección» de docs/27, pendiente MVP2. |
| POST | `/api/v1/collections/:id/follow` | futuro | MVP2 | Corresponde a «Seguir colección por enlace» de docs/27, pendiente MVP2. |
| POST | `/api/v1/collections/:id/unfollow` | futuro | MVP2 | Corresponde a «Seguir colección por enlace» de docs/27, pendiente MVP2. |
| GET | `/api/v1/collections/:id/status` | futuro | MVP2 | Corresponde a «Replicación P2P» de docs/27 y al estado de sincronización previsto en el roadmap MVP2. |
| GET | `/api/v1/discover/featured` | futuro | MVP3+ | Sin correspondencia directa en docs/27; la fase (MVP2 o MVP3+) queda pendiente de confirmar cuando se detalle el contrato de descubrimiento en `docs/06-descubrimiento.md`. |
| GET | `/api/v1/discover/trending` | futuro | MVP3+ | Sin correspondencia directa en docs/27; la fase (MVP2 o MVP3+) queda pendiente de confirmar cuando se detalle el contrato de descubrimiento en `docs/06-descubrimiento.md`. |
| GET | `/api/v1/discover/most_duplicated` | futuro | MVP3+ | Sin correspondencia directa en docs/27; la fase (MVP2 o MVP3+) queda pendiente de confirmar cuando se detalle el contrato de descubrimiento en `docs/06-descubrimiento.md`. |
| GET | `/api/v1/discover/new` | futuro | MVP3+ | Sin correspondencia directa en docs/27; la fase (MVP2 o MVP3+) queda pendiente de confirmar cuando se detalle el contrato de descubrimiento en `docs/06-descubrimiento.md`. |
| GET | `/api/v1/discover/search` | futuro | MVP3+ | Sin correspondencia directa en docs/27; la fase (MVP2 o MVP3+) queda pendiente de confirmar cuando se detalle el contrato de descubrimiento en `docs/06-descubrimiento.md`. |
| GET | `/api/v1/search` | implementado | MVP0 | Búsqueda local; funcionalidad Búsqueda local de docs/27. |
| PATCH | `/api/v1/profile` | implementado | MVP0 | Actualiza metadatos locales mediante `device_metadata`. |

**Resumen:** 38 endpoints: 25 implementados, 0 parciales y 13 futuros (8 de MVP2 y 5 de MVP3+). No se incluyen endpoints futuros de MVP1, como `POST /backup` o `POST /restore`.
