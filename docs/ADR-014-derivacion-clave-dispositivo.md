# ADR-014: Derivación de clave de dispositivo para `device_core`

**Fecha:** 2026-10-31  
**Estado:** Aceptado

### Contexto

El hallazgo **AUD-07** de la auditoría documental identificó una contradicción entre el contrato descrito y el comportamiento real de `device_core`. Véanse [`docs/28-auditoria-documentacion.md`](https://github.com/miSultanato/bookmarkNet/blob/docs/auditoria-pre-mvp1/docs/28-auditoria-documentacion.md) y el [diagnóstico detallado de AUD-07 en `docs/29-diagnostico-device-core-key.md`](https://github.com/miSultanato/bookmarkNet/blob/docs/diagnostico-aud-07/docs/29-diagnostico-device-core-key.md).

En MVP0, `src/storage/device-core.ts` abre el core mediante `new Hypercore(storagePath, { valueEncoding: 'json' })`: la aplicación no proporciona una clave derivada de la identidad. Además, `src/node/start.ts` abre `device_core` antes de ejecutar `loadIdentity()`. Por tanto, la identidad del usuario no interviene en la apertura actual.

La documentación anterior afirmaba que la clave se derivaba de `user_master_key` y, en algunos pasajes, de `user_master_key` junto con `node_id`. También mezclaba dos conceptos que deben quedar separados:

- La clave/material que Hypercore utiliza para identificar y firmar su log.
- El par de claves Ed25519 propio del dispositivo, que la aplicación derivará de la identidad del usuario y del identificador estable de ese dispositivo, y que proporcionará a Hypercore como `keyPair`.

La derivación HKDF-SHA256 ya utilizada para `collection_core` en `src/keys.ts` proporciona el patrón de separación de dominios que se reutilizará. Sin embargo, la derivación de dispositivo no está implementada actualmente.

La decisión de producto ya está tomada: se adopta la opción C del diagnóstico, pero su implementación se aplaza a MVP2. MVP1 no cambiará la apertura ni el comportamiento actual de `device_core`.

### Decisión

1. **Una clave independiente por dispositivo.** Cada dispositivo tendrá su propio par de claves Ed25519, derivado determinísticamente de `user_master_key` y de su `node_id` estable. Dos dispositivos de una misma identidad deberán obtener pares distintos si sus `node_id` son distintos.

2. **Algoritmo y separación de dominio.** En MVP2 se utilizará HKDF-SHA256, siguiendo el patrón ya aplicado a `collection_core`. El contexto de derivación será `bookmarknet:device:` seguido del `node_id`. El resultado de 32 bytes se utilizará como semilla Ed25519 para obtener el par de claves del dispositivo. La implementación deberá reutilizar la primitiva HKDF existente y mantener este dominio separado del dominio `bookmarknet:collection:`.

3. **Uso de la clave.** El par Ed25519 derivado será el material de clave del Hypercore de dispositivo y se proporcionará al abrirlo mediante la opción `keyPair` de Hypercore. Esta decisión no introduce una segunda firma de aplicación para cada evento: la firma de los bloques sigue siendo responsabilidad de Hypercore. La clave pública del dispositivo identifica el core; no debe confundirse con `user_public_key`, que identifica al usuario.

4. **Implementación diferida a MVP2.** En MVP1 se conserva el comportamiento actual de `device_core`: se mantiene la apertura por la ruta local existente, sin derivar ni pasar `keyPair`, y no se modifica el orden de arranque. La derivación no se considerará implementada hasta que se realicen los cambios de MVP2 y sus pruebas.

5. **Persistencia inmediata de `node_id`.** En MVP1 se generará y persistirá un `node_id` estable por instalación/dispositivo, aunque todavía no participe en la derivación. Se conservará entre reinicios y actualizaciones normales. El identificador pertenecerá al estado local del dispositivo y deberá almacenarse separado de la identidad portable del usuario (`identity.bmn` y su exportación), para que importar una identidad en otro dispositivo no copie accidentalmente el mismo `node_id`. Una instalación nueva que importe una identidad existente deberá obtener su propio identificador. La ruta y el formato concretos del almacenamiento local se fijarán en la implementación de MVP1; no forman parte de este contrato criptográfico.

6. **Datos de MVP0 y posibilidad de reset.** Dado que actualmente no hay usuarios reales, se permite coyunturalmente resetear los datos locales de MVP0 si fuera necesario para adoptar el nuevo modelo. El reset puede eliminar:
   - La identidad local, incluida la clave maestra y los datos de perfil asociados.
   - Los bookmarks, tanto los del Inbox global como los asociados a colecciones.
   - Las colecciones y sus grupos, junto con su estado local.
   - La configuración y preferencias locales almacenadas junto a los datos de la instalación.

   Esta autorización solo es válida mientras no existan usuarios reales ni datos de usuario que deban preservarse. **No es una propiedad estructural del producto ni una política permanente de almacenamiento.** Cuando existan usuarios reales, un reset destructivo dejará de ser aceptable como procedimiento ordinario: cualquier cambio incompatible de claves o almacenamiento deberá acompañarse de un plan de migración que preserve los datos, incluya copia de seguridad, verificación de integridad y una estrategia de recuperación/rollback. La existencia actual de pocos o ningún dato no justifica diseñar el sistema futuro suponiendo que siempre se podrán borrar.

7. **Orden de arranque en MVP2.** Cuando se implemente la derivación, el arranque deberá cargar y validar primero la identidad y el `node_id`, derivar el par Ed25519 del dispositivo y, después, abrir `device_core` con ese `keyPair`. Este cambio de orden queda expresamente fuera de MVP1.

8. **Verificación.** La implementación deberá incluir tests que comprueben determinismo para la misma combinación de `user_master_key` y `node_id`, separación para distintos `node_id`, separación para distintas claves maestras y compatibilidad del formato persistido. También deberá probarse la apertura y recuperación del core, así como la estrategia de transición desde los datos MVP0 existentes.

**Implementación: pendiente (MVP2).** La aceptación de este ADR registra la decisión arquitectónica; no significa que la derivación, el uso de `keyPair` ni el nuevo orden de arranque estén ya implementados.

### Consecuencias

- **Positivas:**
  - La clave de cada dispositivo queda vinculada a la identidad del usuario y separada de las claves de otros dispositivos de la misma identidad.
  - El diseño es coherente con la separación de dominios y la derivación determinista ya empleadas para `collection_core`.
  - Persistir `node_id` desde MVP1 evita tener que introducirlo y migrar su identidad de dispositivo justo cuando se implemente la replicación.
  - Se establece una base criptográfica para el modelo multidispositivo de MVP2, sin adelantar esa funcionalidad a MVP1.

- **Negativas y costes:**
  - En MVP2 habrá que cambiar el orden de arranque: cargar identidad y `node_id` antes de abrir `device_core`.
  - MVP1 deberá definir y persistir el formato de `node_id`, incluyendo validación, permisos, estabilidad y comportamiento ante reinstalación o restauración.
  - La derivación requiere tests estables de determinismo y separación entre dispositivos e identidades.
  - Cambiar el material de clave de un core existente puede impedir abrirlo con el nuevo `keyPair`. Antes de activar la derivación habrá que verificar el comportamiento de la versión de Hypercore utilizada y ejecutar una migración o transición explícita; no se asumirá que los cores MVP0 son compatibles automáticamente.
  - Un `node_id` clonado junto con los datos locales podría hacer que dos instalaciones derivasen la misma clave. La copia/restauración de datos de dispositivo deberá tratar este riesgo y distinguir entre recuperar el mismo dispositivo y registrar uno nuevo.

- **Alcance por fases:**
  - **MVP1:** persistir `node_id`; mantener sin cambios la apertura actual de `device_core`.
  - **MVP2:** implementar HKDF-SHA256, derivar el par Ed25519, abrir Hypercore con `keyPair`, cambiar el orden de arranque y resolver la transición de los datos anteriores.

### Alternativas consideradas

- **Opción A — Implementar la derivación inmediatamente, en MVP1.**  
  Descartada. Adelantaría al MVP1 un cambio que no es necesario para la persistencia local por colección sin replicación. También obligaría a cambiar ya el arranque y a resolver la compatibilidad de los cores MVP0 antes de que MVP1 necesite la capacidad multidispositivo. El diagnóstico AUD-07 documenta estos costes y riesgos; la decisión adoptada conserva el modelo objetivo de C sin adelantar su implementación.

- **Opción B — Corregir únicamente la documentación y mantener el modelo actual como solución definitiva.**  
  Descartada. Aunque describiría con precisión el comportamiento actual de MVP0, renunciaría al vínculo determinista entre identidad y core de dispositivo. La replicación multidispositivo necesitaría entonces otro mecanismo para identificar, distribuir y autorizar la clave del core, y no se cumpliría el objetivo arquitectónico de disponer de una clave independiente por dispositivo derivada de la identidad. El diagnóstico AUD-07 señala esta limitación.

- **Opción C — Derivación independiente por dispositivo, implementada en MVP2.**  
  **Aceptada.** Es la opción que mantiene una clave single-writer distinta por dispositivo, reutiliza el patrón HKDF-SHA256 de `collection_core` y permite preparar `node_id` en MVP1 sin cambiar todavía el arranque ni el almacenamiento actual de `device_core`.

### Estado

**Aceptado.** La decisión arquitectónica está cerrada. La implementación queda diferida a MVP2 y la persistencia de `node_id` corresponde a MVP1.

**Implementación: pendiente (MVP2).**

Este ADR se añade como archivo independiente porque esta tarea no permite modificar `docs/14-adrs.md`. En un PR posterior deberá añadirse la entrada ADR-014 al índice de ese documento, conservando la política de no reescribir ADRs aceptados.
