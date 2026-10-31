# Diagnóstico AUD-07 — Clave de device_core

## 1. Resumen ejecutivo

La documentación afirma que `device_core` debe abrirse con una clave derivada de `user_master_key`; `docs/03-identidad.md` añade `node_id`, mientras `docs/05-arquitectura-p2p.md` contiene una formulación que no lo incluye.
El código actual llama a `new Hypercore(storagePath, { valueEncoding: 'json' })`: no proporciona `key` ni `keyPair`, y abre el core antes de cargar la identidad.
Sí existe HKDF-SHA256 para `collection_core`, pero no existe una función de derivación de clave para `device_core`.
`newNodeId()` existe, pero no se invoca en el arranque inspeccionado ni se persiste un identificador de dispositivo en ese flujo.
Es un desajuste código/documentación y, respecto al diseño documentado, una funcionalidad pendiente; no hay evidencia suficiente para calificarlo como una vulnerabilidad explotable en el MVP0 local.
La recomendación es la **opción C**, formalizar una derivación separada por dispositivo basada en `user_master_key` + un `node_id` estable y persistido, antes de depender de ella para replicación.
No se recomienda derivar solo de `user_master_key`: dos dispositivos de la misma identidad obtendrían la misma clave y perderían la separación single-writer.
La migración de los `device_core` existentes y la frontera exacta con MVP1 requieren decisión humana.

## 2. Lo que dice la documentación

### 2.1 `docs/03-identidad.md`

**Sección «Sincronización multidispositivo»:**

> Cada dispositivo del mismo usuario tiene su propio
> `device_core`: un Hypercore single-writer firmado con una
> clave derivada de la clave maestra del usuario y el
> `node_id` del dispositivo.

Es la afirmación documental más explícita: identifica dos entradas de derivación, `user_master_key` y `node_id`, y vincula el resultado con el carácter single-writer del core.

En la sección «Añadir dispositivo» también dice:

> Genera su propio `node_id` y se registra en la lista de dispositivos del usuario.

La frase sitúa la generación del identificador en el flujo de añadir dispositivo. No especifica en esa sección cómo se persiste el identificador para reutilizarlo después de reiniciar.

En la misma sección «Sincronización multidispositivo»:

> Todos los dispositivos del mismo usuario se unen a un topic
> derivado del `user_id` y replican los `device_core` de los
> demás (solo lectura para los ajenos).

Este fragmento describe el uso futuro de los cores en la sincronización; no demuestra que el código actual lo implemente.

### 2.2 `docs/05-arquitectura-p2p.md`

En el apartado «Derivación de claves por colección», el documento describe la clave maestra y la derivación HKDF de las colecciones. Dentro de «Algoritmo de derivación» afirma:

> El `device_core` se abre con una clave derivada de la
> `user_master_key` (que está en `identity.bmn`), no con una
> clave que esté dentro del `device_core`; así se evita la
> dependencia circular.

Esta formulación no menciona `node_id`, a diferencia de `docs/03-identidad.md`. Por tanto, hay una discrepancia interna: no queda fijado si la clave de `device_core` deriva solo de la clave maestra o de la combinación de clave maestra e identificador de dispositivo.

Más adelante, en el apartado «Cores por dispositivo», dice:

> Single-writer, firmado con una clave derivada de la
> clave maestra del usuario + el `node_id`.

Este segundo fragmento sí coincide con `docs/03-identidad.md`.

El documento añade:

> **Estado de implementación (MVP0):** solo existe el `device_core`. El `collection_core` y la replicación entre dispositivos son MVP1+.

Esto califica la infraestructura de replicación como futura, pero no marca explícitamente la derivación de la clave de `device_core` como pendiente: el texto anterior está redactado como diseño definido.

### 2.3 `docs/16-identificadores-y-firmas.md`

La tabla de identificadores define:

> `node_id` | `"n_" + random(8 bytes).hex()` | `n_a1b2c3d4e5f60718`

En «Derivación de claves por colección» indica:

> `collection_keypair = derive(
>   user_master_key,
>   "collection:" + collection_uuid
> )`

Y especifica:

> La derivación usa
> HKDF-SHA256 con separación de dominios
> (`"bookmarknet:collection:" + collection_uuid`).

También afirma:

