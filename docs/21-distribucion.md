# Distribución

Este documento define cómo se empaqueta, publica e instala BookmarkNet.

## Formatos

- **Binarios nativos** por plataforma (generados con `bare-build`):
  - macOS: Mach-O + `.pkg` (instalador).
  - Linux: ELF + `.AppImage`.
  - Windows: PE + `.msix`.
- **Docker:** imagen multi-arch para usuarios de homelab y NAS.

Ambos formatos contienen el mismo core Bare + UI web local. El binario arranca el servidor web y (opcionalmente) abre el navegador. El contenedor Docker expone el puerto de la API local.

## Publicación

- **Binarios nativos:** se publican en **GitHub Releases**. Cada release incluye los binarios por plataforma, el hash SHA-256 de cada uno, y las notas de versión.
- **Imagen Docker:** se publica en **GitHub Container Registry ([ghcr.io](https://ghcr.io/))**. Cada release incluye la nueva imagen con el tag de versión.
- Las notas de versión de GitHub Releases enlazan tanto a los binarios como a la imagen Docker.
- **Firma de código:** no en MVP0–MVP2. Se añadirá cuando haya usuarios no técnicos (notarización de Apple, firma EV de Windows).
- **Firma GPG:** no en MVP0–MVP2. Se añadirá cuando haya usuarios técnicos que quieran verificar la integridad. Mientras tanto, el hash SHA-256 es suficiente.

## Actualización

- **MVP0–MVP2:** actualización manual. El usuario descarga la nueva versión de GitHub Releases y la instala encima.
- **MVP3+:** notificación de nueva versión en la UI. El usuario decide cuándo actualizar. No hay auto-actualización en el roadmap actual.

## Verificación de integridad

- **MVP0–MVP2:** hash SHA-256 publicado en GitHub Releases. El usuario puede verificar manualmente.
- **Fase posterior:** firma GPG del binario, además del hash. El usuario puede verificar con `gpg --verify`.

## Docker

- Imagen multi-arch (`linux/amd64`, `linux/arm64`) publicada en GitHub Container Registry ([ghcr.io](https://ghcr.io/)).
- El contenedor expone el puerto de la API local (por defecto el mismo que el binario).
- Variables de entorno para configurar el directorio de datos y el puerto.
- El contenedor no incluye el navegador; el usuario abre la UI en su navegador apuntando al puerto expuesto.

## Lo que NO se ofrece en MVP0–MVP2

- Auto-actualización.
- Firma de código (Apple notarization, Windows EV).
- Firma GPG.
- Paquetes para gestores de paquetes (Homebrew, apt, choco).
- Snap / Flatpak.
- App Store / Microsoft Store.

Estos se añadirán en fases posteriores, cuando haya usuarios reales y demanda.
