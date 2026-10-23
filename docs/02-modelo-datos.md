# Modelo de datos

## Jerarquía

`User → Collection → Bookmark → Resource → URL`

## Entidades

### User

Representa a una persona. Es la entidad propietaria de bookmarks, grupos, colecciones y publicaciones.

```yaml
user_id: u_93c4...          # HASH(public_key)
public_key: pk_xxxxx
private_key: (nunca se comparte)
display_name: Gorka
bio: Homelab y privacidad
created: 2026-01-15
```

El perfil NO forma parte de la identidad. Puedes cambiar nombre, bio o avatar sin cambiar quién eres.

### Node

Representa una instalación concreta de BookmarkNet.

```yaml
node_id: n_12ae
user_id: u_93c4
device_name: NAS
created: 2026-01-15
last_seen: 2026-10-23
```

### Resource

Representa un recurso web único. Es la entidad global, compartida por toda la red.

```yaml
resource_id: r_7f6a...      # HASH(canonical_url)
url: https://japan-guide.com/mountains
domain: japan-guide.com
title: Hiking in Japan
description: Guide to hiking routes in Japan
created: 2026-01-15
```

### Bookmark

Representa la inclusión de un Resource dentro de una colección. Es local al usuario o a la colección.

```yaml
bookmark_id: b_83a1
resource_id: r_7f6a
collection_id: c_123
tags: [hiking, mountains]
notes: Visitar en otoño
created: 2026-01-15
updated: 2026-01-20
```

### Collection

Agrupa bookmarks. Es la unidad principal de compartición.

```yaml
collection_id: c_123
owner_id: u_93c4
name: Japón 2027
description: Recursos para un viaje de 30 días
visibility: public      # public | private
created: 2026-01-15
updated: 2026-01-20
```

## Relaciones

Un mismo Resource puede aparecer en múltiples colecciones. Cada Bookmark conserva sus propios tags y notas; el `resource_id` es el mismo.

## Invariantes

1. `resource_id = HASH(canonical_url)` (ver [04-canonicalizacion-url.md](04-canonicalizacion-url.md)).
2. `bookmark_id` es único globalmente.
3. Todo bookmark referencia un `resource_id` existente.
4. Toda collection tiene un `owner_id`.
5. Las modificaciones se firman con la clave privada del `owner_id`.