> **El `user_master_key` es la semilla del `user_keypair`.** La clave privada Ed25519 del usuario y el `user_master_key` son el mismo valor (32 bytes). No hay dos claves.

En el fragmento de `docs/16-identificadores-y-firmas.md` revisado, la derivación documentada es la de `collection_keypair`; no aparece una especificación equivalente para `device_core` (ni función, info string, salida o algoritmo específico).

### 2.4 `docs/14-adrs.md`

**ADR-003: «Un par de claves por colección (no por usuario)»**, estado Aceptado:

> Cada colección tiene su propio collection_keypair. El usuario firma el bloque 0 (collection_genesis) que vincula su identidad a la collection_public_key. Los bloques posteriores los firma collection_keypair (Hypercore).

Y entre las consecuencias:

> Se gestiona con Corestore (derivación determinista a partir de la clave maestra + nombre).

ADR-003 decide expresamente la separación de claves por colección, pero no define la clave de `device_core`.

**ADR-004: «Sin Autobase en MVP»**, estado Aceptado, dice:

> La sincronización multidispositivo se resuelve con `device_core` + `user_index` (cores single-writer agregados localmente).

Tampoco especifica cómo se deriva o genera la clave de esos cores. En los ADRs revisados no se encontró una decisión aceptada que cierre el algoritmo de clave de `device_core`.

### 2.5 `docs/20-stack-tecnico.md` y otros documentos

En `docs/20-stack-tecnico.md` no aparece una especificación de derivación para `device_core`, `user_master_key` o `node_id` en el contenido revisado. El documento fija convenciones de TypeScript y stack, no el contrato criptográfico del core.

`docs/02-modelo-datos.md` describe el `node_id` como identificador de nodo en su ejemplo de datos y explica que las colecciones locales viven en `device_core`; no define una derivación de clave para ese core.

`docs/23-migraciones.md` contempla migrar los bloques de `device_core` a un core nuevo durante cambios de schema, pero no especifica una migración de claves ni un procedimiento para pasar de la clave actual a una derivada de identidad.

## 3. Lo que hace el código

### 3.1 Apertura de `device_core`

**Archivo:** `src/storage/device-core.ts`  
**Función:** `openDeviceCore(dataDir)`

Fragmento literal:

```ts
export async function openDeviceCore(dataDir: string): Promise<Hypercore> {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const storagePath = dataDir.replace(/\/+$/, '') + '/device-core'

  const core = new Hypercore(storagePath, { valueEncoding: 'json' })
  await core.ready()
  return core
}
```

La llamada no pasa una opción `key`, `keyPair` ni una clave derivada. El almacenamiento se identifica por la ruta local `dataDir/device-core`. La llamada delega a Hypercore la apertura/creación del core con las opciones indicadas. Este diagnóstico no atribuye un valor concreto a la clave interna que Hypercore genere o recupere: para afirmar sus detalles exactos habría que verificar la semántica de la versión instalada de Hypercore.

### 3.2 Orden de inicialización del nodo

**Archivo:** `src/node/start.ts`  
**Función:** `startNode(config)`

Fragmento literal:

```ts
const openStart = now()
core = await openDeviceCore(config.dataDir)
logTiming('node:open', openStart)

// ...

const identityStart = now()
const stored = await loadIdentity(config.dataDir)
identity = stored ? identityToApi(stored) : null
logTiming('node:identity', identityStart)
```

El orden es concluyente: `openDeviceCore()` se ejecuta antes de `loadIdentity()`. La identidad no puede intervenir en la apertura actual de ese core mediante este flujo.

El nodo abre el core y reconstruye el estado con sus eventos antes de cargar la identidad:

```ts
const events = await readAllEvents(core)
state = foldDeviceEvents(events)
```

No se pasa `node_id` a `openDeviceCore()` ni aparece una llamada de derivación entre la carga de identidad y la apertura del core.

### 3.3 Entrada de la aplicación

**Archivo:** `src/main.ts`

Fragmento literal:

```ts
node = await startNode(config)
api.setNode(node)
```

`src/main.ts` delega la inicialización en `startNode(config)`. No carga `user_master_key`, no genera `node_id` y no deriva una clave para Hypercore por su cuenta.

### 3.4 Almacenamiento y carga de identidad

**Archivo:** `src/identity/store.ts`  
**Funciones:** `createIdentity(dataDir)`, `loadIdentity(dataDir)`

