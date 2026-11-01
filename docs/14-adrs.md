# Architecture Decision Records (ADRs)

Este documento recoge las decisiones arquitectónicas tomadas durante el diseño de BookmarkNet. Cada ADR es un registro corto: contexto, decisión, consecuencias y alternativas consideradas.

Los ADRs son inmutables una vez aceptados. Si una decisión cambia, se crea un nuevo ADR que supersede al anterior, y se anota en el original "Superseded by ADR-XXX".

Excepción: las correcciones de errores factuales (datos desactualizados, omisiones, discrepancias con la implementación o con otros documentos vigentes) se aplican in situ, y se documentan en una sección "### Corrección (fecha)" al final del ADR afectado. Las correcciones no cambian la decisión ni el estado del ADR; solo alinean su contenido con la realidad.

## Formato

Cada ADR sigue este formato:

```text
## ADR-XXX: Título

**Fecha:** YYYY-MM-DD
**Estado:** Aceptado | Superseded by ADR-YYY | Deprecado

### Contexto
¿Por qué hay que tomar esta decisión?

### Decisión
¿Qué se ha decidido?

### Consecuencias
¿Qué implica esta decisión? Ventajas e inconvenientes.

### Alternativas consideradas
¿Qué otras opciones se evaluaron y por qué se descartaron?
```

## ADR-001: Hypercore como stack P2P

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

BookmarkNet necesita un stack P2P para replicar colecciones de bookmarks entre nodos sin servidores centrales. Se evaluaron varias opciones: Hypercore, IPFS, Willow Protocol, Veilid, Earthstar.

### Decisión

Usar Hypercore + Hyperswarm + Hyperbee + Corestore como stack P2P base.

Estado por fases: Hypercore y Hyperswarm se usan desde MVP0. Hyperbee se utilizará como backend de la vista materializada en MVP1 (véase ADR-016). Corestore queda fuera de MVP1; su adopción se evaluará en una fase posterior si la gestión de múltiples Hypercores lo requiere.

### Consecuencias

- **Ventajas:** modelo de log append-only encaja con eventos; Hyperswarm resuelve NAT traversal sin infraestructura propia; Hyperbee da índices locales; ecosistema activo.
- **Inconvenientes:** single-writer por core (se resuelve con claves por colección); multi-writer requiere Autobase (fuera del MVP).

### Alternativas consideradas

- **IPFS:** content-addressed global, no versionado por colección, discovery por CID no por "colección viva".
- **Willow Protocol:** interesante a futuro, menos maduro, sin discovery DHT integrado.
- **Veilid:** orientado a anonimato, no a replicación de datos estructurados.
- **Earthstar:** peers undiscoverable by default, sin discovery.

### Corrección (2026-10-31)

Se aclara el estado real de Hyperbee y Corestore respecto a la decisión original: Hyperbee no estaba instalado ni en uso, y Corestore queda fuera de MVP1. ADR-016 concreta el uso de Hyperbee como backend de la vista materializada en MVP1.

## ADR-002: Bare + TypeScript como runtime

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

Hay que elegir lenguaje y runtime para el nodo. Opciones: Node.js + TypeScript, Bare + TypeScript, Rust, Deno, Bun.

### Decisión

Usar Bare + TypeScript desde el principio.

### Consecuencias

- **Ventajas:** entorno nativo del stack Hyper*; binario pequeño (~5-15 MB); multiplataforma real (desktop y móvil con el mismo core); patrón Pear-end + UI web local.
- **Inconvenientes:** comunidad más pequeña que Node.js; runtime menos conocido; algunas librerías de terceros requieren el shim bare-node.

### Alternativas consideradas

- **Node.js + TypeScript:** descartado por tamaño de binario (~30-50 MB) y falta de soporte móvil realista.
- **Rust:** descartado porque el ecosistema Hyper* en Rust no está maduro y reescribir el core costaría meses.
- **Deno / Bun:** descartados por no ser el entorno nativo de Hypercore y añadir capas de compatibilidad.

## ADR-003: Un par de claves por colección (no por usuario)

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

Hypercore es single-writer. Si se usa la clave del usuario como clave del core, un usuario solo puede tener un core (una sola colección). Eso rompe el modelo de compartir colecciones individuales.

### Decisión

Cada colección tiene su propio collection_keypair. El usuario firma el bloque 0 (collection_genesis) que vincula su identidad a la collection_public_key. Los bloques posteriores los firma collection_keypair (Hypercore).

### Consecuencias

- **Ventajas:** cada colección es un core independiente; se puede compartir, replicar, duplicar o dejar de seguir individualmente; los seeders pueden replicar una colección concreta.
- **Inconvenientes:** un usuario con N colecciones tiene N pares de claves. Se gestiona con Corestore (derivación determinista a partir de la clave maestra + nombre).

### Alternativas consideradas

- **Un core por usuario:** descartado porque rompe el modelo de compartir colecciones individuales.

## ADR-004: Sin Autobase en MVP (pospuesto a MVP futuro)

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

Autobase es multi-writer sobre Hypercore. Se podría usar para contribuciones a colecciones ajenas y para sincronización multidispositivo. Pero añade complejidad (linearización causal, permisos, checkpoints) que no es necesaria en MVP.

### Decisión

No usar Autobase en MVP. Las contribuciones se resuelven con el sistema de propuestas in-app (mensajes unidireccionales, sin multi-writer). La sincronización multidispositivo se resuelve con `device_core` + `user_index` (cores single-writer agregados localmente).

**Autobase se pospone a MVP futuro.** Cuando el producto esté validado (MVP5+), se revisará si merece la pena adoptarlo para `user_core` y/o para métricas globales de resources. Las decisiones actuales se tomaron para evitar Autobase en MVP. Si se adopta, se revisarán.

### Consecuencias

- **Ventajas:** simplicidad; coherente con single-writer; no requiere linearización causal.
- **Inconvenientes:** el `user_core` multidispositivo podría necesitar Autobase en el futuro si se quiere consistencia determinista. Se decide en su momento.
- **Revisión futura:** si se adopta Autobase, algunas decisiones actuales (`device_core` + `user_index`, propuestas sin Autobase) podrían revisarse.

### Alternativas consideradas

- **Autobase para propuestas:** descartado. Las propuestas son mensajes, no escrituras compartidas.
- **Autobase para user_core desde MVP2:** descartado por complejidad. Se evalúa en MVP futuro si el `device_core` + `user_index` no es suficiente.
- **Autobase para métricas globales:** pospuesto a MVP futuro.

## ADR-005: Seed pack con colecciones completas (no punteros)

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

El arranque en frío necesita resolver la sensación de vacío. Se evaluaron dos opciones: un seed_pack_core con punteros a colecciones, o un pack de colecciones completas empaquetadas en el binario.

### Decisión

El seed pack es un conjunto de colecciones completas, empaquetadas en el binario, que funcionan offline desde el primer arranque. Las colecciones se generan a partir de awesome-lists de GitHub (con fuente en la descripción) y colecciones curadas manualmente. Cada colección lleva el creator_peer_id del NAS o VPS del equipo.

