# Diseño: restauración de backups automáticos

**Estado:** propuesta técnica pendiente de implementación y auditoría independiente  
**Fecha:** 2026-11-24  
**Alcance:** MVP1 / recuperación local. No activa MVP2 ni introduce replicación.

## 1. Hallazgos verificados en `main`

La revisión estática de `src/backup/backup.ts`, `src/node/start.ts`, `src/api/server.ts`, `test/backup.test.ts`, `test/backup-api.test.ts` y ADR-019 confirma:

1. Los backups manuales usan Argon2id sobre una contraseña y XChaCha20-Poly1305.
2. Los backups automáticos usan una clave de 32 bytes derivada de `user_master_key` mediante HKDF-SHA256, con el dominio `bookmarknet:backup:`.
3. Ambos caminos escriben actualmente `LOTURABK` + versión `2` + salt + nonce. El header autenticado no identifica el método de derivación.
4. `decryptArchive()` deriva siempre la clave mediante Argon2id. Por ello no puede abrir los backups automáticos.
5. `restoreBackup()` acepta únicamente contraseña; el API escribe esa contraseña en claro en `restore-pending.json` para consumirla al reiniciar.
6. La restauración crea una copia de seguridad previa, pero la sustitución de directorios no es transaccional y no hace rollback automático ante un fallo de I/O posterior al comienzo de la sustitución.
7. En modo `all`, la identidad del archivo se usa para derivar claves de colección. En modo automático, sin embargo, la clave de cifrado depende de la identidad y debe recuperarse antes de descifrar el archivo.

Estos son hallazgos de lectura estática; esta tarea no ha ejecutado tests ni restauraciones.

## 2. Objetivo funcional

Permitir recuperar un backup automático en una instalación nueva, usando la frase BIP39 de 24 palabras para recuperar primero la identidad portable. El backup debe descifrarse y validarse antes de modificar datos locales.

Flujo esperado:

1. En el dispositivo nuevo, importar la identidad mediante BIP39.
2. Seleccionar un backup automático.
3. Lotura deriva localmente la clave de backup desde el `user_master_key` recuperado.
4. Descifra y valida completamente cabecera, autenticación AEAD, TAR, manifiesto, eventos, identidad y claves de colección.
5. Comprueba que la identidad embebida en el backup corresponde a la identidad recuperada localmente.
6. Prepara la restauración y sustituye los datos de forma recuperable.
7. Genera un `node_id` nuevo en modo `all`; nunca copia el del dispositivo anterior.

La frase BIP39 recupera identidad, no datos. El backup automático sigue siendo necesario para recuperar bookmarks, colecciones y eventos locales.

## 3. Formato de backup v3

No cambiar el significado de la versión 2. Crear un formato v3 con identificación explícita del método de clave en la cabecera autenticada.

Cabecera propuesta:

- magic: `LOTURABK`
- format version: `3`
- key derivation id: byte enumerado y validado:
  - `0x01`: Argon2id con contraseña (backup manual).
  - `0x02`: HKDF-SHA256 con identidad (backup automático).
- salt: longitud determinada por el KDF autenticado: 16 bytes para Argon2id (tamaño de libsodium) y 32 bytes para HKDF-SHA256.
- nonce: 24 bytes (XChaCha20-Poly1305).

La cabecera completa debe ser AAD de XChaCha20-Poly1305. No aceptar IDs desconocidos, campos truncados ni combinaciones incoherentes.

### Derivación automática v3

Definir una función compartida y testeada, con dominio separado de cualquier otro uso criptográfico, por ejemplo `bookmarknet:backup:v3`. La derivación automática debe usar HKDF-SHA256 estándar (Extract + Expand), una sal aleatoria de 32 bytes por backup (almacenada en la cabecera v3) y 32 bytes de salida. Para Argon2id, conservar el salt de 16 bytes que requiere libsodium. El nonce XChaCha20-Poly1305 es de 24 bytes. No copiar ni mantener una segunda implementación ad hoc en `src/node/start.ts`.

La clave maestra de identidad nunca se escribe en el backup ni en logs. Limpiar buffers temporales cuando la API de Bare/sodium lo permita y evitar copias innecesarias.

### Compatibilidad v2

- Seguir leyendo backups manuales v2 mediante Argon2id, con la sal de 16 bytes de la cabecera y la contraseña.
- Los backups automáticos v2 también usan magic/version 2 y una cabecera con sal aleatoria de 16 bytes, pero **esa sal no participa en la derivación legacy**. El código actual deriva exactamente con HKDF-SHA256: Extract con sal de 32 bytes cero (`00` × 32) y `user_master_key` como IKM; Expand con info UTF-8 `bookmarknet:backup:` y longitud 32 bytes. El salt aleatorio de cabecera v2 se conserva por formato compartido, pero se ignora para este KDF.
- Como v2 no identifica el KDF, el lector debe seleccionar la ruta a partir de la credencial discriminada suministrada (contraseña o identidad) y probar solo ese KDF. No probar una lista de derivaciones heurísticas ni inferir el modo por nombre de archivo o contenido no autenticado.
- Mantener cada ruta legacy aislada y cubierta con fixtures reales v2 de ambas modalidades. Para el backup automático, exigir importar primero la frase BIP39 en un dispositivo nuevo.
- Nunca reinterpretar un fallo AEAD como archivo vacío ni modificar datos ante fallo.

