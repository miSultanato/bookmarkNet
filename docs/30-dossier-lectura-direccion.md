# Dossier de lectura para dirección

**Proyecto:** Lotura (nombre técnico: BookmarkNet)  
**Fecha de lectura:** 2026-10-31  
**Base de referencia:** `main`, commit `c101679a60a27d0263c04b65818e535f690e5b78`  
**Alcance:** lectura y síntesis documental. No se han modificado documentos existentes ni código.

> **Criterio de lectura:** «Vigente» significa que el documento ofrece una definición coherente con el estado documental y las decisiones conocidas; no significa que la funcionalidad esté implementada. «Parcialmente obsoleto» identifica afirmaciones, fases o contratos que necesitan reconciliación. «Obsoleto» se reserva para contenido cuyo contrato principal ya no corresponde al modelo actual.

## 1. Mapa del repositorio documental

La documentación base solicitada comprende 30 archivos: README, `docs/00`–`docs/27` y `docs/branding/README.md`. Se revisaron además los tres documentos de auditoría/decisión solicitados como anexos: `docs/28`, `docs/29` y ADR-014. Estos tres anexos están accesibles en ramas de PR, pero no en `main`.

| Archivo | Propósito (1 línea) | Estado | Prioridad para MVP1 |
|---|---|---|---|
| `README.md` | Presentación, instalación, arranque, uso y estado del producto. | parcialmente obsoleto | alta |
| `docs/00-vision.md` | Problema, propuesta de valor y visión a largo plazo de Lotura. | vigente | baja |
| `docs/01-principios.md` | Principios arquitectónicos y límites de producto no negociables. | vigente | alta |
| `docs/02-modelo-datos.md` | Entidades, relaciones y ciclo de vida de User, Node, Resource, Bookmark y Collection. | parcialmente obsoleto | alta |
| `docs/03-identidad.md` | Identidad criptográfica, dispositivos, backup y eventos de `device_core`. | parcialmente obsoleto | alta |
| `docs/04-canonicalizacion-url.md` | Algoritmo v1 para canonicalizar URL y derivar `resource_id`. | vigente | media |
| `docs/05-arquitectura-p2p.md` | Arquitectura Hypercore/Hyperswarm, claves, replicación y publicación. | parcialmente obsoleto | alta |
| `docs/06-descubrimiento.md` | Resolución de enlaces `bmn://`, topics, peers, replicación y fases de discovery. | parcialmente obsoleto | media |
| `docs/07-api-local.md` | Contrato HTTP local, endpoints, errores y correspondencia con eventos. | parcialmente obsoleto | alta |
| `docs/08-bootstrap-y-seeds.md` | Diferencia entre bootstrap peers y seed peers, y estrategia inicial de disponibilidad. | vigente | baja |
| `docs/09-roadmap-mvp.md` | Alcance funcional y objetivos de MVP0–MVP5. | parcialmente obsoleto | alta |
| `docs/10-riesgos.md` | Riesgos de producto/P2P y mitigaciones previstas por fase. | vigente | media |
| `docs/11-glosario.md` | Definiciones comunes de entidades, red, almacenamiento y fases. | parcialmente obsoleto | alta |
| `docs/12-testing.md` | Estrategia de unit, integration, property-based, E2E y CI. | parcialmente obsoleto | alta |
| `docs/13-ui-ux.md` | Principios de UX, pantallas y fases de implementación de la UI. | parcialmente obsoleto | media |
| `docs/14-adrs.md` | Registro numerado de decisiones arquitectónicas aceptadas. | parcialmente obsoleto | alta |
| `docs/15-schema-eventos.md` | Schema v1 de eventos de `collection_core`, fold y firma. | parcialmente obsoleto | alta |
| `docs/16-identificadores-y-firmas.md` | Formatos de IDs, jerarquía de claves y verificación criptográfica. | parcialmente obsoleto | alta |
| `docs/17-propuestas.md` | Diseño futuro de propuestas unidireccionales (MVP3+). | vigente | baja |
| `docs/18-seed-pack.md` | Diseño del conjunto de colecciones iniciales empaquetadas en el binario. | vigente | baja |
| `docs/19-onboarding.md` | Flujo de primera ejecución, creación/importación de identidad e importación HTML. | vigente | media |
| `docs/20-stack-tecnico.md` | Runtime Bare, estructura técnica, dependencias previstas y restricciones TypeScript. | parcialmente obsoleto | alta |
| `docs/21-distribucion.md` | Formatos, publicación de releases, Docker y actualización. | vigente | media |
| `docs/22-configuracion.md` | Configuración del nodo, puertos, datos, seguridad HTTP y arranque. | parcialmente obsoleto | media |
| `docs/23-migraciones.md` | Política de evolución de schemas y migración de cores/vistas. | parcialmente obsoleto | alta |
| `docs/24-ui-vision.md` | Dirección visual de Lotura y wireframes de MVP2–MVP5. | parcialmente obsoleto | baja |
| `docs/25-busqueda-i18n.md` | Modelo de idioma de colección y diseño de búsqueda multilingüe. | vigente | baja |
| `docs/26-limitaciones-conocidas.md` | Limitaciones operativas MVP0 y mejoras de almacenamiento previstas. | parcialmente obsoleto | alta |
| `docs/27-trazabilidad.md` | Matriz de funcionalidad ↔ documentación ↔ código ↔ tests ↔ estado. | parcialmente obsoleto | alta |
| `docs/branding/README.md` | Especificación geométrica, cromática y tipográfica de la marca. | vigente | baja |
| `docs/28-auditoria-documentacion.md` | Auditoría pre-MVP1 con diez hallazgos AUD-01..AUD-10. | vigente (anexo en PR) | alta |
| `docs/29-diagnostico-device-core-key.md` | Diagnóstico detallado del hallazgo AUD-07 y opciones A/B/C. | vigente (anexo en PR) | alta |
| `docs/ADR-014-derivacion-clave-dispositivo.md` | Decisión aceptada de derivación por dispositivo, con implementación diferida a MVP2. | vigente (anexo en PR) | alta |

**Justificación de los estados parcialmente obsoletos:**

