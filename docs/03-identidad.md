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
private_key: (nunca sale del dispositivo)
profile:
  display_name: Marta
  bio: ...
  avatar: (opcional)
  website: (opcional)
nodes: [n_12ae, n_98bc, ...]
trusted_nodes: [n_12ae, n_98bc, ...]
```

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
