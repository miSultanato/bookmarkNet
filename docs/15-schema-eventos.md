# Schema de eventos (v1)

Este documento define el contrato más importante del sistema: el
formato exacto de cada evento que se escribe en un Hypercore de
colección. Es append-only e inmutable. Cualquier cambio aquí
requiere versionado y migración.

**Alcance:** este documento define el schema de los
eventos del `collection_core` (log público de una
colección publicada). Los eventos del `device_core`
(borradores locales) están definidos en
docs/03-identidad.md.

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
```

## Campos comunes

| Campo | Tipo | Descripción |
|---|---|---|
| `schema_version` | int | Versión del schema. Empieza en 1 |
| `event_id` | ULID | Único globalmente, ordenable por tiempo |
| `event_type` | string | Uno de los definidos abajo |
| `author_id` | string | Identifica al autor lógico del evento (el `owner_id` de la colección). NO es el firmante criptográfico de cada bloque. Los bloques los firma `collection_keypair` mediante Hypercore. Solo el bloque génesis lleva una firma adicional del usuario (`signature_by_owner`) |
| `created_at` | ISO8601 | Timestamp del autor. No es fuente de verdad para orden (el orden lo da el log) |
| `payload` | object | Depende del `event_type` |
**Nota sobre firmas:** todos los bloques del `collection_core`
(incluido el génesis) los firma `collection_keypair` mediante
Hypercore. El bloque génesis lleva además una firma del usuario
(`signature_by_owner`) sobre sus campos, que se verifica con
`author_public_key`. Los bloques 1..N no llevan
`signature_by_owner`.

Tipos de evento (v1)

**Nota sobre identificadores:** `collection_id` es igual a `collection_public_key` en hex, sin prefijo. Ver `docs/16-identificadores-y-firmas.md`.

| # | event_type | Propósito |
| - | ------------------ | ------------------------------------------- |
| 1 | collection_genesis | Bloque 0. Vincula usuario y colección |
| 2 | add_bookmark | Añade bookmark (con canonical_url embebida) |
| 3 | edit_bookmark | Modifica metadatos de un bookmark |
| 4 | remove_bookmark | Soft delete |
| 5 | move_bookmark | Cambia de grupo |
| 6 | reorder_bookmark | Cambia la posición dentro del grupo |
| 7 | update_metadata | Cambia nombre/descripción/visibilidad |
| 8 | create_group | Crea grupo |
| 9 | delete_group | Elimina grupo (bookmarks → Inbox) |
| 10 | collection_unpublished | El autor deja de compartir la colección |

1. collection_genesis

Siempre el bloque 0 de cualquier colección. Vincula la clave
del Hypercore con el usuario propietario. Sin este bloque, la
colección no es válida.
```json