### Consecuencias

- **Ventajas:** funciona offline; el usuario ve algo útil desde el primer arranque; las colecciones son reales, no punteros.
- **Inconvenientes:** el binario crece con el seed pack; hay que regenerar el seed pack cuando cambian las awesome-lists.

### Alternativas consideradas

- **Punteros a colecciones:** descartado porque no funciona offline y depende de peers disponibles.

## ADR-006: UI web local (sin Electron)

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

Hay que elegir cómo se presenta la UI al usuario. Opciones: Electron, Tauri, app nativa, UI web local servida por el core.

### Decisión

UI web local servida por el core en localhost. Sin Electron, sin Tauri, sin app nativa en desktop.

### Consecuencias

- **Ventajas:** simplicidad; el core sirve los assets estáticos; el usuario abre el navegador; sin dependencias de frameworks de escritorio; portable a móvil (WebView).
- **Inconvenientes:** el usuario tiene que abrir el navegador manualmente (o el core lo abre automáticamente si está configurado); no hay integración nativa con el sistema (bandeja, notificaciones).

### Alternativas consideradas

- **Electron:** descartado por tamaño y complejidad.
- **Tauri:** descartado por la misma razón; además, añade Rust al stack, que ya se descartó en ADR-002.

## ADR-007: Migración lazy + eager local (no in situ)

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

Los bloques de Hypercore son inmutables. Cuando cambia el schema de eventos, hay que decidir cómo se migran los datos existentes sin reescribir el log.

### Decisión

- Vista materializada: migración automática y transparente al arrancar (lazy).
- Colecciones no publicadas (device_core): migración eager automática (duplicar a v2, verificar, borrar v1).
- Colecciones publicadas (collection_core): migración explícita, con aviso único al autor y collection_unpublished + migrated_to.
- No hay migración in situ. Los bloques nunca se reescriben.

### Consecuencias

- **Ventajas:** coherente con la inmutabilidad de Hypercore; no hay reescritura; el usuario decide cuándo migrar las publicadas.
- **Inconvenientes:** la vista materializada se tiene que persistir en disco (Hyperbee o similar); las colecciones publicadas conviven con versiones antiguas de schema.

### Alternativas consideradas

- **Migración in situ:** descartada porque Hypercore no permite reescribir bloques.
- **Migración eager de publicadas:** descartada porque los seguidores no migran automáticamente.

## ADR-008: Propuestas in-app sin Autobase (MVP3+)

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

El diseño original mencionaba "Pull Request" para contribuir a colecciones ajenas. Pero Hypercore es single-writer, y Autobase queda fuera del MVP (ADR-004).

### Decisión

Las propuestas son mensajes unidireccionales. El proponente duplica la colección (copia congelada con forked_from), añade cambios, y envía una propuesta al autor original. El autor decide si acepta (escribiendo él mismo en su colección) o rechaza. Sin multi-writer.

Cuatro capas de control de abusos:

- Restricción de relación (solo puedes proponer a colecciones que has duplicado).
- Cuota de envío (límites diarios y por colección).
- Control absoluto del receptor (bloquear, silenciar, spam).
- Límite de exposición (diff de bookmarks, sin renderizado).

### Consecuencias

- **Ventajas:** sin Autobase; coherente con single-writer; control de abusos integrado.
- **Inconvenientes:** el flujo es manual (duplicar + enviar propuesta); no hay merge automático.

### Alternativas consideradas

- **Pull Request con Autobase:** descartado por complejidad y porque rompe el modelo single-writer.
- **Contribución directa:** descartada por la misma razón.

## ADR-009: Sin IA/NLP en búsqueda

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

La búsqueda podría ser semántica (embeddings, modelos de lenguaje) o literal (substring, case-insensitive). La semántica ofrece mejores resultados para búsquedas vagas, pero requiere IA/NLP.

### Decisión

Búsqueda literal, sin IA, sin NLP. Substring, case-insensitive, sobre título, descripción, tags y URL de bookmarks, y nombre y descripción de colecciones. Orden: colecciones primero, bookmarks después, tags al final.

### Consecuencias

- **Ventajas:** coherente con el principio "sin IA"; simple, rápido, local, sin dependencias; suficiente para URLs y tags.
- **Inconvenientes:** no encuentra sinónimos ni conceptos relacionados. Para eso están las colecciones curadas y los tags.

### Alternativas consideradas

- **Búsqueda semántica:** descartada por contradecir el principio "sin IA" y por el coste (modelo, CPU, almacenamiento).

## ADR-010: ALLOWED_HOSTS configurable para NAS

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

La API local corre en localhost. Pero el caso de uso del NAS (sin monitor ni teclado) requiere acceder a la UI desde otro dispositivo de la LAN. Limitar la API a solo localhost rompe ese caso de uso.

### Decisión

Validación de Host configurable mediante ALLOWED_HOSTS. Por defecto: localhost, 127.0.0.1, [::1]. El usuario puede añadir IPs o nombres de host de la LAN (ej. 192.168.1.100 para el NAS). Cualquier petición con un Host no permitido devuelve 421 Misdirected Request.

Además: validación de Origin en mutaciones, exigir Content-Type: application/json, y bind a 127.0.0.1 por defecto.

Además, para acceso desde la LAN, el usuario debe configurar `bind` a `0.0.0.0` en `config.json`. Por defecto, el servidor se bindea a `127.0.0.1`, lo que impide el acceso desde otros dispositivos aunque `ALLOWED_HOSTS` los permita. El acceso LAN requiere ambas configuraciones.

### Consecuencias

- **Ventajas:** el NAS es accesible desde la LAN; protección contra DNS rebinding y CSRF; el usuario controla qué hosts son válidos.
- **Inconvenientes:** el usuario tiene que configurar ALLOWED_HOSTS manualmente para el NAS; no hay autenticación (la API es local, pero accesible desde la LAN si se configura).

### Alternativas consideradas

- **Solo localhost:** descartado porque rompe el caso de uso del NAS.
- **ALLOWED_HOSTS=\*:** descartado por seguridad; el usuario debe añadir solo las IPs necesarias.

## ADR-011: Canonicalización de URLs

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

`resource_id` se deriva de la URL canónica. Si dos nodos canonicalizan la misma URL de forma distinta, generan `resource_id` distintos y el resource se duplica. La canonicalización debe ser determinista e idéntica en todos los nodos.

### Decisión

Aplicar los pasos definidos en `docs/04-canonicalizacion-url.md`:

1. Lowercase de scheme y host.
2. Eliminar `www.` del inicio del host.
3. Eliminar fragmento (`#...`).
4. Eliminar parámetros de tracking conocidos.
5. Mantener el resto de query params.
6. Ordenar los parámetros de query alfabéticamente por nombre (mantener orden de valores repetidos).
7. Eliminar el `?` vacío final.
8. Normalizar trailing slash (mantener tal cual, sin forzar).
9. `resource_id = "r_" + sha256("v1:" + canonical_url).hex()`.

### Consecuencias

