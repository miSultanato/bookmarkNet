# Modelo de datos

## Jerarquía

`User → Collection → Bookmark → Resource → URL`

## Entidades

**Nota sobre identificadores:** los formatos exactos están definidos en `docs/16-identificadores-y-firmas.md`. Los ejemplos de este documento son abreviados.

### User

Representa a una persona. Es la entidad propietaria de bookmarks, grupos, colecciones y publicaciones.

```yaml
user_id: "u_" + sha256(public_key).hex().slice(0, 16)
public_key: pk_user_xxxxx
private_key: (nunca se comparte)
display_name: Marta
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

Representa un recurso web único. Su identidad lógica es global, pero no existe un registro físico compartido por toda la red en MVP.

```yaml
resource_id: r_7f6a...      # sha256 completo en hex (64 caracteres)
url: https://japan-guide.com/mountains
domain: japan-guide.com
title: Hiking in Japan
description: Guide to hiking routes in Japan
created: 2026-01-15
```

**Globalidad lógica, no física:** el `resource_id` es el mismo en todos los nodos porque se deriva de la URL canónica. Pero en MVP no existe un registry global de resources. Cada nodo materializa su propia vista de qué resources conoce y en cuántas colecciones aparecen, a partir de los `canonical_url` embebidos en las colecciones que replica. Las métricas de popularidad ("X aparece en N colecciones") son locales al nodo hasta MVP5.

**Horizonte:** un Autobase de resources (multi-writer) podrá agregar los resources conocidos para dar métricas globales en el futuro, sin cambiar el `resource_id` ni el schema de `add_bookmark`.

### Bookmark

Representa la inclusión de un Resource dentro de una colección. Es local al usuario o a la colección.

```yaml
bookmark_id: 01J8XLK3M...
resource_id: r_7f6a...  # sha256 completo en hex (64 caracteres)
collection_id: 3df0c93d...
tags: [hiking, mountains]
notes: Visitar en otoño
created: 2026-01-15
updated: 2026-01-20
```

### Collection

Agrupa bookmarks. Es la unidad principal de compartición.

```yaml
collection_id: 3df0c93d...
owner_id: u_93c4
name: Japón 2027
description: Recursos para un viaje de 30 días
visibility: public      # public | private
created: 2026-01-15
updated: 2026-01-20
```

**Dos planos de existencia:**

- **Local (borrador):** antes de publicar, la colección vive solo en los `device_core` del usuario que la creó. Es privada, no replicable por terceros.
- **Público (canal):** al publicar, se crea un `collection_core` single-writer con el estado actual congelado. A partir de ahí, cada cambio en la colección se escribe automáticamente tanto en el `device_core` del dispositivo que lo hace como en el `collection_core`.

La escritura dual es transparente para el usuario. Si sigues una colección, recibes las actualizaciones de su dueño y no puedes editarla. Si la duplicas, creas una copia propia congelada que puedes editar y publicar. Seguir y duplicar son operaciones independientes y no excluyentes: puedes hacer ambas sobre la misma colección. La copia duplicada tiene su propio `collection_core` y `collection_id`, y su `forked_from` apunta al original; los cambios posteriores del original no se propagan a la copia. Si quieres incorporar esos cambios, debes hacerlo manualmente.

**Relación con el génesis:** cada colección tiene su propio `collection_keypair`. El bloque 0 (`collection_genesis`) contiene `collection_public_key`, `author_public_key` y `signature_by_owner` (firma del usuario sobre los campos del génesis). Los bloques posteriores los firma `collection_keypair` mediante Hypercore.

## Relaciones

Un mismo Resource puede aparecer en múltiples colecciones. Cada Bookmark conserva sus propios tags y notas; el `resource_id` es el mismo.

## Invariantes

1. `resource_id = "r_" + sha256("v1:" + canonical_url).hex()` (ver [04-canonicalizacion-url.md](04-canonicalizacion-url.md) y `docs/16-identificadores-y-firmas.md`).
2. `bookmark_id` es único globalmente.
3. Todo bookmark referencia un `resource_id` existente.
4. Toda collection tiene un `owner_id`.
5. Las modificaciones se firman con la clave privada de la colección (`collection_keypair`). El usuario firma el bloque génesis (`collection_genesis`) para vincular su identidad a la colección. Ver `docs/16-identificadores-y-firmas.md`.
6. `resource_id` es independiente de dónde se almacene el resource. Se deriva siempre de la URL canónica y no cambia si en el futuro se introduce un registry global (Autobase).
