# Roadmap MVP

Regla: cada fase debe producir algo utilizable por una persona real.

## MVP 0 — Nodo local

**Objetivo:** guardar bookmarks localmente, todavía sin P2P.

Componentes: Identity, Hypercore, Hyperbee, Web UI.

- Stack: Bare + TypeScript, UI web local servida por el core (ver docs/20-stack-tecnico.md).
- Distribución: binario nativo por plataforma + Docker (ver docs/21-distribucion.md).
- Testing: unit tests para módulos críticos (ver docs/12-testing.md).
- UI: pantallas de Explorar, Mis bookmarks, Colección, Bookmark y Ajustes (ver docs/13-ui-ux.md).
- Onboarding básico: pantalla de primera ejecución con 3 opciones. Solo "Importar bookmarks HTML" funciona en MVP0. "Añadir colecciones iniciales" muestra "seed pack disponible próximamente". "Continuar" va directo a la app.

Funcionalidades:
- Crear identidad.
- Inbox.
- Crear, editar y eliminar bookmarks.
- Crear, mover y eliminar colecciones.
- Grupos: crear, mover bookmarks entre grupos, eliminar grupos. Los bookmarks sin grupo van al Inbox.
- Web UI en `localhost:port`.

Resultado: «Pocket local».

**Estado: completado.** Identidad, bookmarks, colecciones, grupos, Inbox global, perfil, configuración, importación HTML, UI web local (con rediseño y búsqueda), binario standalone (`bare-build`), AppImage, imagen Docker, auto-incremento de puerto y `openBrowserOnStart` implementados y testeados.

## MVP 1 — Modelo Hypercore

**Objetivo:** todo vive sobre Hyper*, aunque siga siendo local.

- Cada colección = un Hypercore.
- Eventos en vez de INSERT (por ejemplo, el envelope canónico):

  ```json
  {
    "schema_version": 1,
    "event_id": "01J8XL...",
    "event_type": "add_bookmark",
    "author_id": "u_...",
    "created_at": "...",
    "payload": { ... }
  }
  ```
- Preparado para replicarse.

## MVP 2 — Multidispositivo + compartición directa

### Seguir vs duplicar

Son dos operaciones distintas:

- **Seguir:** replicas la colección del autor. Recibes sus cambios. No puedes editar la colección original. Se materializa con un enlace `bmn://<collection_id>`.
- **Duplicar:** creas una copia propia congelada en el momento del fork, con su propio `collection_core` y `collection_id`. El génesis de tu copia incluye `forked_from: <collection_id_original>`. Pasa a ser tuya: puedes editarla, publicarla y volver a forkearla. Los cambios posteriores del autor original NO se propagan automáticamente a tu copia; si quieres incorporarlos, debes hacerlo manualmente.

Seguir y duplicar son operaciones independientes y no excluyentes. Puedes seguir una colección y duplicarla a la vez: la versión seguida recibe las actualizaciones de su dueño y no puedes editarla; la copia duplicada es tuya y la editas por separado. Duplicar conserva intacta la relación de seguimiento y crea una colección distinta; no transforma la versión seguida.

**Objetivo:** validar identidad multidispositivo y compartición entre usuarios, con NAT traversal básico y tolerancia a offline.

Escenario: Marta (NAS 24/7) comparte «Japón 2027»; Laura (portátil ocasional) la sigue, se desconecta y Marta añade tres bookmarks. Laura vuelve dos días después y se actualiza automáticamente.

Funcionalidades:
- Añadir dispositivo mediante QR.
- Replicación entre dispositivos propios.
- Compartir colección por `bmn://<collection_id>`.
- Seguir colección por enlace.
- Duplicar una colección ajena como copia propia congelada.
- Publicar y despublicar colecciones propias.
- Estado de sincronización en UI.
- NAT traversal vía Hyperswarm (sin relays ni TURN).

Demo de validación:
1. Crear identidad.
2. Añadir segundo dispositivo.
3. Crear colección.
4. Compartir colección.
5. Seguirla desde otro usuario.
6. Apagar nodos durante días.
7. Recuperar sincronización automáticamente.
8. Funcionar detrás de NAT domésticos.