- **Ventajas:** determinista; dos nodos generan el mismo `resource_id` para la misma URL.
- **Inconvenientes:** la versión `v1:` permite evolucionar la canonicalización en el futuro sin romper los `resource_id` existentes.

### Alternativas consideradas

- **Canonicalización sin ordenar query params:** descartada porque `?a=1&b=2` y `?b=2&a=1` son la misma URL y deben generar el mismo `resource_id`.

## ADR-012: Serialización de firmas del génesis

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

La firma del génesis (`signature_by_owner`) debe ser verificable por cualquier nodo. La serialización de los campos firmados debe ser determinista e idéntica en todos los nodos. Si no, la firma no se puede verificar.

### Decisión

La firma se calcula sobre la concatenación de los campos del génesis, en este orden:

```text
sha256(
  collection_id + "\x00" +
  collection_public_key + "\x00" +
  author_id + "\x00" +
  author_public_key + "\x00" +
  name + "\x00" +
  visibility + "\x00" +
  language + "\x00" +
  (forked_from ?? "") + "\x00" +
  (migrated_from ?? "")
)
```

Cada campo se serializa como string UTF-8. Los campos `null` se serializan como string vacío (`""`).

La firma incluye `author_id` y `author_public_key` para vincular criptográficamente la identidad del autor con el génesis. Sin estos campos, un atacante podría cambiar `author_id` sin invalidar la firma.

### Consecuencias

- **Ventajas:** determinista; cualquier nodo puede verificar la firma con `author_public_key`.
- **Inconvenientes:** cualquier cambio en la lista de campos firmados requiere una nueva versión del schema (`schema_version: 2`).

### Alternativas consideradas

- **Firmar el JSON completo:** descartado porque la serialización JSON no es determinista entre implementaciones (orden de claves, espacios, etc.).

### Corrección (2026-10-31)

Se incorporan `language` y el separador explícito `\x00`, y se añade la nota de seguridad sobre `author_id` y `author_public_key`. La versión anterior no reflejaba la implementación real de `src/events.ts` ni la especificación vigente de `docs/15` y `docs/16`.

## ADR-013: Contrato de eventos de `device_core`

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

El `device_core` contiene los borradores locales de las colecciones del usuario. Sus eventos son distintos de los del `collection_core` (que es el log público de una colección publicada). Hay que definir el schema de esos eventos.

### Decisión

El `device_core` define los siguientes doce eventos:

- `device_metadata`: reemplaza el perfil del usuario (nombre, bio, avatar).
- `device_create_collection`: crea una colección local en estado borrador.
- `device_update_collection`: modifica los metadatos de una colección local.
- `device_delete_collection`: marca una colección local como eliminada, junto con sus bookmarks y grupos.
- `device_add_bookmark`: añade un bookmark a una colección local o al Inbox global.
- `device_edit_bookmark`: modifica los campos de un bookmark existente.
- `device_remove_bookmark`: marca un bookmark como eliminado.
- `device_move_bookmark`: mueve un bookmark entre colecciones, grupos, raíz o Inbox global.
- `device_reorder_bookmark`: cambia la posición de un bookmark dentro de un grupo.
- `device_create_group`: crea un grupo en una colección local.
- `device_delete_group`: elimina un grupo y devuelve sus bookmarks a la raíz de la colección.
- `device_add_device`: añade un dispositivo a la lista local de dispositivos conocidos del `device_core`; la replicación de esa lista corresponde a MVP2.

Ver `docs/03-identidad.md` para el detalle de payloads y las reglas del fold.

### Consecuencias

- **Ventajas:** schema separado del `collection_core`; los borradores no contaminan el log público.
- **Inconvenientes:** dos schemas que mantener. Pero son independientes: el `device_core` puede evolucionar sin afectar al `collection_core`.

### Alternativas consideradas

- **Reutilizar los eventos del `collection_core` en el `device_core`:** descartado porque el `device_core` tiene eventos que no existen en el `collection_core` (`device_metadata`, `device_collection`) y viceversa.

### Corrección (2026-10-31)

Se sustituye la lista de cuatro tipos genéricos por los once eventos concretos `device_*`. `docs/03` es la especificación vigente de payloads y fold; ADR-013 había quedado en un nivel de abstracción que no reflejaba el contrato real.

Se añade `device_add_device` al contrato de eventos de `device_core`, que pasa de once a doce eventos. ADR-018 decidió que la lista de dispositivos conocidos reside en `device_core`, y ADR-019 la necesita para el backup de identidad; el evento no figuraba en el contrato original de este ADR.

### Corrección (2026-11-01)

El payload de `device_create_collection` incluye ahora `publicCollectionId`, el identificador público de la colección (clave pública Ed25519 en hexadecimal, sin prefijo). Se persiste en `device_core` junto al ULID local para permitir el mapeo `local_collection_id` ↔ `collection_id` definido en ADR-015.

## ADR-014: Derivación de la clave de `device_core`

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

El hallazgo **AUD-07** de la auditoría documental identificó una contradicción entre el contrato descrito y el comportamiento real de `device_core`. Véanse [`docs/28-auditoria-documentacion.md`](docs/28-auditoria-documentacion.md) y el [diagnóstico detallado de AUD-07 en `docs/29-diagnostico-device-core-key.md`](docs/29-diagnostico-device-core-key.md).

En MVP0, `src/storage/device-core.ts` abre el core mediante `new Hypercore(storagePath, { valueEncoding: 'json' })`: la aplicación no proporciona una clave derivada de la identidad. Además, `src/node/start.ts` abre `device_core` antes de ejecutar `loadIdentity()`. Por tanto, la identidad del usuario no interviene en la apertura actual.

La documentación anterior afirmaba que la clave se derivaba de `user_master_key` y, en algunos pasajes, de `user_master_key` junto con `node_id`. También mezclaba dos conceptos que deben quedar separados:

- La clave/material que Hypercore utiliza para identificar y firmar su log.
- El par de claves Ed25519 propio del dispositivo, que la aplicación derivará de la identidad del usuario y del identificador estable de ese dispositivo, y que proporcionará a Hypercore como `keyPair`.

La derivación HKDF-SHA256 ya utilizada para `collection_core` en `src/keys.ts` proporciona el patrón de separación de dominios que se reutilizará. Sin embargo, la derivación de dispositivo no está implementada actualmente.

La decisión de producto ya está tomada: se adopta la opción C del diagnóstico, pero su implementación se aplaza a MVP2. MVP1 no cambiará la apertura ni el comportamiento actual de `device_core`.

### Decisión

1. **Una clave independiente por dispositivo.** Cada dispositivo tendrá su propio par de claves Ed25519, derivado determinísticamente de `user_master_key` y de su `node_id` estable. Dos dispositivos de una misma identidad deberán obtener pares distintos si sus `node_id` son distintos.

2. **Algoritmo y separación de dominio.** En MVP2 se utilizará HKDF-SHA256, siguiendo el patrón ya aplicado a `collection_core`. El contexto de derivación será `bookmarknet:device:` seguido del `node_id`. El resultado de 32 bytes se utilizará como semilla Ed25519 para obtener el par de claves del dispositivo. La implementación deberá reutilizar la primitiva HKDF existente y mantener este dominio separado del dominio `bookmarknet:collection:`.

