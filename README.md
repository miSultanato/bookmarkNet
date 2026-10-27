# Lotura

Guarda enlaces. Comparte colecciones.

Crea, comparte y descubre colecciones de enlaces.

El conocimiento no se crea. Se descubre, se organiza y se comparte.

> **Nota:** Lotura es el nombre de producto. El nombre técnico del proyecto es BookmarkNet (repo, paquete, directorio de datos).

> **Disclaimer:** este repositorio (documentación y código) se desarrolla con asistencia de un LLM local. Las decisiones de diseño, la revisión y la verificación son humanas.

## Qué es

Lotura indexa las decisiones humanas sobre qué recursos son valiosos, no las páginas web. Los usuarios guardan enlaces, los organizan en grupos y colecciones, y la red descubre patrones (stacks, rutas, relaciones) que emergen de cómo miles de personas organizan la información.

## Qué NO es

- No es un buscador web (no compite con Google).
- No es una red social.
- No es una wiki ni plataforma de contenido.
- No usa IA, comentarios, likes ni karma.

## Jerarquía conceptual

`User → Collection → Bookmark → Resource → URL`

## Estado

MVP en diseño. Ver [docs/09-roadmap-mvp.md](docs/09-roadmap-mvp.md).

## Requisitos

- **Para desarrollo:** Node.js 22 o posterior y Bare. Instala Bare con `npm install -g bare-runtime`.
- **Para ejecutar el binario standalone ya generado:** no necesitas instalar Node.js ni Bare. Para generarlo desde el código fuente, consulta [Desarrollo](#desarrollo).

## Instalación

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/miSultanato/bookmarkNet.git
cd bookmarkNet
npm install
npm install -g bare-runtime
```

## Arranque

Desde la raíz del repositorio, ejecuta:

```bash
bare src/main.ts
```

El nodo sirve la interfaz web en [http://localhost:7575](http://localhost:7575). Abre esa dirección en el navegador. El puerto por defecto es `7575`; el auto-incremento si está ocupado está pendiente de implementación.

### Binario standalone

El comando `npm run build` genera un binario standalone mediante `bare-build`, en `build/lotura` (Linux/macOS) o `build/lotura.exe` (Windows). En Linux/macOS puedes ejecutarlo con:

```bash
./build/lotura
```

Consulta también las [notas de ejecución](#notas-de-ejecución) sobre la primera carga y el cierre limpio.

## Notas de ejecución

### Cold start

La primera vez que ejecutes el binario, el sistema operativo tarda unos segundos en cargarlo en memoria (el binario pesa ~97 MB). Las siguientes ejecuciones son instantáneas: la UI carga en menos de 100 ms.

### Cierre limpio

Cierra Lotura con Ctrl+C (SIGINT) o SIGTERM. Evita `kill -9` (SIGKILL), porque puede dejar locks huérfanos en el `device_core`.

### Workaround para macOS y Windows

En Linux, Lotura mata automáticamente los procesos huérfanos al arrancar. En macOS y Windows, si Lotura se cierra abruptamente, el siguiente arranque puede fallar con `File descriptor could not be locked`. Solución: cierra todos los procesos de Lotura, borra el archivo `~/.bookmarknet/device-core/db/LOCK` y vuelve a arrancar.

En Windows, la ruta de datos por defecto es `%APPDATA%\\bookmarknet\\`; elimina `device-core\\db\\LOCK` dentro de ese directorio en lugar de usar la ruta Unix del ejemplo.

### Arranque temprano de la UI

Lotura sirve la UI inmediatamente al arrancar (los assets están precargados en memoria). Mientras el nodo carga, la UI muestra “Cargando Lotura…” y reintenta automáticamente. El nodo suele estar listo en ~30 ms.

## Uso básico

1. Abre [http://localhost:7575](http://localhost:7575).
2. Pulsa **Empezar** en la portada.
3. En el onboarding, crea tu identidad. No necesitas email ni contraseña: las claves se generan y se guardan en tu dispositivo. Opcionalmente, marca **Importar bookmarks de mi navegador** y selecciona un archivo HTML exportado desde Chrome, Firefox o Edge.
4. Crea una colección en **Mis colecciones**.
5. Añade bookmarks desde la pantalla de una colección o desde el **Inbox**.
6. Importa un archivo HTML en cualquier momento desde **Importar** (`#/import`).
7. Configura tu perfil desde **Configuración**.

## Desarrollo

Desde la raíz del repositorio:

```bash
# Arrancar en modo desarrollo
bare src/main.ts

# Generar el binario standalone
npm run build

# Ejecutar los tests con brittle-bare
npm test
```

`npm test` ejecuta los tests con `brittle-bare`. El proceso de build genera los assets antes de empaquetar el binario.

- [`docs/branding/`](docs/branding/): assets de marca (logos y favicon).
- [`docs/`](docs/): documentación completa del proyecto, con más de 24 documentos.

## Dónde viven los datos

El nodo guarda sus datos en el directorio local de BookmarkNet:

- **Linux/macOS:** `~/.bookmarknet/`
- **Windows:** `%APPDATA%\\bookmarknet\\`

Dentro encontrarás, según el uso y la configuración:

- `identity.bmn`: identidad y clave privada en claro, en un archivo con permisos `0600`; el directorio de datos se crea con permisos `0700`.
- El core local de Hypercore (`device_core`), que contiene los eventos.
- `config.json`, si se crea para personalizar la configuración.
- `logs/`, con los logs del nodo.

**Importante:** el archivo de identidad en disco no está cifrado. Protege tu cuenta de usuario y el acceso al directorio de datos. La exportación cifrada de identidad mediante `POST /api/v1/identity/export` todavía no está implementada.

## Configuración

El archivo opcional `config.json` está en `<dataDir>/config.json`; por defecto, en `~/.bookmarknet/config.json`. Si no existe, el nodo usa los valores por defecto.

Las variables de entorno tienen prioridad sobre `config.json`:

- `BOOKMARKNET_PORT`: puerto HTTP.
- `BOOKMARKNET_DATA_DIR`: directorio de datos.
- `BOOKMARKNET_LOG_LEVEL`: nivel de log.
- `BOOKMARKNET_ALLOWED_HOSTS`: hosts permitidos, separados por comas.
- `BOOKMARKNET_BIND`: dirección de bind del servidor.

Valores por defecto:

- Puerto: `7575`.
- `logLevel`: `info`.
- `openBrowserOnStart`: `true` en la configuración; la apertura automática del navegador está pendiente de implementación.
- `allowedHosts`: `localhost`, `127.0.0.1` y `[::1]`.
- `bind`: `127.0.0.1` (solo loopback).

La pantalla **Configuración** muestra la configuración en modo de solo lectura y no expone `dataDir` por seguridad. Para cambiarla, edita `config.json` y reinicia el nodo.

## Nota sobre el nombre

**Lotura** es el nombre del producto que ves en la interfaz. **BookmarkNet** es el nombre técnico usado por el repositorio, `package.json`, el directorio de datos y los identificadores internos. El directorio de datos sigue llamándose `~/.bookmarknet/` en Linux/macOS (o `%APPDATA%\\bookmarknet\\` en Windows).

## Documentación

| Documento | Contenido |
|---|---|
| [00-vision](docs/00-vision.md) | Visión y propuesta de valor |
| [01-principios](docs/01-principios.md) | Principios de diseño no negociables |
| [02-modelo-datos](docs/02-modelo-datos.md) | Entidades y relaciones |
| [03-identidad](docs/03-identidad.md) | Identidad multidispositivo |
| [04-canonicalizacion-url](docs/04-canonicalizacion-url.md) | Reglas de canonicalización |
| [05-arquitectura-p2p](docs/05-arquitectura-p2p.md) | Stack Hypercore/Hyperswarm |
| [06-descubrimiento](docs/06-descubrimiento.md) | Descubrimiento por clave |
| [07-api-local](docs/07-api-local.md) | API local del nodo |
| [08-bootstrap-y-seeds](docs/08-bootstrap-y-seeds.md) | Nodos de arranque |
| [09-roadmap-mvp](docs/09-roadmap-mvp.md) | Fases incrementales |
| [10-riesgos](docs/10-riesgos.md) | Riesgos y mitigaciones |
| [11-glosario](docs/11-glosario.md) | Términos |
| [12-testing](docs/12-testing.md) | Estrategia de testing |
| [13-ui-ux](docs/13-ui-ux.md) | Principios de diseño y pantallas |
| [14-adrs](docs/14-adrs.md) | Architecture Decision Records |
| [15-schema-eventos](docs/15-schema-eventos.md) | Schema de eventos |
| [16-identificadores-y-firmas](docs/16-identificadores-y-firmas.md) | Identificadores y firmas |
| [17-propuestas](docs/17-propuestas.md) | Sistema de propuestas |
| [18-seed-pack](docs/18-seed-pack.md) | Seed pack inicial |
| [19-onboarding](docs/19-onboarding.md) | Flujo de primera ejecución |
| [20-stack-tecnico](docs/20-stack-tecnico.md) | Stack técnico |
| [21-distribucion](docs/21-distribucion.md) | Distribución |
| [22-configuracion](docs/22-configuracion.md) | Configuración local |
| [23-migraciones](docs/23-migraciones.md) | Migraciones de schema |
| [24-ui-vision](docs/24-ui-vision.md) | Visión y dirección de la UI |
| [25-busqueda-i18n](docs/25-busqueda-i18n.md) | Búsqueda e internacionalización |