- `README.md`: la sección Estado todavía dice «MVP en diseño»; además conserva avisos de funciones pendientes que `docs/09` y AUD-01..AUD-03 contradicen.
- `docs/02-modelo-datos.md`: describe el modelo futuro de publicación/escritura dual, pero no separa en todos los pasajes diseño y comportamiento MVP0 ni resuelve el límite exacto MVP1/MVP2 (AUD-04).
- `docs/03-identidad.md` y `docs/05-arquitectura-p2p.md`: redactan como presentes flujos de derivación/replicación que el código no realiza; AUD-07 y AUD-10. El ADR-014 en rama ya decide la derivación futura, pero todavía no está integrado.
- `docs/06-descubrimiento.md`: sitúa DHT en MVP3, mientras el roadmap sitúa NAT traversal/Hyperswarm en MVP2 sin definir la frontera (AUD-05).
- `docs/07-api-local.md`: contiene contratos futuros de publicación/seguir/duplicar junto al API MVP0; debe conservarse la distinción entre endpoints descritos y endpoints implementados.
- `docs/09-roadmap-mvp.md`: la frase «Cada colección = un Hypercore» en MVP1 no precisa cómo convive con la creación de `collection_core` al publicar en MVP2; AUD-04.
- `docs/11-glosario.md`: define términos útiles, pero algunos conceptos de sincronización, estado y ciclo de publicación no tienen una semántica única compartida por todos los documentos.
- `docs/12-testing.md`: todavía describe la CI de «repo privado» y una estrategia futura para repo público, aunque el repositorio ya es público; además mezcla planes de tests de red con fases todavía no implementadas.
- `docs/13-ui-ux.md` y `docs/24-ui-vision.md`: hay diferencias de navegación y pantallas entre el diseño inicial y la UI MVP0; `docs/24` se declara referencia visual futura, no especificación de implementación.
- `docs/14-adrs.md`: ADR-012 y ADR-013 ya tienen divergencias documentadas en AUD-08/AUD-09. ADR-014 existe fuera del índice, en una rama de PR.
- `docs/15-schema-eventos.md` y `docs/16-identificadores-y-firmas.md`: las descripciones de firma del génesis no son uniformes respecto a `language` y al separador NUL (AUD-08). `docs/16` no documenta la derivación de dispositivo, ahora decidida en ADR-014.
- `docs/20-stack-tecnico.md`: enumera Hyperbee/Corestore como librerías principales, pero el estado real de dependencias y el backend de la vista materializada no coinciden con una lectura de componentes ya instalados (AUD-06).
- `docs/22-configuracion.md`: describe comportamientos actuales que el README presenta como pendientes (AUD-02); el README es el texto desfasado, pero el conjunto documental necesita quedar sincronizado.
- `docs/23-migraciones.md`: la vista materializada sigue admitiendo «Hyperbee, SQLite o archivo» y no define transición de clave para `device_core`; AUD-06/AUD-07.
- `docs/26-limitaciones-conocidas.md`: el backend de índice se describe como una previsión, mientras ADR-001 puede leerse como una elección ya cerrada (AUD-06).
- `docs/27-trazabilidad.md`: es útil como matriz de realidad, pero no refleja todos los cambios recientes de alcance y conserva el contrato antiguo de estados/fases de varias funciones; AUD-07/AUD-09/AUD-10.

## 2. Resumen por documento

### README.md
Presenta Lotura, su instalación y ejecución local, uso básico, Docker, configuración y ubicación de datos. Conserva el nombre técnico BookmarkNet para repo, paquete e identificadores. Su sección Estado y algunas notas de funcionalidades pendientes no están sincronizadas con el estado descrito por el roadmap y la auditoría (AUD-01..AUD-03).

### docs/00-vision.md
Define el problema como exceso de información y la propuesta como curaduría humana de bookmarks organizada en colecciones. La red debe permitir compartir, duplicar y descubrir patrones emergentes. Las contribuciones a colecciones ajenas se reservan a propuestas in-app en MVP3+.

### docs/01-principios.md
Fija disciplina del nodo, bookmark como unidad, separación usuario/nodo y resource/bookmark, replicación de eventos y ausencia de IA/red social compleja. También declara que bootstrap no equivale a centralización y que el primer hito de valor es descubrir y reutilizar una colección ajena.

### docs/02-modelo-datos.md
Describe User, Node, Resource, Bookmark y Collection, con la jerarquía `User → Collection → Bookmark → Resource → URL`. Distingue borrador local en `device_core` de colección pública en `collection_core`, y explica `forked_from`, seguir, duplicar y génesis. La asignación de persistencia local por colección y publicación entre MVP1/MVP2 queda afectada por AUD-04.

### docs/03-identidad.md
Define `user_master_key` como la misma semilla de 32 bytes del `user_keypair`, identidad portable, perfil, backup y alta de dispositivos. Especifica once eventos `device_*` y diferencia Inbox global de raíz de colección. Sus párrafos de derivación de `device_core` y replicación multidispositivo están redactados como diseño presente, aunque AUD-07/AUD-10 y el diagnóstico `docs/29` muestran que no están implementados.

### docs/04-canonicalizacion-url.md
Define canonicalización v1: scheme/host en minúsculas, eliminación de `www.`, fragmento y tracking conocido, orden de query params, reglas de trailing slash y validación de esquemas. `resource_id` se deriva de `sha256("v1:" + canonical_url)`; los casos abiertos se reservan para antes de MVP3.

### docs/05-arquitectura-p2p.md
Describe Hypercore como log append-only single-writer, Hyperbee como índice y Hyperswarm como DHT/NAT traversal. Detalla jerarquía de claves, `collection_core`, `device_core`, publicación, escritura dual y estados de sincronización. Es uno de los documentos más afectados por AUD-04, AUD-05, AUD-06, AUD-07 y AUD-10.

### docs/06-descubrimiento.md
Explica el flujo `bmn://<collection_id>` → topic → Hyperswarm → peer → verificación del génesis → replicación. Separa publicación, seeders, caché de peers y caso offline. Su tabla de fases sitúa compartición directa en MVP2 y DHT automático en MVP3, en tensión con la formulación de NAT traversal del roadmap (AUD-05).

### docs/07-api-local.md
Especifica la API HTTP local para identidad, bookmarks, grupos, colecciones, discovery y búsqueda. La sección de correspondencia API/eventos deja claro que en MVP0 las mutaciones generan eventos `device_*`; los eventos de `collection_core` y la publicación son futuros. Debe leerse como contrato con funciones de distintas fases, no como prueba de que todos los endpoints estén implementados.

### docs/08-bootstrap-y-seeds.md
Distingue bootstrap peer (ayuda a encontrar la red) de seed peer (mantiene copias de colecciones públicas). Rechaza que una colección dependa de un nodo oficial y describe la necesidad práctica de nodos iniciales estables para el lanzamiento.

### docs/09-roadmap-mvp.md
Declara MVP0 completado y define MVP1 como modelo Hypercore local por colección, MVP2 como multidispositivo y compartición directa, MVP3 como discovery DHT, MVP4 como seed pack y MVP5 como métricas emergentes. La frontera entre persistencia local de `collection_core` y publicación/escritura dual no está cerrada con precisión (AUD-04).