## 4. Identidad y validación previa

Para backups automáticos, exigir identidad local antes del descifrado. Después de descifrar:

- Validar estructura de `identity.bmn` y formato de claves.
- Comprobar que la identidad local y la identidad del backup son la misma identidad (comparación de clave maestra y clave pública; validar también su correspondencia criptográfica si existe una función canónica).
- Rechazar el backup antes de cualquier mutación si la identidad no coincide.
- Validar manifiesto, lista de dispositivos frente al fold de `device-events.json`, eventos, génesis y derivación de cada `collection_core`.
- En modo `all`, preservar la semántica actual de regenerar `node_id`.
- En modo `collections-only`, preservar identidad y `node_id`, pero dejar claro que el log completo de `device_core` también se reemplaza; no es una fusión selectiva.

No confiar en datos del manifiesto hasta que el AEAD haya autenticado el archivo.

## 5. Restauración pendiente y protección de secretos

El diseño actual persiste la contraseña en claro en `restore-pending.json`. No extender ese patrón a la clave HKDF ni a la frase BIP39.

Antes de implementar la restauración automática, definir un mecanismo de dos fases que no persista contraseñas, frases ni claves en claro. Debe cubrir el hecho de que el proceso se reinicia y que el nodo mantiene abiertos Hypercores:

- Fase prepare: descifrar, autenticar, validar y preparar un conjunto de datos recuperable sin tocar el estado activo.
- Fase commit: cerrar recursos de forma ordenada, sustituir datos y reconstruir cores/vista.
- Recuperación ante crash: marcador de transacción y estados explícitos para completar o revertir en el siguiente arranque.
- La copia de seguridad previa debe conservarse hasta confirmar que el nuevo nodo arranca y reconstruye la vista correctamente.

La estrategia de staging debe evitar dejar una copia plaintext persistente de todo el backup sin una decisión explícita de seguridad. Si la arquitectura actual no permite completar la operación en proceso sin guardar un secreto, separar esa refactorización como requisito previo; no volver a guardar la contraseña en claro como solución provisional.

## 6. API y UI

Separar credenciales por modalidad en el contrato interno, por ejemplo una unión discriminada `password` / `identity`, sin aceptar campos ambiguos. La API pública debe validar estrictamente el modo de backup y el modo de restauración.

La UI debe explicar:
- backup manual: requiere contraseña;
- backup automático: requiere identidad recuperada (frase BIP39);
- importar primero identidad para recuperar un backup automático en dispositivo nuevo;
- `collections-only` reemplaza también el log de dispositivo y no fusiona;
- la copia de seguridad previa queda disponible para recuperación si la transacción falla.

No exponer claves, frases ni contraseñas en logs, errores, URLs o nombres de archivo.

## 7. Plan de implementación

1. Extraer HKDF-SHA256 a un módulo compartido y añadir vectores de prueba deterministas.
2. Introducir cabecera v3 con KDF id; mantener lector manual v2.
3. Añadir lector legacy para backup automático v2 condicionado a identidad local y autenticación AEAD.
4. Refactorizar `restoreBackup` para recibir credenciales discriminadas y validar identidad antes de tocar datos.
5. Resolver la transacción de restauración/staging y el ciclo de vida del nodo antes de eliminar `restore-pending.json`.
6. Añadir tests unitarios y de integración para backup manual v3, automático v3, automático v2, manual v2, contraseña incorrecta, identidad incorrecta, backup corrupto, crash en cada fase, rollback y regeneración de `node_id`.
7. Actualizar UI, ADR-019, README y trazabilidad con el comportamiento efectivamente probado.
8. Ejecutar `npm test`, `git diff --check` y build standalone en un entorno Bare; no usar el recuento histórico 278 como resultado actual.
9. Auditoría independiente en NEO/Pi antes de merge.

## 8. Criterios de aceptación

- Un backup automático v3 se restaura en un dispositivo limpio tras importar BIP39.
- Un backup automático v2 se restaura con la ruta legacy y la identidad correcta, si el fixture confirma compatibilidad.
- Una identidad incorrecta o una autenticación AEAD fallida no modifica ningún dato.
- Los backups manuales v2 siguen restaurándose.
- El modo `all` genera un `node_id` nuevo; `collections-only` conserva el actual.
- No se persisten contraseñas, frases ni claves en claro en archivos pendientes.
- Una interrupción en cualquier fase deja el estado recuperable y documentado.
- Tests unitarios e integración y build pasan realmente en CI/NEO.

## 9. Fuera de alcance

