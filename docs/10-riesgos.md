# Riesgos y mitigaciones

## R1 — Arranque en frío del descubrimiento

**Riesgo:** sin descubrimiento global hasta MVP3, los usuarios dependen de enlaces `bmn://` que circulan por canales externos. El producto parece vacío.

**Mitigación:** Discovery Feed v1 con colecciones concretas, no temas vacíos; seed peers con colecciones populares desde el día 1; el usuario debe poder abrir una colección y ver bookmarks reales.

## R2 — Contribuciones y multi-writer

**Riesgo:** la contribución directa a una colección ajena requiere multi-writer (Autobase), que está fuera del MVP. Si se implementa mal, rompe el modelo single-writer de Hypercore.

**Mitigación:**
- En MVP0–MVP2 no existe contribución. Solo duplicar y seguir.
- En MVP3+ se añadirá un sistema de propuestas in-app (ver [docs/17-propuestas.md](17-propuestas.md)). Las propuestas son mensajes unidireccionales. El receptor las acepta o rechaza. Nunca hay escritura compartida.
- Autobase queda como horizonte futuro solo para el `user_core` multidispositivo (Punto 6), no para propuestas.

## R3 — Canonicalización de URLs

**Riesgo:** errores fragmentan `resource_id` y hacen inútiles las métricas de popularidad y el conocimiento emergente.

**Mitigación:** especificación formal en [04-canonicalizacion-url.md](04-canonicalizacion-url.md), versionado de la función (`v1:` en el hash) y tests exhaustivos con casos límite.

## R4 — Ansiedad del usuario por sincronización

**Riesgo:** en P2P, el usuario necesita saber si sus datos están respaldados. «🔴 Ningún peer disponible» durante días puede interpretarse como pérdida de datos.

**Mitigación:** UI clara: «Tu colección está segura en tu dispositivo. Se replicará cuando haya peers disponibles»; estado de sincronización visible y honesto.

## R5 — Autor original offline

**Riesgo:** si el autor desaparece, la colección sigue viva gracias a seeders, pero no recibe actualizaciones. No se distingue entre una colección huérfana pero funcional y una activa.

**Mitigación:** estado visible en UI: «⚠ Autor inactivo hace N meses». No es un problema técnico, sino de expectativas.

## R6 — NAT traversal difícil

**Riesgo:** algunos usuarios detrás de CGNAT no podrán conectar directamente.

**Mitigación:** MVP2 sólo usa conexiones que Hyperswarm consiga establecer; sin relays ni TURN en MVP2. A futuro, relays para casos difíciles.

## R7 — El producto se queda en «Syncthing para bookmarks»

**Riesgo:** si el descubrimiento no arranca, el producto es útil pero no cumple la visión.

**Mitigación:** hito claro (A crea → B duplica → C descubre). No construir funcionalidades encima hasta validarlo; si no ocurre, reconsiderar antes de seguir.

## R8 — Abuso del sistema de propuestas

**Riesgo:** una vez añadido el sistema de propuestas en MVP3+, podría ser objeto de spam, suplantación, acoso o sondeo.

**Mitigación:** cuatro capas de control (ver [docs/17-propuestas.md](17-propuestas.md)):
1. Restricción de relación: solo puedes proponer a colecciones que has duplicado.
2. Cuota de envío: límites diarios y por colección.
3. Control absoluto del receptor: bloquear, silenciar, marcar spam.
4. Límite de exposición: la propuesta se muestra como diff de bookmarks, no como contenido renderizado.
