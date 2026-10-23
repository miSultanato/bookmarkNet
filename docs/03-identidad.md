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
user_id: HASH(public_key)   # u_93c4fa12...
public_key: pk_xxxxx
private_key: (nunca sale del dispositivo)
profile:
  display_name: Gorka
  bio: ...
  avatar: (opcional)
  website: (opcional)
nodes: [n_12ae, n_98bc, ...]
trusted_nodes: [n_12ae, n_98bc, ...]
```

## Creación

Primera ejecución de `bookmarknet-node`:

1. Genera clave privada y pública.
2. Calcula `user_id = HASH(public_key)`.
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

**Seguridad:** la clave privada nunca viaja en claro por la red. El QR es de un solo uso y la contraseña se muestra solo en pantalla del nodo original. En LAN confiable se puede omitir la contraseña (opción configurable), pero por defecto se exige.

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

Cada colección tiene su propio par de claves. El usuario firma el bloque génesis (`collection_genesis`) que vincula su identidad a la colección. Los bloques posteriores del log los firma la clave de la colección (Hypercore).

Cuando un nodo recibe una modificación:
- Verifica que el bloque está firmado por `collection_keypair` (Hypercore lo hace automáticamente).
- Verifica que el `author_id` del evento coincide con el `owner_id` del génesis.
- Si ambas verificaciones pasan → aceptar. Si no → rechazar.

## Propiedad

Las colecciones, bookmarks y publicaciones pertenecen siempre a la identidad del usuario, nunca al dispositivo que los almacena.
