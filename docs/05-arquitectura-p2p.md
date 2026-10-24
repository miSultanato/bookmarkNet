# Arquitectura P2P

## Stack

- **Hypercore:** log append-only firmado por una clave. Una colección = un Hypercore.
- **Hyperbee:** índice key-value sobre Hypercore. Metadatos locales y consultas.
- **Hyperswarm:** DHT para discovery y NAT traversal.

## Por qué Hypercore

- El log append-only encaja con el modelo de eventos.
- Hyperswarm resuelve NAT traversal sin infraestructura propia.
- Hyperbee aporta índices locales sin construir una capa de consultas.
- Ecosistema activo.

## Limitaciones conocidas

**Un solo escritor por core.** Hypercore nativo es single-writer. Si en el futuro se quiere que otras personas contribuyan al core del autor original, será necesario **Autobase** (multi-writer sobre Hypercore) o un modelo de fork + merge. No bloquea el MVP, pero condiciona la arquitectura futura; ver [10-riesgos.md](10-riesgos.md).

## Modelo de replicación

- Replicamos eventos, no estados.
- Cada colección = un Hypercore.
- Cada bloque = un evento.
- Verificación criptográfica bloque a bloque.

Los 9 tipos de evento están definidos en `docs/15-schema-eventos.md`:
`collection_genesis`, `add_bookmark`, `edit_bookmark`, `remove_bookmark`, `move_bookmark`, `reorder_bookmark`, `update_metadata`, `create_group`, `delete_group`.

La lista anterior es exhaustiva, no ilustrativa.

Jerarquía de claves:
- El usuario (`user_keypair`) firma los campos del bloque 0 (`collection_genesis`) mediante una firma llamada `signature_by_owner`. Esta firma se incluye en el payload del evento y se verifica con `author_public_key`.
- La colección (`collection_keypair`) firma TODOS los bloques del Hypercore, incluido el bloque 0, como parte del protocolo de Hypercore. Esta firma es automática y garantiza la integridad del log.
- Los bloques 1..N solo llevan la firma de Hypercore (hecha por `collection_keypair`). No llevan `signature_by_owner`.

Es decir, en el bloque 0 conviven DOS firmas distintas: la del usuario sobre los campos del génesis (`signature_by_owner`) y la firma del propio bloque Hypercore (`collection_keypair`).

## Nodos offline

Los nodos offline son normales. Un portátil puede estar apagado el 80 % del tiempo. Requisito mínimo: al menos un nodo con la colección debe seguir online.

Si todos desaparecen, la colección queda temporalmente inaccesible. Cuando uno vuelve y anuncia el topic, reaparece.

## Estado de sincronización (UI)

- ✅ Sincronizada
- ⏳ Sin cambios pendientes
- ⚠ Última réplica hace N días
- 🔴 Ningún peer disponible

La UI debe comunicar: «Tu colección está segura en tu dispositivo. Se replicará cuando haya peers disponibles».

## Futuro (fuera del MVP)

- Relays / TURN para NAT traversal difícil.
- Autobase para multi-writer.
- Set reconciliation (Willow-like) para una sincronización más eficiente.
