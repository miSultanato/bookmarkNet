# Búsqueda multilingüe (i18n)

> **Estado de implementación (MVP0):** la búsqueda local actual es literal (substring, case-insensitive). No realiza expansión multilingüe ni usa el diccionario de equivalencias. El campo `language` identifica el idioma de la colección, pero no modifica el comportamiento de la búsqueda. La búsqueda multilingüe es una funcionalidad de MVP3+.

## Objetivo

Búsqueda multilingüe sin traducir el contenido guardado en las colecciones.

## Principios

- **La colección como unidad:** la búsqueda y sus resultados se organizan en torno a colecciones.
- **El contenido no se traduce:** títulos, descripciones, notas y bookmarks conservan el idioma original.
- **La búsqueda sí es multilingüe:** una consulta puede encontrar contenido relacionado expresado en español, inglés o euskera.

## Modelo

El campo `language` pertenece a la colección y está implementado en MVP0: se gestiona en `device_create_collection`, se incluye en `collection_genesis` y se expone mediante la API. La UI lo utiliza en badges y en el `<select>` de idioma. Los valores admitidos son:

- `es`: español.
- `en`: inglés.
- `eu`: euskera.

El idioma identifica la lengua principal de la colección; no implica traducir ni reescribir su contenido.

## Diccionario multilingüe

El diccionario agrupa términos equivalentes en los tres idiomas y se organiza en tres categorías:

- **Técnicos:** vocabulario de disciplinas, herramientas y tecnologías.
- **Generales:** términos comunes para describir temas, tareas e intereses.
- **Topónimos:** nombres de lugares y sus variantes lingüísticas habituales.

El diccionario contempla ES (español), EN (inglés) y EU (euskera). La selección y mantenimiento de equivalencias concretas se definirá conforme evolucione el vocabulario real del producto.

## Expansión de índice

Al indexar términos de búsqueda, se incorporan sus equivalencias conocidas en el diccionario ES/EN/EU. Así, una consulta en uno de los idiomas puede recuperar colecciones cuyos términos equivalentes aparecen en otro idioma, sin alterar el texto original ni generar traducciones del contenido.

La expansión se limita a equivalencias registradas en el diccionario; no presupone traducción automática ni comprensión semántica.

## Presentación de resultados

- Los resultados se muestran mezclados según su relevancia para la consulta, no separados por idioma.
- Cada resultado muestra un badge con el idioma principal de su colección (`ES`, `EN` o `EU`).
- El contenido original se presenta en el idioma en que fue guardado.

## Fase

**MVP3+.** La búsqueda multilingüe y la expansión del índice se plantean para una fase posterior al MVP0.

## Notas técnicas

- El runtime es **Bare**, no Node.js.
- La búsqueda semántica mediante embeddings es una extensión futura opcional y no forma parte del núcleo.
