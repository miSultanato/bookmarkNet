# Migraciones de schema

Este documento define cómo evoluciona el schema de eventos y cómo se migran los datos existentes sin reescribir Hypercores.

## Principios

- Los bloques son inmutables. Un bloque escrito con `schema_version: 1` se queda con `schema_version: 1` para siempre. Nunca se reescribe.
- La migración se hace en la vista materializada. El log conserva la historia; la vista materializada se construye aplicando el fold con las migraciones necesarias.
- El `schema_version` es obligatorio. Cada bloque lo lleva. El fold comprueba la versión y aplica la migración correspondiente. Si el nodo encuentra una versión que no conoce (más nueva), rechaza el bloque y avisa al usuario.

## Función de migración

Una función de migración por tipo de evento y por cambio de schema. Se aplica en dos momentos:

- Al vuelo (fold): cuando el nodo lee un bloque antiguo, aplica la migración para construir la vista materializada.
- Al duplicar: cuando el usuario duplica una colección, se lee el estado actual (ya migrado) y se escribe en un `collection_core` nuevo en la versión actual.

Ejemplo:

```text
migrate_add_bookmark(bloque, target_version):
  if bloque.schema_version < 2:
    bloque.resource_id = sha256("v2:" + canonical_url_v2)
  if bloque.schema_version < 3:
    bloque.tags = convert_tags_v3(bloque.tags)
  if bloque.schema_version < 4:
    bloque.group_id = bloque.group_id ?? null
  return bloque
```

## Migración de la vista materializada

- Siempre automática y transparente. Al arrancar, el nodo lee los bloques del log, aplica las migraciones al vuelo, y guarda la vista materializada en la versión actual.
- Persistida en disco. La vista materializada se guarda en un índice local (Hyperbee, SQLite o archivo). No se recalcula en cada arranque.
- Solo se recalcula cuando llegan bloques nuevos o cuando la vista no existe.
- El usuario no hace nada. No sabe que ha habido una migración.

## Migración de colecciones no publicadas

- Eager automática. Al actualizar la app a una nueva versión de schema, el nodo detecta los `device_core` con bloques antiguos y los migra:
  1. Duplicar los bloques a la versión actual en un `device_core` nuevo.
  2. Verificar que el fold del nuevo produce el mismo estado (o el esperado).
  3. Actualizar el `user_index` para apuntar al nuevo.
  4. Borrar los datos locales del `device_core` viejo (dejar de replicarlo y eliminar del disco).
- No hay intervención del usuario. Nadie más tiene esos datos. Borrar el log viejo local es seguro.
- Coherente con la regla 1: no se reescribe el log, se crea uno nuevo y se borra el viejo.

## Migración de colecciones publicadas

- Explícita. El autor decide cuándo migrar. La app muestra un aviso único al arrancar después de actualizar: "Tienes N colecciones publicadas en v1. ¿Migrar a v2? [Migrar] [Más tarde]".
- Si el autor pulsa "Migrar":
  1. Duplicar la colección a la versión actual (nuevo `collection_core` con nuevo `collection_id`).
  2. Despublicar el v1: escribir `collection_unpublished` con `migrated_to: <nuevo_collection_id>`.
  3. Publicar el nuevo.
  4. Los seguidores del v1 reciben el aviso y pueden seguir el nuevo.
- Si el autor pulsa "Más tarde": no se vuelve a mostrar el aviso hasta la siguiente versión de schema. El autor puede migrar cuando quiera desde ajustes o desde la propia colección.
- No hay migración automática. Los seguidores del v1 no migran solos. El autor decide.

## Flujo de migración de una colección publicada

1. Autor tiene "Japón 2027" publicada en v1 (`collection_id: A`).
2. Autor actualiza la app a v2.
3. La app muestra el aviso: "Tienes 1 colección publicada en v1. ¿Migrar a v2? [Migrar] [Más tarde]".
4. Autor pulsa "Migrar".
5. La app duplica A a v2 en un `collection_core` nuevo con `collection_id: B`. `migrated_from: A`.
6. La app escribe `collection_unpublished` en A con `migrated_to: B`.
7. La app deja de anunciar el topic de A.
8. La app publica B.
9. Los seguidores de A reciben `collection_unpublished` con `migrated_to: B`. La UI muestra:
   "Marta ha dejado de compartir esta colección.
   Ha migrado a una nueva versión.
   [Seguir la nueva versión]"
10. Si el seguidor pulsa "Seguir", su nodo deja de seguir A y empieza a seguir B.

**Diferencia entre `forked_from` y `migrated_from`:** `forked_from` indica que la colección es una copia congelada de otra (duplicar). `migrated_from` indica que la colección es una migración de schema de otra. Son mutuamente excluyentes.

## Lo que NO se hace

- No hay migración in situ. Los bloques nunca se reescriben.
- No hay migración eager de colecciones publicadas. Los seguidores no migran solos.
- No hay ventana de soporte de versiones. Un usuario con datos en v1 puede actualizar directamente a v10; el fold aplica todas las migraciones necesarias al vuelo.
- No hay migración por par de versiones. Solo hay una función por tipo de evento y por cambio de schema.

## Compatibilidad hacia atrás por defecto

Si el cambio de schema es compatible (añadir un campo opcional, aceptar un valor nuevo en un enum), no hay función de migración. El fold lee el bloque antiguo y lo trata como si fuera el nuevo, con valores por defecto.

Solo los cambios incompatibles (cambiar el significado de un campo, cambiar la canonicalización, cambiar la estructura de un tipo) requieren función de migración.