Fragmento literal de creación:

```ts
const masterKey = generateUserMasterKey()
const { publicKey } = userKeypairFromMasterKey(masterKey)
const identity: StoredIdentity = {
  private_key: toHex(masterKey),
  public_key: toHex(publicKey),
  profile: {}
}
await saveIdentity(dataDir, identity)
```

La identidad guarda la semilla maestra en `private_key` como hexadecimal. La función `loadIdentity(dataDir)` lee y valida `identity.bmn`, y devuelve `private_key` y `public_key`; no genera ni devuelve un `node_id`.

**Archivo:** `src/identity.ts`

```ts
export function generateUserMasterKey(): Uint8Array {
  const masterKey = new Uint8Array(32)
  sodium.randombytes_buf(masterKey)
  return masterKey
}
```

```ts
export function userKeypairFromMasterKey(masterKey: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } {
  // ...
  sodium.crypto_sign_seed_keypair(publicKey, secretKey, masterKey)
  return { publicKey, secretKey }
}
```

El código confirma que `user_master_key` es la semilla Ed25519 del usuario. No contiene una derivación para el core de dispositivo.

### 3.5 Derivación HKDF existente

**Archivo:** `src/keys.ts`  
**Función:** `deriveCollectionKeypair(masterKey, collectionUuid)`

Fragmento literal:

```ts
const info = utf8Bytes('bookmarknet:collection:' + collectionUuid)
const seed = hkdfSha256(masterKey, info)
const publicKey = new Uint8Array(32)
const secretKey = new Uint8Array(64)
sodium.crypto_sign_seed_keypair(publicKey, secretKey, seed)
return { publicKey, secretKey }
```

El módulo implementa HKDF-SHA256 para colecciones con separación de dominio `bookmarknet:collection:`. No hay en este módulo una función `deriveDeviceKeypair` ni una info string para `device_core`.

Los tests de `test/keys.test.ts` comprueban determinismo, separación por ULID y separación entre distintas claves maestras para `deriveCollectionKeypair`; no prueban derivación de clave de dispositivo.

### 3.6 Generación de `node_id`

**Archivo:** `src/ids.ts`  
**Función:** `newNodeId()`

```ts
export function newNodeId(): string {
  const bytes = new Uint8Array(8)
  sodium.randombytes_buf(bytes)
  return `n_${toHex(bytes)}`
}
```

El generador existe. Sin embargo, `src/node/start.ts` no lo importa ni lo invoca; tampoco se observa en ese flujo que se almacene un `node_id` estable en `dataDir` o en `identity.bmn`. La existencia de un generador no equivale a que cada instalación tenga ya un identificador persistente.

### 3.7 Eventos y folds

**Archivo:** `src/device-events.ts`  
**Tipo:** `DeviceEventBase`

```ts
export interface DeviceEventBase<TType extends string = string, TPayload = unknown> {
  schema_version: 1
  event_id: string
  event_type: TType
  author_id: string
  created_at: string
  payload: TPayload
}
```

Los eventos contienen `author_id` (identidad de usuario), pero no un `node_id`, una clave pública de dispositivo ni una firma de aplicación por evento.

**Archivo:** `src/device-fold.ts`  
**Función:** `foldDeviceEvents(events)`

El fold aplica los eventos para reconstruir el estado local. No recibe una clave ni valida una firma de dispositivo. La integridad append-only y las firmas internas de bloques de Hypercore son una capa distinta del campo `author_id` de los eventos.

**Archivos:** `src/events.ts` y `src/fold.ts`

Estos módulos definen y aplican el schema de eventos de `collection_core`. `genesisSigningHash()` y `collectionGenesis()` firman/verifican el génesis de colección mediante la clave del propietario y la clave de colección; no participan en la apertura ni en la autenticación de `device_core`.

### 3.8 Tests del almacenamiento actual

**Archivo:** `test/device-core.test.ts`

El test crea eventos usando una semilla fija para obtener el `authorId`, pero abre el core así:

```ts
core = await openDeviceCore(DATA_DIR)
```

Después cierra y reabre con la misma llamada y comprueba que los eventos persisten. El test no proporciona una clave a `openDeviceCore`, no prueba que la clave del core dependa de la identidad y no prueba que dos `node_id` distintos produzcan cores diferentes.

## 4. Diferencias y causas probables

