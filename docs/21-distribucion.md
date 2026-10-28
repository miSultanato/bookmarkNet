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

El workflow de release (`.github/workflows/release.yml`) genera el binario Linux (`.AppImage`) al crear un tag `v*` y lo publica en GitHub Releases con su hash SHA-256. Los binarios de macOS y Windows se añadirán en una fase posterior (requieren runners específicos o cross-compilación).

## Actualización

- **MVP0–MVP2:** actualización manual. El usuario descarga la nueva versión de GitHub Releases y la instala encima.
- **MVP3+:** notificación de nueva versión en la UI. El usuario decide cuándo actualizar. No hay auto-actualización en el roadmap actual.

## Verificación de integridad

- **MVP0–MVP2:** hash SHA-256 publicado en GitHub Releases. El usuario puede verificar manualmente.
- **Fase posterior:** firma GPG del binario, además del hash. El usuario puede verificar con `gpg --verify`.

## Docker

La imagen Docker se publica automáticamente en ghcr.io/misultanato/lotura al crear un tag v*. El workflow .github/workflows/docker-publish.yml se encarga de construirla y subirla.

La imagen Docker se puede ejecutar en equipos de homelab y NAS. Desde el repositorio, construye la imagen localmente:

```bash
docker build -t lotura .
```

Para ejecutarla usando el volumen persistente `lotura-data`:

```bash
docker run -d \
  --name lotura \
  -p 7575:7575 \
  -v lotura-data:/data \
  ghcr.io/misultanato/lotura:latest
```

Abre la UI en [http://localhost:7575](http://localhost:7575). Los datos se guardan en el volumen Docker `lotura-data` y sobreviven al reemplazo o reinicio del contenedor. El contenedor configura `BOOKMARKNET_BIND=0.0.0.0` para aceptar conexiones a través del puerto publicado y `BOOKMARKNET_DATA_DIR=/data` para persistir los datos. No se abre ningún navegador dentro del contenedor.

Para otras opciones de configuración, consulta [docs/22-configuracion.md](22-configuracion.md). Si accedes desde otro equipo de la LAN, configura también `BOOKMARKNET_ALLOWED_HOSTS` para permitir el nombre o la IP usados en la cabecera Host.

## Lo que NO se ofrece en MVP0–MVP2

- Auto-actualización.
- Firma de código (Apple notarization, Windows EV).
- Firma GPG.
- Paquetes para gestores de paquetes (Homebrew, apt, choco).
- Snap / Flatpak.
- App Store / Microsoft Store.

Estos se añadirán en fases posteriores, cuando haya usuarios reales y demanda.