3. **Uso de la clave.** El par Ed25519 derivado será el material de clave del Hypercore de dispositivo y se proporcionará al abrirlo mediante la opción `keyPair` de Hypercore. Esta decisión no introduce una segunda firma de aplicación para cada evento: la firma de los bloques sigue siendo responsabilidad de Hypercore. La clave pública del dispositivo identifica el core; no debe confundirse con `user_public_key`, que identifica al usuario.

4. **Implementación diferida a MVP2.** En MVP1 se conserva el comportamiento actual de `device_core`: se mantiene la apertura por la ruta local existente, sin derivar ni pasar `keyPair`, y no se modifica el orden de arranque. La derivación no se considerará implementada hasta que se realicen los cambios de MVP2 y sus pruebas.

5. **Persistencia inmediata de `node_id`.** En MVP1 se generará y persistirá un `node_id` estable por instalación/dispositivo, aunque todavía no participe en la derivación. Se conservará entre reinicios y actualizaciones normales. El identificador pertenecerá al estado local del dispositivo y deberá almacenarse separado de la identidad portable del usuario (`identity.bmn` y su exportación), para que importar una identidad en otro dispositivo no copie accidentalmente el mismo `node_id`. Una instalación nueva que importe una identidad existente deberá obtener su propio identificador. La ruta y el formato concretos del almacenamiento local se fijarán en la implementación de MVP1; no forman parte de este contrato criptográfico.

6. **Datos de MVP0 y posibilidad de reset.** Dado que actualmente no hay usuarios reales, se permite coyunturalmente resetear los datos locales de MVP0 si fuera necesario para adoptar el nuevo modelo. El reset puede eliminar:
   - La identidad local, incluida la clave maestra y los datos de perfil asociados.
   - Los bookmarks, tanto los del Inbox global como los asociados a colecciones.
   - Las colecciones y sus grupos, junto con su estado local.
   - La configuración y preferencias locales almacenadas junto a los datos de la instalación.

   Esta autorización solo es válida mientras no existan usuarios reales ni datos de usuario que deban preservarse. **No es una propiedad estructural del producto ni una política permanente de almacenamiento.** Cuando existan usuarios reales, un reset destructivo dejará de ser aceptable como procedimiento ordinario: cualquier cambio incompatible de claves o almacenamiento deberá acompañarse de un plan de migración que preserve los datos, incluya copia de seguridad, verificación de integridad y una estrategia de recuperación/rollback. La existencia actual de pocos o ningún dato no justifica diseñar el sistema futuro suponiendo que siempre se podrán borrar.

7. **Orden de arranque en MVP2.** Cuando se implemente la derivación, el arranque deberá cargar y validar primero la identidad y el `node_id`, derivar el par Ed25519 del dispositivo y, después, abrir `device_core` con ese `keyPair`. Este cambio de orden queda expresamente fuera de MVP1.

8. **Verificación.** La implementación deberá incluir tests que comprueben determinismo para la misma combinación de `user_master_key` y `node_id`, separación para distintos `node_id`, separación para distintas claves maestras y compatibilidad del formato persistido. También deberá probarse la apertura y recuperación del core, así como la estrategia de transición desde los datos MVP0 existentes.

**Implementación: pendiente (MVP2).** La aceptación de este ADR registra la decisión arquitectónica; no significa que la derivación, el uso de `keyPair` ni el nuevo orden de arranque estén ya implementados.

### Consecuencias

- **Positivas:**
  - La clave de cada dispositivo queda vinculada a la identidad del usuario y separada de las claves de otros dispositivos de la misma identidad.
  - El diseño es coherente con la separación de dominios y la derivación determinista ya empleadas para `collection_core`.
  - Persistir `node_id` desde MVP1 evita tener que introducirlo y migrar su identidad de dispositivo justo cuando se implemente la replicación.
  - Se establece una base criptográfica para el modelo multidispositivo de MVP2, sin adelantar esa funcionalidad a MVP1.

- **Negativas y costes:**
  - En MVP2 habrá que cambiar el orden de arranque: cargar identidad y `node_id` antes de abrir `device_core`.
  - MVP1 deberá definir y persistir el formato de `node_id`, incluyendo validación, permisos, estabilidad y comportamiento ante reinstalación o restauración.
  - La derivación requiere tests estables de determinismo y separación entre dispositivos e identidades.
  - Cambiar el material de clave de un core existente puede impedir abrirlo con el nuevo `keyPair`. Antes de activar la derivación habrá que verificar el comportamiento de la versión de Hypercore utilizada y ejecutar una migración o transición explícita; no se asumirá que los cores MVP0 son compatibles automáticamente.
  - Un `node_id` clonado junto con los datos locales podría hacer que dos instalaciones derivasen la misma clave. La copia/restauración de datos de dispositivo deberá tratar este riesgo y distinguir entre recuperar el mismo dispositivo y registrar uno nuevo.

- **Alcance por fases:**
  - **MVP1:** persistir `node_id`; mantener sin cambios la apertura actual de `device_core`.
  - **MVP2:** implementar HKDF-SHA256, derivar el par Ed25519, abrir Hypercore con `keyPair`, cambiar el orden de arranque y resolver la transición de los datos anteriores.

### Alternativas consideradas

- **Opción A — Implementar la derivación inmediatamente, en MVP1.**  
  Descartada. Adelantaría al MVP1 un cambio que no es necesario para la persistencia local por colección sin replicación. También obligaría a cambiar ya el arranque y a resolver la compatibilidad de los cores MVP0 antes de que MVP1 necesite la capacidad multidispositivo. El diagnóstico AUD-07 documenta estos costes y riesgos; la decisión adoptada conserva el modelo objetivo de C sin adelantar su implementación.

- **Opción B — Corregir únicamente la documentación y mantener el modelo actual como solución definitiva.**  
  Descartada. Aunque describiría con precisión el comportamiento actual de MVP0, renunciaría al vínculo determinista entre identidad y core de dispositivo. La replicación multidispositivo necesitaría entonces otro mecanismo para identificar, distribuir y autorizar la clave del core, y no se cumpliría el objetivo arquitectónico de disponer de una clave independiente por dispositivo derivada de la identidad. El diagnóstico AUD-07 señala esta limitación.

- **Opción C — Derivación independiente por dispositivo, implementada en MVP2.**  
  **Aceptada.** Es la opción que mantiene una clave single-writer distinta por dispositivo, reutiliza el patrón HKDF-SHA256 de `collection_core` y permite preparar `node_id` en MVP1 sin cambiar todavía el arranque ni el almacenamiento actual de `device_core`.

## ADR-015: Creación de `collection_core` en MVP1

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

MVP1 introduce la persistencia local de `collection_core`: cada colección tendrá su propio Hypercore, almacenado localmente y sin publicación ni replicación en red. En MVP0, el `collection_core` existe únicamente como modelo de dominio —tipos, constructores de eventos y fold en `src/events.ts` y `src/fold.ts`—, pero todavía no se abre ni se persiste.

