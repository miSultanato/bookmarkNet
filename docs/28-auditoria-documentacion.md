# Auditoría de documentación (pre-MVP1)

## 1. Resumen ejecutivo

Se detectan **10 inconsistencias o desalineaciones** relevantes para preparar MVP1.
Las tres de mayor impacto son: la frontera MVP1/MVP2 de `collection_core`, la derivación de la clave de `device_core` descrita pero ausente del código, y la especificación de firma del génesis desactualizada.
También están desfasados el estado del README, dos funcionalidades que declara pendientes aunque están implementadas y el contrato de eventos de `device_core` en ADR-013.
La documentación no fija con suficiente precisión si MVP1 crea cores locales por colección o si esa creación se reserva para publicar en MVP2.
La frontera MVP2/MVP3 entre NAT traversal y descubrimiento DHT necesita una decisión explícita.
Hyperbee está aceptado como parte del stack en ADR-001, pero no está implementado y el backend del índice materializado sigue descrito con alternativas.
El código ya inicializa Hyperswarm sobre un topic de prueba, pero todavía no descubre ni replica colecciones o dispositivos.
No se ha modificado ningún archivo existente ni código.

## 2. Metodología

Se tomó como referencia `main` en el commit `c101679a60a27d0263c04b65818e535f690e5b78` (31/10/2026), titulado `feat: Inicialización de nodo con soporte de enjambre P2P`.

Se leyeron el `README.md` y todos los documentos solicitados:

- `docs/00-vision.md`, `docs/01-principios.md`, `docs/02-modelo-datos.md`, `docs/03-identidad.md`, `docs/04-canonicalizacion-url.md`.
- `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md`, `docs/07-api-local.md`, `docs/08-bootstrap-y-seeds.md`, `docs/09-roadmap-mvp.md`, `docs/10-riesgos.md`.
- `docs/11-glosario.md`, `docs/12-testing.md`, `docs/13-ui-ux.md`, `docs/14-adrs.md`, `docs/15-schema-eventos.md`, `docs/16-identificadores-y-firmas.md`.
- `docs/17-propuestas.md`, `docs/18-seed-pack.md`, `docs/19-onboarding.md`, `docs/20-stack-tecnico.md`, `docs/21-distribucion.md`, `docs/22-configuracion.md`.
- `docs/23-migraciones.md`, `docs/24-ui-vision.md`, `docs/25-busqueda-i18n.md`, `docs/26-limitaciones-conocidas.md`, `docs/27-trazabilidad.md` y `docs/branding/README.md`.

Para contrastar afirmaciones se consultaron `package.json` y sus scripts; `src/events.ts`, `src/fold.ts`, `src/device-events.ts`, `src/keys.ts`, `src/storage/device-core.ts`, `src/node/config.ts`, `src/node/start.ts`, `src/main.ts`, `src/p2p/swarm.ts`, `src/identity/export.ts` y `src/api/identity.ts`. También se consultó `test/config.test.ts` para comprobar los valores de configuración por defecto y la lectura de opciones.

La verificación consistió en comparar afirmaciones, fases y contratos documentales con las implementaciones y dependencias reales en ese commit. No se ejecutó la suite: el alcance era una auditoría documental y los puntos comprobados en código eran inspeccionables directamente. Cuando el repositorio no permite determinar la intención de producto, se indica que requiere confirmación humana.

## 3. Inconsistencias detectadas

### AUD-01 — Estado general del proyecto en README

