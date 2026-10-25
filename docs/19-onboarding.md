# Onboarding

Este documento define la primera experiencia del usuario al abrir BookmarkNet por primera vez.

## Principio

El onboarding debe ser lo más rápido posible. La identidad se crea cuando el usuario pulsa "Continuar" (o al importar bookmarks), llamando a `POST /api/v1/identity/create`. El nodo arranca sin identidad y la UI muestra el onboarding hasta que se crea. El perfil es opcional y se puede ajustar en cualquier momento. El usuario debe poder estar dentro de la app en menos de 30 segundos si así lo quiere.

## Flujo

Al arrancar por primera vez, el nodo no tiene identidad (`GET /api/v1/identity` devuelve `{ identity: null }`). La UI muestra el onboarding. Cuando el usuario pulsa "Continuar" (o "Importar"), la UI llama a `POST /api/v1/identity/create` y luego a `POST /api/v1/identity/import` si procede. A continuación, el usuario ve la pantalla principal. La pantalla de onboarding ofrece tres opciones independientes:

1. **Importar bookmarks de mi navegador** (HTML).
2. **Añadir colecciones iniciales** (seed pack).
3. **Continuar** (sin ninguna de las anteriores).

Las tres son opcionales. El usuario puede marcar una, ambas o ninguna.

**Fase:** este flujo es el diseño completo. En MVP0 solo funciona "Importar bookmarks HTML". Las otras dos opciones se muestran pero no están operativas hasta MVP4 (seed pack).

## Identidad y perfil

- **Identidad:** se crea cuando el usuario confirma el onboarding (llamada a `POST /api/v1/identity/create`). No se pide nombre, email ni contraseña. Las claves son suficientes.
- **Perfil:** opcional. Se puede ajustar en cualquier momento desde ajustes.
- **Al compartir por primera vez:** la app ofrece la opción de ajustar el perfil (nombre, bio). No es obligatorio. Se puede omitir y compartir igualmente.

## Importar bookmarks

- En MVP solo se soporta importación de HTML de navegador.
- Si el usuario marca la opción pero no selecciona archivo, se muestra un aviso suave: "No has seleccionado archivo. ¿Continuar sin importar?" y se continúa sin importar.
- Los bookmarks importados van al Inbox.

## Añadir colecciones iniciales

- Si el usuario marca la opción, se instala el seed pack incluido en el binario (ver docs/18-seed-pack.md).
- Las colecciones quedan disponibles offline desde ese momento.
- Si hay seed peers online, se actualizan a la última versión.

## Después de Continuar

- Si el usuario marcó el seed pack: va a la pantalla de Explorar con las colecciones del seed pack visibles.
- Si no marcó nada: va a una pantalla con un mensaje claro de qué puede hacer ("Aún no tienes colecciones. Puedes añadir el seed pack o importar bookmarks desde ajustes.").
- En ningún caso se muestra una pantalla vacía sin contexto.

## Después del onboarding

El onboarding no se puede repetir. Pero desde ajustes el usuario puede:

- **Importar bookmarks** (HTML de navegador).
- **Añadir el seed pack** (si no lo hizo en el onboarding).
- **Ajustar el perfil** (nombre, bio, avatar).

## Fuera del MVP

- Importación desde Pocket, Raindrop, Pinboard u otros servicios.
- Onboarding guiado paso a paso.
- Tutorial interactivo.