El contrato actual de MVP0 guarda las colecciones en `device_core`. Al incorporar un log independiente por colección hay que fijar cuatro aspectos relacionados: cuándo se crea ese log, qué evento lo inicializa, qué ocurre con las colecciones creadas bajo el modelo de MVP0 y cómo se relacionan el identificador local de la colección y su identificador público.

La decisión debe mantener separadas la persistencia local y la publicación. Crear un `collection_core` no implica anunciarlo, compartirlo ni replicarlo: esas capacidades pertenecen a MVP2.

### Decisión

1. **Creación junto con la colección local.** El `collection_core` se crea cuando se crea la colección en `device_core`, como parte del flujo asociado al evento `device_create_collection`. No se espera a que el usuario publique la colección. Desde MVP1, cada colección nueva dispone de su propio Hypercore local.

2. **Génesis para colecciones no publicadas.** Al crear una colección que todavía no está publicada, el primer evento de su `collection_core` es un `collection_genesis` con `visibility: "unlisted"`. No se añade un campo `status: "draft"`: `visibility` ya expresa que la colección no se ofrece públicamente. La diferencia entre una colección no publicada y una publicada es de red —si se anuncia o no el topic—, no de estructura del log ni de existencia del core. La creación y persistencia local del core no anuncian el topic.

3. **Reset de MVP0; sin migración automática.** La transición de MVP0 a MVP1 se realiza mediante un reset de los datos locales: antes del primer arranque de MVP1 se borra el `dataDir` utilizado por MVP0. Esta pérdida de datos está autorizada por ADR-014 mientras no haya usuarios reales. No existe migración automática de las colecciones de MVP0 ni se conserva su `device_core`. Después del reset, todas las colecciones presentes en `device_core` son colecciones creadas bajo MVP1; por ello, `startNode()` crea o comprueba el `collection_core` de todas las colecciones no eliminadas.

4. **Identificadores y mapeo local-público.**
   - `collection_uuid` es el ULID local y estable de la colección. En el `device_core` se conserva como identificador local.
   - El génesis del `collection_core` incluye ese mismo valor en el campo `local_collection_id`, de tipo ULID y con carácter informativo.
   - El `collection_id` público del génesis es la clave pública Ed25519 de la colección, codificada en hexadecimal y sin prefijo, de acuerdo con el contrato de identificadores vigente.
   - El `device_core` mantiene el mapeo `local_collection_id` → `collection_id`. Cuando necesita abrir el `collection_core`, resuelve primero el identificador público a partir del ULID local. `local_collection_id` no sustituye al `collection_id` público ni cambia su definición.

5. **Génesis obligatorio.** Un `collection_core` no puede existir sin génesis. El primer evento del log es siempre `collection_genesis` (bloque 0); un core vacío no constituye una colección válida. El génesis conserva el contrato de campos y firma definido en los documentos de schema e identificadores; `local_collection_id` añade la referencia local informativa y no redefine la identidad pública de la colección.

**Implementación: pendiente (MVP1).**

### Consecuencias

- **Ventajas:**
  - Hay un único modelo estructural: todo `collection_core` válido tiene un génesis desde el momento de su creación.
  - La colección queda preparada para publicarse en MVP2 sin cambiar la estructura del log ni crear entonces el core desde cero; la publicación podrá anunciar el topic y activar las capacidades de red previstas para esa fase.
  - El `device_core` puede resolver sin ambigüedad qué `collection_core` corresponde a cada colección local mediante el mapeo entre `local_collection_id` y `collection_id`.

- **Costes:**
  - El génesis de una colección todavía no publicada ocupa espacio local. Si el usuario la publica más adelante, ese mismo log será el que se anuncie y replique; no se anuncia antes de la publicación.
  - `local_collection_id` duplica el `collection_uuid` que ya guarda el `device_core`. La redundancia es deliberada: permite relacionar el identificador local con el identificador público contenido en el génesis.

- **Riesgos y consideraciones:**
  - El génesis es el primer bloque de un log append-only y no se reescribe. Si el usuario publica una colección y después la despublica, el génesis ya está escrito y conserva el valor de `visibility` que tuviera al crearse (por ejemplo, `"unlisted"` para el borrador o `"public"` si ese fue el valor fijado para el génesis en el flujo de publicación). La despublicación posterior se representa mediante `collection_unpublished` y el cese del anuncio del topic; no elimina ni modifica el génesis. Véase «Despublicar» en `docs/05-arquitectura-p2p.md`.
  - El reset elimina los datos locales de MVP0. El usuario debe realizarlo antes de arrancar MVP1; no debe reutilizar un `dataDir` de MVP0 esperando que la aplicación migre sus colecciones. Tras el reset, la inicialización de `collection_core` en `startNode()` puede aplicarse a todas las colecciones no eliminadas porque solo existen colecciones creadas bajo MVP1.

### Alternativas consideradas

- **Crear el `collection_core` al publicar.** Descartada. Obliga a construir y poblar el log en el momento de publicar, y deja a la colección sin `collection_core` durante todo el tiempo anterior. No satisface el objetivo de MVP1 de persistir localmente un Hypercore por colección desde su creación.

- **Añadir `status: "draft"` al génesis.** Descartada. `visibility: "unlisted"` ya representa que una colección no se ofrece públicamente. Un campo adicional duplicaría esa distinción, ampliaría el schema y obligaría a mantener compatibilidad o migraciones sin aportar una diferencia estructural necesaria.

- **Migrar las colecciones existentes de MVP0.** Descartada. ADR-014 permite el reset de los datos locales durante esta transición mientras no haya usuarios reales. Una migración eager de todas las colecciones antiguas añadiría trabajo y complejidad que no se justifican en esta fase.

## ADR-016: Vista materializada con Hyperbee en MVP1

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

MVP1 incorpora la persistencia de `collection_core` por colección y mantiene el `device_core` como log local del dispositivo. Sin una vista materializada persistida, el nodo tendría que reconstruir el estado recorriendo los logs en cada arranque, con un coste creciente a medida que aumenta el número de eventos y colecciones.

ADR-001 decidió incorporar Hyperbee al stack, pero el componente no estaba instalado ni se utilizaba. Por su parte, `docs/23-migraciones.md` contempla Hyperbee, SQLite o un archivo como posibles backends de la vista materializada, mientras que `docs/26-limitaciones-conocidas.md` recoge Hyperbee como mejora prevista. Es necesario fijar el backend y el alcance de las vistas, así como sus reglas de actualización, reconstrucción y migración de esquema.

### Decisión

1. **Backend: Hyperbee.** La vista materializada se persistirá con Hyperbee. Se descartan SQLite y un archivo JSON.

2. **Vistas materializadas en MVP1.** Se mantendrá una vista del estado del `device_core` (perfil, colecciones, bookmarks y grupos) y una vista del estado de cada `collection_core` (metadatos, bookmarks y grupos). Los índices de búsqueda por título, tag y URL canónica son una extensión prevista si el tiempo lo permite, pero no son obligatorios en MVP1.