- **Tipo**: desactualización
- **Archivos afectados**: `README.md`, `docs/09-roadmap-mvp.md`, `docs/27-trazabilidad.md`
- **Descripción**: el README, en la sección «Estado», afirma «MVP en diseño». En cambio, `docs/09-roadmap-mvp.md`, sección «MVP 0 — Nodo local», declara el MVP0 completado y enumera identidad, bookmarks, colecciones, grupos, Inbox, perfil, configuración, importación, UI, binario, AppImage, Docker y otras capacidades. `docs/27-trazabilidad.md` registra esas funcionalidades como implementadas.
- **Evidencia en código (si aplica)**: la matriz de `docs/27-trazabilidad.md` enlaza las implementaciones y tests concretos, entre otros `src/identity.ts`, `src/device-events.ts`, `src/device-fold.ts`, `src/api/server.ts`, `src/ui/*` y `src/node/config.ts`.
- **Impacto**: alto — presenta a usuarios y colaboradores un estado de madurez que ya no corresponde al producto disponible.
- **Corrección propuesta**: sustituir «MVP en diseño» por una descripción breve y verificable: MVP0 completado; MVP1 es el siguiente hito y está pendiente de definición/codificación según las decisiones de esta auditoría.

### AUD-02 — Auto-incremento de puerto y apertura automática del navegador

- **Tipo**: desactualización
- **Archivos afectados**: `README.md`, `docs/09-roadmap-mvp.md`, `docs/22-configuracion.md`
- **Descripción**: el README dice que el auto-incremento del puerto está pendiente y que la apertura automática del navegador está pendiente. El roadmap declara ambas implementadas y testeadas. `docs/22-configuracion.md` describe ya el auto-incremento y `open_browser_on_start` como comportamiento disponible.
- **Evidencia en código (si aplica)**:
  - `src/node/start.ts`: `listenWithPortFallback(server, startPort, bind, portExplicit, maxAttempts = 100)` prueba puertos consecutivos cuando el puerto no es explícito y falla si el puerto explícito está ocupado.
  - `src/main.ts`: importa `bare-open` y ejecuta `await open(`http://localhost:${api.port}`)` cuando `config.openBrowserOnStart === true`.
  - `src/node/config.ts`: el valor por defecto de `openBrowserOnStart` es `true`.
  - `test/config.test.ts`: comprueba el valor por defecto y que `open_browser_on_start: false` se respeta.
- **Impacto**: medio — el README da instrucciones y expectativas incorrectas sobre el arranque.
- **Corrección propuesta**: eliminar del README las dos advertencias de funcionalidad pendiente y describir el fallback de puerto y la apertura automática como comportamientos implementados, conservando la posibilidad de desactivar esta última.

### AUD-03 — Exportación cifrada de identidad

- **Tipo**: desactualización
- **Archivos afectados**: `README.md`, `docs/03-identidad.md`, `docs/07-api-local.md`, `docs/27-trazabilidad.md`
- **Descripción**: el README afirma que la exportación cifrada mediante `POST /api/v1/identity/export` no está implementada. `docs/03-identidad.md` y `docs/07-api-local.md` describen el endpoint, y `docs/27-trazabilidad.md` marca Export/Import como implementado.
- **Evidencia en código (si aplica)**: `src/api/identity.ts` implementa `handleExportIdentity` y `handleImportIdentity`; `src/identity/export.ts` implementa `exportIdentity` e `importIdentity`, con derivación de clave mediante `crypto_pwhash` y cifrado autenticado XChaCha20-Poly1305.
- **Impacto**: medio — puede llevar a concluir erróneamente que no existe un mecanismo de backup cifrado y afectar a las instrucciones de recuperación.
- **Corrección propuesta**: actualizar el README para indicar que la exportación/importación cifrada está implementada. Mantener claramente diferenciados el archivo local `identity.bmn` (en claro, protegido por permisos del directorio) y el artefacto exportado cifrado con contraseña.

### AUD-04 — Frontera MVP1/MVP2: persistencia de `collection_core` frente a publicación

