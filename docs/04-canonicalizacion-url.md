# Canonicalización de URLs

Esta especificación es crítica: los errores fragmentan `resource_id` y hacen inútiles las métricas de popularidad y el conocimiento emergente.

## Regla de identidad

```
resource_id = "r_" + sha256("v1:" + canonical_url).hex()
```

El identificador completo incluye el prefijo `r_` y el hash SHA-256 en hexadecimal (64 caracteres). Ver `docs/16-identificadores-y-firmas.md`.

## Pasos de canonicalización (v1)

Aplicar en este orden:

1. **Minúsculas en scheme y host.** `HTTPS://WWW.JAPAN-GUIDE.COM/` → `https://www.japan-guide.com/`
2. **Eliminar `www.` al inicio del host.** `www.japan-guide.com` → `japan-guide.com`
3. **Eliminar fragmento (`#...`).** `https://ejemplo.com/pagina#seccion` → `https://ejemplo.com/pagina`
4. **Eliminar parámetros de tracking conocidos:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`; `ref` y `source` sólo si sus valores son de tracking conocidos.
5. **Mantener el resto de parámetros de consulta**, pues pueden cambiar el recurso.
6. **Ordenar los parámetros de query alfabéticamente por nombre.** Si hay parámetros repetidos (`?a=1&a=2`), mantener el orden original de los valores (no ordenar valores).
7. **Normalizar trailing slash:** si el path está vacío, usar `/`; si el path no termina en `/`, mantenerlo tal cual. No forzar una barra final: algunos recursos distinguen ambas rutas.
8. **Eliminar un `?` vacío final.**

## Ejemplos

| Entrada | Resultado |
|---|---|
| `https://japan-guide.com` | `https://japan-guide.com/` |
| `https://japan-guide.com/` | `https://japan-guide.com/` |
| `https://japan-guide.com/mountains` | `https://japan-guide.com/mountains` |
| `https://japan-guide.com/mountains/` | `https://japan-guide.com/mountains/` (distinto) |
| `https://japan-guide.com/mountains?utm_source=x` | `https://japan-guide.com/mountains` |
| `https://japan-guide.com/mountains?a=1` | `https://japan-guide.com/mountains?a=1` |
| `https://japan-guide.com/mountains#x` | `https://japan-guide.com/mountains` |

## Casos abiertos (decidir antes de MVP3)

- ¿URLs con `?page=2` son recursos distintos? Sí, mantener.
- ¿URLs acortadas (`bit.ly/...`)? En v1 no se resuelven.

## Versionado

La función de canonicalización tiene versión para permitir migraciones futuras: `resource_id = "r_" + sha256("v1:" + canonical_url).hex()`.

## Decisiones v1 (casos no cubiertos)

Estas decisiones complementan los 8 pasos anteriores y se aplican en v1. No son parte del algoritmo de canonicalización en sí, sino de la política de aceptación de `canonicalizeUrl`.

- **Credenciales (`user:pass@host`):** se eliminan. Si la URL tiene `username` o `password` (`https://user:pass@host/`), se eliminan. La URL canónica no incluye credenciales. **Consecuencia:** dos URLs que solo difieran en credenciales (`https://example.com/path` y `https://user:pass@example.com/path`) producen el mismo `resource_id`.
- **Validar el esquema.** Solo se aceptan `http:` y `https:`. Cualquier otro esquema (`mailto:`, `ftp:`, `file:`, etc.) o una URL sin esquema (`example.com/path`) se rechaza con `RangeError`. La app puede intentar normalizar URLs sin esquema en la UI (añadiendo `https://`), pero la función `canonicalizeUrl` no lo hace.
- **Puertos no estándar (`:8080`):** se mantienen. Un puerto no estándar identifica un recurso distinto.
- **Encoding en el path (`%20` vs `+`):** se mantiene tal cual. La normalización de encoding se pospone a v2.
- **`ref` y `source`:** en v1 se mantienen siempre. El doc no define qué valores son "de tracking conocidos", así que no se eliminan para no fragmentar `resource_id` por una lista inventada. La lista explícita, si se decide, irá en v2.

## Implementación

El parseo de URLs usa `bare-url` (implementación WHATWG mantenida por Holepunch, disponible para Bare). No se usa `URL` global, que no está garantizado en Bare.
