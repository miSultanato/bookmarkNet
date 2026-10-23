# Bootstrap peers y seed peers

## Distinción

| Concepto | Función | No es |
|---|---|---|
| Bootstrap peer | «¿Conoces a alguien? Prueba con estos peers» | Servidor de bookmarks, búsqueda o colecciones |
| Seed peer | Mantiene copias de colecciones públicas populares, Discovery Feed y temas semilla | Plataforma propietaria |

## Regla arquitectónica

Ninguna colección puede depender exclusivamente de un nodo oficial. Si 15 usuarios siguen una colección, puede haber 15 réplicas; los nodos oficiales dejan de ser importantes para esa colección.

## Configuración inicial sugerida

```
NAS Casa   → Bootstrap Peer
VPS Europa → Bootstrap + Seed
VPS América → Bootstrap + Seed
```

Claves públicas incluidas en la app:

```json
{
  "bootstrap_nodes": ["peer_a", "peer_b", "peer_c"]
}
```

## Discovery Feed

El Discovery Feed v1 se incluye en la app. Los seed peers pueden mantener versiones más recientes (v4, v5...) que se propagan al conectar.

Sin servidores web ni HTTP central.

## Evolución

- Inicio: 90 % de disponibilidad = nodos oficiales.
- Madurez: 90 % de disponibilidad = usuarios replicando; los nodos oficiales pasan a ser nodos veteranos de la red.

## Regla de lanzamiento

Para lanzar BookmarkNet se considera prácticamente obligatorio tener al menos un NAS 24/7 y un VPS europeo como bootstrap peers conocidos. No porque la arquitectura lo necesite a largo plazo, sino porque una red con pocos usuarios necesita estabilidad inicial.