- **Tipo**: contradicción
- **Archivos afectados**: `docs/02-modelo-datos.md`, `docs/03-identidad.md`, `docs/05-arquitectura-p2p.md`, `docs/07-api-local.md`, `docs/09-roadmap-mvp.md`, `docs/15-schema-eventos.md`, `docs/27-trazabilidad.md`
- **Descripción**:
  - `docs/09-roadmap-mvp.md`, «MVP 1 — Modelo Hypercore», dice «Cada colección = un Hypercore». En «MVP 2 — Multidispositivo + compartición directa» sitúa compartir, seguir, publicar y despublicar.
  - `docs/03-identidad.md`, sección «collectionId = collection_uuid», dice que el ULID se usa para derivar la clave «Al publicar (MVP2)».
  - `docs/05-arquitectura-p2p.md`, secciones «Cores por dispositivo» y «Publicación y doble log», califica `collection_core`, publicación y escritura dual como MVP1+.
  - `docs/07-api-local.md` indica que `collection_genesis` se crea al publicar y etiqueta esa creación como MVP1+.
  - `docs/15-schema-eventos.md` y `docs/27-trazabilidad.md` marcan la persistencia de `collection_core` como pendiente MVP1+.
  - `docs/02-modelo-datos.md` describe la colección pública como un `collection_core` que nace al publicar, mientras el borrador permanece en `device_core`.
- **Evidencia en código (si aplica)**: el código actual solo abre y escribe el `device_core` en `src/storage/device-core.ts`. `src/events.ts` y `src/fold.ts` contienen el modelo de eventos/fold de colección, pero no existe en los archivos consultados una apertura/persistencia de `collection_core`.
- **Impacto**: alto — esta ambigüedad define el alcance central del siguiente hito y puede provocar implementaciones incompatibles entre sí.
- **Corrección propuesta**: separar explícitamente dos conceptos en todos los documentos: (1) persistencia local por colección mediante `collection_core`, sin replicación; (2) publicación/anuncio/seguimiento y escritura dual entre `device_core` y `collection_core`. La asignación de cada concepto a MVP1 o MVP2 requiere confirmación humana. No debe mantenerse «MVP1+» como sustituto de una fase concreta.

### AUD-05 — Frontera MVP2/MVP3: enlace directo, NAT traversal y DHT

- **Tipo**: ambigüedad
- **Archivos afectados**: `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md`, `docs/09-roadmap-mvp.md`, `docs/10-riesgos.md`, `docs/24-ui-vision.md`
- **Descripción**:
  - `docs/09-roadmap-mvp.md`, MVP2, incluye compartir/seguir por enlace `bmn://<collection_id>` y «NAT traversal vía Hyperswarm».
  - `docs/06-descubrimiento.md`, «Estado por fases», dice que MVP2 es compartición directa «sin discovery automático» y reserva el descubrimiento por topic vía Hyperswarm DHT para MVP3; también reserva la caché local de peers para MVP3.
  - `docs/05-arquitectura-p2p.md` define Hyperswarm como DHT para discovery y NAT traversal.
  - `docs/10-riesgos.md` describe MVP2 como conexiones que Hyperswarm consiga establecer, sin relays ni TURN.
  - `docs/24-ui-vision.md` sitúa las acciones de compartir/seguir en MVP2, sin aclarar qué mecanismo localiza el peer que sirve el enlace.
- **Evidencia en código (si aplica)**: `src/p2p/swarm.ts` crea `new Hyperswarm()` y llama a `swarm.join(topic, { server: true, client: true })`. Hyperswarm se inicializa actualmente con un topic constante de prueba desde `src/node/start.ts`; esto no demuestra que exista ya descubrimiento funcional de colecciones.
- **Impacto**: alto — compartir una clave por enlace no basta por sí solo para localizar un peer; el mecanismo de conexión determina qué se puede validar en MVP2.
- **Corrección propuesta**: definir qué significa exactamente «compartición directa» en MVP2 y si el uso de Hyperswarm/DHT necesario para encontrar peers forma parte de MVP2 o se difiere a MVP3. Documentar por separado el descubrimiento iniciado por enlace, el descubrimiento abierto/automático y la caché de peers. **Requiere confirmación humana**; no se puede deducir una separación técnica inequívoca de los documentos actuales.

### AUD-06 — Grado de decisión e implementación de Hyperbee