**Importante:** el primer momento mágico no es sincronizar el portátil con el NAS, sino encontrar una colección hecha por otra persona y añadirla a la biblioteca.

**Publicación y despublicación:**

- Publicar una colección crea un `collection_core` con el estado actual.
- Escritura dual automática tras publicar.
- Despublicar escribe `collection_unpublished` y deja de anunciar el topic.
- No hay republicación.

## MVP 3 — Hyperswarm + descubrimiento inicial

- Descubrimiento por topic vía DHT.
- `announce(topic)` al publicar.
- Caché local de peers conocidos.
- Búsqueda enriquecida: `collection_count` **local** por resource ("aparece en N colecciones locales").

## MVP 4 — Seed pack completo

- Seed pack: conjunto de colecciones completas incluidas en el binario.
- Origen: awesome-lists de GitHub transformadas mediante script, más colecciones creadas manualmente.
- Cada colección lleva el `creator_peer_id` del NAS o VPS del equipo.
- Onboarding completo de primera ejecución: la opción "Añadir colecciones iniciales" instala el seed pack y permite explorar sus colecciones offline. El onboarding básico de MVP0 ya muestra las tres opciones, pero esta opción indica "seed pack disponible próximamente" hasta MVP4.
- Importación desde Pocket u otras fuentes: fuera de MVP4, en fases posteriores.

Ver docs/18-seed-pack.md para el seed pack y docs/19-onboarding.md para el flujo de primera ejecución.
## MVP 5 — Métricas emergentes

- `collection_count` **global** estimado (gossip o seed peers agregadores).
- Búsqueda con `co_occurrence` ("relacionado frecuente con X, Y, Z").
- Estadísticas agregadas (nunca bookmarks privados).
- Tendencias, más duplicados, más reutilizados y nuevos.
- Conocimiento emergente: stacks, relaciones y rutas.

## Hito de validación real

```
Usuario A crea colección
Usuario B la descubre
Usuario B la duplica
Usuario B añade bookmarks
Usuario C descubre la copia
```

Si ese ciclo ocurre de forma natural, la red está validada. Todo lo demás se construye encima sin cambiar la arquitectura.

## Fuera del MVP

Sin likes, comentarios, chat, IA, recomendaciones IA, rankings de usuarios, seguidores complejos, mensajería, moderación distribuida ni temas automáticos avanzados.

## Migraciones de schema

La política de migraciones está en
docs/23-migraciones.md. Resumen:

- Bloques inmutables. La migración se hace en la vista
  materializada.
- Vista materializada: migración automática y
  transparente al arrancar.
- Colecciones no publicadas (`device_core`): migración
  eager automática.
- Colecciones publicadas (`collection_core`): migración
  explícita con aviso único al autor y
  `collection_unpublished` + `migrated_to`.

## MVP3+ — Propuestas in-app (horizonte)

En una fase posterior a MVP2 se añadirá el sistema de propuestas in-app. Mecanismo:

1. Laura duplica una colección de Marta (copia congelada con `forked_from`).
2. Laura añade o modifica bookmarks en su copia.
3. Laura pulsa "Proponer al autor original" dentro de la app.
4. Marta recibe la propuesta en su bandeja de propuestas.
5. Marta revisa el diff y acepta o rechaza.
6. Si acepta, la app de Marta escribe los cambios en su propia colección (eventos `add_bookmark` o `edit_bookmark`, firmados por Marta).

**No requiere Autobase.** Cada escritura es single-writer en el log del autor correspondiente. La propuesta es un mensaje, no una escritura compartida.

Ver [docs/17-propuestas.md](17-propuestas.md) para el detalle del mecanismo y las medidas anti-abuso.

## Hitos operativos

- **Antes del coding:** hacer el repositorio público (con LICENSE MIT, .gitignore, README). Ver docs/12-testing.md.
- **MVP2:** avisos de sincronización (dispositivos offline al publicar, despublicación con migrated_to).
- **MVP3:** notificación de nueva versión de la app.
- **MVP4:** onboarding con seed pack completo.

## Documentos relacionados

- Testing: docs/12-testing.md
- UI/UX: docs/13-ui-ux.md
- ADRs: docs/14-adrs.md