{
  "schema_version": 1,
  "event_id": "01J8XK...",
  "event_type": "collection_genesis",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T14:30:00Z",
  "payload": {
    "collection_id": "3df0c93d...",
    "collection_public_key": "pk_col_xxxxx",
    "author_public_key": "pk_user_xxxxx",
    "name": "Japón 2027",
    "description": "Recursos para un viaje de 30 días",
    "visibility": "public",
    "forked_from": null,
    "migrated_from": null,
    "signature_by_owner": "sig_xxxxx"
  }
}
```

**Valores de `visibility`:** `"public"` (aparece en búsquedas y descubrimiento) o `"unlisted"` (solo accesible por enlace directo). No existe `"private"`: el `collection_genesis` solo se crea al publicar, y una colección privada no se publica. El estado `"draft"` vive solo en el `device_core` (ver `docs/03-identidad.md`), no en el `collection_core`.
**Verificación:** El receptor verifica que `sha256(author_public_key).hex().slice(0, 16)` coincide con `author_id`. Esto permite verificar la firma sin depender de un directorio global de usuarios. Además, `signature_by_owner` es la firma del usuario propietario (identificado por `author_id`) sobre los campos `collection_id`, `collection_public_key`, `author_id`, `author_public_key`, `name`, `visibility`, `(forked_from ?? "")` y `(migrated_from ?? "")`:

```text
sha256(
  collection_id ||
  collection_public_key ||
  author_id ||
  author_public_key ||
  name ||
  visibility ||
  (forked_from ?? "") ||
  (migrated_from ?? "")
)
```

Es lo que demuestra que el usuario es el dueño de la colección.

**Reglas de `forked_from`:**

- `null` si la colección es original.
- `<collection_id>` de la colección original si es un duplicado.
- Es informativo, no verificable criptográficamente en MVP. Se usa para mostrar "duplicado de X" en la UI y para métricas de forks.
- En el futuro, si se quiere verificación, se puede añadir una firma del autor original. Fuera de MVP.
- `forked_from` no crea ningún vínculo de sincronización. Es una copia congelada en el momento del fork.

**Reglas de `migrated_from`:**

- `null` si la colección no es una migración.
- `<collection_id>` de la colección original si es una migración de schema (v1 → v2, etc.).
- Es informativo. El receptor no verifica que el `collection_id` destino exista.
- `migrated_from` y `forked_from` son mutuamente excluyentes: una colección es una copia duplicada o una migración, no ambas.

2. add_bookmark

Añade un bookmark (referencia a un resource) a la colección.
```json

{
  "schema_version": 1,
  "event_id": "01J8XL...",
  "event_type": "add_bookmark",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T14:32:00Z",
  "payload": {
    "bookmark_id": "01J8XL...",
    "resource_id": "r_7f6a...",
    "canonical_url": "https://japan-guide.com/mountains",
    "title": "Hiking in Japan",
    "description": "Guide to hiking routes in Japan",
    "tags": ["hiking", "mountains"],
    "notes": "Visitar en otoño",
    "group_id": null
  }
}
```

Notas:

    bookmark_id es un ULID generado por el autor en el momento
    de añadir.

    canonical_url se embebe siempre (no solo la primera vez).
    Permite que cualquier nodo reconstruya el resource localmente
    sin dependencias externas.

    resource_id = SHA256("v1:" + canonical_url) — se incluye por
    conveniencia y verificación, pero se puede recalcular.

    group_id es opcional. null = Inbox.

3. edit_bookmark

Modifica metadatos de un bookmark existente. No cambia el
resource_id ni la URL.
```json

{
  "schema_version": 1,
  "event_id": "01J8XM...",
  "event_type": "edit_bookmark",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T15:00:00Z",
  "payload": {
    "bookmark_id": "01J8XL...",
    "changes": {
      "title": "Hiking in Japan (actualizado)",
      "tags": ["hiking", "mountains", "otoño"],
      "notes": "Visitar en octubre"
    }
  }
}
```

Notas:

    Solo los campos presentes en changes se modifican.

    Los campos no presentes se mantienen.

    Para borrar un campo: "notes": null.

4. remove_bookmark

Marca un bookmark como eliminado. No borra el bloque anterior.
```json

{
  "schema_version": 1,
  "event_id": "01J8XN...",
  "event_type": "remove_bookmark",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T15:10:00Z",
  "payload": {
    "bookmark_id": "01J8XL..."
  }
}
```

5. move_bookmark

Mueve un bookmark a otro grupo (o al Inbox).
```json

{
  "schema_version": 1,
  "event_id": "01J8XP...",
  "event_type": "move_bookmark",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T15:15:00Z",
  "payload": {
    "bookmark_id": "01J8XL...",
    "group_id": "g_1a2b3c4d5e6f" 
  }
}
```

group_id: null → Inbox.
6. update_metadata

Cambia nombre, descripción o visibilidad de la colección.
```json