- **Tipo**: contradicción
- **Archivos afectados**: `docs/05-arquitectura-p2p.md`, `docs/09-roadmap-mvp.md`, `docs/14-adrs.md`, `docs/20-stack-tecnico.md`, `docs/23-migraciones.md`, `docs/26-limitaciones-conocidas.md`, `package.json`
- **Descripción**:
  - `docs/14-adrs.md`, ADR-001, registra como aceptada la decisión de usar Hypercore + Hyperswarm + Hyperbee + Corestore.
  - `docs/05-arquitectura-p2p.md` describe Hyperbee como índice key-value; `docs/09-roadmap-mvp.md` incluye Hyperbee entre los componentes de MVP0; `docs/20-stack-tecnico.md` la lista entre las librerías principales.
  - `docs/26-limitaciones-conocidas.md` dice que para MVP1+ se prevé migrar el estado materializado a Hyperbee.
  - `docs/23-migraciones.md` deja el índice local como «Hyperbee, SQLite o archivo», lo que mantiene abierta la elección del soporte de la vista materializada.
  - El estado real del repositorio no contiene Hyperbee como dependencia.
- **Evidencia en código (si aplica)**: `package.json` no declara `hyperbee` ni `corestore`. `src/storage/device-core.ts` abre un Hypercore y `readAllEvents` recorre sus bloques; `src/node/start.ts` reconstruye el estado con `foldDeviceEvents`. No se encontró uso de Hyperbee en los archivos consultados.
- **Impacto**: alto — afecta al almacenamiento del estado materializado, al rendimiento esperado y al alcance de MVP1.
- **Corrección propuesta**: distinguir en la documentación entre decisión arquitectónica aceptada, dependencia instalada y componente efectivamente usado. Resolver si Hyperbee es el backend decidido para MVP1 o si ADR-001 debe matizarse y la elección del índice sigue pendiente. Si sigue pendiente, sustituir las afirmaciones que lo presentan como componente ya decidido/previsto de MVP0 y dejar la decisión registrada como pendiente. **Requiere confirmación humana**.

### AUD-07 — Clave de firma del `device_core`

- **Tipo**: contradicción
- **Archivos afectados**: `docs/03-identidad.md`, `docs/05-arquitectura-p2p.md`, `docs/27-trazabilidad.md`, `src/storage/device-core.ts`
- **Descripción**: `docs/03-identidad.md`, «Sincronización multidispositivo», y `docs/05-arquitectura-p2p.md`, «Cores por dispositivo», afirman que cada `device_core` se firma con una clave derivada de `user_master_key` y `node_id`. La trazabilidad marca el almacenamiento Hypercore como implementado, pero el código de apertura no recibe esa clave derivada.
- **Evidencia en código (si aplica)**: `src/storage/device-core.ts` ejecuta `new Hypercore(storagePath, { valueEncoding: 'json' })`; no deriva ni pasa un `keyPair` basado en `user_master_key` y `node_id`. La derivación HKDF implementada en `src/keys.ts` es para `collection_keypair`, usando `"bookmarknet:collection:" + collectionUuid`.
- **Impacto**: alto — afecta a la afirmación de propiedad criptográfica y a la posibilidad de reproducir/autorizar el core de cada dispositivo; es una diferencia de contrato, no solo de terminología.
- **Corrección propuesta**: confirmar si el diseño exige derivar la clave de `device_core` de la identidad y el `node_id`. Si sí, documentar esa operación como pendiente y no como implementada; si no, corregir la especificación para describir el mecanismo real. **Requiere confirmación humana**.

### AUD-08 — Serialización de la firma de `collection_genesis`

- **Tipo**: contradicción
- **Archivos afectados**: `docs/14-adrs.md`, `docs/15-schema-eventos.md`, `docs/16-identificadores-y-firmas.md`, `src/events.ts`
- **Descripción**:
  - `docs/14-adrs.md`, ADR-012, presenta una concatenación con `||` y no incluye `language`.
  - `docs/16-identificadores-y-firmas.md`, «El evento de génesis», también muestra `||` y omite `language`.
  - `docs/15-schema-eventos.md` incluye `language` en la lista de campos firmados. Más adelante explica que los campos se separan con el byte NUL (`\x00`), pero conserva un fragmento anterior con notación `||`, que puede interpretarse como una serialización distinta.
  - El código actual incluye `language` y separa todos los campos mediante NUL.
