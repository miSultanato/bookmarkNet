# Descubrimiento por clave

## Flujo

```
bmn://<collection_id>
        ↓
topic = HASH(collection_public_key)
        ↓
Hyperswarm.join(topic)
        ↓
DHT responde: peers que anunciaron ese topic
        ↓
Conexión con peer → pedir metadata
        ↓
Verificación criptográfica del génesis y de los bloques
        ↓
Replicación Hypercore (bloques verificados)
        ↓
Colección disponible
```

## Al recibir la clave

El nodo sólo conoce `collection_public_key`. No conoce el nombre, descripción, bookmarks ni peers.

## Verificación

Al recibir una colección se verifican DOS cosas distintas sobre el bloque 0:

1. **Firma del usuario sobre los campos del génesis.**
   El bloque 0 (`collection_genesis`) incluye en su payload el campo `signature_by_owner`, que es la firma del usuario sobre los campos de propiedad de la colección. Se verifica con `author_public_key` (también incluida en el payload). Además, se comprueba que `author_id == "u_" + sha256(author_public_key).hex().slice(0, 16)`.

2. **Firma del bloque Hypercore (para TODOS los bloques, incluido el 0).**
   El bloque 0, y todos los bloques 1..N, están firmados por `collection_keypair` como parte del protocolo de Hypercore. Hypercore lo verifica automáticamente al replicar.

Si alguna de las dos verificaciones falla → rechazar la colección.

Los bloques 1..N solo llevan la firma de Hypercore (hecha por `collection_keypair`). No llevan `signature_by_owner`.

## Publicación

Al hacer pública una colección, el nodo anuncia el topic (`announce(topic)`).

## Seeders

Una colección tiene 0..N réplicas. Mientras una esté online, la colección sigue disponible.

```
Colección «Japón 2027»
├─ Seeder A (NAS Marta)
├─ Seeder B (Laura)
└─ Seeder C (Carlos)
```

## Caché local de descubrimiento

```yaml
collection: 3df0c93d
last_peers: [peer_a, peer_b]
last_seen: 2026-10-20
```

La próxima vez se intentan primero los peers conocidos antes de consultar toda la DHT.

## Caso offline

Si todos los peers están offline, la colección no es accesible temporalmente. Cuando uno vuelve y anuncia el topic, reaparece.

## Estado por fases

- MVP2: compartición directa por enlace, sin discovery automático.
- MVP3: descubrimiento por topic vía Hyperswarm DHT.
- MVP4: seed pack incluido en la app (ver docs/18-seed-pack.md). Colecciones completas que funcionan offline desde el primer arranque.
- MVP5: métricas agregadas para tendencias.

**Seed pack:** además del descubrimiento por topic, el nodo incluye el seed pack en el binario. Al arrancar por primera vez, el usuario puede añadir las colecciones del seed pack y explorarlas sin conexión. Ver docs/18-seed-pack.md.

## Avisos de publicación

**Al publicar con dispositivos offline:**

Si el dispositivo que publica detecta que algún otro
dispositivo del mismo usuario tiene cambios no
replicados (divergencia real), muestra un aviso:

> "Publicando con 2 de 3 dispositivos sincronizados.
> Los cambios que aún no se han replicado desde
> [dispositivo] no se incluirán en esta publicación.
> ¿Publicar de todos modos? / Sincronizar primero"

Si no hay divergencia real, no se muestra aviso.

**Al recibir una despublicación:**

Cuando un seguidor replica un evento
`collection_unpublished`, muestra:

> "[Autor] ha dejado de compartir esta colección.
> Conservas la última versión que replicaste. No
> recibirás más actualizaciones."

Y el estado de la colección cambia a "Archivada".

## Métricas y popularidad (MVP)

Las métricas de popularidad que muestra el nodo ("este bookmark aparece en N colecciones", "esta colección ha sido duplicada M veces") son **locales al nodo** en MVP. Se calculan sumando lo que el nodo tiene localmente (colecciones propias, seguidas y del seed pack).

No existe una cifra global absoluta hasta MVP5 (métricas emergentes agregadas).
