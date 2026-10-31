# Identidad

## Principios

- La identidad pertenece al usuario, no al dispositivo.
- Múltiples dispositivos simultáneos.
- Sin cuentas centralizadas ni email.
- Autenticación por clave pública.
- Exportable, importable y recuperable.
- Los datos sobreviven a la desaparición de cualquier dispositivo.

## Estructura

```yaml
user_id: "u_" + sha256(public_key).hex().slice(0, 16)
public_key: pk_user_xxxxx
private_key: (nunca viaja en claro)
profile:
  display_name: Marta
  bio: ...
  avatar: (opcional)
  website: (opcional)
nodes: [n_12ae, n_98bc, ...]
trusted_nodes: [n_12ae, n_98bc, ...]
```

**Relación entre `user_master_key` y `user_keypair`:** la clave privada del usuario (`private_key`) **es** el `user_master_key` (32 bytes). El `user_keypair` Ed25519 se construye directamente a partir de esta semilla: `public_key = Ed25519.getPublicKey(user_master_key)`. No hay dos claves distintas. Las claves de colección se derivan de la misma semilla con HKDF-SHA256 (ver `docs/05-arquitectura-p2p.md`).

## Creación

Primera ejecución de `bookmarknet-node`:

1. Genera clave privada y pública.
2. Calcula `user_id = "u_" + sha256(public_key).hex().slice(0, 16)`.
3. Crea un perfil vacío (rellenarlo es opcional).

No hay registro, email ni contraseña.

**Cuándo se crea la identidad:** la identidad no se crea automáticamente al arrancar el nodo. El nodo arranca sin identidad (`GET /api/v1/identity` devuelve `{ identity: null }`). La identidad se crea explícitamente con `POST /api/v1/identity/create` (o se importa con `POST /api/v1/identity/import`). La UI muestra el onboarding (`docs/19-onboarding.md`) hasta que hay identidad.

## Añadir dispositivo

Desde un nodo existente:

1. `Añadir dispositivo`
2. El nodo original genera:
   - Un par de claves efímero para el intercambio.
   - Una contraseña aleatoria de 6 dígitos (mostrada en pantalla).
   - Un QR que contiene `{identity_blob_cifrado, salt, nonce, ephemeral_public_key}`.
3. `identity_blob_cifrado` = clave privada del usuario + clave pública + perfil, cifrado con la contraseña (AES-GCM o ChaCha20-Poly1305).
4. El nuevo nodo escanea el QR e introduce la contraseña de 6 dígitos.
5. Descifra `identity_blob` con la contraseña.
6. Genera su propio `node_id` y se registra en la lista de dispositivos del usuario.
7. El QR y la contraseña caducan a los 5 minutos o al completar la operación (lo que ocurra primero).

