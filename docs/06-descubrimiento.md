# Descubrimiento por clave

## Flujo

```
bmn://<collection_public_key>
        ↓
topic = HASH(collection_public_key)
        ↓
Hyperswarm.join(topic)
        ↓
DHT responde: peers que anunciaron ese topic
        ↓
Conexión con peer → pedir metadata
        ↓
Verificación criptográfica (firmada por collection_public_key)
        ↓
Replicación Hypercore (bloques verificados)
        ↓
Colección disponible
```

## Al recibir la clave

El nodo sólo conoce `collection_public_key`. No conoce el nombre, descripción, bookmarks ni peers.

## Verificación

La metadata debe estar firmada por `collection_public_key`. Si no coincide, se rechaza.

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