| Doc dice | Código hace | Pretendido probable |
|---|---|---|
| `docs/03-identidad.md`: clave derivada de `user_master_key` + `node_id`. | `openDeviceCore(dataDir)` no recibe ninguno de los dos. | Un core distinto por dispositivo, reproducible desde una identidad compartida y un identificador local estable. |
| `docs/05-arquitectura-p2p.md`: en un párrafo dice derivar solo de `user_master_key`; en otro añade `node_id`. | No existe derivación para `device_core`; la única HKDF implementada es la de colección. | Separación de dominio por tipo de clave y por dispositivo; el texto sin `node_id` parece incompleto o contradictorio. |
| `docs/16-identificadores-y-firmas.md`: define `node_id` aleatorio y la HKDF de colección, pero no la derivación de dispositivo. | `newNodeId()` genera un valor aleatorio, pero el arranque inspeccionado no lo crea ni persiste. | Un `node_id` generado una vez y conservado durante la vida del dispositivo. |
| `docs/14-adrs.md`: ADR-003 decide claves por colección; ADR-004 menciona `device_core` + `user_index`, sin contrato de clave. | No hay ADR aceptado localizado que cierre la derivación de dispositivo. | La decisión de claves de dispositivo quedó implícita en el diseño narrativo, sin ADR ni contrato técnico completo. |
| La documentación habla de cores replicables entre dispositivos. | MVP0 abre un core local por ruta `dataDir/device-core`; el arranque usa un topic Hyperswarm de prueba, no un intercambio de cores. | La derivación sería una pieza de identidad/descubrimiento para una fase futura, no una capacidad necesaria para el nodo local aislado actual. |

### Solapamiento con otros hallazgos

- **AUD-04 (frontera MVP1/MVP2):** se solapa en que la decisión de cuándo se crean y usan los cores y cuándo se replican condiciona cuándo debe cerrarse el contrato de clave. Este informe no vuelve a decidir la fase de publicación ni el alcance de `collection_core`.
- **AUD-06 (Hyperbee):** no es el mismo problema. Hyperbee trata del índice/vista materializada; AUD-07 trata de identidad criptográfica y apertura del Hypercore de dispositivo.
- **AUD-09 (schema de eventos):** el campo `author_id` y el schema de `device_core` son contexto, pero corregir los nombres/tipos de evento no resuelve la clave del core. Los eventos actuales tampoco incluyen `node_id` ni una firma de aplicación por evento.

## 5. Impacto

### Seguridad

En el MVP0 local, la clave del core no se deriva de la identidad maestra según el código inspeccionado. Eso significa que poseer/restaurar `identity.bmn` no basta, por sí solo, para reconstruir una clave de dispositivo a partir de una fórmula documentada. El acceso local sigue dependiendo de los permisos del directorio de datos y del material que Hypercore almacene allí.

No se demuestra aquí una vulnerabilidad remota ni una exposición directa de `user_master_key`. La derivación por dispositivo sería una forma de vincular criptográficamente el core con la identidad, pero no sustituye controles de autorización, protección del almacenamiento ni verificación de confianza del peer.

### Integridad de datos

El log local persiste y se reabre en la misma ruta, como comprueba `test/device-core.test.ts`. La prueba no acredita que pueda reconstruirse el mismo core desde la identidad en otro equipo.

Si se cambia el esquema de clave para un `device_core` ya creado, puede no ser posible abrir su almacenamiento existente con el nuevo material de clave. La compatibilidad concreta depende del comportamiento de Hypercore y de cómo esté guardado el estado local; debe probarse antes de elegir A o C. La ruta estable no garantiza por sí sola que una clave nueva sea compatible con el core anterior.

### Replicación futura

La documentación plantea que otros dispositivos descubran y repliquen los cores de un usuario. Para ello se necesitará un contrato que permita identificar cada core y autorizar su escritura/verificación. Una derivación determinista con `user_master_key` + `node_id` permitiría distinguir dispositivos de una misma identidad, siempre que `node_id` sea estable, único en la práctica y se distribuya de forma autenticada.

Derivar solo de `user_master_key` sería problemático para varios dispositivos: todos los dispositivos que compartan identidad obtendrían el mismo par de claves, contradiciendo el diseño de un core single-writer independiente por dispositivo. El código actual evita demostrar esa colisión porque no realiza esa derivación; no debe confundirse la ausencia de derivación con una colisión observada.