### docs/10-riesgos.md
Enumera riesgos de arranque en frío, multi-writer, canonicalización, percepción de sincronización, autor offline, NAT traversal, falta de discovery y abuso de propuestas. La mitigación de NAT en MVP2 presupone las conexiones que Hyperswarm consiga establecer, sin relays/TURN.

### docs/11-glosario.md
Define conceptos como Resource, Bookmark, Collection, Group, Inbox, User, Node, bootstrap/seed peer, topic, seeder, Hypercore, Hyperbee, Hyperswarm, seguir, duplicar, `device_core`, `collection_core`, escritura dual y `collection_genesis`. Es la referencia terminológica más compacta, aunque no resuelve todas las diferencias de vocabulario entre documentos.

### docs/12-testing.md
Establece unit tests, property-based tests, integration tests con dos nodos, E2E y objetivos de cobertura/tiempo. Incluye pruebas de replicación, publicación, multidispositivo y migraciones como objetivos de fases futuras. La sección CI mantiene una distinción repo privado/público que ya no refleja el estado del repositorio público.

### docs/13-ui-ux.md
Define principios de UI local-first, honestidad de sincronización y pantallas por fases. Describe MVP0 y reserva dispositivos/estado de sincronización para MVP2, propuestas para MVP3+ y seed pack para MVP4. Algunas pantallas/nombres de navegación pertenecen al diseño previo y deben contrastarse con `docs/24-ui-vision.md` y la UI real.

### docs/14-adrs.md
Contiene ADR-001 a ADR-013 en un único documento y declara que los ADR aceptados son inmutables; una decisión nueva que cambia otra debe supersederla. AUD-08 y AUD-09 identifican contratos desactualizados en ADR-012 y ADR-013. ADR-014 todavía no forma parte de este archivo.

### docs/15-schema-eventos.md
Especifica los diez eventos v1 de `collection_core`, sus payloads, reglas de fold, idempotencia, soft delete y validación. Distingue estos eventos de los `device_*` de `docs/03`. La descripción de serialización de firma contiene fragmentos con notación distinta (AUD-08).

### docs/16-identificadores-y-firmas.md
Define formatos de `user_id`, `node_id`, `resource_id`, `bookmark_id`, `collection_id`, `group_id` y `event_id`, así como Ed25519, `user_master_key`, claves de colección y firma de génesis. No especifica una derivación de clave de dispositivo y su ejemplo de firma de génesis omite `language` y el separador NUL (AUD-08; la primera carencia se aborda como decisión futura en ADR-014).

### docs/17-propuestas.md
Diseña para MVP3+ un sistema de propuestas como mensajes unidireccionales, sin escritura en el log ajeno ni Autobase. El emisor duplica una colección, propone un diff y el propietario decide si incorpora los cambios. Define límites y controles locales antiabuso.

### docs/18-seed-pack.md
Define un paquete de colecciones completas incluido en el binario, utilizable offline y actualizable por P2P desde seed peers. Describe origen de las colecciones, identidad del proyecto, `creator_peer_id` y opciones del onboarding. Su fase objetivo es MVP4.

### docs/19-onboarding.md
Describe la creación explícita de identidad, importación HTML y opciones de primera ejecución. La identidad se crea al continuar o importar, no al arrancar el nodo. El seed pack se presenta como opción futura de MVP4.

### docs/20-stack-tecnico.md
Fija TypeScript/Bare, core P2P en worker, UI web local y empaquetado standalone. Incluye restricciones del stripper TypeScript (por ejemplo, `import type`, evitar `enum`, `namespace` y parameter properties). La lista de librerías principales incluye componentes cuya dependencia/uso real no coincide por completo con el estado del repo (AUD-06).

### docs/21-distribucion.md
Define binarios por plataforma, Docker, GitHub Releases, GHCR, hashes SHA-256 y política de actualizaciones manuales en MVP0–MVP2. Aclara que firma de código y GPG quedan fuera de MVP0–MVP2.

### docs/22-configuracion.md
Describe puerto, directorio de datos, `config.json`, variables de entorno, validación Host/Origin/Content-Type, bind y secuencia de arranque. Su detalle de auto-incremento y navegador automático coincide con la implementación descrita en AUD-02, mientras README conserva advertencias contrarias.

### docs/23-migraciones.md
Define logs inmutables, migración al vuelo de vistas materializadas, migración eager de colecciones no publicadas y migración explícita de publicadas. La elección del backend de vista materializada sigue abierta entre Hyperbee, SQLite o archivo; no detalla el cambio de clave de `device_core` (AUD-06/AUD-07).

### docs/24-ui-vision.md
Especifica la dirección visual de Lotura y contiene wireframes estáticos. Declara explícitamente que es una referencia de diseño para MVP2–MVP4 y que no todas las pantallas/métricas están implementadas. Su navegación amplia y fases deben contrastarse con el alcance real de MVP0.

### docs/25-busqueda-i18n.md
Define el campo `language` de colección con valores `es`, `en`, `eu` y un futuro diccionario de equivalencias para búsqueda multilingüe. Declara que MVP0 solo hace búsqueda literal y que expansión multilingüe corresponde a MVP3+.

### docs/26-limitaciones-conocidas.md
Registra cold start, locks de RocksDB/Hypercore, limpieza de workers y fragmentación por escrituras pequeñas. Propone Hyperbee para MVP1+ como mejora de la vista materializada, pero no coincide con la lectura de ADR-001 como decisión cerrada (AUD-06).

### docs/27-trazabilidad.md
Relaciona funcionalidades con documentos, código, tests y estado, y distingue «Implementado (modelo)» de persistencia/red pendiente. Es una referencia esencial para diferenciar implementación y diseño, aunque no refleja todos los hallazgos de AUD-07/AUD-09/AUD-10.

### docs/branding/README.md
Especifica narrativa de marca, símbolo modular en forma de L, dimensiones, radios, gradiente, colores, tipografía y usos de SVG. Es una referencia visual vigente y no condiciona las decisiones técnicas de MVP1.

### docs/28-auditoria-documentacion.md (rama `docs/auditoria-pre-mvp1`, PR #1)
Registra diez hallazgos AUD-01..AUD-10, metodología, evidencia documental/código, impacto, propuestas de corrección y decisiones que requieren confirmación humana. No está en `main` mientras el PR #1 permanezca abierto.

### docs/29-diagnostico-device-core-key.md (rama `docs/diagnostico-aud-07`, PR #2)
Profundiza AUD-07: contrasta documentación y código, detalla ausencia de derivación de dispositivo y orden de arranque, analiza impacto y presenta opciones A/B/C. Su recomendación C quedó posteriormente convertida en decisión aceptada por ADR-014. No está en `main`.

