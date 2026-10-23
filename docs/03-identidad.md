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

1. Seleccionar «Añadir dispositivo».
2. Generar un QR o código temporal.
3. El nuevo nodo escanea o importa el código.
4. Recibe la identidad (clave privada y pública).
5. Genera su propio Node ID.

Resultado: misma identidad, nuevo dispositivo.

## Backup

Formato: `identity.bmn`. Contenido: `private_key`, `public_key`, `profile`. Debe cifrarse siempre con contraseña antes de exportarlo. **No contiene bookmarks**, sólo identidad.

## Recuperación

Si se pierden todos los dispositivos pero se conserva `identity.bmn`:

1. Instalar BookmarkNet en un equipo nuevo.
2. Importar `identity.bmn` y la contraseña.
3. Reconectar a la red.
4. Sincronizar colecciones desde otros nodos que las repliquen.

## Sincronización multidispositivo

Toda modificación se firma con la identidad. Cada entidad compartible incluye `owner_id`. Al recibir un cambio, se comprueba que está firmado por el propietario; si no, se rechaza.

## Propiedad

Las colecciones, bookmarks y publicaciones pertenecen siempre a la identidad del usuario, nunca al dispositivo que los almacena.