### Alcance de MVP1

La derivación de `device_core` **condiciona, pero no necesariamente bloquea**, MVP1 si el objetivo de MVP1 es persistencia local por colección mediante `collection_core` sin replicación.

La derivación de colección ya existe en `src/keys.ts` y su test valida determinismo por `user_master_key` + `collection_uuid`. Por tanto, la creación de `collection_core` puede diseñarse con esa primitiva sin reutilizar la clave de `device_core`.

Sí condiciona decisiones de arquitectura si MVP1 pretende cambiar el formato/almacenamiento del `device_core`, mantener una relación criptográfica entre borradores y colecciones o preparar desde el principio la migración a multidispositivo. Antes de fijar el formato de almacenamiento y migración de MVP1 conviene decidir si el `device_core` actual conservará su identidad de core o será migrado a una clave derivada.

## 6. Opciones de resolución

### Opción A — Corregir el código para derivar la clave como dice la documentación

Implementar una derivación HKDF-SHA256 para `device_core` y pasar el material resultante al abrir Hypercore. Antes habría que resolver la contradicción documental: `docs/03-identidad.md` dice `user_master_key` + `node_id`, pero un párrafo de `docs/05-arquitectura-p2p.md` dice solo `user_master_key`.

**Pros**
- Alinea la implementación con la intención explícita de `docs/03-identidad.md`.
- Da una identidad criptográfica reproducible al core del dispositivo.
- Si incluye `node_id`, mantiene separación de claves entre dispositivos de la misma identidad.

**Contras**
- La especificación actual no fija el algoritmo completo, el domain separator, el formato de salida ni la persistencia/recuperación de `node_id`.
- Puede hacer incompatibles los `device_core` creados por MVP0 con la clave que se derive después.
- Requiere definir migración, rollback y recuperación ante una identidad importada en otro dispositivo.

| Dimensión | Impacto |
|---|---|
| MVP0 (datos existentes) | Medio/alto: el core existente puede no abrir con el nuevo material; podría requerir migración que copie eventos, valide el fold y conserve backup. |
| MVP1 | Medio: debe coordinarse con la persistencia por colección y con el formato definitivo del core de dispositivo. |
| Replicación futura | Favorable si la derivación incluye un `node_id` estable y autenticado. |
| Esfuerzo estimado | Alto: derivación, almacenamiento del identificador, compatibilidad/migración y pruebas multi-dispositivo. |

### Opción B — Corregir la documentación para reflejar el código actual

Aceptar que `device_core` es un core local abierto por ruta y que Hypercore gestiona su material de clave sin que la aplicación lo derive de `user_master_key` ni de `node_id`.

**Pros**
- Refleja fielmente el MVP0 existente.
- Evita cambiar el almacenamiento y no introduce una migración inmediata.
- Permite mantener la derivación de claves de colección como contrato independiente.

**Contras**
- El core no se puede reconstruir determinísticamente a partir de la identidad maestra y un identificador de dispositivo.
- La replicación futura necesitará otro mecanismo explícito para descubrir, identificar, compartir y autorizar cada core.
- Si el requisito de propiedad criptográfica por identidad es intencional, esta opción rebaja el diseño en vez de implementarlo.

| Dimensión | Impacto |
|---|---|
| MVP0 (datos existentes) | Bajo/nulo: no cambia los datos ni la forma de abrir el core. |
| MVP1 | Bajo si `device_core` permanece como log local y las claves de `collection_core` se derivan separadamente. |
| Replicación futura | Medio/alto: obliga a diseñar distribución y autenticación de la clave/identidad del core por otro canal. |
| Esfuerzo estimado | Bajo en documentación; medio/alto en el diseño posterior de replicación. |

### Opción C — Rediseñar y formalizar la derivación por dispositivo

Definir un contrato explícito y separado del de colección: `device_keypair = HKDF-SHA256(user_master_key, "bookmarknet:device:" + node_id)`, con `node_id` generado una vez y persistido por instalación. El ejemplo describe una posible separación de dominio, no una decisión ya tomada ni una especificación que deba copiarse sin revisión.

