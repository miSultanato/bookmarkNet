# Arquitectura P2P

## Stack

- **Hypercore:** log append-only firmado por una clave. Una colección = un Hypercore.
- **Hyperbee:** índice key-value sobre Hypercore. Metadatos locales y consultas.
- **Hyperswarm:** DHT para discovery y NAT traversal.

## Por qué Hypercore

- El log append-only encaja con el modelo de eventos.
- Hyperswarm resuelve NAT traversal sin infraestructura propia.
- Hyperbee aporta índices locales sin construir una capa de consultas.
- Ecosistema activo.

## Limitaciones conocidas

**Un solo escritor por core.** Hypercore nativo es single-writer. Si en el futuro se quiere que otras personas contribuyan al core del autor original, será necesario **Autobase** (multi-writer sobre Hypercore) o un modelo de fork + merge. No bloquea el MVP, pero condiciona la arquitectura futura; ver [10-riesgos.md](10-riesgos.md).

## Modelo de replicación

- Replicamos eventos, no estados.
- Cada colección = un Hypercore.
- Cada bloque = un evento.
- Verificación criptográfica bloque a bloque.

Los 10 tipos de evento están definidos en `docs/15-schema-eventos.md`:
`collection_genesis`, `add_bookmark`, `edit_bookmark`, `remove_bookmark`, `move_bookmark`, `reorder_bookmark`, `update_metadata`, `create_group`, `delete_group`, `collection_unpublished`.

La lista anterior es exhaustiva, no ilustrativa.

Jerarquía de claves:
- El usuario (`user_keypair`) firma los campos del bloque 0 (`collection_genesis`) mediante una firma llamada `signature_by_owner`. Esta firma se incluye en el payload del evento y se verifica con `author_public_key`.
- La colección (`collection_keypair`) firma TODOS los bloques del Hypercore, incluido el bloque 0, como parte del protocolo de Hypercore. Esta firma es automática y garantiza la integridad del log.
- Los bloques 1..N solo llevan la firma de Hypercore (hecha por `collection_keypair`). No llevan `signature_by_owner`.

Es decir, en el bloque 0 conviven DOS firmas distintas: la del usuario sobre los campos del génesis (`signature_by_owner`) y la firma del propio bloque Hypercore (`collection_keypair`).

**Derivación de claves por colección:**

```text
collection_keypair = derive(
  user_master_key,
  "collection:" + collection_uuid
)
```

**Algoritmo de derivación:**

- `user_master_key` se genera con `crypto.randomBytes(32)` en la primera ejecución.
- `collection_keypair` se deriva de `user_master_key` mediante **HKDF-SHA256** con la info `"bookmarknet:collection:" + collection_uuid`.
- El resultado (32 bytes) se usa como seed de Ed25519.
- La `user_master_key` se almacena en `dataDir/identity.bmn` en claro, protegida por los permisos `0700` del directorio de datos. El cifrado con contraseña se aplica solo al exportar (`POST /identity/export`) y al importar (`POST /identity/import`). En MVP0 y MVP1, el `device_core` se abre con la ruta local existente, sin derivar una clave de la identidad. ADR-014 (`docs/14-adrs.md`) decide que en MVP2 se derivará un par Ed25519 por dispositivo mediante HKDF-SHA256 con separación de dominio `bookmarknet:device:` + `node_id`, y que `device_core` se abrirá con ese `keyPair`. En MVP1 solo se persiste `node_id`.
- La derivación es determinista: el mismo `user_master_key` + `collection_uuid` produce siempre el mismo `collection_keypair`.

Donde `collection_uuid` es un ULID generado al crear la
colección. **No es el nombre visible.** El nombre es
editable; el UUID no.

> **Nota sobre identificadores:** el `collection_uuid` es un ULID y constituye el identificador local de la colección en el `device_core` (ver `docs/03-identidad.md`). Ese mismo ULID es la entrada para derivar la `collection_keypair`, pero **no** es el `collection_id` público del `collection_core`. Al publicar, `collection_id` pasa a ser la clave pública Ed25519 derivada, codificada como 64 caracteres hexadecimales en minúsculas y sin prefijo (`collectionIdFromPublicKey(publicKey)`). Por tanto, el ULID local se conserva como `collection_uuid` y nombre/ruta local; el identificador público del génesis y la clave pública `core.key` son el hexadecimal derivado. No se cambia el ULID almacenado en `device_core` ni se migra su tipo: son dos identificadores distintos con funciones distintas.

