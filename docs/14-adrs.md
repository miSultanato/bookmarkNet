# Architecture Decision Records (ADRs)

Este documento recoge las decisiones arquitectónicas tomadas durante el diseño de BookmarkNet. Cada ADR es un registro corto: contexto, decisión, consecuencias y alternativas consideradas.

Los ADRs son inmutables una vez aceptados. Si una decisión cambia, se crea un nuevo ADR que supersede al anterior, y se anota en el original "Superseded by ADR-XXX".

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

### Consecuencias

- **Ventajas:** modelo de log append-only encaja con eventos; Hyperswarm resuelve NAT traversal sin infraestructura propia; Hyperbee da índices locales; ecosistema activo.
- **Inconvenientes:** single-writer por core (se resuelve con claves por colección); multi-writer requiere Autobase (fuera del MVP).

### Alternativas consideradas

- **IPFS:** content-addressed global, no versionado por colección, discovery por CID no por "colección viva".
- **Willow Protocol:** interesante a futuro, menos maduro, sin discovery DHT integrado.
- **Veilid:** orientado a anonimato, no a replicación de datos estructurados.
- **Earthstar:** peers undiscoverable by default, sin discovery.

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
  collection_id ||          // hex sin prefijo
  collection_public_key ||  // hex sin prefijo
  author_id ||              // "u_" + hex
  author_public_key ||      // "pk_user_" + hex
  name ||                   // UTF-8
  visibility ||             // "public" | "private" | "unlisted"
  (forked_from ?? "") ||    // collection_id o ""
  (migrated_from ?? "")     // collection_id o ""
)
```

Cada campo se serializa como string UTF-8. Los campos `null` se serializan como string vacío (`""`).

### Consecuencias

- **Ventajas:** determinista; cualquier nodo puede verificar la firma con `author_public_key`.
- **Inconvenientes:** cualquier cambio en la lista de campos firmados requiere una nueva versión del schema (`schema_version: 2`).

### Alternativas consideradas

- **Firmar el JSON completo:** descartado porque la serialización JSON no es determinista entre implementaciones (orden de claves, espacios, etc.).

## ADR-013: Contrato de eventos de `device_core`

**Fecha:** 2026-10-24  
**Estado:** Aceptado

### Contexto

El `device_core` contiene los borradores locales de las colecciones del usuario. Sus eventos son distintos de los del `collection_core` (que es el log público de una colección publicada). Hay que definir el schema de esos eventos.

### Decisión

El `device_core` tiene cuatro tipos de evento:

- `device_metadata`: perfil del usuario (nombre, bio, avatar).
- `device_collection`: referencia a una colección propia (publicada o borrador) con su `collection_id` y estado (`draft`, `published`, `unpublished`).
- `device_bookmark`: bookmark en una colección no publicada.
- `device_group`: grupo en una colección no publicada.

Ver `docs/03-identidad.md` para el detalle.

### Consecuencias

- **Ventajas:** schema separado del `collection_core`; los borradores no contaminan el log público.
- **Inconvenientes:** dos schemas que mantener. Pero son independientes: el `device_core` puede evolucionar sin afectar al `collection_core`.

### Alternativas consideradas

- **Reutilizar los eventos del `collection_core` en el `device_core`:** descartado porque el `device_core` tiene eventos que no existen en el `collection_core` (`device_metadata`, `device_collection`) y viceversa.

## Documentos relacionados

- `docs/20-stack-tecnico.md`: stack técnico (ADR-002).
- `docs/05-arquitectura-p2p.md`: arquitectura P2P (ADR-001, ADR-003, ADR-004).
- `docs/17-propuestas.md`: sistema de propuestas (ADR-008).
- `docs/18-seed-pack.md`: seed pack (ADR-005).
- `docs/22-configuracion.md`: configuración y seguridad (ADR-010).
- `docs/23-migraciones.md`: migraciones (ADR-007).