3. **Actualización y coherencia.** Al arrancar, se comprobará si la vista materializada está al día respecto al log, tomando como referencia el último evento procesado. Si la vista está desfasada, se reconstruirá. Durante la sesión, la vista se actualizará con cada evento nuevo.

4. **Reconstrucción por fases.** En MVP1, la reconstrucción se hará mediante replay completo desde el log de Hypercore. En MVP2, se incorporará snapshot y replay únicamente de los eventos posteriores al snapshot.

5. **Migración de esquema.** Se aplicará migración lazy al arrancar: si cambia el esquema de la vista materializada, se reconstruirá con el nuevo esquema a partir del log. La política general de migraciones se define en `docs/23-migraciones.md`.

6. **Corestore fuera de MVP1.** En MVP1 se gestionarán los cores directamente con Hypercore. Corestore se evaluará en una fase posterior si la gestión de múltiples Hypercores lo requiere.

**Implementación: pendiente (MVP1).**

### Consecuencias

- **Ventajas:**
  - En un arranque normal, la carga de la vista evita recorrer todos los eventos y permite un coste O(1) respecto al número de eventos; las consultas indexadas tienen un coste O(log n).
  - La coherencia entre log y vista se recupera comprobando el último evento procesado y reconstruyendo cuando la vista queda desfasada.
  - La migración lazy permite adaptar automáticamente la vista al esquema vigente sin intervención manual del usuario.

- **Costes:**
  - Hay que gestionar la coherencia entre el log y la vista. Si la vista se corrompe, deberá reconstruirse desde el log.
  - Se necesitan tests específicos de reconstrucción y de migración lazy.
  - Hyperbee añade una nueva dependencia a `package.json`.

- **Riesgos y mitigaciones:**
  - Si la vista materializada se corrompe y la reconstrucción falla, el arranque puede fallar. La mitigación es reconstruirla desde el log de Hypercore, que sigue siendo la fuente de verdad.

### Alternativas consideradas

- **SQLite:** descartada. Añade una dependencia nativa que no encaja con el stack Hyper* ni con el runtime Bare.
- **Archivo JSON:** descartado. Sin índices, resulta lento con muchas colecciones y no escala bien para las consultas previstas.
- **Posponer Hyperbee a MVP2:** descartada. Mantendría un arranque lento con muchas colecciones y obligaría a migrar en MVP2 la vista desde un archivo JSON a Hyperbee, añadiendo trabajo.
- **Corestore en MVP1:** descartada. Aunque gestiona múltiples Hypercores, en MVP1 el número de cores es pequeño y pueden gestionarse directamente con Hypercore. Su adopción se evaluará en una fase posterior si resulta necesaria.

## ADR-017: Persistencia y ciclo de vida de `node_id` en MVP1

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

ADR-014 decidió que en MVP1 se persiste un `node_id` estable por dispositivo, sin cambiar la apertura actual de `device_core`. La derivación de la clave Ed25519 del dispositivo queda aplazada a MVP2.

El formato del identificador ya está definido en `docs/16-identificadores-y-firmas.md`: `"n_" + random(8 bytes).hex()`. Esto produce un identificador con el prefijo `n_` seguido de 16 caracteres hexadecimales. Sin embargo, no se había concretado dónde se guarda, cómo se valida, qué ocurre durante una reinstalación o al restaurar un backup, ni cuál es su relación con `device_core`.

El `node_id` será una entrada de la derivación de la clave del dispositivo prevista para MVP2: HKDF-SHA256 con separación de dominio `"bookmarknet:device:" + node_id`, aplicada a `user_master_key` (ADR-014). Por tanto, debe persistirse de forma estable desde MVP1, aunque todavía no intervenga en la apertura de `device_core`.

### Decisión

1. **Ubicación independiente.** El `node_id` se guarda en `dataDir/node_id`, en un archivo propio. Se mantiene separado de `identity.bmn`, para que exportar o importar la identidad del usuario no copie el identificador del dispositivo, y separado de `config.json`, para que borrar o regenerar la configuración no lo elimine.

2. **Formato de texto.** El archivo contiene una única línea de texto plano con el formato `n_` seguido de 16 caracteres hexadecimales y un salto de línea final: `n_xxxxxxxxxxxxxxxx\n`. No se utiliza JSON ni formato binario. Los 16 caracteres hexadecimales representan los 8 bytes aleatorios definidos por `docs/16-identificadores-y-firmas.md`.

3. **Validación y corrupción.** Al cargar el archivo se valida el formato completo: prefijo `n_`, longitud exacta y únicamente caracteres hexadecimales después del prefijo, además del salto de línea final. Si el archivo no existe o su contenido no cumple el formato, se genera y persiste un `node_id` nuevo. Un identificador ausente o corrupto no debe impedir el arranque.

4. **Reinstalación.** Una reinstalación normal conserva el `node_id`: el instalador no elimina `dataDir`. Si el usuario quiere registrar un dispositivo nuevo, puede borrar manualmente `dataDir/node_id`; al siguiente arranque se generará otro. Una opción específica en la configuración para registrar un dispositivo nuevo se reserva para MVP2.

5. **Restauración de backup.** En MVP1, restaurar un backup regenera siempre el `node_id`, incluso si se restaura en el mismo dispositivo. No se permite clonar el identificador de un dispositivo mediante la restauración. La opción de conservar el `node_id` para recuperar el mismo dispositivo se implementará en MVP2, cuando exista red y sea posible detectar identificadores duplicados.

6. **Separación de `device_core`.** El `node_id` vive fuera de `device_core`, en `dataDir/node_id`. No se almacena como evento ni como dato dentro del core. En MVP1, su carga y persistencia no cambian la apertura actual de `device_core`; la relación con la derivación de su clave se aplicará en MVP2 conforme a ADR-014.

**Implementación (MVP1):** `src/node/node-id.ts`; carga en `startNode()` y exposición de lectura mediante `GET /api/v1/node/id`.

### Consecuencias

- **Ventajas:**
  - El `node_id` es estable desde MVP1 y sobrevive a reinicios y reinstalaciones normales.
  - Al estar separado de `identity.bmn`, importar una identidad en otro dispositivo no copia el identificador del dispositivo original.
  - Al estar separado de `config.json`, borrar o regenerar la configuración no elimina accidentalmente la identidad local del dispositivo.
  - La validación es robusta: un archivo ausente o corrupto se resuelve regenerando el identificador, en lugar de bloquear el arranque.
  - MVP2 podrá utilizar el identificador persistido en la derivación HKDF-SHA256 prevista por ADR-014 sin introducir entonces una migración de almacenamiento.

- **Costes:**
  - Se añade un archivo más a `dataDir` y hay que gestionar su lectura, validación, creación y persistencia.
  - La aplicación debe tratar explícitamente el caso de un `node_id` corrupto y generar uno nuevo.
  - La restauración de un backup regenera el `node_id`; este comportamiento puede sorprender al usuario y deberá explicarse en la UI y en el README.