Esto garantiza que:

- Renombrar una colección no cambia su clave.
- Dos colecciones con el mismo nombre tienen UUIDs
  distintos y, por tanto, claves distintas.

## Cores por dispositivo

Además de los `collection_core` (uno por colección), cada
dispositivo tiene su propio `device_core`:

- Single-writer. En MVP0 y MVP1 se abre con la ruta local existente,
  sin derivar una clave. En MVP2 se abrirá con un `keyPair` derivado
  mediante HKDF-SHA256 (`bookmarknet:device:` + `node_id`), según
  ADR-014.
- Contiene los borradores locales de las colecciones
  propias y los metadatos del usuario.
- Todos los dispositivos del mismo usuario se descubren
  por un topic derivado del `user_id`.

La vista local del usuario (`user_index`) se construye
agregando los `device_core` de todos sus dispositivos.

Esto no requiere Autobase: cada `device_core` es un
Hypercore single-writer independiente.

**Estado de implementación (MVP0):** solo existe el `device_core`. La persistencia local de `collection_core` (un Hypercore por colección, sin publicación) es MVP1. La publicación, la replicación entre dispositivos y la escritura dual son MVP2.

## Publicación y doble log

Antes de publicar, una colección existe solo en los
`device_core` del usuario. Al publicar:

1. Se crea un `collection_core` nuevo (single-writer,
   con `collection_keypair` derivado mediante el
   `collection_uuid` estable de la colección).
2. Se crea y escribe en él el `collection_genesis`, seguido
   de los eventos necesarios para reconstruir el estado actual.
3. El `collection_core` se anuncia en un topic derivado
   de su clave pública.

A partir de ese momento, cada modificación de la
colección se escribe en dos sitios:

- En el `device_core` del dispositivo que la hace (para
  la vista local).
- En el `collection_core` (para los seguidores).

Esta **escritura dual** es automática y transparente.

**Estado de implementación (MVP0):** la escritura dual y la publicación P2P no están implementadas. En MVP0, el nodo solo escribe en el `device_core` local. La publicación, la replicación y la escritura dual son funcionalidades de MVP2.

**Despublicar:** el autor escribe un evento
`collection_unpublished` en el `collection_core`, espera
un tiempo razonable a que los peers lo repliquen, y deja
de anunciar el topic. Los seguidores conservan lo
replicado y reciben el aviso.

**No existe "republicar".** Publicar de nuevo significa
crear un `collection_core` nuevo con un nuevo
`collection_id`.

**Escritura dual y fallos:**

- Si la escritura en el `collection_core` falla (peer no disponible, error de red, etc.), el evento se escribe igualmente en el `device_core` y se marca como "pendiente de publicar".
- El nodo reintenta la escritura en el `collection_core` en segundo plano, con backoff exponencial.
- La UI muestra el estado "pendiente" en la colección. Cuando la escritura se completa, el estado pasa a "sincronizada".
- No hay divergencia silenciosa: el usuario siempre sabe si hay cambios pendientes.
- Si el `collection_core` no está accesible durante mucho tiempo, el estado pasa a "offline" (ver sección "Estado de sincronización").


## Nodos offline

Los nodos offline son normales. Un portátil puede estar apagado el 80 % del tiempo. Requisito mínimo: al menos un nodo con la colección debe seguir online. Estado de implementación: la replicación entre dispositivos y los estados de sincronización son MVP2.

Si todos desaparecen, la colección queda temporalmente inaccesible. Cuando uno vuelve y anuncia el topic, reaparece.

## Estado de sincronización (UI)

- ✅ Sincronizada: la colección se ha replicado completamente en todos los peers conocidos.
- 🔄 Sincronizando: hay una replicación en curso.
- ⏳ Pendiente: hay cambios locales que aún no se han replicado a ningún peer.
- ⚠ Última réplica hace N días: no hay peers disponibles desde hace N días. Los cambios locales están seguros en el dispositivo.
- 🔴 Sin peers: no se ha conectado nunca con un peer para esta colección.
- 📦 Archivada: el autor ha despublicado la colección. Se conserva lo replicado.

Cada estado es mutuamente excluyente.

La UI debe comunicar: «Tu colección está segura en tu dispositivo. Se replicará cuando haya peers disponibles».

## Futuro (fuera del MVP)

- Relays / TURN para NAT traversal difícil.
- Autobase para multi-writer.
- Set reconciliation (Willow-like) para una sincronización más eficiente.
