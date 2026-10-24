# Sistema de propuestas (MVP3+)

Este documento define el sistema de propuestas in-app que se añadirá en MVP3 o posterior. NO forma parte del MVP0–MVP2. Su objetivo es permitir sugerir cambios a colecciones ajenas sin romper el modelo single-writer de Hypercore.

## Principio

**Las propuestas son mensajes, no escrituras compartidas.**

Cada usuario escribe siempre en su propio log. La propuesta es un mensaje unidireccional que el receptor revisa y decide si acepta. No hay multi-writer, no hay Autobase, no hay escritura en el log de otro usuario.

## Flujo

1. Laura duplica una colección de Marta (copia congelada con `forked_from`).
2. Laura añade o modifica bookmarks en su copia.
3. Laura pulsa "Proponer al autor original" dentro de la app.
4. La app de Laura crea un `proposal_core` (Hypercore single-writer, firmado por Laura) y anuncia el topic derivado de `target_collection_id`.
5. La app de Marta, unida al topic de sus propias colecciones, descubre la propuesta y la replica.
6. Marta ve la propuesta en su bandeja de propuestas.
7. Marta revisa el diff y acepta o rechaza.
8. Si acepta, la app de Marta escribe los cambios en su propia colección (eventos `add_bookmark` o `edit_bookmark`, firmados por Marta con su `collection_keypair`).

## Formato del evento `proposal`

```json
{
  "schema_version": 1,
  "event_id": "01J8X...",
  "event_type": "proposal",
  "author_id": "u_laura...",
  "created_at": "2026-10-24T...",
  "payload": {
    "target_collection_id": "3df0c93d...",
    "source_collection_id": "a1b2c3d4...",
    "message": "He añadido 3 bookmarks de senderismo",
    "diff": {
      "added": [
        {
          "canonical_url": "https://...",
          "title": "...",
          "tags": ["..."]
        }
      ],
      "modified": [],
      "removed": []
    }
  }
}
```

Reglas del payload:

- `target_collection_id`: colección a la que se propone el cambio.
- `source_collection_id`: copia del emisor. Debe tener `forked_from == target_collection_id` (validado por el receptor).
- `message`: texto plano, máximo 500 caracteres. Sin Markdown, sin enlaces clicables.
- `diff`: solo bookmarks, sin imágenes, sin archivos, sin renderizado.

## Control de abusos

### Capa 1 — Restricción de relación

Solo puedes proponer cambios a colecciones que has duplicado.

- El emisor lo verifica antes de enviar.
- El receptor lo revalida al recibir: si `source_collection_id.forked_from != target_collection_id`, rechazar.
- Esto elimina el spam de extraños: necesitas una relación previa (fork) para proponer.

### Capa 2 — Cuota de envío

Límites locales (aplicados por el emisor):

| Regla | Valor |
|---|---|
| Propuestas por día | 10 |
| Propuestas por colección y semana | 3 |
| Intervalo mínimo entre propuestas | 1 hora |
| Tamaño máximo de mensaje | 500 caracteres |
| Tamaño máximo de diff | 4 KB |

Estos límites los aplica el emisor antes de enviar. El receptor puede ignorar propuestas que superen estos límites si detecta abuso.

### Capa 3 — Control absoluto del receptor

La bandeja de propuestas no es un buzón de mensajes privados. El receptor puede:

- **Rechazar con un clic**: la propuesta desaparece.
- **Bloquear al emisor**: todas las propuestas futuras de ese `user_id` se descartan automáticamente.
- **Marcar como spam**: el emisor entra en una lista negra local (solo para este nodo).
- **Silenciar la colección**: rechazar automáticamente todas las propuestas a una colección concreta.

Los bloqueos son locales al nodo. No se sincronizan en la red. Esto evita la censura colectiva y los ataques coordinados.

### Capa 4 — Límite de exposición de contenido

- La propuesta se muestra como diff de bookmarks (lista de añadidos, modificados, eliminados).
- No hay renderizado de Markdown.
- No hay enlaces clicables.
- El receptor debe hacer clic en "aceptar" para que los cambios se escriban realmente en su colección.
- Los cambios aceptados se convierten en eventos normales (`add_bookmark`, `edit_bookmark`), firmados por el receptor.

## Lo que NO hace este sistema

- No escribe en el log del receptor. El receptor escribe.
- No usa Autobase. Cada log es single-writer.
- No tiene notificaciones push. Las propuestas se descubren al unirse al topic correspondiente.
- No tiene mensajería libre. Solo propuestas estructuradas con diff.
- No tiene reputación global. Los bloqueos son locales.

## Evolución futura

Si en el futuro se quiere contribución directa multi-writer, será con Autobase. Pero eso es un cambio de modelo, no una extensión del sistema de propuestas. El sistema de propuestas funciona sin Autobase y es suficiente para MVP3+.