**Pros**
- Resuelve la contradicción entre derivar solo de la clave maestra y derivar de clave maestra + dispositivo.
- Mantiene claves distintas para cada dispositivo de un mismo usuario.
- Permite reproducir la clave al restaurar la identidad y el identificador estable del dispositivo, sin compartir la misma clave single-writer entre todos los dispositivos.
- Sigue el patrón de separación de dominios ya utilizado por `deriveCollectionKeypair`.

**Contras**
- Requiere definir cómo se conserva y recupera `node_id`, cómo se registra en la identidad y cómo se evita clonar accidentalmente el mismo identificador en dos instalaciones.
- Requiere especificar derivación, formato de claves, tratamiento de rotación/revocación y autenticación del vínculo entre `user_id`, `node_id` y clave pública.
- Tiene el mismo riesgo de incompatibilidad con los cores MVP0 que la opción A; la migración no desaparece por mejorar el diseño.

| Dimensión | Impacto |
|---|---|
| MVP0 (datos existentes) | Medio/alto: probablemente requiere conservar el core actual o migrarlo a un nuevo core con verificación y backup; confirmar con pruebas de Hypercore. |
| MVP1 | Medio: conviene cerrar el contrato antes de congelar el esquema de almacenamiento y migración del nodo. No impide por sí mismo derivar claves de colección. |
| Replicación futura | Favorable: identidad y separación por dispositivo quedan definidas; todavía habrá que diseñar descubrimiento, autorización y revocación. |
| Esfuerzo estimado | Alto: decisión criptográfica, persistencia de `node_id`, migración y pruebas de restauración/multi-dispositivo. |

## 7. Recomendación técnica

**Recomiendo la opción C: formalizar una derivación de clave independiente por dispositivo, basada en `user_master_key` y un `node_id` estable y persistido.**

Es la opción que mejor conserva las dos propiedades expresadas en la documentación: la identidad pertenece al usuario y cada dispositivo mantiene su propio core single-writer. La opción A implementaría una frase documental todavía ambigua; la opción B describiría el MVP0 con precisión, pero dejaría sin resolver el contrato que la propia arquitectura necesita para replicar cores de distintos dispositivos.

La recomendación no implica implementar ahora ni cambiar el alcance de MVP1. Antes de codificar, el responsable debe aprobar el algoritmo exacto, el ciclo de vida de `node_id` y una estrategia de compatibilidad para los `device_core` ya creados. Si se decide que MVP1 no toca el core de dispositivo, puede aplazarse la implementación de esta derivación, pero la decisión debe quedar cerrada antes de iniciar la replicación multidispositivo.

## 8. Decisión pendiente del humano

El responsable del proyecto debe decidir:

1. **¿La clave de `device_core` debe ser determinista y estar vinculada a la identidad del usuario?** La documentación actual responde que sí, pero el código no lo hace.
2. **¿Se confirma que la derivación incluye `node_id`?** Es la formulación de `docs/03-identidad.md` y de un apartado de `docs/05-arquitectura-p2p.md`; otro párrafo de este último solo menciona `user_master_key`.
3. **¿Qué significa persistir/restaurar un dispositivo?** ¿Se conserva `node_id` al reinstalar o importar identidad, o una instalación nueva debe recibir un identificador nuevo? Esto determina si la clave puede reconstruirse y qué ocurre al clonar datos.
4. **¿Qué compatibilidad se exige para los `device_core` de MVP0?** ¿Se mantienen con su clave actual y se migran solo al cambiar de versión, o se acepta una migración inmediata? Hay que validar con la versión concreta de Hypercore si un core existente puede abrirse con una nueva clave o si exige crear otro core y copiar/verificar bloques.
5. **¿Debe resolverse antes de MVP1 o basta con cerrarlo antes de replicación?** Si MVP1 solo añade `collection_core` local y no cambia `device_core`, puede ser un requisito previo de la fase multidispositivo, no un bloqueo directo de la persistencia por colección.

Información adicional recomendable antes de decidir: verificar la semántica exacta de `key`/`keyPair` y almacenamiento de claves en la versión instalada `hypercore@^11.39.3`; revisar el historial de commits que introdujo `openDeviceCore`, `newNodeId` y el texto de derivación; y definir un caso de prueba de restauración en un segundo directorio/dispositivo con la misma identidad, así como otro con un `node_id` distinto. No se ha hecho una prueba de migración ni se ha afirmado que el core actual tenga una clave concreta.
