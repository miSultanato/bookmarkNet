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
| **Duplicar** | Crear una copia propia de una colección ajena (fork sin jerga) |
| **Registry de resources** | Estructura física que almacenaría todos los resources conocidos. NO existe en MVP. En el futuro podría implementarse con Autobase |
| **Propuesta** | Mensaje unidireccional mediante el cual un usuario sugiere cambios a una colección ajena que ha duplicado previamente. El receptor decide si los acepta. No es una escritura compartida |
| **Cuota de propuestas** | Límites locales de envío de propuestas (por día, por colección, por intervalo) que el emisor aplica para evitar abusos |
| **Bandeja de propuestas** | Lista local de propuestas recibidas que el receptor puede revisar, aceptar, rechazar, bloquear o marcar como spam |
| **device_core** | Hypercore single-writer por dispositivo del mismo usuario. Contiene borradores locales de colecciones propias y metadatos |
| **user_index** | Vista local agregada de los device_core de todos los dispositivos del mismo usuario |
| **collection_core** | Hypercore single-writer de una colección publicada. Replicable por seguidores |
| **Escritura dual** | Tras publicar una colección, cada cambio se escribe en el device_core y en el collection_core |
| **Despublicar** | Escribir `collection_unpublished` y dejar de anunciar el topic del collection_core. No hay republicación |
