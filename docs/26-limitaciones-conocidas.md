# Limitaciones conocidas de MVP0

Este documento recoge limitaciones operativas y decisiones técnicas conocidas de Lotura. BookmarkNet sigue siendo el nombre técnico del repositorio y de los identificadores internos.

## Cold start del binario

El binario standalone pesa aproximadamente 97 MB. En la primera ejecución en frío, el sistema operativo tarda unos segundos en cargarlo en memoria. Las siguientes ejecuciones suelen ser instantáneas porque el binario ya está en la caché del sistema.

## Worker zombie de Hypercore

Al cerrar con `SIGTERM` o `SIGINT`, el worker de Hypercore puede quedar vivo y mantener bloqueado el lock de RocksDB (`device-core/db/LOCK`).

- **Linux:** al arrancar, la limpieza intenta detectar y matar procesos huérfanos leyendo `/proc`.
- **macOS y Windows:** la limpieza basada en `/proc` no está disponible. Como workaround, cierra todas las instancias de Lotura y elimina el archivo de lock `LOCK` dentro de `~/.bookmarknet/device-core/db/` (en Windows, revisa el directorio de datos bajo `%APPDATA%\bookmarknet\device-core\db\`).

No borres el lock mientras haya una instancia activa: primero cierra todos los procesos de Lotura.

## RocksDB y fragmentación

Muchas escrituras pequeñas —por ejemplo, durante la importación de bookmarks evento a evento— pueden generar numerosos archivos SST en RocksDB y ralentizar la apertura de la base de datos.

La mejora prevista es agrupar escrituras en lotes (*batch*) o revisar una migración a Hyperbee en MVP1+.

## Hyperbee

Para MVP1+, se prevé migrar el estado materializado a Hyperbee, un índice B-tree sobre Hypercore. El objetivo es ofrecer consultas O(log n) y un arranque O(1) respecto al número de registros, evitando reconstruir el estado completo mediante un recorrido lineal. Estas complejidades son objetivos de diseño, no garantías medidas del MVP0 actual.

## Limitaciones de `/proc`

La limpieza automática de procesos huérfanos basada en `/proc` solo funciona en Linux. En macOS y Windows el workaround es manual: cerrar todas las instancias y eliminar el archivo `LOCK` indicado arriba.

## Nombre del producto

- **Lotura** es el nombre del producto que ve el usuario.
- **BookmarkNet** es el nombre técnico utilizado en el repositorio, `package.json`, el directorio de datos y los identificadores internos.
