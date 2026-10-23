# Riesgos y mitigaciones

## R1 — Arranque en frío del descubrimiento

**Riesgo:** sin descubrimiento global hasta MVP3, los usuarios dependen de enlaces `bmn://` que circulan por canales externos. El producto parece vacío.

**Mitigación:** Discovery Feed v1 con colecciones concretas, no temas vacíos; seed peers con colecciones populares desde el día 1; el usuario debe poder abrir una colección y ver bookmarks reales.

## R2 — Multi-writer en Hypercore

**Riesgo:** Hypercore nativo es single-writer. Las contribuciones tipo «Pull Request» requerirán Autobase o fork + merge.

**Mitigación:** no bloquea el MVP; documentar la decisión y elegir entre Autobase y fork/merge antes de MVP3.

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
