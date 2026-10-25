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

## Recuperación

Si se pierden todos los dispositivos pero se conserva `identity.bmn`:

1. Instalar BookmarkNet en un equipo nuevo.
2. Importar `identity.bmn` y la contraseña.
3. Reconectar a la red.
4. Sincronizar colecciones desde otros nodos que las repliquen.

## Sincronización multidispositivo

Cada dispositivo del mismo usuario tiene su propio
`device_core`: un Hypercore single-writer firmado con una
clave derivada de la clave maestra del usuario y el
`node_id` del dispositivo.

El `device_core` contiene:
- Las colecciones propias que ese dispositivo ha creado.
- Los bookmarks que ese dispositivo ha añadido o
  modificado en colecciones propias.
- Los cambios de perfil.
- La lista de dispositivos que conoce.

**Tipos de evento del `device_core`:**

- `device_metadata`: perfil del usuario (nombre, bio,
  avatar). Se aplica al `user_index` local.
- `device_collection`: referencia a una colección propia
  (publicada o borrador) con su `collection_id` y
  estado (`draft`, `published`, `unpublished`).
- `device_bookmark`: bookmark en una colección no
  publicada. Incluye `collection_id`, `bookmark_id`,
  `resource_id`, `canonical_url`, metadatos.
- `device_group`: grupo en una colección no publicada.
  Incluye `collection_id`, `group_id`, `name`, `position`.

**Nota:** estos eventos son distintos de los del
`collection_core` (docs/15-schema-eventos.md). El
`device_core` es un log local por dispositivo; el
`collection_core` es el log público de una colección
publicada.

Todos los dispositivos del mismo usuario se unen a un topic
derivado del `user_id` y replican los `device_core` de los
demás (solo lectura para los ajenos).

La vista unificada del usuario (qué colecciones tiene,
cuál es su perfil actual) se construye **localmente**
(`user_index`) sumando los `device_core` de todos sus
dispositivos.

**No hay un "dispositivo principal".** Cualquier
dispositivo escribe en su propio `device_core`.

## Propiedad

Las colecciones, bookmarks y publicaciones pertenecen siempre a la identidad del usuario, nunca al dispositivo que los almacena.