- MVP2, replicación, escritura dual, publicación y sincronización.
- Cambios en el modelo de identidad BIP39.
- Restaurar el `node_id` del dispositivo anterior.
- Migrar backups v1: ADR-019 ya declara que requieren una versión anterior de Lotura.


## 10. Revisión adicional de seguridad y recursos — 2026-11-26

La inspección estática de la implementación actual en `main` añade dos requisitos que deben resolverse antes de implementar el flujo nuevo.

### BR-RESTORE-10 — la copia de seguridad previa sigue symlinks

La función `copyTree()` usa `fs.stat(source)`, que sigue symlinks, y si el destino observado es un directorio enumera su contenido recursivamente. Por tanto, si el `dataDir` actual contiene un symlink a un archivo/directorio externo, la copia de seguridad previa puede leer y copiar ese contenido fuera del árbol de datos esperado. Un ciclo de symlinks también puede provocar recursión y consumo de recursos hasta que falle.

Requisito:
- No seguir symlinks durante la copia de seguridad previa.
- Usar `lstat` y rechazar symlinks y archivos especiales por defecto, o definir una política explícita que nunca resuelva destinos fuera del árbol.
- Verificar contención de cada ruta y de sus ancestros; no confiar solo en concatenar rutas.
- Si se detecta un symlink, abortar antes de mutar el estado activo y dejar un error explícito; no continuar con una copia parcial como si fuera íntegra.

Tests:
1. Symlink a archivo externo: no copiar contenido externo.
2. Symlink a directorio externo: no recorrerlo.
3. Symlink roto: rechazo controlado.
4. Symlink circular: no recursión ni consumo indefinido.
5. Archivo especial: rechazo y preservación del estado original.

Este hallazgo es sobre la copia previa local, no sobre la extracción del TAR importado. El parser TAR ya rechaza rutas absolutas y segmentos `.`/`..`, limita tipos de entrada y `validateEntries()` aplica una allowlist de nombres; no confundir ambas fronteras.

### BR-RESTORE-11 — el límite global de 1 GiB no controla la amplificación de memoria

La implementación actual define `MAX_ARCHIVE_BYTES = 1 GiB`, pero `restoreBackup()` lee el archivo completo con `fs.readFile()`; `decryptArchive()` crea un buffer plaintext del tamaño del ciphertext; `parseTar()` copia cada entrada; y después se crean buffers/string/objetos JSON para manifiesto y logs de eventos. El pico de memoria puede ser varias veces el tamaño del archivo, aun respetando el límite global.

Requisito:
- Definir límites explícitos para tamaño total cifrado/descifrado, número de entradas, bytes por entrada, bytes de JSON por tipo y cantidades de eventos/dispositivos/colecciones.
- Comprobar tamaños antes de crear copias o parsear JSON, y fallar antes de cualquier mutación.
- Evaluar descifrado/parseo por streaming o reducir copias temporales; si no es viable en Bare, elegir un límite total compatible con la memoria del dispositivo y documentar el pico estimado.
- Rechazar manifiestos/eventos que superen límites, incluso si el TAR completo cabe dentro del máximo global.
- Mantener la validación completa antes de la fase commit.

No se fija aquí un nuevo número: el límite funcional requiere dimensionamiento en el dispositivo objetivo y una decisión consciente; 1 GiB no debe tratarse como prueba de seguridad frente a agotamiento de memoria.

### Estado
BR-RESTORE-10 y BR-RESTORE-11 son requisitos adicionales derivados de lectura estática; no se ejecutó ningún exploit, restore ni test. No se modificó código de producto.


### BR-RESTORE-12 — la copia previa duplica el almacén de backups

`createBackup()` y `createBackupWithKey()` escriben los archivos bajo `dataDir/backups/`. Antes de restaurar, `restoreBackup()` llama a `copyTree(dataDir, safetyCopy)` y `copyTree()` recorre recursivamente todos los directorios salvo `restore-pending.json`. Por tanto, cada restauración copia también el directorio `backups/` completo, incluidos todos los backups históricos y potencialmente el archivo que se está restaurando.

Impacto: duplicación innecesaria de almacenamiento y tiempo de I/O en cada restauración; con un historial grande puede impedir completar la copia previa por falta de espacio. Las restauraciones repetidas generan además snapshots que contienen snapshots anteriores y sus backups duplicados.

Requisito:
- Definir el alcance de la safety copy: estado activo necesario para rollback, no duplicación indiscriminada del almacén de backups.
- Preservar el backup de origen y los backups existentes sin copiarlos dentro de cada safety copy, o justificar explícitamente una política de retención/copia distinta.
- Comprobar espacio disponible y tratar falta de espacio como fallo previo a cualquier mutación.
- Mantener la copia previa verificable y recuperable, coordinada con el diseño transaccional de BR-RESTORE-10/11.

Tests/validación: fixture con varios backups grandes y verificación de que la safety copy no los duplica ni modifica; prueba de espacio insuficiente que confirme que los datos activos permanecen intactos. Hallazgo estático; no se ejecutó restore ni se midió consumo real.