{
  "schema_version": 1,
  "event_id": "01J8XQ...",
  "event_type": "update_metadata",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T16:00:00Z",
  "payload": {
    "changes": {
      "name": "Japón 2027 (versión final)",
      "description": "Recursos actualizados",
      "visibility": "public"
    }
  }
}
```

7. create_group

Crea un grupo dentro de la colección.
```json

{
  "schema_version": 1,
  "event_id": "01J8XR...",
  "event_type": "create_group",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T16:10:00Z",
  "payload": {
    "group_id": "g_1a2b3c4d5e6f",
    "name": "Transporte",
    "position": 0
  }
}
```

8. delete_group

Elimina un grupo. Los bookmarks que contenía se mueven a Inbox.
```json

{
  "schema_version": 1,
  "event_id": "01J8XT...",
  "event_type": "delete_group",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T16:30:00Z",
  "payload": {
    "group_id": "g_1a2b3c4d5e6f"
  }
}
```

9. `reorder_bookmark`

Cambia la posición de un bookmark dentro de un grupo (o del Inbox).

```json
{
  "schema_version": 1,
  "event_id": "01J8XS...",
  "event_type": "reorder_bookmark",
  "author_id": "u_93c4fa12...",
  "created_at": "2026-10-23T16:20:00Z",
  "payload": {
    "bookmark_id": "01J8XL...",
    "group_id": "g_1a2b3c4d5e6f",
    "position": 2
  }
}
```

**Reglas:**

- `position` es un entero. Orden dentro del grupo (0 = primero).
- Si `group_id` es `null`, reordena en Inbox.
- Si `position` es mayor que el número actual de bookmarks en el grupo, se coloca al final.
- Idempotente: aplicar dos veces el mismo `reorder_bookmark` da el mismo resultado.
- El orden por defecto (si nunca se ha reordenado) es por `created_at` ascendente.
- **Fold:** actualiza la posición del bookmark en el grupo indicado. Los demás bookmarks del grupo se reajustan (los que estaban en posiciones ≥ `position` suben uno).

10. `collection_unpublished`

El autor deja de compartir la colección. Es el último
evento que se escribe en el `collection_core`. Los
seguidores conservan lo replicado y muestran un aviso.

```json
{
  "schema_version": 1,
  "event_id": "01J8XV...",
  "event_type": "collection_unpublished",
  "author_id": "u_marta...",
  "created_at": "2026-10-24T17:00:00Z",
  "payload": {
    "message": "La autora ha dejado de compartir esta colección.",
    "migrated_to": null
  }
}
```

**Reglas:**

- Solo el autor de la colección puede emitirlo.
- `migrated_to` es opcional. Si es `null` o está ausente, no hay migración.
- Si `migrated_to` está presente, debe ser un `collection_id` válido (hex, sin prefijo).
- El receptor no verifica que el `collection_id` destino exista o sea accesible. Es informativo.
- El receptor no migra automáticamente. Muestra la opción; el usuario decide.
- Tras este evento, el autor deja de anunciar el topic del `collection_core`.

Fold del log → estado actual

El estado actual de una colección se obtiene aplicando los
eventos en orden:
```text
estado = {}
para cada bloque en el log (orden):
    aplicar(bloque, estado)