**La clave privada nunca viaja en claro.** En el flujo de
añadir dispositivo, se transfiere cifrada con una
contraseña efímera de 6 dígitos (ver sección "Añadir
dispositivo"). Nunca se transmite en texto plano ni se
almacena fuera del dispositivo en forma legible.

El QR es de un solo uso y la contraseña se muestra solo en
pantalla del nodo original. En LAN confiable se puede omitir
la contraseña (opción configurable), pero por defecto se exige.

**Futuro (fuera de MVP):** intercambio de claves Diffie-Hellman entre dispositivos para evitar compartir la contraseña por canal visual. No se implementa en MVP.

## Backup

Formato: `identity.bmn`. Contenido: `private_key`, `public_key`, `profile`. Debe cifrarse siempre con contraseña antes de exportarlo. **No contiene bookmarks**, sólo identidad.

**Ubicación en el dispositivo:** la `user_master_key` (la clave privada del usuario) se guarda en `dataDir/identity.bmn` en claro, protegida por los permisos `0700` del directorio de datos. El cifrado con contraseña se aplica solo al exportar (`POST /identity/export`) y al importar (`POST /identity/import`). El archivo exportado es el que se cifra; el archivo en disco no.

## Recuperación

Si se pierden todos los dispositivos pero se conserva `identity.bmn`:

1. Instalar BookmarkNet en un equipo nuevo.
2. Importar `identity.bmn` y la contraseña.
3. Reconectar a la red.
4. Sincronizar colecciones desde otros nodos que las repliquen.

## Sincronización multidispositivo

Cada dispositivo del mismo usuario tiene su propio
`device_core`: un Hypercore single-writer. En MVP0 y MVP1,
`device_core` se abre con la ruta local existente, sin derivar una
clave de la identidad. ADR-014 (`docs/14-adrs.md`) decide que en MVP2
se derivará un par Ed25519 por dispositivo mediante HKDF-SHA256 con
separación de dominio `bookmarknet:device:` + `node_id`, y que
`device_core` se abrirá con ese `keyPair`. En MVP1 solo se persiste
`node_id`; la apertura actual no cambia.

El `device_core` contiene:
- Las colecciones propias que ese dispositivo ha creado.
- Los bookmarks que ese dispositivo ha añadido o
  modificado en colecciones propias.
- Los cambios de perfil.
- La lista de dispositivos que conoce.

### Tipos de evento del `device_core`

El `device_core` es un log single-writer local. Sus eventos son distintos de los del `collection_core` (`docs/15-schema-eventos.md`): el `device_core` contiene borradores locales, no colecciones publicadas. Los 12 eventos son:

1. `device_metadata`: perfil del usuario (nombre, bio, avatar). Reemplaza el perfil completo (no hace merge).
2. `device_create_collection`: crea una colección local (borrador).
3. `device_update_collection`: modifica metadatos de una colección local.
4. `device_delete_collection`: marca una colección local como eliminada (soft delete en cascada: sus bookmarks y grupos también se marcan como eliminados).
5. `device_add_bookmark`: añade un bookmark a una colección local.
6. `device_edit_bookmark`: modifica campos de un bookmark.
7. `device_remove_bookmark`: marca un bookmark como eliminado (soft delete).
8. `device_move_bookmark`: mueve un bookmark a otro grupo (o a la raíz de la colección). El Inbox global es distinto: usa `collectionId: null` y `groupId: null`; la raíz conserva el `collectionId` de la colección y usa `groupId: null`.
9. `device_reorder_bookmark`: cambia la posición de un bookmark dentro de un grupo.
10. `device_create_group`: crea un grupo en una colección local.
11. `device_delete_group`: marca un grupo como eliminado (sus bookmarks vuelven a la raíz de su colección).
12. `device_add_device`: añade un dispositivo a la lista de dispositivos conocidos del `device_core`. En MVP1, la lista es local; la replicación es MVP2.

Todos los eventos comparten los campos comunes de `docs/15`: `schema_version: 1`, `event_id` (ULID), `event_type`, `author_id` (el `user_id` del dueño del dispositivo), `created_at` (ISO8601), `payload`.

#### Payloads

```typescript
interface DeviceMetadataPayload {
  displayName?: string
  bio?: string
  avatar?: string
}

interface DeviceCreateCollectionPayload {
  collectionId: string      // ULID (= collection_uuid, ver docs/05)
  name: string
  description?: string
  visibility: 'public' | 'unlisted'
  language: 'es' | 'en' | 'eu' // Idioma principal de la colección. Valores: es (español), en (inglés), eu (euskera). Por defecto, es.
}

interface DeviceUpdateCollectionPayload {
  collectionId: string
  changes: {
    name?: string
    description?: string | null   // null = borrar
    visibility?: 'public' | 'unlisted'
    language?: 'es' | 'en' | 'eu'
  }
}

interface DeviceDeleteCollectionPayload {
  collectionId: string
}

interface DeviceAddBookmarkPayload {
  bookmarkId: string        // ULID
  collectionId: string | null
  resourceId: string        // r_...
  canonicalUrl: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  groupId?: string | null   // null = raíz de colección; con collectionId: null, debe ser null (Inbox global)
}

interface DeviceEditBookmarkPayload {
  bookmarkId: string
  changes: {
    title?: string            // no se puede borrar con null
    description?: string | null
    tags?: string[]           // no se puede borrar con null
    notes?: string | null
  }
}

interface DeviceRemoveBookmarkPayload {
  bookmarkId: string
}

interface DeviceMoveBookmarkPayload {
  bookmarkId: string
  collectionId: string | null
  groupId: string | null
}

interface DeviceReorderBookmarkPayload {
  bookmarkId: string
  groupId: string | null
  position: number
}

interface DeviceCreateGroupPayload {
  groupId: string           // ULID
  collectionId: string
  name: string
  position: number
}

interface DeviceDeleteGroupPayload {
  groupId: string
  collectionId: string
}

interface DeviceAddDevicePayload {
  nodeId: string          // "n_" + 16 hex
  publicKey?: string      // "pk_user_" + hex; opcional en MVP1,
                          // obligatorio en MVP2 (clave derivada
                          // del dispositivo)
  addedAt: string         // ISO8601
}
```

**Inbox global vs Inbox de colección:** el Inbox global contiene bookmarks con `collectionId: null` y `groupId: null`. No pertenecen a ninguna colección. El Inbox de colección (también llamado raíz de la colección) contiene bookmarks con `collectionId: "c_..."` y `groupId: null`: pertenecen a esa colección, pero no a un grupo. Son conceptos distintos y la UI los muestra de forma distinta.

Para `device_add_bookmark`, si `collectionId` es `null`, `groupId` debe ser `null`; el constructor lanza `RangeError` si `collectionId: null` y `groupId` no es `null`.

Reglas adicionales del constructor `device_move_bookmark`: acepta el payload `{ bookmarkId, collectionId, groupId }`. Si `collectionId` es `null`, `groupId` debe ser `null`; el constructor lanza `RangeError` si no se cumple.

| Regla de movimiento | Resultado |
|---|---|
| `collectionId` distinto del actual | Cambia de colección y establece `position: null`. |
| `collectionId` igual al actual | Solo cambia `groupId` y establece `position: null`. |
| `collectionId: null` y `groupId: null` | Mueve al Inbox global. |
| `collectionId: null` y `groupId` no es `null` | Inválido: el constructor lanza `RangeError` y el fold ignora el evento. |

#### `collectionId` = `collection_uuid`

El `collectionId` en el `device_core` es el `collection_uuid` de `docs/05-arquitectura-p2p.md`. Es un ULID. Al publicar (MVP2), se usa el mismo ULID para derivar la `collection_keypair` con HKDF-SHA256. El `collectionId` local no aparece en el `collection_core`, pero es el mismo valor que se usó para derivar la clave. No hay cambio de tipo ni migración entre MVP0 y MVP2.

#### Estado del dispositivo

El fold de los eventos `device_*` produce un `DeviceState`:

```typescript
interface DeviceState {
  profile: {
    displayName?: string
    bio?: string
    avatar?: string
  }
  collections: Map<string, DeviceCollectionState>  // collection_id -> estado
  bookmarks: Map<string, DeviceBookmarkState>      // bookmark_id -> estado
  groups: Map<string, DeviceGroupState>            // group_id -> estado
  devices: Map<string, DeviceEntryState>            // node_id -> estado
}

interface DeviceCollectionState {
  collectionId: string
  name: string
  description?: string
  visibility: 'public' | 'unlisted'
  language: 'es' | 'en' | 'eu'
  deleted: boolean
  createdAt: string
  updatedAt?: string
}

interface DeviceBookmarkState {
  bookmarkId: string
  collectionId: string | null
  resourceId: string
  canonicalUrl: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  groupId: string | null
  position: number | null
  deleted: boolean
  createdAt: string
  updatedAt?: string
}

interface DeviceGroupState {
  groupId: string
  collectionId: string
  name: string
  position: number
  deleted: boolean
  createdAt: string
  updatedAt?: string
}

interface DeviceEntryState {
  nodeId: string
  publicKey?: string
  addedAt: string
}
```

#### Reglas de fold

- **`device_metadata`:** reemplaza `state.profile` con el payload. Campos ausentes se eliminan.
- **`device_add_device`:** si el `nodeId` ya existe en la lista de dispositivos conocidos, ignora (idempotencia). Si no existe, lo añade a la lista. El fold nunca lanza error.
- **`device_create_collection`:** crea la colección si no existe. Si existe, ignora. Asigna `language` desde el payload; si falta en un evento mal formado, usa `'es'`. El constructor garantiza el valor por defecto `'es'`.
- **`device_update_collection`:** si la colección no existe o está eliminada, ignora. Aplica `changes` (con `null` para borrar `description`). Asigna `language` si está presente; si no, conserva el valor actual.
- **`device_delete_collection`:** si no existe, ignora. Marca `deleted: true`. Sus bookmarks y grupos también se marcan como eliminados (soft delete en cascada, definitivo: no se "resucitan" si la colección se vuelve a crear con el mismo `collectionId`; se crea una colección nueva).
- **`device_add_bookmark`:** si `collectionId` es `null`, se acepta sin validar colección (Inbox global), pero `groupId` debe ser `null`; si no lo es, se ignora. Si `collectionId` no es `null` y la colección no existe o está eliminada, se ignora. Si el `bookmarkId` ya existe, se ignora. Si `groupId` no es `null` y no existe o no pertenece a `collectionId`, se ignora. Crea el bookmark con `position: null` (orden por `createdAt`).
- **`device_edit_bookmark`:** si el bookmark no existe o está eliminado, ignora. Aplica `changes`. `title` y `tags` no se pueden borrar con `null` (ignora el cambio). `description` y `notes` sí.
- **`device_remove_bookmark`:** si no existe o está eliminado, ignora. Marca `deleted: true`.
- **`device_move_bookmark`:** si el bookmark no existe o está eliminado, se ignora. Si `collectionId` es `null` y `groupId` no es `null`, el evento es inválido y se ignora. Si `collectionId` no es `null` y la colección no existe o está eliminada, se ignora. Si `groupId` no es `null` y no existe, está eliminado o no pertenece a `collectionId`, se ignora. Si `collectionId` es distinto del actual, cambia de colección y resetea `position` a `null`; si es igual, solo cambia `groupId` y resetea `position` a `null`. `collectionId: null` y `groupId: null` mueve el bookmark al Inbox global.
- **`device_reorder_bookmark`:** si el bookmark no existe o está eliminado, ignora. Si no está en el `groupId` indicado, ignora. Materializa posiciones del grupo (como en `collection_core`), reajusta, actualiza `updatedAt`.
- **`device_create_group`:** si la colección no existe o está eliminada, ignora. Si el `groupId` ya existe, ignora. Crea el grupo.
- **`device_delete_group`:** si el grupo no existe o está eliminado, ignora. Marca `deleted: true`. Los bookmarks del grupo vuelven a la raíz de su colección (`groupId: null`, `position: null`); no se mueven al Inbox global.
- **Idempotencia:** el fold nunca lanza error. Ignora eventos inválidos.

Todos los dispositivos del mismo usuario se unen a un topic
derivado del `user_id` y replican los `device_core` de los
demás (solo lectura para los ajenos).

Estado de implementación: la replicación entre dispositivos es
MVP2. En MVP0 y MVP1 solo existe el `device_core` local del
dispositivo.

La vista unificada del usuario (qué colecciones tiene,
cuál es su perfil actual) se construye **localmente**
(`user_index`) sumando los `device_core` de todos sus
dispositivos.

**No hay un "dispositivo principal".** Cualquier
dispositivo escribe en su propio `device_core`.

## Propiedad

Las colecciones, bookmarks y publicaciones pertenecen siempre a la identidad del usuario, nunca al dispositivo que los almacena.
