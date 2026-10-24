# Roadmap MVP

Regla: cada fase debe producir algo utilizable por una persona real.

## MVP 0 — Nodo local

**Objetivo:** guardar bookmarks localmente, todavía sin P2P.

Componentes: Identity, Hypercore, Hyperbee, Web UI.

Funcionalidades:
- Crear identidad.
- Inbox.
- Crear, editar y eliminar bookmarks.
- Crear, mover y eliminar colecciones.
- Web UI en `localhost:port`.

Resultado: «Pocket local».

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
- **Duplicar:** creas una copia propia congelada en el momento del fork. El génesis de tu copia incluye `forked_from: <collection_id_original>`. Es una copia congelada: los cambios posteriores del autor original NO se propagan automáticamente a tu copia. Si quieres actualizarla, vuelves a duplicar.

**Objetivo:** validar identidad multidispositivo y compartición entre usuarios, con NAT traversal básico y tolerancia a offline.

Escenario: Gorka (NAS 24/7) comparte «Japón 2027»; Laura (portátil ocasional) la sigue, se desconecta y Gorka añade tres bookmarks. Laura vuelve dos días después y se actualiza automáticamente.

Funcionalidades:
- Añadir dispositivo mediante QR.
- Replicación entre dispositivos propios.
- Compartir colección por `bmn://<collection_id>`.
- Seguir colección por enlace.
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

## MVP 3 — Hyperswarm + descubrimiento inicial

- Descubrimiento por topic vía DHT.
- `announce(topic)` al publicar.
- Caché local de peers conocidos.

## MVP 4 — Discovery Feed

- Temas semilla.
- Colecciones destacadas.
- Feed incluido en la app, actualizable vía seed peers.

**Mejora crítica:** el Discovery Feed no debe ser una lista de temas vacíos. Debe mostrar colecciones concretas navegables desde el primer arranque; el usuario debe poder abrir una colección el día 1 y ver bookmarks reales.

## MVP 5 — Métricas emergentes

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

## MVP3+ — Propuestas in-app (horizonte)

En una fase posterior a MVP2 se añadirá el sistema de propuestas in-app. Mecanismo:

1. Laura duplica una colección de Gorka (copia congelada con `forked_from`).
2. Laura añade o modifica bookmarks en su copia.
3. Laura pulsa "Proponer al autor original" dentro de la app.
4. Gorka recibe la propuesta en su bandeja de propuestas.
5. Gorka revisa el diff y acepta o rechaza.
6. Si acepta, la app de Gorka escribe los cambios en su propia colección (eventos `add_bookmark` o `edit_bookmark`, firmados por Gorka).

**No requiere Autobase.** Cada escritura es single-writer en el log del autor correspondiente. La propuesta es un mensaje, no una escritura compartida.

Ver [docs/17-propuestas.md](17-propuestas.md) para el detalle del mecanismo y las medidas anti-abuso.
