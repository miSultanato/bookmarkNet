# Identificadores y firmas (v1)

Este documento define el formato exacto de cada identificador y
la cadena de firmas que garantiza la propiedad.

## Formatos de identificador

Todos los IDs son strings con prefijo para hacerlos legibles y
evitar colisiones accidentales.

| Entidad | Formato | Ejemplo |
|---------|---------|---------|
| `user_id` | `"u_" + sha256(public_key).hex().slice(0, 16)` | `u_93c4fa12a8b3c4d5` |
| `node_id` | `"n_" + random(8 bytes).hex()` | `n_12ae9f3b` |
| `resource_id` | `"r_" + sha256("v1:" + canonical_url).hex()` | `r_7f6a...` (64 hex chars) |
| `bookmark_id` | ULID | `01J8XLK3M...` |
| `collection_id` | = `collection_public_key` (hex, sin prefijo) | `3df0c93d...` |
| `group_id` | `"g_" + random(6 bytes).hex()` | `g_transp0` |
| `event_id` | ULID | `01J8XLK3M...` |

### Por qué estos formatos

- **Prefijos** (`u_`, `n_`, `r_`, `g_`) hacen los IDs legibles en
  logs y en la UI, y evitan confundir un resource con un user.
- **ULID** para `bookmark_id` y `event_id`: ordenable por tiempo,
  único, generado localmente sin coordinación.
- **`collection_id = collection_public_key`**: un solo
  identificador para la colección. La representación `bmn://`
  es simplemente `bmn://` + este valor.

## Claves y firmas

### Jerarquía de claves

Usuario (user_keypair)
│
│ firma el génesis de cada colección
▼
Colección (collection_keypair)
│
│ firma cada bloque del log
▼
Hypercore de la colección
text


### Por qué dos niveles

Hypercore nativo es **single-writer**: cada core está firmado por
un único par de claves. Si usáramos la clave del usuario como
clave del core, un usuario solo podría tener **un** core (una
sola colección). Por eso:

- Cada **colección** tiene su propio `collection_keypair`.
- El **usuario** firma un evento de génesis que vincula su
  identidad con la `collection_public_key`.
- Los bloques del log los firma el `collection_keypair`
  (Hypercore lo hace automáticamente).

### El evento de génesis

El bloque 0 de cada colección es `collection_genesis` (ver
`15-schema-eventos.md`). Contiene:

```json
{
  "collection_id": "3df0c93d...",
  "collection_public_key": "pk_col_xxxxx",
  "name": "Japón 2027",
  "description": "...",
  "visibility": "public",
  "author_id": "u_93c4fa12...",
  "signature_by_owner": "sig_xxxxx"
}

signature_by_owner es la firma del usuario (author_id)
sobre:
text

sha256(
  collection_id ||
  collection_public_key ||
  name ||
  visibility
)

Cadena de verificación

Cuando un nodo recibe una colección, verifica:

    El Hypercore está firmado por collection_public_key.
    Hypercore lo verifica automáticamente.

    El bloque 0 es collection_genesis.

    La signature_by_owner es válida:

        Reconstruir el mensaje firmado (campos del génesis).

        Verificar con la public_key del author_id.

    collection_id == collection_public_key.

    Los bloques siguientes están firmados por el
    collection_keypair (Hypercore lo hace).

Si alguna verificación falla → rechazar la colección.
Cómo se obtiene la public_key del autor

El author_id = "u_" + sha256(public_key).hex().slice(0,16).
Pero un hash no permite recuperar la clave pública.

Solución: el evento collection_genesis incluye también la
author_public_key completa:
json

{
  "collection_id": "...",
  "collection_public_key": "...",
  "author_id": "u_93c4fa12...",
  "author_public_key": "pk_user_xxxxxxxxxxxx",
  "signature_by_owner": "..."
}

El receptor verifica:
text

sha256(author_public_key).hex().slice(0,16) == author_id

Y luego verifica la firma con author_public_key.
Rotación de claves del usuario (futuro)

Fuera de MVP. Si en el futuro se quiere rotar la clave del
usuario, se añadirá un evento key_rotation firmado por la
clave antigua y la nueva. No se implementa en MVP.
Propiedad

Toda entidad compartible incluye owner_id:

    collection_genesis.author_id → propietario de la colección.

    Cada evento posterior tiene author_id que debe coincidir
    con el owner_id (o un colaborador autorizado en el futuro).

En MVP: un solo autor por colección. No hay colaboradores.
Firmas de modificaciones

En MVP, todas las modificaciones las firma el mismo
collection_keypair (Hypercore), y el author_id del evento
debe coincidir con el owner_id del génesis. No hay firmas
individuales por evento más allá de la firma del bloque.

Cuando se añada multi-writer (Autobase, futuro), cada evento
llevará una firma adicional del usuario que lo emite. Se
documentará entonces.
Verificación de un bookmark

Un bookmark es válido si:

    Su add_bookmark está en el log de una colección válida.

    El resource_id coincide con sha256("v1:" + canonical_url).

    No ha sido eliminado por un remove_bookmark posterior.

No hay firma individual por bookmark. La integridad la da el log.
Resumen visual
text

User (u_93c4fa12...)
 │
 │ collection_genesis
 │ signature_by_owner
 ▼
Collection (3df0c93d...)
 │
 │ bloques firmados por collection_keypair
 ▼
Hypercore (log append-only)
 │
 │ add_bookmark / edit_bookmark / ...
 ▼
Bookmark (01J8XL...)
 │
 │ resource_id = sha256("v1:" + canonical_url)
 ▼
Resource (r_7f6a...)
 │
 ▼
URL (https://japan-guide.com/mountains)

text


---

# Vamos con el checklist, paso a paso

Vamos a ir **de uno en uno**. Para cada punto te presento:

- La pregunta concreta
- Las opciones
- Mi recomendación
- Y tú decides (o pides más contexto)

Empezamos por el primero, que es el más importante.

---

## Punto 1 de 14 — Formato exacto de eventos

**Pregunta:** ¿Está bien el schema que acabo de escribir en `docs/15-schema-eventos.md`, o quieres cambiar algo antes de fijarlo como contrato?

**Lo que he decidido en ese documento (para que lo valides):**

1. **9 tipos de evento** para v1: `collection_genesis`, `add_bookmark`, `edit_bookmark`, `remove_bookmark`, `move_bookmark`, `update_metadata`, `create_group`, `delete_group`. (Son 8 realmente, perdón: genesis + 7).

2. **Cada bloque incluye `schema_version` desde el día 1** — permite migrar sin reescribir.

3. **La URL canónica se embebe en cada `add_bookmark`** — así la colección es autocontenida y replicable sin depender de un registry global. Duplica un poco de información, pero la autonomía vale la pena.

4. **`bookmark_id` es un ULID generado por el autor** — ordenable por tiempo, único sin coordinación.

5. **Soft delete**: `remove_bookmark` marca como eliminado, no borra el bloque anterior.

6. **Fold del log → estado**: se aplica en orden, con reglas de idempotencia para replicación desordenada.

7. **Un solo autor por colección en MVP**. Multi-writer (Autobase) queda documentado como futuro.
