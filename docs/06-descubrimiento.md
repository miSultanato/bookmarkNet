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

Al recibir una colección se verifican DOS cosas distintas:

1. **El génesis está firmado por el usuario.**
   El bloque 0 (`collection_genesis`) contiene `signature_by_owner`, que es la firma del usuario sobre los campos de propiedad. Se verifica con `author_public_key`. Además, se comprueba que `author_id == "u_" + sha256(author_public_key).hex().slice(0, 16)`.

2. **Los bloques están firmados por la colección.**
   Los bloques 1..N los firma `collection_keypair`. Hypercore lo verifica automáticamente al replicar.

Si alguna verificación falla → rechazar la colección.

## Publicación

Al hacer pública una colección, el nodo anuncia el topic (`announce(topic)`).

## Seeders

Una colección tiene 0..N réplicas. Mientras una esté online, la colección sigue disponible.

```
Colección «Japón 2027»
├─ Seeder A (NAS Gorka)
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
- MVP4: Discovery Feed incluido en la app.
- MVP5: métricas agregadas para tendencias.

## Métricas y popularidad (MVP)

Las métricas de popularidad que muestra el nodo ("este bookmark aparece en N colecciones", "esta colección ha sido duplicada M veces") son **locales al nodo** en MVP. Se calculan sumando lo que el nodo tiene localmente (colecciones propias, seguidas y Discovery Feed).

No existe una cifra global absoluta hasta MVP5 (métricas emergentes agregadas).
