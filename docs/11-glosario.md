# Glosario

| Término | Definición |
|---|---|
| **Resource** | URL canónica. Identidad lógica global (mismo `resource_id` en todos los nodos). NO es un registro físico global: cada nodo materializa su propia vista de los resources que conoce |
| **Bookmark** | Referencia contextual a un resource dentro de una colección |
| **Collection** | Agrupación de bookmarks, unidad principal de compartición |
| **Group** | Contenedor ligero de bookmarks sin jerarquías complejas |
| **Inbox** | Bandeja de entrada donde caen los bookmarks nuevos antes de organizar |
| **User** | Persona. Identidad criptográfica determinada por public key |
| **Node** | Instalación concreta de BookmarkNet. Un usuario puede tener N |
| **Bootstrap peer** | Nodo que ayuda a encontrar la red al arrancar; no es servidor |
| **Seed peer** | Nodo que mantiene copias de colecciones públicas populares |
| **Topic** | `HASH(collection_public_key)`, identificador de descubrimiento en Hyperswarm |
| **Seeder** | Nodo que posee una copia de una colección y la sirve |
| **Hypercore** | Log append-only firmado por una clave |
| **Hyperbee** | Índice key-value sobre Hypercore |
| **Hyperswarm** | DHT para discovery y NAT traversal |
| **Autobase** | Multi-writer sobre Hypercore. Permite que varios escritores publiquen en una vista compartida y determinista. Futuro, fuera de MVP |
| **Canonicalización** | Proceso de normalizar una URL para calcular `resource_id` |
| **Momento mágico** | Encontrar una colección hecha por otra persona y añadirla a la biblioteca |
| **Seguir** | Replicar una colección ajena para recibir las actualizaciones de su dueño. La colección sigue siendo del autor y el seguidor no puede editarla. Es independiente de duplicar y puede coexistir con ello |\n| **Duplicar** | Crear una copia propia de una colección ajena en el estado actual. Tiene su propio `collection_core` y `collection_id`, y `forked_from` apunta al original. El duplicado se puede editar, publicar y volver a forkear; los cambios posteriores del original no se propagan y deben incorporarse manualmente si se desean. Es independiente de seguir: se pueden hacer ambas operaciones sobre la misma colección |
| **Registry de resources** | Estructura física que almacenaría todos los resources conocidos. NO existe en MVP. En el futuro podría implementarse con Autobase |
| **Propuesta** | Mensaje unidireccional mediante el cual un usuario sugiere cambios a una colección ajena que ha duplicado previamente. El receptor decide si los acepta. No es una escritura compartida |
| **Cuota de propuestas** | Límites locales de envío de propuestas (por día, por colección, por intervalo) que el emisor aplica para evitar abusos |
| **Bandeja de propuestas** | Lista local de propuestas recibidas que el receptor puede revisar, aceptar, rechazar, bloquear o marcar como spam |
| **device_core** | Hypercore single-writer por dispositivo del mismo usuario. Contiene borradores locales de colecciones propias y metadatos |
| **user_index** | Vista local agregada de los device_core de todos los dispositivos del mismo usuario |
| **collection_core** | Hypercore single-writer de una colección publicada. Replicable por seguidores |
| **Escritura dual** | Tras publicar una colección, cada cambio se escribe en el device_core y en el collection_core |
| **Despublicar** | Escribir `collection_unpublished` y dejar de anunciar el topic del collection_core. No hay republicación |
| **Seed pack** | Conjunto de colecciones completas incluidas en el binario de BookmarkNet para resolver el arranque en frío. Ver docs/18-seed-pack.md |
| **Awesome collection** | Colección generada a partir de una awesome-list de GitHub mediante un script de transformación. Incluye la fuente original en su descripción |
| **Creator peer** | `node_id` del nodo que tiene la copia autorizada de una colección del seed pack. Permite replicarla sin depender del seed pack completo |
| **Búsqueda literal** | Búsqueda por substring case-insensitive sobre título, descripción, tags y URL. Sin IA, sin NLP, sin búsqueda semántica |
| **collection_count** | Número de colecciones locales que contienen un resource. Métrica local al nodo hasta MVP5 |
| **co_occurrence** | Frecuencia con la que dos resources aparecen juntos en las mismas colecciones locales. Métrica local al nodo hasta MVP5 |
