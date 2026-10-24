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
| **Seguir** | Replicar una colección ajena para recibir las actualizaciones de su dueño. La colección sigue siendo del autor y el seguidor no puede editarla. Es independiente de duplicar y puede coexistir con ello |
| **Duplicar** | Crear una copia propia de una colección ajena en el estado actual. Tiene su propio `collection_core` y `collection_id`, y `forked_from` apunta al original. El duplicado se puede editar y publicar; los cambios posteriores del original no se propagan y deben incorporarse manualmente si se desean. `forked_from` es el campo técnico asociado; en la UI la acción se llama "Duplicar". Es independiente de seguir: se pueden hacer ambas operaciones sobre la misma colección |
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
| **Bare** | Runtime de JavaScript de Holepunch, zero-core, diseñado para embeber y compilar a binario standalone. Entorno nativo del stack Hyper* |
| **Pear-end** | Core P2P de BookmarkNet que corre en un worker Bare. Contiene toda la lógica peer-to-peer y es portable entre desktop y móvil |
| **Worklet** | Hilo aislado de Bare que corre dentro de una app nativa (móvil o desktop) y se comunica con el shell vía IPC |
| **bare-build** | Herramienta de empaquetado de Bare que genera ejecutables standalone o instaladores nativos por plataforma |
| **bare-build --standalone** | Modo de empaquetado de Bare que genera un ejecutable único por plataforma con el core y los assets web embebidos |
| **bare-build --package** | Modo de empaquetado de Bare que genera instaladores nativos (.pkg, .AppImage, .msix) |
| **GitHub Releases** | Canal de publicación de binarios, hashes y notas de versión |
| **ALLOWED_HOSTS** | Lista de hosts permitidos para la API local. Por defecto solo loopback. Configurable para acceso desde la LAN (caso NAS) |
| **config.json** | Archivo de configuración del nodo, en el directorio de datos. Contiene puerto, data dir, bootstrap nodes, log level, allowed hosts |
| **BOOKMARKNET_\*** | Variables de entorno que sobreescriben config.json. Útiles para Docker y overrides puntuales |
| Migración al vuelo | Migración aplicada por el fold al leer un bloque antiguo para construir la vista materializada |
| Migración eager | Migración de colecciones no publicadas: duplicar a la versión actual, verificar y borrar el log viejo local |
| Migración explícita | Migración de colecciones publicadas: el autor decide cuándo, con aviso único y `migrated_to` |
| migrated_to | Campo opcional de `collection_unpublished` con el `collection_id` de la nueva versión |
| Vista materializada | Estado actual construido por el fold. Se persiste en disco y se migra al vuelo |
| **collection_genesis** | Bloque 0 de un collection_core. Vincula la identidad del usuario con la colección. Firmado por el usuario (signature_by_owner) |
| **signature_by_owner** | Firma del usuario sobre los campos del collection_genesis. Se verifica con author_public_key |
| **author_public_key** | Clave pública del autor de la colección, incluida en el génesis. Permite verificar signature_by_owner |
| **canonical_url** | URL normalizada según las reglas de docs/04-canonicalizacion-url.md. Se usa para calcular resource_id |
| **schema_version** | Versión del schema de eventos de un bloque. Obligatorio en cada bloque |
| **fold** | Proceso de aplicar los eventos del log en orden para construir el estado actual (vista materializada) |
| **proposal_core** | Hypercore single-writer por propuesta. Contiene el evento proposal con el diff de cambios |
| **forked_from** | Campo del collection_genesis que indica que la colección es una copia congelada de otra. Se usa al duplicar |
| **migrated_from** | Campo del collection_genesis que indica que la colección es una migración de schema de otra. Mutuamente excluyente con forked_from |
| **identity_blob_cifrado** | Bloque de identidad cifrado con contraseña efímera, transferido en el QR de añadir dispositivo |
| **user_keypair** | Par de claves del usuario (Ed25519). Firma el collection_genesis |
| **collection_keypair** | Par de claves de una colección. Firma todos los bloques del collection_core. Derivado de user_master_key + collection_uuid |
| **collection_uuid** | ULID generado al crear una colección. Se usa para derivar collection_keypair. No es el nombre visible |
| **Hypercore single-writer** | Propiedad de Hypercore: cada core tiene un único escritor. Se resuelve con claves por colección |
| **DHT** | Distributed Hash Table. Hyperswarm la usa para descubrir peers por topic |
| **NAT traversal** | Técnica para establecer conexiones directas entre peers detrás de NAT. Hyperswarm lo hace automáticamente |
| **CGNAT** | Carrier-Grade NAT. NAT de los ISP. Hyperswarm lo atraviesa sin abrir puertos |
| **Origin** | Header HTTP que indica el origen de una petición. Se valida en mutaciones para evitar CSRF |
| **CSRF** | Cross-Site Request Forgery. Ataque que fuerza al navegador a enviar peticiones no deseadas. Se mitiga validando Origin y Content-Type |
| **DNS rebinding** | Ataque que hace que el navegador resuelva un dominio malicioso a 127.0.0.1. Se mitiga validando Host |
| **ULID** | Universally Unique Lexicographically Sortable Identifier. Ordenable por tiempo, usado en bookmark_id y event_id |
| **Ed25519** | Algoritmo de firma de clave pública. Usado para todas las firmas del sistema |
| **AES-GCM** | Algoritmo de cifrado simétrico autenticado. Usado para cifrar identity_blob_cifrado |
| **ChaCha20-Poly1305** | Alternativa a AES-GCM. Puede usarse para cifrar identity_blob_cifrado |