```

## Reglas de fold

| Evento | Efecto |
|---|---|
| `collection_genesis` | Crea la colección con sus metadatos |
| `add_bookmark` | Añade bookmark al estado (si no existe) |
| `edit_bookmark` | Aplica cambios sobre el bookmark existente |
| `remove_bookmark` | Marca el bookmark como eliminado (soft delete) |
| `move_bookmark` | Cambia el `group_id` del bookmark |
| `reorder_bookmark` | Actualiza la posición del bookmark en el grupo. Reajusta el resto |
| `update_metadata` | Aplica cambios sobre la colección |
| `create_group` | Añade grupo al estado |
| `delete_group` | Marca grupo como eliminado y mueve sus bookmarks a Inbox |
| `collection_unpublished` | Marca la colección como despublicada. No elimina bookmarks |
Idempotencia

    add_bookmark con un bookmark_id ya existente → ignorar.

    edit_bookmark / remove_bookmark / move_bookmark sobre
    un bookmark_id inexistente → ignorar (puede pasar en
    replicación desordenada).

    collection_genesis solo se aplica una vez (bloque 0).

    collection_unpublished con el mismo event_id → ignorar.

    reorder_bookmark con el mismo position que ya tiene → ignorar.

Resolución de conflictos

En MVP no hay multi-writer, así que no hay conflictos posibles:
un solo autor escribe. Cuando se añada multi-writer (Autobase,
futuro), esta sección se ampliará.
Versionado

    Cada bloque incluye schema_version.

    Si en el futuro cambia el formato, se incrementa.

    Un nodo que encuentra un bloque con versión desconocida:

        Si es menor: aplica función de migración al materializar.

        Si es mayor: rechaza el bloque y no completa la replicación
        (indica al usuario que actualice).

Lo que el log NO contiene

    Imágenes, vídeos, capturas, thumbnails.

    Contenido generado por usuarios (posts, comentarios).

    Likes, karma, rankings.

    Datos de otros usuarios.

    Estadísticas agregadas.

    Tags a nivel de colección. Los tags viven solo en los
    bookmarks. Cualquier tag "de colección" se deriva
    agregando los tags de sus bookmarks.

Solo eventos sobre bookmarks y metadatos de la colección.

## Tipos y validación

Los tipos TypeScript de los eventos viven en `src/events.ts`, junto con los constructores. El fold vive en `src/fold.ts`. No se separan tipos y lógica en archivos distintos: el proyecto es pequeño y la separación añadiría fricción sin beneficio.

**Validación:** los constructores validan tipos y campos obligatorios, y lanzan `RangeError` si falta algo. Esto es crítico porque los bloques de Hypercore son inmutables: un evento mal formado no se puede corregir. El fold valida reglas de negocio (por ejemplo, que un `bookmark_id` exista para `edit_bookmark`); si no se cumple, el fold ignora el evento (idempotencia).

**Constructores y claves:** los constructores de eventos no derivan claves. Reciben los datos ya resueltos. En particular, `collectionGenesis` recibe `{ authorId, authorPublicKey, secretKey }` ya calculados. La derivación de claves (de `masterKey` a `userKeypair`) es responsabilidad de `src/identity.ts`, no de `src/events.ts`. Esto mantiene la separación de responsabilidades y facilita los tests.

### Firma sobre hash

`signature_by_owner` se calcula firmando el hash SHA-256 de la concatenación de los campos, no la concatenación directamente:

```text
message = collection_id || collection_public_key || author_id ||
          author_public_key || name || visibility ||
          (forked_from ?? "") || (migrated_from ?? "")
hash = sha256(message)
signature = ed25519.sign(hash, secretKey)
```

La verificación hace lo mismo: recalcula `sha256(message)` y verifica la firma sobre el hash.

### Campos opcionales

- **`description`:** no participa en la firma. Si no se pasa, se omite del payload. Si se pasa, se incluye como string.
- **`forked_from`:** por defecto `null`. Se serializa como `""` en la firma (`(forkedFrom ?? "")`).
- **`migrated_from`:** por defecto `null`. Se serializa como `""` en la firma (`(migratedFrom ?? "")`).

`null` y `""` producen el mismo resultado en la firma para `forked_from` y `migrated_from`, lo cual es correcto y determinista.

### Separador de concatenación en la firma

Los campos se concatenan en el orden indicado, con un separador explícito `\x00` (null byte) entre cada campo. No se usa `||` literal. La concatenación es:

```text
message = collection_id + "\x00" +
          collection_public_key + "\x00" +
          author_id + "\x00" +
          author_public_key + "\x00" +
          name + "\x00" +
          visibility + "\x00" +
          (forked_from ?? "") + "\x00" +
          (migrated_from ?? "")
