# UI/UX

Este documento define los principios de diseño, las pantallas del MVP y la navegación de BookmarkNet. Es un documento vivo: se completa a medida que se implementa la UI.

## Principios de diseño

1. **El bookmark es el centro.** La UI gira alrededor del enlace. Las personas, los posts y el contenido generado no son el foco.
2. **Minimalismo.** Sin gamificación, sin notificaciones innecesarias, sin elementos sociales que distraigan. La app hace lo que tiene que hacer y no más.
3. **Sin cuentas.** La identidad es criptográfica. No hay login, no hay email, no hay password. El usuario no gestiona una cuenta; tiene claves.
4. **Local primero.** La UI asume que los datos están en local. Si hay red, se sincroniza. Si no, funciona igual.
5. **Honestidad sobre la sincronización.** La UI muestra el estado real de cada colección (sincronizada, pendiente, offline, archivada). No oculta la incertidumbre.
6. **Sin IA.** No hay resúmenes automáticos, ni clasificación automática, ni recomendaciones IA. La organización es humana.

## Pantallas MVP0 — Nodo local

### 1. Onboarding

Primera ejecución. Tres opciones independientes:

- Importar bookmarks de mi navegador (HTML)
- Añadir colecciones iniciales (seed pack)
- Continuar

Las tres opcionales. Si el usuario marca "Importar" pero no selecciona archivo, aviso suave. Después de "Continuar", va a Explorar (si marcó seed pack) o a un mensaje claro de qué puede hacer.

**Fase:** el onboarding básico (esta pantalla) es MVP0. La opción "Añadir colecciones iniciales" solo funciona a partir de MVP4 (cuando existe el seed pack). En MVP0 muestra "disponible próximamente".

### 2. Explorar

Pantalla principal tras el onboarding.

- **Si el usuario añadió el seed pack:** lista de colecciones del seed pack, agrupadas por tema (Viajes, Fotografía, Finanzas, Cocina, Homelab, Privacidad).
- **Si no añadió el seed pack:** mensaje claro con botones para "Añadir colecciones iniciales" o "Importar bookmarks".
- **Búsqueda:** barra de búsqueda en la parte superior. Al buscar, resultados ordenados: colecciones primero, después bookmarks, después tags.

### 3. Mis bookmarks

Fase MVP0: "Mis bookmarks" tiene dos pestañas:

- **Inbox:** bookmarks con `collectionId: null` (Inbox global). Cada uno muestra título, URL y tags. Acción "Mover a colección" (se implementa cuando exista la pantalla de Bookmark).
- **Colecciones:** lista de colecciones propias, con contador de bookmarks por colección. Incluye un formulario inline para crear una colección nueva.

Los grupos no son una pestaña global. Los grupos son por colección y se ven dentro de la pantalla "Colección". En una colección, los bookmarks con `groupId: null` se muestran en un grupo visual "Sin grupo" (o "Raíz"). No se llama Inbox.

### 4. Colección

Vista de una colección concreta.

- **Cabecera:** nombre, descripción, visibilidad, estado de sincronización.
- **Lista de bookmarks:** agrupados por grupos (si los tiene) o en orden. Los bookmarks con `groupId: null` van en un grupo visual "Sin grupo" (raíz de la colección). No es el Inbox global.
- **Acciones:** seguir (si es ajena), duplicar, publicar (si es propia y privada), despublicar (si es propia y pública), editar metadatos.
- **Si es ajena:** botón "Seguir" y botón "Duplicar".
- **Si es propia:** botón "Publicar" o "Despublicar".

**Fase:** las acciones "Seguir", "Duplicar", "Publicar" y "Despublicar" son MVP2. En MVP0 la pantalla de colección solo muestra los bookmarks y permite editarlos.

### 5. Bookmark

Vista de un bookmark concreto.

- **URL, título, descripción, tags, notas.**
- **Colecciones que lo contienen** (si el usuario tiene varias colecciones con el mismo resource).
- **Acciones:** editar, eliminar, mover a grupo o colección.
- **Si el bookmark está en el Inbox global (`collectionId: null`):** se muestra la acción "Mover a colección".
- **Si el usuario sigue colecciones ajenas:** "Aparece en N colecciones de tu red".

### 6. Ajustes

- **Perfil:** nombre, bio, avatar (opcional).
- **Dispositivos:** lista de dispositivos del usuario.
- **Importar bookmarks:** HTML de navegador.
- **Añadir seed pack:** si no lo hizo en el onboarding.
- **Configuración:** puerto, directorio de datos, bootstrap nodes, log level.

## Pantallas MVP2 — Multidispositivo

### 7. Dispositivos

- Lista de dispositivos del usuario (NAS, PC, portátil...).
- Estado de cada uno: online, offline, última sincronización.
- Acción: añadir dispositivo (QR).
- Acción: revocar dispositivo (futuro).

### 8. Estado de sincronización

- Por colección: sincronizada, pendiente, offline, archivada.
- Por dispositivo: última sincronización, peers conectados.
- Mensaje honesto: "Tu colección está segura en tu dispositivo. Se replicará cuando haya peers disponibles."

## Pantallas MVP4 — Seed pack

### 9. Seed pack

- Lista de colecciones del seed pack, agrupadas por tema.
- Botón "Añadir todas" o selección individual.
- Indica el origen (awesome-list de GitHub, colección curada).

## Pantallas MVP3+ — Propuestas

### 10. Bandeja de propuestas

- Lista de propuestas recibidas.
- Cada propuesta: autor, colección destino, diff de cambios, mensaje.
- Acciones: aceptar, rechazar, bloquear emisor, marcar spam.

## Navegación

- **Barra superior:** búsqueda + acceso a ajustes.
- **Barra lateral (o tabs):** Explorar | Mis bookmarks | Dispositivos | Ajustes.
- **Dentro de una colección:** breadcrumb para volver a Explorar o Mis bookmarks.
- **Sin menús anidados profundos.** Máximo 2 niveles.

## Estados de UI

- **Cargando:** spinner o skeleton.
- **Vacío:** mensaje claro con acción sugerida.
- **Error:** mensaje + acción de reintento.
- **Offline:** banner discreto "Sin conexión. Los cambios se sincronizarán cuando vuelvas a estar online."
- **Sincronizando:** indicador discreto en la cabecera.
- **Archivada:** etiqueta en la colección.

## Lo que NO se muestra

- Notificaciones push.
- Contadores de "me gusta" o similar.
- Rankings de usuarios.
- Recomendaciones automáticas.
- Publicidad.
- Chat o mensajería libre.

## Accesibilidad

- Contraste suficiente (WCAG AA).
- Navegación por teclado.
- Textos alternativos en iconos.
- Sin dependencia de color para información crítica.

## Documentos relacionados

- `docs/19-onboarding.md`: flujo de primera ejecución.
- `docs/18-seed-pack.md`: contenido del seed pack.
- `docs/17-propuestas.md`: sistema de propuestas.
- `docs/06-descubrimiento.md`: búsqueda y métricas.
