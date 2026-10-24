# Configuración local

Este documento define la configuración del nodo de BookmarkNet: puerto, directorio de datos, bootstrap nodes, seguridad de la API local y opciones de arranque.

## Puerto

- **Por defecto:** `7575`.
- **Configurable:** por `BOOKMARKNET_PORT` (env var) o por `port` en `config.json`.
- **Auto-incremento:** si el puerto está ocupado, el nodo intenta el siguiente (`7576`, `7577`...) hasta encontrar uno libre. El puerto elegido se escribe en el log y en `config.json` (si no estaba ya fijado).
- **UI y API comparten puerto y origen.** La UI se sirve desde `/` y la API desde `/api/v1/`. No hay CORS.

## Directorio de datos

- **Por defecto:** `~/.bookmarknet/` en Linux/macOS; `%APPDATA%\bookmarknet\` en Windows.
- **Configurable:** por `BOOKMARKNET_DATA_DIR` o por `data_dir` en `config.json`.
- **Creación automática:** si el directorio no existe, se crea con permisos `0700` (solo el usuario propietario).
- Contiene: Hypercores, `config.json`, logs, y la identidad cifrada (`identity.bmn` si se exporta).

## Archivo de configuración

Ubicación: `<data_dir>/config.json`.

```json
{
  "port": 7575,
  "data_dir": "~/.bookmarknet",
  "bootstrap_nodes": ["peer_a", "peer_b", "peer_c"],
  "log_level": "info",
  "open_browser_on_start": true,
  "allowed_hosts": ["localhost", "127.0.0.1", "[::1]"]
}
```

Todas las claves son opcionales. Si `config.json` no existe, se usan los valores por defecto.

## Variables de entorno (override)

Las variables de entorno tienen prioridad sobre `config.json`:

| Variable | Equivalente en config.json |
|---|---|
| `BOOKMARKNET_PORT` | `port` |
| `BOOKMARKNET_DATA_DIR` | `data_dir` |
| `BOOKMARKNET_LOG_LEVEL` | `log_level` |
| `BOOKMARKNET_ALLOWED_HOSTS` | `allowed_hosts` (lista separada por comas) |
| `BOOKMARKNET_BIND` | `bind` |

Útil para Docker y para overrides puntuales.

## Seguridad de la API local

La API local y la UI comparten puerto. Para evitar DNS rebinding y CSRF:

### Validación de Host

- **Por defecto:** solo se aceptan `localhost`, `127.0.0.1` y `[::1]` (con o sin puerto).
- **Configurable:** `allowed_hosts` en `config.json` o `BOOKMARKNET_ALLOWED_HOSTS` (lista separada por comas).
- **Rechazo:** cualquier petición con un `Host` no permitido devuelve `421 Misdirected Request`.
- **Caso de uso del NAS:** si el NAS tiene IP `192.168.1.100` y quieres acceder a su UI desde el PC, añade `192.168.1.100` a `allowed_hosts`. El PC accede a `http://192.168.1.100:7575` y funciona.
- **Recomendación:** añadir solo las IPs/nombres estrictamente necesarios. No usar `*` salvo en redes completamente confiables.

### Validación de Origin en mutaciones

- Las peticiones `POST`, `PUT`, `PATCH` y `DELETE` deben incluir un `Origin` que coincida con el `Host` de la petición.
- Si no hay `Origin` (ej. `curl`), se permite solo desde loopback (`127.0.0.1`).
- Si el `Origin` no coincide, se rechaza con `403 Forbidden`.

### Content-Type

- Las peticiones `POST`, `PUT` y `PATCH` deben incluir `Content-Type: application/json`.
- Esto fuerza un preflight CORS que el servidor no responde para orígenes externos, bloqueando CSRF.

### Bind

- El servidor HTTP se bindea solo a `127.0.0.1` por defecto.
- Si se quiere acceder desde la LAN (caso NAS), el usuario debe configurar `bind` explícitamente en `config.json` (`"bind": "0.0.0.0"`) o por `BOOKMARKNET_BIND`. Por defecto es `127.0.0.1` para minimizar la superficie de exposición.

## Log

- **Nivel:** `error`, `warn`, `info` (por defecto), `debug`.
- **Destino:** `<data_dir>/logs/bookmarknet.log`.
- **Rotación:** diaria, con retención de 7 días.

## Arranque

- Al ejecutar el binario, el nodo:
  1. Lee `config.json` (si existe).
  2. Aplica overrides de env vars.
  3. Crea el directorio de datos si no existe.
  4. Arranca el servidor HTTP en el puerto elegido.
  5. Arranca Hyperswarm y se une a los topics de bootstrap.
  6. Si `open_browser_on_start` es `true`, abre el navegador en `http://localhost:<puerto>`.
- Si el puerto está ocupado, prueba el siguiente. Si el directorio de datos no se puede crear, sale con error.

## Lo que NO se configura en MVP

- Tema de la UI (claro/oscuro): se detecta del sistema.
- Idioma de la UI: por defecto, español.
- Múltiples usuarios en el mismo nodo: fuera de MVP.
- Proxy inverso: el usuario puede poner uno delante, pero el nodo no lo configura.
