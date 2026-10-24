# Seed pack

El seed pack es un conjunto de colecciones completas, creadas y mantenidas por el equipo de BookmarkNet, que se incluyen en el binario de la aplicación para resolver el arranque en frío.

## Objetivo

Evitar que un usuario nuevo abra la app y vea una pantalla vacía. Desde el primer arranque, incluso sin conexión, el usuario tiene acceso a colecciones útiles que puede explorar, seguir o duplicar.

## Composición

- **Colecciones completas**, no punteros. Cada colección es un `collection_core` real, replicable y verificable.
- **Creadas y mantenidas por el equipo** del proyecto.

  **Identidad del proyecto:** el equipo del proyecto tiene un `user_keypair` (la "identidad del proyecto"). Cada colección del seed pack tiene su propio `collection_keypair`. El `collection_genesis` de cada colección lo firma el `user_keypair` del proyecto. El `creator_peer_id` es el `node_id` del NAS o VPS del equipo que tiene la copia autorizada.
- **Funcionan como cualquier otra colección:** se publican, se replican, se siguen y se duplican.

## Origen de las colecciones

Muchas de las colecciones del seed pack se generan a partir de awesome-lists públicas de GitHub mediante un script de transformación. Cada colección generada incluye en su descripción la fuente original ("Basado en awesome-selfhosted de GitHub").

También puede haber colecciones creadas manualmente por el equipo.

## Empaquetado

- El binario de BookmarkNet incluye un snapshot de los `collection_core` del seed pack en el momento del build.
- Al arrancar, el nodo replica esos cores desde el snapshot local.
- El usuario puede abrirlos, leerlas, duplicarlas y seguirlas sin conexión.

## Actualización

- **Offline:** el usuario tiene la versión incluida en el binario.
- **Online:** el nodo se une a los topics de los `collection_core` del seed pack y, si hay una versión más reciente en los seed peers, se actualiza.

No hay servidores web ni HTTP central. La actualización es P2P como cualquier otra colección.

## Peers del creador

Cada colección del seed pack incluye en su metadata el `creator_peer_id` (el `node_id` del NAS o VPS del equipo que tiene la copia autorizada). Si el usuario no puede conectar con el creador, puede intentar con otros peers que tengan la colección. Si no hay ninguno, la colección queda inaccesible hasta que alguien la replique.

## Onboarding

En la primera ejecución, la app ofrece tres opciones independientes:

1. **Importar bookmarks de mi navegador** (HTML). Los bookmarks van al Inbox.
2. **Añadir colecciones iniciales** (el seed pack).
3. **Continuar** (sin ninguna de las dos anteriores).

Las tres son opcionales. El usuario puede marcar una, ambas o ninguna.

## Importación de bookmarks

En MVP solo se soporta importación de HTML de navegador. La importación desde Pocket y otros servicios se añadirá en fases posteriores.

## Futuro

- **Curación distribuida:** si en el futuro se quiere que otros propongan colecciones al seed pack, se hará con el sistema de propuestas (docs/17-propuestas.md) o con Autobase. Fuera del MVP.
- **Más fuentes de importación:** Pocket, Raindrop, Pinboard, etc. Se añadirán en fases posteriores.