- **Riesgos y consideraciones:**
  - Si el usuario borra `dataDir/node_id`, el siguiente arranque genera otro identificador. No es grave en MVP1, porque el identificador aún no determina la clave de `device_core`; en MVP2 cambiará la identidad criptográfica del dispositivo.
  - Si el usuario restaura un backup en el mismo dispositivo, también se regenera el `node_id`. No es grave en MVP1; en MVP2 deberá ofrecerse una opción explícita de «conservar node_id» para recuperar el mismo dispositivo.
  - La política de regeneración evita que una restauración cree dos instalaciones con el mismo identificador. La detección de duplicados en red y la recuperación controlada del identificador original quedan para MVP2.

### Alternativas consideradas

- **Guardar `node_id` en `identity.bmn`.** Descartada. La identidad es portable entre dispositivos; incluir el identificador local haría que importar una identidad copiase también el `node_id`, contradiciendo la separación establecida por ADR-014.

- **Guardar `node_id` en `config.json`.** Descartada. Borrar o regenerar la configuración eliminaría también el identificador del dispositivo, aunque este deba conservarse de forma independiente.

- **Guardar `node_id` dentro de `device_core`.** Descartada. `device_core` es single-writer y el identificador debe existir antes de abrirlo para poder derivar su clave en MVP2. Almacenarlo dentro del propio core introduciría una dependencia circular.

- **Usar JSON o formato binario.** Descartados. Un archivo de texto plano con un prefijo y una longitud fija es más simple, legible y suficiente para un identificador de 8 bytes.

- **Fallar el arranque si `node_id` está corrupto.** Descartada. En MVP1 el identificador no es crítico para abrir `device_core`; regenerarlo es más robusto y evita que una corrupción local impida iniciar la aplicación.

- **Conservar `node_id` al restaurar un backup en MVP1.** Descartada. Permitirlo podría clonar un dispositivo y producir dos instalaciones con la misma identidad de dispositivo. Se evaluará en MVP2, cuando la red permita detectar duplicados y se pueda ofrecer una recuperación explícita del mismo dispositivo.

## ADR-018: Separación entre identidad portable y estado del dispositivo

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

ADR-014 decidió que cada dispositivo tendrá su propio par de claves Ed25519, derivado de `user_master_key` y `node_id` mediante HKDF-SHA256 con separación de dominio `bookmarknet:device:` + `node_id`. Esa derivación se implementará en MVP2. ADR-017 concretó que `node_id` se persiste desde MVP1 en un archivo local independiente y definió su ciclo de vida.

La identidad portable del usuario se representa mediante `identity.bmn`: contiene la clave maestra del usuario (`user_master_key`), su clave pública (`public_key`) y su perfil (`displayName`, `bio`, `avatar`). Hasta ahora no estaba suficientemente delimitado qué datos formaban parte de ese archivo, qué debía exportarse e importarse mediante la API ni dónde debía residir la lista de dispositivos conocidos.

Es necesario separar dos ámbitos: la identidad portable, que pertenece al usuario y puede trasladarse entre instalaciones, y el estado del dispositivo, que pertenece a una instalación concreta. El identificador `node_id`, el `device_core` y la configuración local no deben viajar al importar la identidad en otro dispositivo.

### Decisión

1. **Contenido de `identity.bmn`.** El archivo contiene exclusivamente la identidad portable del usuario: `user_master_key` (32 bytes), `public_key` y el perfil (`displayName`, `bio`, `avatar`). No contiene `node_id`, datos de `device_core` ni configuración del dispositivo.

2. **Exportación de identidad.** `POST /api/v1/identity/export` exporta únicamente `identity.bmn`,  cifrado con la contraseña proporcionada. No incluye `node_id`, `device_core` ni configuración. La exportación es de identidad, no un backup completo del dispositivo.

3. **Importación de identidad.** `POST /api/v1/identity/import` importa únicamente `identity.bmn`.  El dispositivo importador genera su propio `node_id` conforme a ADR-017; nunca se importa el `node_id` del dispositivo de origen. Tampoco se importan su `device_core` ni su configuración.

4. **Ubicación de la lista de dispositivos.** La lista de dispositivos conocidos pertenece al estado local de `device_core`,  no a `identity.bmn`.  Se representará mediante un nuevo evento `device_add_device`, que se añadirá al contrato de eventos de `device_core` en el paso 8 de esta fase (corrección de `docs/03-identidad.md` y ADR-013). En MVP1 la lista es local: cada dispositivo conoce los dispositivos que se le han añadido, pero la lista no se replica. La replicación corresponde a MVP2.

5. **Estado inicial de un dispositivo importador.** Un dispositivo nuevo que importa una identidad existente obtiene su propio `node_id` y comienza con la lista de dispositivos vacía. Una eventual opción para importar manualmente esa lista queda fuera de MVP1 y solo se considerará si se define expresamente en el futuro.

**Implementación: pendiente (MVP1). El evento `device_add_device` se añadirá al contrato de `device_core` en una tarea posterior de esta misma fase.**

### Consecuencias

- **Ventajas:**
  - Separa de forma explícita la identidad portable del usuario y el estado propio de cada dispositivo.
  - Importar una identidad en un dispositivo nuevo no copia el `node_id`, el `device_core` ni la configuración de la instalación de origen.
  - La lista de dispositivos queda en el log local de `device_core`; en MVP2 podrá replicarse entre dispositivos sin cambiar el modelo de propiedad de esos datos.

- **Costes:**
  - Hay que añadir el evento `device_add_device` al contrato de `device_core`, junto con su payload y comportamiento de fold. Se hará en el paso 8 de esta fase, no en este ADR.
  - En MVP1 la lista de dispositivos es local y no se replica. Esta limitación puede confundir al usuario y deberá explicarse en la UI y en el README.

- **Riesgos y consideraciones:**
  - Al importar una identidad en un dispositivo nuevo, su lista de dispositivos empieza vacía; no refleja automáticamente los dispositivos conocidos por las otras instalaciones. En MVP2, la replicación permitirá unificar esa información.
  - En MVP1 no se puede recuperar el mismo dispositivo importando una identidad: la importación genera un `node_id` nuevo y clonar el identificador no está permitido. En MVP2 se ofrecerá la opción de «conservar node_id» con detección de duplicados, conforme a ADR-017.

### Alternativas consideradas

- **Incluir `node_id` en `identity.bmn`.** Descartada. Importar la identidad copiaría el identificador del dispositivo de origen, contradiciendo la separación entre identidad portable y dispositivo establecida por ADR-014 y concretada por ADR-017.

- **Incluir la lista de dispositivos en `identity.bmn`.** Descartada. La lista es estado del dispositivo, no identidad portable. Además, al importar el archivo en una instalación nueva podría quedar desactualizada y no representaría necesariamente el estado local de esa instalación.

- **Incluir la configuración en `identity.bmn`.** Descartada. La configuración (por ejemplo, opciones de red, puerto o preferencias locales) pertenece al dispositivo y no debe trasladarse automáticamente junto con la identidad del usuario.

