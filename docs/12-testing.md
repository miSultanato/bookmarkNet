# Testing

Este documento define la estrategia de testing de BookmarkNet.
Es un documento vivo: se completa a medida que se implementa el
código. No es una especificación cerrada.

## Principios

1. **Los tests son código de primera clase.** No son un extra.
   Se escriben junto con la funcionalidad, no después.
2. **Los módulos críticos tienen cobertura alta.** La
   canonicalización de URLs, el fold de eventos y la
   verificación de firmas son el corazón del sistema. Un bug
   ahí rompe todo lo demás.
3. **Los tests de integración validan el flujo completo.** Un
   test unitario no detecta que dos nodos no se replican
   correctamente. Hacen falta tests con dos nodos reales.
4. **Los tests no dependen de la red.** Hyperswarm se puede
   simular en local para tests de integración. Los tests de
   red real (con peers externos) son e2e y se ejecutan aparte.

## Qué se testea

### Módulos críticos

- **Canonicalización de URLs:** todos los casos límite
  (trailing slash, query params, tracking, fragmentos,
  mayúsculas, `www.`, etc.).
- **Fold de eventos:** cada tipo de evento, la idempotencia,
  el orden, la migración al vuelo.
- **Verificación de firmas:** Ed25519, `signature_by_owner`,
  verificación de `author_public_key` contra `author_id`.
- **Identificadores:** formato de cada ID (ULID, hex, prefijos).

### Flujos de integración

- **Replicación entre dos nodos:** nodo A crea colección,
  nodo B la sigue, A añade bookmark, B lo recibe.
- **Publicación y despublicación:** crear `collection_core`,
  despublicar con `collection_unpublished`, verificar que los
  seguidores reciben el aviso.
- **Multidispositivo:** dos `device_core` del mismo usuario
  se replican y la vista unificada es correcta.
- **Migraciones:** colección en v1, migrar a v2, verificar que
  el estado es correcto.

### API local

- **Endpoints CRUD:** bookmarks, colecciones, grupos.
- **Búsqueda:** orden de resultados, campos buscados, filtros.
- **Seguridad:** validación de `Host`, `Origin`,
  `Content-Type`. Rechazo de peticiones no permitidas.
- **Autenticación local:** (si se implementa en el futuro).

### Seguridad

- **DNS rebinding:** petición con `Host: evil.com` debe ser
  rechazada con `421`.
- **CSRF:** petición `POST` sin `Origin` o con `Origin`
  distinto debe ser rechazada con `403`.
- **Bind:** el servidor solo escucha en `127.0.0.1` por
  defecto.

## Cómo se testea

### Unit tests

- **Framework:** `brittle` (el framework de tests de
  Holepunch, nativo de Bare). Si se prefiere, `node:test` con
  el shim `bare-node`.
- **Cobertura:** 80% mínimo en módulos críticos
  (canonicalización, fold, firmas).
- **Velocidad:** la suite completa de unit tests debe correr
  en menos de 30 segundos.

### Property-based tests

- **Canonicalización:** generar URLs aleatorias y verificar
  que la canonicalización es idempotente y determinista.
- **Fold:** generar secuencias aleatorias de eventos y
  verificar que el fold es determinista.
- **Herramienta:** `fast-check` (funciona en Bare con el shim
  de Node).

### Integration tests

- **Dos nodos en local:** levantar dos instancias del nodo en
  puertos distintos, conectarlas por Hyperswarm en modo
  local, replicar una colección, verificar el estado.
- **Velocidad:** cada test de integración debe correr en menos
  de 2 minutos.

### E2E tests

- **Nodos reales en red:** (fuera de MVP0–MVP2). Se ejecutan
  manualmente o en releases, no en cada PR.

## CI (Integración Continua)

### Fase actual (repo privado)

- **Plataforma:** GitHub Actions.
- **Límite:** 2.000 minutos/mes (GitHub Free para repos
  privados).
- **Estrategia:** conservadora.
  - Unit tests en cada push a cualquier rama.
  - Integration tests solo en `main` y en PRs a `main`.
  - E2E tests solo en releases.
  - `paths-ignore` para evitar ejecuciones innecesarias
    (cambios solo en docs, por ejemplo).

### Fase futura (repo público)

- **Plataforma:** GitHub Actions.
- **Límite:** ilimitado y gratis para repos públicos.
- **Estrategia:** completa.
  - Unit tests en cada push.
  - Integration tests en cada PR.
  - E2E tests en `main` y en releases.
  - Cobertura reportada en cada PR.

### Cuándo se hace público el repo

Antes de empezar a codificar. Ver `docs/21-distribucion.md` y
la conversación del proyecto. Los pasos para hacerlo público:

1. Revisar el historial de git (que no haya secretos).
2. Añadir `.gitignore` robusto.
3. Añadir `LICENSE` (MIT).
4. Añadir `README.md` en la raíz.
5. Configurar GitHub Actions sin límites de minutos.

## Cobertura

- **Módulos críticos:** 80% mínimo (canonicalización, fold,
  firmas, identificadores).
- **Módulos de UI:** sin objetivo fijo. Los tests de UI son
  costosos y frágiles. Se testea la lógica, no el DOM.
- **API local:** 70% mínimo.

## Lo que NO se testea (o se testea poco)

- **UI:** los tests de DOM son frágiles. Se testea la lógica
  de la UI (validaciones, transformaciones), no el renderizado.
- **Hyperswarm real:** los tests de integración usan
  Hyperswarm en modo local. Los tests de red real son e2e y se
  ejecutan aparte.
- **Rendimiento:** no se testea rendimiento en MVP0–MVP2. Se
  mide cuando haya usuarios reales.

## Herramientas

- `brittle` o `node:test` para unit tests.
- `fast-check` para property-based tests.
- `bare` para ejecutar los tests en el runtime nativo.
- GitHub Actions para CI.

## Documentos relacionados

- `docs/20-stack-tecnico.md`: runtime y herramientas.
- `docs/21-distribucion.md`: CI y releases.
- `docs/22-configuracion.md`: configuración del nodo.
