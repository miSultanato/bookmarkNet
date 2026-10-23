# Principios de diseño

Estos principios son no negociables. Cualquier decisión que los viole debe rechazarse, aunque sea técnicamente atractiva.

## 1. Disciplina extrema del nodo

El nodo debe hacer sólo lo imprescindible para que exista la red. Debe ser pequeño, autónomo, autocontenido y capaz de existir completamente sin servidores centrales. Todo lo demás puede venir después.

## 2. El bookmark es la unidad

Todo parte del bookmark. Las personas existen, pero no son el foco. El foco está en el bookmark y en cómo miles de usuarios lo contextualizan y conectan con otros bookmarks.

## 3. Separación Usuario / Nodo

- La identidad pertenece al usuario, no al dispositivo.
- Un usuario puede tener múltiples dispositivos.
- La propiedad de una colección pertenece al usuario.
- El nodo almacena una copia.

## 4. Separación Resource / Bookmark

- Resource = URL canónica, global, compartida por toda la red.
- Bookmark = referencia contextual a un resource dentro de una colección.

Permite calcular popularidad real y construir conocimiento emergente sin contaminar el modelo base.

## 5. Replicamos eventos, no estados

Append-only. Tolerante a nodos offline. Los nodos offline son normales, nunca excepciones.

## 6. Sin IA

Ni resúmenes, clasificación automática, recomendaciones IA, ni NLP. Búsqueda local sobre bookmarks, colecciones y tags.

## 7. Sin red social compleja

Sin chat, comentarios, likes, karma, puntos ni rankings. Seguir usuarios existe, pero es secundario al seguimiento de colecciones.

## 8. Bootstrap ≠ centralización

Los bootstrap peers ayudan a encontrar la red. No son servidores de bookmarks ni de búsqueda. Ninguna colección puede depender exclusivamente de un nodo oficial.

## 9. El primer momento mágico

El hito de validación no es sincronizar tu propio portátil con tu NAS, sino encontrar una colección hecha por otra persona y añadirla a tu biblioteca.