- **Exportar también `node_id` y `device_core` mediante `POST /api/v1/identity/export`.** Descartada. Ese endpoint exporta identidad, no datos del dispositivo. El alcance y formato de un backup completo del dispositivo se tratarán por separado en ADR-019.

- **Guardar la lista de dispositivos en `dataDir/devices.json`.** Descartada. En MVP2 habría que migrar ese archivo a `device_core` para poder replicar la lista entre dispositivos. Mantener desde MVP1 el estado en `device_core` evita introducir esa deuda técnica.

## ADR-019: Backup y pérdida de datos en MVP1

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

En MVP0 no existe un backup completo del dispositivo. El archivo `identity.bmn` contiene únicamente la identidad portable del usuario (`user_master_key`, `public_key` y perfil): no contiene bookmarks ni colecciones. Por tanto, si el usuario pierde el dispositivo, pierde los bookmarks y las colecciones no publicadas que solo existían localmente.

MVP1 introduce la persistencia de un `collection_core` por colección (ADR-015), mantiene el `device_core` y persiste un `node_id` propio del dispositivo (ADR-017). Esto aumenta los datos que deben preservarse y permite distinguir la identidad portable del estado local que debe recuperarse. Hay que decidir qué incluye cada backup, cómo se genera, cómo se restaura y qué ocurre ante la pérdida del dispositivo.

La recuperación de identidad mediante QR o frase larga es un mecanismo independiente del backup: permite recuperar la identidad portable en un dispositivo nuevo, pero no sustituye la copia de los datos locales.

### Decisión

1. **Backup de identidad.** Incluye `identity.bmn` —`user_master_key`, `public_key` y perfil— y la lista de dispositivos conocidos. Esta lista se obtiene del `device_core` mediante el evento `device_add_device`; si todavía no existe o está vacía, el backup incluye una lista vacía. No incluye `node_id`, `device_core` ni configuración del dispositivo. El archivo de identidad se cifra con contraseña.

2. **Backup de colecciones.** Incluye todos los `collection_core` locales, estén publicados o no, y el `device_core`. No incluye `identity.bmn`, que pertenece al backup de identidad. Ambos conjuntos se empaquetan en un único archivo; el formato concreto (por ejemplo, `tar.gz`) se decidirá durante la implementación.

3. **Generación de backups.** Se admiten dos modalidades:
   - **Manual:** el usuario solicita el backup mediante `POST /backup`.
   - **Automática:** se genera periódicamente en `dataDir/backups/`. El intervalo se fijará en la implementación; el valor predeterminado será de 24 horas.

4. **Restauración.** `POST /restore` ofrece dos modos:
   - **«Restaurar todo»:** restaura la identidad, las colecciones y la lista de dispositivos. Conforme a ADR-017, genera un `node_id` nuevo; nunca restaura el identificador del dispositivo de origen.
   - **«Restaurar solo colecciones»:** restaura los `collection_core` y el `device_core` sin modificar `identity.bmn` y sin regenerar `node_id`.

5. **Recuperación de identidad por QR o frase larga.** Al crear la identidad se genera un mecanismo de recuperación que se muestra una sola vez al usuario. No forma parte del backup. En MVP1 permite recuperar únicamente la identidad portable en un dispositivo nuevo, sin necesitar un backup completo. El mecanismo concreto —por ejemplo, BIP39 con una frase de 12 o 24 palabras, o un QR con la clave cifrada— se decidirá durante la implementación. Este mecanismo es distinto del QR temporal del flujo de añadir dispositivo.

6. **Política de pérdida de datos.**
   - Si el usuario pierde su único dispositivo y no había publicado sus colecciones, pierde los bookmarks y las colecciones locales; solo puede recuperar la identidad mediante el QR o la frase de recuperación.
   - Si había publicado colecciones, podrá recuperarlas desde peers cuando exista replicación en MVP2, o desde un backup si dispone de él.
   - La política y sus límites deben explicarse en el README y en la UI.

### Consecuencias

- **Ventajas:**
  - El usuario puede recuperar su identidad y sus colecciones si pierde el dispositivo, siempre que disponga del mecanismo de recuperación y/o de los backups correspondientes.
  - El backup automático reduce el riesgo de pérdida de los cambios recientes.
  - Separar el backup de identidad del de colecciones permite restaurar solo los datos necesarios y mantener independiente la identidad portable.

- **Costes:**
  - Hay que implementar `POST /backup` y `POST /restore`, incluidos los dos modos de restauración.
  - Hay que gestionar la tarea periódica, el espacio en disco y la rotación de backups automáticos.
  - Hay que documentar la política de pérdida de datos en el README y en la UI.

- **Riesgos y mitigaciones:**
  - Sin backup, la pérdida del dispositivo implica perder los bookmarks y colecciones no publicados. La mitigación es ofrecer backup manual y automático y explicar sus límites.
  - Un backup corrupto puede impedir la restauración. Se mitigará mediante verificación de integridad antes de aceptar el backup y antes de completar la restauración.
  - Si el backup se genera o almacena en un dispositivo comprometido, un atacante podría acceder a los datos. Los backups exportados deberán cifrarse con contraseña; se recomienda además mantener rotación de copias para reducir el impacto de corrupción o pérdida de una versión.

**Implementación: pendiente (MVP1).** El evento `device_add_device` (necesario para el backup de identidad) se añadirá al contrato de `device_core` en una tarea posterior de esta misma fase.

### Alternativas consideradas

- **No hacer backup en MVP1.** Descartada: el usuario perdería los datos locales al perder el dispositivo, lo que perjudicaría la confianza en el producto.
- **Hacer backup solo de identidad.** Descartada: permitiría recuperar la identidad, pero no las colecciones ni los bookmarks no publicados.
- **Hacer backup solo de colecciones.** Descartada: no recuperaría la identidad; el usuario tendría que recuperarla por QR o frase, que es un mecanismo independiente.
- **Usar backup en la nube.** Descartada: contradice el principio local-first y la ausencia de servidores centrales.
- **Incluir `node_id` en el backup.** Descartada: contradice ADR-017; la restauración de un backup completo regenera el identificador.
- **Conservar `node_id` al restaurar en MVP1.** Descartada: permitirlo podría clonar un dispositivo. ADR-017 reserva la recuperación del mismo identificador para MVP2, cuando pueda detectarse duplicación.
- **Incluir el QR o la frase de recuperación en el backup.** Descartada: son un mecanismo independiente para recuperar la identidad, se generan al crearla y se muestran una sola vez; no son parte de una copia de seguridad.

## Documentos relacionados

- `docs/20-stack-tecnico.md`: stack técnico (ADR-002).
- `docs/05-arquitectura-p2p.md`: arquitectura P2P (ADR-001, ADR-003, ADR-004).
- `docs/17-propuestas.md`: sistema de propuestas (ADR-008).
- `docs/18-seed-pack.md`: seed pack (ADR-005).
- `docs/22-configuracion.md`: configuración y seguridad (ADR-010).
- `docs/23-migraciones.md`: migraciones (ADR-007).