### docs/ADR-014-derivacion-clave-dispositivo.md (rama `docs/adr-device-key-derivation`, PR #3)
Registra la decisión aceptada de derivación Ed25519 independiente por dispositivo mediante HKDF-SHA256 de `user_master_key` y `node_id`, con persistencia de `node_id` en MVP1 y derivación/uso de `keyPair` en MVP2. Declara explícitamente que la implementación está pendiente de MVP2 y que el reset MVP0 es coyuntural. No está en `main` ni en el índice de ADRs.

## 3. Convención de ADRs

La convención está expresamente definida en `docs/14-adrs.md`:

1. Encabezado: `## ADR-XXX: Título`.
2. Metadatos: `**Fecha:** YYYY-MM-DD` y `**Estado:** Aceptado | Superseded by ADR-YYY | Deprecado`.
3. Secciones, en este orden:
   - `### Contexto`
   - `### Decisión`
   - `### Consecuencias`
   - `### Alternativas consideradas`

El documento introductorio también indica que cada ADR debe ser un registro corto de contexto, decisión, consecuencias y alternativas.

- **Numeración:** el último ADR registrado en `docs/14-adrs.md` es ADR-013. El siguiente número libre es ADR-014.
- **Inmutabilidad:** sí. El texto dice: «Los ADRs son inmutables una vez aceptados».
- **Cómo se cambia una decisión:** se crea un ADR nuevo que supersede al anterior y se anota en el original `Superseded by ADR-XXX`. No se reescribe silenciosamente un ADR aceptado.
- **Ubicación:** los ADR existentes viven como secciones numeradas dentro de `docs/14-adrs.md`. No se encontró una carpeta `docs/adr/` ni una convención previa de un archivo por ADR en el árbol documental consultado.
- **ADR-014:** existe como archivo separado `docs/ADR-014-derivacion-clave-dispositivo.md` en la rama `docs/adr-device-key-derivation` (PR #3), pero **no está en el índice** `docs/14-adrs.md` de `main`. Para integrarlo, primero debe incorporarse el archivo a la rama principal y, en un PR posterior, añadirse una sección ADR-014 al índice con el mismo formato y orden, junto con una referencia al archivo externo si se decide mantener ambos formatos. La convención actual no resuelve por sí sola cómo convivirían el ADR completo dentro del índice y un archivo independiente.

## 4. Terminología canónica del repo

La tabla recoge nombres y definiciones documentales. Cuando el nombre cambia según el plano (evento de colección frente a evento de dispositivo) se conserva esa diferencia; no se equiparan conceptos solo porque compartan verbo.

| Concepto | Nombre canónico | Documento de referencia | Notas |
|---|---|---|---|
| Core local de dispositivo | `device_core` | `docs/03-identidad.md`, `docs/11-glosario.md` | Hypercore single-writer por dispositivo; contiene borradores locales, metadatos y eventos del dispositivo. La clave documentada previamente es objeto de AUD-07 y ADR-014. |
| Core público de colección | `collection_core` | `docs/02-modelo-datos.md`, `docs/11-glosario.md` | Hypercore single-writer de una colección publicada, replicable por seguidores; persistencia local por colección en MVP1 es la frontera de AUD-04. |
| Semilla maestra del usuario | `user_master_key` | `docs/03-identidad.md`, `docs/16-identificadores-y-firmas.md` | Semilla Ed25519 de 32 bytes; es la clave privada del usuario, no una segunda clave separada. |
| Identificador de dispositivo | `node_id` | `docs/02-modelo-datos.md`, `docs/16-identificadores-y-firmas.md` | `"n_" + random(8 bytes).hex()`; el modelo lo asocia a una instalación. Persistencia estable en MVP1 es decisión de ADR-014, no implementación actual. |
| Identidad | `identity` / `user_keypair` | `docs/03-identidad.md`, `docs/16-identificadores-y-firmas.md` | Identidad criptográfica de usuario; el perfil es opcional y no forma parte de la clave que identifica al usuario. |
| Colección | `Collection` / `collection` | `docs/02-modelo-datos.md`, `docs/11-glosario.md` | Agrupación de bookmarks y unidad principal de compartición. Tiene plano local borrador y plano publicado. |
| Grupo | `Group` / `group` | `docs/02-modelo-datos.md`, `docs/11-glosario.md` | Contenedor ligero de bookmarks dentro de una colección; no hay jerarquías complejas. |
| Bookmark | `Bookmark` / `bookmark` | `docs/02-modelo-datos.md`, `docs/11-glosario.md` | Referencia contextual a un Resource dentro de una colección; el Inbox global es una excepción local sin colección. |
| Inbox global | `Inbox` (`collectionId: null`, `groupId: null`) | `docs/03-identidad.md`, `docs/07-api-local.md` | Bookmarks sin colección. No equivale a la raíz de una colección (`collectionId: "c_..."`, `groupId: null`). |
| Génesis de colección | `collection_genesis` | `docs/15-schema-eventos.md`, `docs/16-identificadores-y-firmas.md` | Bloque 0 del `collection_core`; vincula la clave de colección con el usuario propietario y lleva `signature_by_owner`. |
| Añadir bookmark (colección) | `add_bookmark` | `docs/15-schema-eventos.md` | Evento de `collection_core`; no es el evento local MVP0. |
| Editar bookmark (colección) | `edit_bookmark` | `docs/15-schema-eventos.md` | Modifica metadatos de un bookmark existente en el log de colección. |
| Eliminar bookmark (colección) | `remove_bookmark` | `docs/15-schema-eventos.md` | Soft delete; no borra bloques anteriores. |
| Mover bookmark (colección) | `move_bookmark` | `docs/15-schema-eventos.md` | Cambia `group_id` dentro de la misma colección; `null` significa raíz, no Inbox global. |
| Reordenar bookmark (colección) | `reorder_bookmark` | `docs/15-schema-eventos.md` | Cambia posición dentro de un grupo o raíz de colección. |
| Actualizar metadatos de colección | `update_metadata` | `docs/15-schema-eventos.md` | Modifica nombre, descripción o visibilidad de colección. |
| Crear grupo (colección) | `create_group` | `docs/15-schema-eventos.md` | Crea un grupo dentro del log de colección. |
| Eliminar grupo (colección) | `delete_group` | `docs/15-schema-eventos.md` | Elimina grupo y devuelve sus bookmarks a la raíz de esa colección. |
| Despublicar colección | `collection_unpublished` | `docs/15-schema-eventos.md` | Último evento del core publicado; informa a seguidores y cesa el anuncio del topic. |
| Procedencia de duplicado | `forked_from` | `docs/02-modelo-datos.md`, `docs/15-schema-eventos.md` | Campo informativo en el génesis; apunta al `collection_id` original. No crea sincronización ni prueba criptográficamente el vínculo en MVP. |
| Publicada | `published` | `docs/02-modelo-datos.md`, `docs/03-identidad.md` | Estado de colección con core público. El uso de estados también aparece como `draft`/`published`/`unpublished` en ADR-013, cuyo contrato de eventos está desfasado (AUD-09). |
| Seguir | `followed` / acción «Seguir» | `docs/02-modelo-datos.md`, `docs/11-glosario.md`, `docs/09-roadmap-mvp.md` | Suscripción/replicación de la colección original y recepción de actualizaciones; no permite editarla. No es lo mismo que duplicar. |
| Duplicar | `duplicated` / acción «Duplicar» | `docs/02-modelo-datos.md`, `docs/11-glosario.md` | Crea una copia congelada con nuevo `collection_id`; el génesis incluye `forked_from`. |
| Estado de sincronización | `synced` / `syncing` / `pending` / `offline` / `archived` (etiquetas documentales en español) | `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md`, `docs/13-ui-ux.md` | `docs/05` define cinco estados mutuamente excluyentes; `docs/13` y `docs/06` los resumen con vocabulario parcial. No hay un único enum canónico común fijado en estos documentos. |

**Distinciones que no deben colapsarse:**

- `device_add_bookmark`, `device_edit_bookmark`, `device_remove_bookmark`, `device_move_bookmark`, `device_reorder_bookmark`, `device_create_group` y `device_delete_group` son los eventos locales MVP0 de `device_core` definidos en `docs/03-identidad.md`. Los nombres sin prefijo `device_` de la tabla son los eventos del `collection_core` de `docs/15-schema-eventos.md`.
- En el API local, `move_bookmark` como operación de usuario puede mover entre colecciones o al Inbox; el evento `move_bookmark` de `collection_core` solo cambia grupo dentro de una colección. En MVP0 se emite `device_move_bookmark`.
- `published`, `followed`, `duplicated` y los estados de sincronización describen ciclo de vida/relaciones, no nombres de eventos equivalentes.

## 5. Índice «qué documento manda sobre qué tema»

| Tema | Documento(s) que lo definen | Documento(s) que lo mencionan pero no lo definen | Riesgo de contradicción |
|---|---|---|---|
| Identidad | `docs/03-identidad.md`, `docs/16-identificadores-y-firmas.md` | README, `docs/02`, `docs/07`, `docs/19`, `docs/22` | Medio: identidad portable y estado local de dispositivo se mezclan en pasajes de backup/multidispositivo. |
| Claves y derivación | `docs/16-identificadores-y-firmas.md` (usuario/colección); decisión de dispositivo en ADR-014 | `docs/03`, `docs/05`, ADR-003/004 | Alto: AUD-07; docs 03/05 discrepaban sobre incluir `node_id`; ADR-014 todavía está fuera de main e índice. |
| Modelo de eventos | `docs/03-identidad.md` (device); `docs/15-schema-eventos.md` (collection) | `docs/02`, `docs/05`, `docs/07`, `docs/14` | Alto: ADR-013 enumera cuatro eventos antiguos frente a los once de device; AUD-09. |
| Almacenamiento | `docs/05-arquitectura-p2p.md`, `docs/15-schema-eventos.md`, `docs/23-migraciones.md` | `docs/02`, `docs/09`, `docs/20`, `docs/26`, `docs/27` | Alto: AUD-04 y AUD-06; no está fijado de forma inequívoca el backend de vista materializada ni el alcance MVP1 de `collection_core`. |
| Replicación | `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md` | `docs/01`, `docs/02`, `docs/03`, `docs/08`, `docs/09`, `docs/10`, `docs/12`, `docs/27` | Alto: diseño descrito en presente frente a implementación pendiente (AUD-10). |
| Descubrimiento | `docs/06-descubrimiento.md` | `docs/05`, `docs/08`, `docs/09`, `docs/10`, `docs/24` | Alto: MVP2 enlace/NAT traversal frente a MVP3 DHT (AUD-05). |
| Publicación | `docs/02-modelo-datos.md`, `docs/05-arquitectura-p2p.md`, `docs/15-schema-eventos.md` | `docs/06`, `docs/07`, `docs/09`, `docs/13`, `docs/24` | Alto: publicación y creación de core a veces se agrupan con persistencia local por colección (AUD-04). |
| Compartir | `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md`, `docs/09-roadmap-mvp.md` | `docs/00`, `docs/02`, `docs/13`, `docs/24` | Alto: el enlace `bmn://` no define por sí solo cómo se localiza el peer (AUD-05). |
| Seguir | `docs/02-modelo-datos.md`, `docs/11-glosario.md`, `docs/09-roadmap-mvp.md` | `docs/06`, `docs/07`, `docs/13`, `docs/24` | Medio: endpoints y pantallas descritos como contratos futuros, sin estado de implementación. |
| Duplicar | `docs/02-modelo-datos.md`, `docs/11-glosario.md`, `docs/15-schema-eventos.md` | `docs/07`, `docs/09`, `docs/13`, `docs/17`, `docs/24` | Medio: el significado de `forked_from` es informativo y no sincroniza; no confundir con seguir/migrar. |
| Estado de sincronización | `docs/05-arquitectura-p2p.md` | `docs/06`, `docs/10`, `docs/13`, `docs/24` | Alto: conjunto de estados y semántica de «sincronizada»/«offline» no está expresado con el mismo detalle en todos. |
| UI | `docs/13-ui-ux.md` (fases/UX), `docs/24-ui-vision.md` (dirección visual) | README, `docs/09`, `docs/19`, `docs/25` | Medio: navegación/pantallas de diseño inicial y visión posterior difieren. |
| API local | `docs/07-api-local.md` | README, `docs/19`, `docs/22` | Medio: endpoints de fases futuras se presentan en el mismo inventario que MVP0; separar disponibilidad real. |
| Testing | `docs/12-testing.md` | `docs/09`, `docs/21`, `docs/27` | Medio: CI repo privado/público no está actualizada; pruebas P2P son objetivos futuros. |
| Distribución | `docs/21-distribucion.md` | README, `docs/09`, `docs/20`, `docs/26` | Bajo: formatos soportados y limitaciones por plataforma están descritos, aunque README y release notes deben mantenerlos sincronizados. |
| Migraciones | `docs/23-migraciones.md` | `docs/07`, `docs/09`, `docs/14`, `docs/26` | Alto: migración de schema sí está descrita; migración de clave de `device_core` no estaba especificada antes de ADR-014. |
| i18n | `docs/25-busqueda-i18n.md` | `docs/03`, `docs/07`, `docs/13`, `docs/15`, `docs/24` | Bajo: idioma de colección está definido; búsqueda multilingüe es MVP3+ y no debe confundirse con el comportamiento MVP0. |

## 6. Citas literales relevantes para AUD-01..AUD-10

Las citas siguientes se reproducen como fragmentos documentales o de código. Se incluyen para localizar la evidencia, no para volver a evaluar ni resolver los hallazgos de `docs/28-auditoria-documentacion.md`.

### AUD-01 — Estado general del proyecto en README

- **Documento:** `README.md`, sección «Estado»:  
  > «MVP en diseño. Ver [docs/09-roadmap-mvp.md](docs/09-roadmap-mvp.md).»
- **Documento:** `docs/09-roadmap-mvp.md`, sección «MVP 0 — Nodo local»:  
  > «**Estado: completado.** Identidad, bookmarks, colecciones, grupos, Inbox global, perfil, configuración, importación HTML, UI web local (con rediseño y búsqueda), binario standalone (`bare-build`), AppImage, imagen Docker, auto-incremento de puerto y `openBrowserOnStart` implementados y testeados.»

### AUD-02 — Auto-incremento de puerto y apertura automática

- **Documento:** `README.md`, sección «Arranque»:  
  > «El puerto por defecto es `7575`; el auto-incremento si está ocupado está pendiente de implementación.»
- **Documento:** `README.md`, sección «Configuración»:  
  > «`openBrowserOnStart`: `true` en la configuración; la apertura automática del navegador está pendiente de implementación.»
- **Documento:** `docs/22-configuracion.md`, sección «Puerto»:  
  > «Si el puerto por defecto (`7575`) está ocupado, el nodo intenta los siguientes (`7576`, `7577`...) hasta encontrar uno libre, con un máximo de 100 intentos.»
- **Código:** `src/main.ts`, flujo de arranque:  
  ```ts
  if (config.openBrowserOnStart === true) {
    phaseStart = now()
    try {
      await open(`http://localhost:${api.port}`)
    } catch (error) {
      console.warn('No se pudo abrir el navegador:', (error as Error).message)
    }
  }
  ```
  `src/node/start.ts` exporta `listenWithPortFallback(server, startPort, bind, portExplicit, maxAttempts = 100)`.

### AUD-03 — Exportación cifrada de identidad

- **Documento:** `README.md`, sección «Dónde viven los datos»:  
  > «La exportación cifrada de identidad mediante `POST /api/v1/identity/export` todavía no está implementada.»
- **Documento:** `docs/07-api-local.md`, sección «Identidad»:  
  > «POST /identity/export        # body: {password} → identity.bmn»
- **Código:** `src/api/identity.ts`, función `handleExportIdentity`:  
  ```ts
  return { status: 200, body: await exportIdentity(dataDir, body.password) }
  ```
- **Código:** `src/identity/export.ts`, función `exportIdentity`:  
  ```ts
  export async function exportIdentity(dataDir: string, password: string): Promise<ExportedIdentity> {
    const stored = await loadIdentity(dataDir)
    if (stored === null) throw new RangeError('No existe una identidad para exportar')
  ```

### AUD-04 — Frontera MVP1/MVP2 de `collection_core`

- **Documento:** `docs/09-roadmap-mvp.md`, sección «MVP 1 — Modelo Hypercore»:  
  > «Cada colección = un Hypercore.»
- **Documento:** `docs/03-identidad.md`, sección «collectionId = collection_uuid» (apartado sobre publicación):  
  > «Al publicar (MVP2)»
- **Documento:** `docs/07-api-local.md`, sección «Colecciones»:  
  > «El `collection_genesis` se crea al publicar la colección (creación del `collection_core`, MVP1+).»
- **Documento:** `docs/15-schema-eventos.md`, sección «Estado de implementación»:  
  > «Persistencia de `collection_core` | Pendiente (MVP1+)»
- **Código:** `src/storage/device-core.ts`, función `openDeviceCore`:  
  ```ts
  const core = new Hypercore(storagePath, { valueEncoding: 'json' })
  ```

### AUD-05 — Frontera MVP2/MVP3: enlace directo, NAT traversal y DHT

- **Documento:** `docs/06-descubrimiento.md`, sección «Estado por fases»:  
  > «MVP2: compartición directa por enlace, sin discovery automático.»  
  > «MVP3: descubrimiento por topic vía Hyperswarm DHT.»
- **Documento:** `docs/09-roadmap-mvp.md`, sección «MVP 2 — Multidispositivo + compartición directa»:  
  > «NAT traversal vía Hyperswarm (sin relays ni TURN).»
- **Código:** `src/node/start.ts`, constante de prueba:  
  ```ts
  const TEST_TOPIC = Buffer.from('lotura-test-topic')
  ```
- **Código:** `src/p2p/swarm.ts`, función `startSwarm`:  
  ```ts
  const swarm = new Hyperswarm()
  await swarm.join(topic, { server: true, client: true })
  ```

### AUD-06 — Decisión e implementación de Hyperbee

- **Documento:** `docs/14-adrs.md`, ADR-001, sección «Decisión»:  
  > «Usar Hypercore + Hyperswarm + Hyperbee + Corestore como stack P2P base.»
- **Documento:** `docs/23-migraciones.md`, sección «Migración de la vista materializada»:  
  > «La vista materializada se guarda en un índice local (Hyperbee, SQLite o archivo).»
- **Documento:** `docs/26-limitaciones-conocidas.md`, sección «Hyperbee»:  
  > «Para MVP1+, se prevé migrar el estado materializado a Hyperbee, un índice B-tree sobre Hypercore.»
- **Código:** `package.json`, bloque `dependencies`:  
  ```json
  "dependencies": {
    "bare-http1": "^4.6.3",
    "bare-open": "^1.0.3",
    "bare-process": "^4.5.1",
    "hypercore": "^11.39.3",
    "pear-gracedown": "^1.0.5",
    "sodium-native": "^5.2.0",
    "hyperswarm": "^4.4.0"
  }
  ```
  En esa lista no aparecen `hyperbee` ni `corestore`.

### AUD-07 — Clave de `device_core`

- **Documento:** `docs/03-identidad.md`, sección «Sincronización multidispositivo»:  
  > «Cada dispositivo del mismo usuario tiene su propio `device_core`: un Hypercore single-writer firmado con una clave derivada de la clave maestra del usuario y el `node_id` del dispositivo.»
- **Documento:** `docs/05-arquitectura-p2p.md`, sección «Derivación de claves por colección»:  
  > «El `device_core` se abre con una clave derivada de la `user_master_key` (que está en `identity.bmn`), no con una clave que esté dentro del `device_core`; así se evita la dependencia circular.»
- **Código:** `src/storage/device-core.ts`, función `openDeviceCore`:  
  ```ts
  const core = new Hypercore(storagePath, { valueEncoding: 'json' })
  ```
- **Código:** `src/node/start.ts`, función `startNode`, orden de inicialización:  
  ```ts
  core = await openDeviceCore(config.dataDir)
  // ...
  const stored = await loadIdentity(config.dataDir)
  ```
- **Decisión posterior:** `docs/ADR-014-derivacion-clave-dispositivo.md`, disponible en la rama del PR #3, acepta opción C; su implementación queda pendiente de MVP2.

### AUD-08 — Serialización de la firma de `collection_genesis`

- **Documento:** `docs/14-adrs.md`, ADR-012, sección «Decisión»:  
  > «collection_id || collection_public_key || author_id || author_public_key || name || visibility || (forked_from ?? "") || (migrated_from ?? "")»
- **Documento:** `docs/16-identificadores-y-firmas.md`, sección «El evento de génesis»:  
  > «sha256( collection_id || collection_public_key || author_id || author_public_key || name || visibility || (forked_from ?? "") || (migrated_from ?? "") )»
- **Documento:** `docs/15-schema-eventos.md`, sección «Separador de concatenación en la firma»:  
  > «Los campos se concatenan en el orden indicado, con un separador explícito `\x00` (null byte) entre cada campo. No se usa `||` literal.»
- **Código:** `src/events.ts`, función `genesisSigningHash`:  
  ```ts
  const message = [
    params.collectionId,
    toHex(params.collectionPublicKey),
    params.authorId,
    toHex(params.authorPublicKey),
    params.name,
    params.visibility,
    params.language,
    params.forkedFrom ?? '',
    params.migratedFrom ?? ''
  ].join('\x00')
  ```

### AUD-09 — ADR-013 conserva un schema antiguo de `device_core`

- **Documento:** `docs/14-adrs.md`, ADR-013, sección «Decisión»:  
  > «El `device_core` tiene cuatro tipos de evento: `device_metadata`, `device_collection`, `device_bookmark` y `device_group`.»
- **Documento:** `docs/03-identidad.md`, sección «Tipos de evento del `device_core`»:  
  > «Los 11 eventos son:»
- **Código:** `src/device-events.ts`, tipos de evento:  
  ```ts
  export interface DeviceMetadataEvent extends DeviceEventBase<'device_metadata', DeviceMetadataPayload> {}
  export interface DeviceCreateCollectionEvent extends DeviceEventBase<'device_create_collection', DeviceCreateCollectionPayload> {}
  export interface DeviceUpdateCollectionEvent extends DeviceEventBase<'device_update_collection', DeviceUpdateCollectionPayload> {}
  export interface DeviceDeleteCollectionEvent extends DeviceEventBase<'device_delete_collection', DeviceDeleteCollectionPayload> {}
  ```
  El mismo archivo define además `device_add_bookmark`, `device_edit_bookmark`, `device_remove_bookmark`, `device_move_bookmark`, `device_reorder_bookmark`, `device_create_group` y `device_delete_group`.

### AUD-10 — Replicación multidispositivo y prototipo Hyperswarm

- **Documento:** `docs/03-identidad.md`, sección «Sincronización multidispositivo»:  
  > «Todos los dispositivos del mismo usuario se unen a un topic derivado del `user_id` y replican los `device_core` de los demás (solo lectura para los ajenos).»
- **Documento:** `docs/27-trazabilidad.md`, fila «Replicación P2P (`bmn://`)»:  
  > «Pendiente (MVP1+)»
- **Código:** `src/node/start.ts`, función `startNode`:  
  ```ts
  const TEST_TOPIC = Buffer.from('lotura-test-topic')
  swarm = await startSwarm(TEST_TOPIC, (socket) => {
    console.log('peer connected')
  })
  ```
- **Código:** `src/p2p/swarm.ts`, función `startSwarm`:  
  ```ts
  await swarm.join(topic, { server: true, client: true })
  swarm.on('connection', (socket) => {
    onPeer(socket)
  })
  ```

## 7. Vacíos y ambigüedades que la lectura revela

La lista identifica temas que no tienen contrato documental cerrado o cuya definición está repartida de forma ambigua. No propone soluciones ni reabre decisiones ya aceptadas.

1. **Frontera de persistencia MVP1:** el alcance exacto de «cada colección = un Hypercore» frente a `collection_core` creado al publicar sigue descrito con fases distintas (AUD-04). La decisión de alcance de MVP1 no queda expresada como una única regla transversal.
2. **Backend de vista materializada:** `docs/23-migraciones.md` enumera Hyperbee, SQLite o archivo; ADR-001 acepta Hyperbee como parte del stack; `package.json` no incluye Hyperbee/Corestore (AUD-06).
3. **Ciclo de vida y almacenamiento de `node_id`:** el formato aleatorio está definido en `docs/16`, pero la persistencia, renovación, reinstalación, restauración y clonación no estaban cerradas en la documentación base. ADR-014 decide persistencia estable por dispositivo en MVP1, pero deja ruta y formato de almacenamiento local para concretar en esa fase.
4. **Identidad portable frente a estado del dispositivo:** `identity.bmn` contiene identidad y perfil, mientras el modelo multidispositivo requiere identificar cada instalación. La separación de los datos exportables y locales aparece en ADR-014, todavía no integrado en main.
5. **Descubrimiento por enlace vs discovery automático:** `docs/06` reserva DHT para MVP3, mientras `docs/09` incluye NAT traversal vía Hyperswarm en MVP2 (AUD-05).
6. **Contrato de conexión y replicación:** el diseño explica topics, peers y replicación, pero no define en todos los documentos la secuencia de negociación, autenticación/autorización, selección de peer, reintentos y tratamiento de conexiones simultáneas.
7. **Estado de sincronización:** los estados se describen en `docs/05`, pero su semántica exacta (qué significa «sincronizada» respecto a peers conocidos, cuándo pasa a «offline», y cómo se distingue estado local de remoto) no está formalizada en un contrato compartido.
8. **Seguimiento y duplicación como relaciones persistentes:** se explica su semántica de producto, pero no se identifica un esquema canónico único para almacenar la lista de colecciones seguidas, peers, origen y ciclo de vida de una copia en cada dispositivo.
9. **Publicación y fallo de escritura dual:** `docs/05` describe reintentos y estado pendiente, pero no define el contrato duradero de cola, orden, idempotencia y recuperación ante fallo parcial entre `device_core` y `collection_core`.
10. **Firma del génesis:** la diferencia entre `||` y separador NUL, y la inclusión de `language`, está identificada en AUD-08; el contrato documental único no se reproduce de forma idéntica en todos los documentos.
11. **Contrato de eventos de dispositivo:** ADR-013 contiene cuatro nombres antiguos frente a los once eventos actuales descritos en `docs/03` (AUD-09).
12. **Revocación de dispositivo:** `docs/03` y `docs/13` mencionan revocar dispositivos como futuro, pero no hay política definida de revocación, recuperación de claves o efecto sobre cores ya replicados.
13. **Migración criptográfica de `device_core`:** ADR-014 fija la decisión futura, pero el comportamiento exacto de transición desde cores MVP0 y la compatibilidad de Hypercore con la nueva opción `keyPair` requieren validación en la implementación de MVP2.
14. **Política de pérdida de datos:** ADR-014 autoriza reset solo mientras no haya usuarios reales; los procedimientos de backup, migración, rollback y recuperación ante cambios incompatibles deberán concretarse antes de que esa condición deje de cumplirse.
15. **Hyperbee y ADRs:** no está definido cómo mantener una decisión aceptada si el componente no está instalado ni usado, ni cómo se registrará una eventual decisión posterior sobre el índice.
16. **Estados `published`, `followed`, `duplicated`:** los documentos usan estos términos como estados o relaciones, pero no presentan un único esquema normativo que indique si son estados persistidos, relaciones calculadas o acciones del usuario.
17. **API por fase:** `docs/07` enumera endpoints futuros junto a los de MVP0; no existe una tabla única y completa que marque cada endpoint como implementado, parcial o futuro.
18. **Navegación y UI:** `docs/13` y `docs/24` no comparten exactamente la misma navegación ni jerarquía de pantallas; la visión visual posterior se declara wireframe, no contrato.
19. **Testing de red:** `docs/12` define pruebas de dos nodos y replicación, pero las fases en que se ejecutarán y su relación con el CI público necesitan mantenerse sincronizadas con el roadmap.
20. **i18n:** el campo `language` está definido e implementado para colección, pero la gobernanza del diccionario de equivalencias y su actualización no está especificada (la búsqueda multilingüe se reserva a MVP3+).
21. **Backup de datos de usuario:** el backup `identity.bmn` no contiene bookmarks; la recuperación de colecciones depende de peers replicadores. La documentación no describe un backup local completo de los datos no publicados.

## 8. Recomendación de orden de corrección

Orden sugerido por dependencias documentales; no se ejecuta ninguna corrección en este dossier.

### Grupo 1 — Fijar contratos de autoridad y estado

1. **`docs/14-adrs.md` + ADR-014:** integrar la decisión ya aceptada y reflejar ADR-014 en el índice, respetando la inmutabilidad de ADRs aceptados. Resolver documentalmente la convivencia entre el índice único y el archivo separado.
2. **`docs/27-trazabilidad.md`:** usarlo como fotografía verificable de qué está implementado, qué es modelo y qué está pendiente; alinear la matriz con las decisiones ya registradas y los hallazgos AUD-01..AUD-10.
3. **`README.md`:** actualizar el estado del producto y las instrucciones operativas una vez que la matriz de trazabilidad sea la referencia acordada.

### Grupo 2 — Contratos de identidad, claves y eventos

4. **`docs/03-identidad.md`, `docs/05-arquitectura-p2p.md` y `docs/16-identificadores-y-firmas.md`:** mantener coherentes identidad, `node_id`, claves de dispositivo y colección, y distinguir explícitamente lo implementado de lo decidido para MVP2. La decisión C de ADR-014 se considera cerrada y no se reabre.
5. **`docs/14-adrs.md` mediante ADR sustitutivo cuando corresponda, y `docs/15-schema-eventos.md`:** alinear ADR-012 con el contrato de firma actual, y tratar ADR-013 conforme a la política de supersession; no reescribir silenciosamente ADRs aceptados.
6. **`docs/02-modelo-datos.md` y `docs/07-api-local.md`:** reflejar los contratos de identidad/eventos y distinguir operaciones locales MVP0 de los endpoints y flujos de colección futura.

### Grupo 3 — Alcance y arquitectura de MVP1/MVP2

7. **`docs/09-roadmap-mvp.md`, `docs/05-arquitectura-p2p.md`, `docs/02-modelo-datos.md`, `docs/15-schema-eventos.md`:** sincronizar la frontera entre persistencia local por colección, publicación, escritura dual y replicación.
8. **`docs/20-stack-tecnico.md`, `docs/23-migraciones.md`, `docs/26-limitaciones-conocidas.md`:** dejar consistente la decisión/uso de Hyperbee y el backend de la vista materializada.
9. **`docs/06-descubrimiento.md`, `docs/08-bootstrap-y-seeds.md`, `docs/10-riesgos.md`:** alinear el alcance de enlace directo, Hyperswarm/NAT traversal, DHT y seed peers por fase.

### Grupo 4 — Contratos transversales y presentación

10. **`docs/11-glosario.md`:** consolidar nombres canónicos y referencias a los documentos que definen cada concepto, sin sustituir las especificaciones normativas.
11. **`docs/12-testing.md` y `docs/21-distribucion.md`:** alinear estrategia de CI, pruebas por fase y canales reales de distribución.
12. **`docs/13-ui-ux.md`, `docs/24-ui-vision.md`, `docs/19-onboarding.md` y `docs/25-busqueda-i18n.md`:** sincronizar pantallas, navegación, onboarding, estados de sincronización e idioma con los contratos de fases ya fijados.

### Grupo 5 — Cierre y revisión cruzada

13. **`docs/04-canonicalizacion-url.md`, `docs/17-propuestas.md`, `docs/18-seed-pack.md` y `docs/branding/README.md`:** revisión final de consistencia cruzada; no aparecen como bloqueantes centrales para la persistencia de MVP1.
14. **Relectura integral:** comprobar referencias cruzadas, estados de implementación y vocabulario entre README, roadmap, ADRs, API, schemas y trazabilidad antes de dar por cerrada la documentación pre-MVP1.

---

**Nota de alcance:** este dossier es un mapa de lectura, no una especificación nueva ni una decisión arquitectónica. Las decisiones ya aceptadas —incluida opción C en ADR-014— se registran como tales y no se reabren aquí.