- **Evidencia en código (si aplica)**: `src/events.ts`, función `genesisSigningHash`: el array de campos contiene `params.language` y se serializa con `.join('\\x00')` antes de calcular SHA-256.
- **Impacto**: alto — una diferencia en los campos o en su serialización invalida la verificación de firmas entre implementaciones.
- **Corrección propuesta**: hacer que ADR-012, docs/15 y docs/16 describan exactamente el mismo preimage que `genesisSigningHash`: incluir `language`, orden fijo de campos, UTF-8 y separador NUL entre campos. Marcar ADR-012 como superseded o registrar una revisión conforme a la política de ADRs, sin reescribir silenciosamente una decisión aceptada.

### AUD-09 — ADR-013 conserva un schema antiguo de `device_core`

- **Tipo**: contradicción
- **Archivos afectados**: `docs/03-identidad.md`, `docs/14-adrs.md`, `src/device-events.ts`
- **Descripción**: ADR-013 afirma que `device_core` tiene cuatro tipos de evento: `device_metadata`, `device_collection`, `device_bookmark` y `device_group`. La especificación actual de `docs/03-identidad.md` define once eventos distintos y con granularidad CRUD/movimiento/reordenación. Los nombres del ADR ya no corresponden al contrato actual.
- **Evidencia en código (si aplica)**: `src/device-events.ts` define los once tipos: `device_metadata`, `device_create_collection`, `device_update_collection`, `device_delete_collection`, `device_add_bookmark`, `device_edit_bookmark`, `device_remove_bookmark`, `device_move_bookmark`, `device_reorder_bookmark`, `device_create_group` y `device_delete_group`.
- **Impacto**: alto — ADR-013 es una decisión aceptada que documenta un contrato distinto del que se usa realmente.
- **Corrección propuesta**: actualizar ADR-013 mediante un ADR sustitutivo o anotarlo como superseded, y hacer que el contrato vigente remita expresamente a los once eventos de `docs/03-identidad.md`. No conservar los cuatro nombres como si fueran el schema actual.

### AUD-10 — Estado de replicación multidispositivo y prototipo Hyperswarm

- **Tipo**: ambigüedad
- **Archivos afectados**: `docs/03-identidad.md`, `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md`, `docs/27-trazabilidad.md`, `src/node/start.ts`, `src/p2p/swarm.ts`
- **Descripción**:
  - `docs/03-identidad.md` afirma en presente que todos los dispositivos del mismo usuario se unen a un topic derivado de `user_id` y replican los `device_core` ajenos en solo lectura.
  - `docs/05-arquitectura-p2p.md` describe el mismo flujo sin marcar claramente ese párrafo como diseño futuro.
  - `docs/27-trazabilidad.md` declara multidispositivo/seguir/duplicar y replicación P2P como pendientes MVP1+ y deja el código de replicación en «—».
  - El último commit añade inicialización de Hyperswarm, pero no implementa ese flujo de replicación.
- **Evidencia en código (si aplica)**: `src/node/start.ts` llama a `startSwarm(TEST_TOPIC, ...)` con `TEST_TOPIC = Buffer.from('lotura-test-topic')`. `src/p2p/swarm.ts` se une a ese topic y únicamente registra `peer connected` al recibir una conexión; no deriva topics de `user_id`, no intercambia claves de cores ni replica Hypercore.
- **Impacto**: medio — puede confundirse la inicialización experimental del transporte con una capacidad multidispositivo disponible.
- **Corrección propuesta**: etiquetar el párrafo de `docs/03-identidad.md` y el apartado correspondiente de `docs/05-arquitectura-p2p.md` como diseño pendiente, y actualizar `docs/27-trazabilidad.md` para registrar el prototipo Hyperswarm sobre topic de prueba como infraestructura experimental, diferenciándolo de la replicación funcional, que continúa pendiente.

