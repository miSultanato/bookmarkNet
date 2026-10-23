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
6. **Normalizar trailing slash:** si el path está vacío, usar `/`; si el path no termina en `/`, mantenerlo tal cual. No forzar una barra final: algunos recursos distinguen ambas rutas.
7. **Eliminar un `?` vacío final.**

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

- ¿`?a=1&b=2` y `?b=2&a=1` son el mismo resource? La propuesta v1 es que sí: ordenar parámetros.
- ¿URLs con `?page=2` son recursos distintos? Sí, mantener.
- ¿URLs acortadas (`bit.ly/...`)? En v1 no se resuelven.

## Versionado

La función de canonicalización tiene versión para permitir migraciones futuras: `resource_id = "r_" + sha256("v1:" + canonical_url).hex()`.
