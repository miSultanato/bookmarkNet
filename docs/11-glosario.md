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