## 4. Decisiones pendientes que la auditoría revela

Estas decisiones corresponden al responsable del producto/arquitectura. La auditoría no las decide:

1. **Alcance exacto de MVP1:** ¿cada colección local tendrá su propio `collection_core` persistente aunque siga siendo privada y no se anuncie, o MVP1 solo prepara el modelo de eventos y la persistencia por colección se activa al publicar en MVP2?
2. **Momento de publicación:** ¿publicar, anunciar un topic y habilitar seguidores pertenece a MVP1 o se reserva íntegramente a MVP2? Debe quedar separado de la persistencia local por colección.
3. **Descubrimiento y NAT traversal:** ¿MVP2 puede usar Hyperswarm/DHT para resolver un enlace directo y establecer conexiones, dejando para MVP3 el descubrimiento abierto y la caché de peers? ¿O el uso de DHT se reserva por completo a MVP3?
4. **Hyperbee:** ¿se mantiene como decisión aceptada y backend elegido para el índice/vista materializada de MVP1, o se reabre la elección entre Hyperbee, SQLite y archivo? También debe aclararse si Corestore forma parte de la implementación prevista o solo del diseño.
5. **Clave de `device_core`:** ¿debe derivarse de `user_master_key` + `node_id`, como afirman los documentos, o se acepta otro mecanismo de clave local?
6. **Migración MVP0 → MVP1:** ¿cómo se transformará el log único `device_core` actual en los cores por colección? ¿Se conservará un log de dispositivo para perfil y metadatos, además de los nuevos cores? ¿Cómo se preservarán bookmarks del Inbox global y colecciones borrador?
7. **Contrato de firma:** confirmar que el contrato vigente es el implementado en `src/events.ts` (incluye `language` y separador NUL) y formalizar cómo se registra la sustitución de ADR-012.
8. **ADR-013:** confirmar que los once eventos actuales de `device_core` sustituyen definitivamente al schema de cuatro eventos descrito por el ADR aceptado.

## 5. Archivos que NO requieren cambios

Se revisaron y no se detectó en esta auditoría una contradicción concreta que justifique modificarlos para resolver los hallazgos anteriores:

- `docs/00-vision.md`
- `docs/01-principios.md`
- `docs/02-modelo-datos.md` (su descripción conceptual se debe releer al decidir la frontera de publicación; el hallazgo de fases está registrado en AUD-04)
- `docs/04-canonicalizacion-url.md`
- `docs/08-bootstrap-y-seeds.md`
- `docs/10-riesgos.md` (participa como contexto en AUD-05, pero no requiere corrección independiente mientras se resuelva esa decisión)
- `docs/11-glosario.md`
- `docs/12-testing.md`
- `docs/13-ui-ux.md`
- `docs/17-propuestas.md`
- `docs/18-seed-pack.md`
- `docs/19-onboarding.md`
- `docs/21-distribucion.md`
- `docs/24-ui-vision.md` (participa como contexto en AUD-05, sin corrección independiente identificada)
- `docs/25-busqueda-i18n.md`
- `docs/branding/README.md`

La ausencia de un archivo en esta lista significa que está afectado por uno o más hallazgos, no que no se haya revisado. En particular, `README.md`, `docs/03-identidad.md`, `docs/05-arquitectura-p2p.md`, `docs/06-descubrimiento.md`, `docs/07-api-local.md`, `docs/09-roadmap-mvp.md`, `docs/14-adrs.md`, `docs/15-schema-eventos.md`, `docs/16-identificadores-y-firmas.md`, `docs/20-stack-tecnico.md`, `docs/23-migraciones.md`, `docs/26-limitaciones-conocidas.md` y `docs/27-trazabilidad.md` aparecen en los hallazgos y requieren revisión una vez tomadas las decisiones pendientes.
