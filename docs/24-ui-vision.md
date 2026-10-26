# Visión de UI

Este documento recoge la visión visual de Lotura para MVP2–MVP4 y conserva wireframes HTML estáticos como referencia. Es un documento de diseño: no implica que todas las pantallas o métricas estén implementadas.

## Branding

- **Nombre:** LOTURA.
- **Significado:** enlace, conexión, vínculo (euskera).
- **Tagline:** «Guarda enlaces. Comparte colecciones.»
- **Descripción:** «Crea, comparte y descubre colecciones de enlaces.»
- **Logo:** L modular. Narrativa: «Los enlaces se agrupan en colecciones, y las colecciones construyen Lotura».
- **Colores:** gradiente azul → violeta para el logo; para la UI, acento `#2563eb`.
- **Inspiraciones:** Immich, Linkding, Raindrop, GitHub.
- **No:** Facebook, Twitter, Instagram.

## 1. Filosofía visual

Lotura se diseña como una **aplicación local servida por el nodo y accedida desde el navegador**, no como una web pública centralizada. El modelo mental se acerca a Home Assistant, Immich, Linkding o qBittorrent: el usuario ejecuta su propio servicio y abre su interfaz local.

La entidad principal visible es la **colección**, no el usuario ni el tema. Los bookmarks son recursos organizados dentro de colecciones; la red P2P es la infraestructura que permite encontrarlos, replicarlos y mantenerlos disponibles.

Inspiraciones visuales y de interacción:

- **Immich:** aplicación personal, organización clara y control local.
- **Linkding:** interfaz funcional para guardar y consultar enlaces.
- **Raindrop:** navegación visual por colecciones y recursos.
- **GitHub:** exploración de proyectos y señales transparentes sobre actividad y disponibilidad.

No se busca imitar Facebook, Twitter ni Instagram. Lotura no es una red social: no necesita likes, publicaciones, perfiles como foco ni métricas de popularidad de personas.

La sensación general debe ser la de una **biblioteca de conocimiento**, tranquila y útil. Fondo claro u oscuro, acento azul o verde, mucho espacio en blanco, tarjetas legibles y jerarquía tipográfica sencilla. Los indicadores P2P (estado, peers y sincronización) están presentes, pero son discretos: primero se percibe la biblioteca y después se entiende la red que la sostiene.

La UI debe mostrar la disponibilidad y la sincronización con honestidad. Una colección sin peers no debe parecer disponible si no lo está; las métricas globales futuras deben distinguirse de las observaciones locales.

## Portada

Wireframe conceptual de la portada de Lotura:

```text
┌──────────────────────────────────────────────────────────────┐
│                            LOTURA                            │
│                                                              │
│              Guarda enlaces. Comparte colecciones.           │
│     Crea, comparte y descubre colecciones de enlaces.        │
│                                                              │
│                   [ Empezar ]  [ Explorar ]                  │
│                                                              │
│  ES                         EN                         EU    │
│  Guarda enlaces.            Save links.                Gorde estekak.
│  Comparte colecciones.      Share collections.         Partekatu bildumak.
│  Crea, comparte y           Create, share and          Sortu, partekatu
│  descubre colecciones       discover link              eta aurkitu
│  de enlaces.                collections.               esteka-bildumak.
└──────────────────────────────────────────────────────────────┘
```

- **ES:** «Guarda enlaces. Comparte colecciones.» / «Crea, comparte y descubre colecciones de enlaces.»
- **EN:** «Save links. Share collections.» / «Create, share and discover link collections.»
- **EU:** «Gorde estekak. Partekatu bildumak.» / «Sortu, partekatu eta aurkitu esteka-bildumak.»

> En MVP0, Lotura es el nombre de producto. El código sigue siendo `bookmarknet`. En MVP1, se hace el cambio completo.

## 2. Estructura de navegación

La navegación principal se mantiene estable y poco profunda:

- **Inicio**
- **Inbox**
- **Mis colecciones**
- **Explorar**
- **Red**
- **Importar**
- **Configuración**

La barra lateral identifica siempre la sección actual. La cabecera puede incluir búsqueda global de colecciones, temas y bookmarks. Dentro de una colección o un recurso, el contenido principal conserva el protagonismo; la navegación no debe competir visualmente con él.

## 3. Las 9 pantallas

### 3.1. Inicio

Es una biblioteca de entrada, no una landing promocional. Resume lo más útil para continuar:

- Colecciones destacadas.
- Mis colecciones.
- Temas disponibles.
- Estado resumido de la red P2P.

En MVP0 la pantalla se simplifica a Mis colecciones e Inbox. Las colecciones destacadas, los temas y el resumen de red se incorporan cuando existan fuentes de datos adecuadas.

### 3.2. Inbox

Bandeja de entrada de bookmarks que todavía no se han organizado en una colección. Debe sentirse como una bandeja de correo: una lista limpia, acciones claras y poca decoración.

Cada elemento puede mostrar título, URL y tags. Las acciones principales son mover a una colección, etiquetar, crear una colección y eliminar. Inbox es distinto del grupo raíz de una colección: un bookmark sin grupo dentro de una colección no pertenece al Inbox global.

### 3.3. Mis colecciones

Lista de colecciones propias con nombre, contador de bookmarks, visibilidad y última sincronización. Debe permitir identificar rápidamente qué contiene cada colección y si sus datos están sincronizados.

Incluye una acción visible para crear una colección. Los estados de sincronización deben ser comprensibles y no depender exclusivamente del color.

### 3.4. Colección

Es la pantalla estrella de Lotura. Presenta una colección como una biblioteca temática, no como una lista plana de URLs.

**Cabecera:** nombre, descripción, tags o tema, visibilidad y acciones disponibles. En las fases posteriores incluye **Seguir**, **Duplicar** y **Compartir**.

**Sidebar de métricas P2P:** número de bookmarks, peers, seguidores, copias, última sincronización y estado P2P. Los datos que aún no estén disponibles no deben inventarse ni mostrarse como cifras confirmadas.

**Contenido:** grupos y bookmarks. Los grupos organizan el contenido; los bookmarks se presentan como recursos, con título y URL secundaria cuando sea útil. Los elementos sin grupo aparecen en una sección raíz, no en Inbox.

Seguir y duplicar son operaciones distintas: seguir replica la colección ajena y recibe sus cambios; duplicar crea una copia propia congelada en el momento de la copia.

### 3.5. Bookmark (Resource global)

Esta pantalla representa el **Resource global**, no solo una instancia local de bookmark. Debe explicar qué es el recurso y cómo aparece en la red.

Incluye:

- URL, título, descripción y tags.
- Estadísticas globales cuando existan: colecciones, duplicaciones y guardados.
- Colecciones que incluyen el recurso.
- Recursos relacionados.
- Notas personales del usuario.

Las notas personales siguen siendo privadas/locales. Las métricas globales pertenecen a MVP5; antes de disponer de agregación fiable, la interfaz no debe confundirlas con conteos locales.

### 3.6. Explorar

Pantalla de descubrimiento de colecciones, no un buscador web general ni una tienda de aplicaciones. La colección sigue siendo la entidad principal.

Agrupa contenido por temas y puede mostrar tendencias, colecciones recomendadas y nuevas. Los filtros permiten navegar por tema y ordenar por señales disponibles, como recientes o más replicadas. Debe indicar la procedencia y disponibilidad de cada colección: incluida en el seed pack, descubierta en la red, disponible ahora o sin peers conocidos.

La exploración inicial parte del seed pack y evoluciona hacia colecciones descubiertas vía peers. No depende de recomendaciones de IA.

### 3.7. Red

Vista específica del estado P2P:

- Peers conocidos y conectados.
- Bootstrap peers.
- Colecciones seguidas.
- Colecciones que no tienen peers disponibles.
- Último peer encontrado o última conexión conocida.

La pantalla debe ayudar a entender la disponibilidad real, no convertir la red en un ranking social. Los datos obsoletos deben incluir contexto temporal (por ejemplo, última conexión hace 47 días).

### 3.8. Importar

Punto único para incorporar bibliotecas existentes. La primera fuente soportada es la exportación HTML del navegador. En fases posteriores se añaden Pocket mediante CSV, Raindrop y Linkding.

La UI debe explicar qué archivo o formato espera y comunicar los errores de importación sin perder el contexto. La disponibilidad de cada conector debe reflejar la fase de implementación.

### 3.9. Configuración

Sección de identidad y operación local:

- Identidad criptográfica.
- Dispositivos asociados.
- Bootstrap peers.

En MVP0 la configuración es mínima y no incluye la gestión de dispositivos ni de bootstrap peers. La UI no debe sugerir que existe una cuenta centralizada: la identidad de BookmarkNet se basa en claves.

## 4. Fase de implementación

### MVP0 — Nodo local

- Inicio simplificado: Mis colecciones + Inbox.
- Inbox.
- Mis colecciones.
- Colección, sin métricas P2P ni acciones Seguir/Duplicar/Compartir.
- Bookmark, sin métricas globales.
- Importar, solo desde HTML del navegador.
- Configuración, sin gestión de dispositivos ni bootstrap peers.

### MVP2 — Multidispositivo y compartición directa

- Añadir métricas P2P a la pantalla de colección.
- Incorporar acciones Seguir, Duplicar y Compartir.
- Añadir la Vista de Red.
- Añadir gestión de Dispositivos.
- Añadir configuración de Bootstrap peers.

### MVP4 — Seed pack y exploración inicial

- Añadir Explorar, empezando por las colecciones del seed pack.
- Añadir Temas como forma de navegar las colecciones iniciales.

### MVP5 — Métricas emergentes

- Añadir «Presente en N colecciones» con alcance global estimado.
- Añadir Recursos relacionados mediante co-ocurrencia.
- Añadir estadísticas globales de colecciones, duplicaciones y guardados.

Las métricas globales no deben confundirse con los conteos locales de MVP3 ni presentarse como exactas si son estimaciones distribuidas.

## 5. Wireframes HTML de referencia

Los siguientes bloques son wireframes estáticos inspirados en los diseños originales. Sirven para validar jerarquía, distribución y contenido antes de implementar interacciones o conectar datos reales. Las cifras y nombres de ejemplo son ilustrativos.

### 5.1. Inicio

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lotura — Inicio</title>
  <style>
    body { margin: 0; font: 16px system-ui, sans-serif; background: #f5f6f8; color: #222; }
    .layout { display: flex; min-height: 100vh; }
    aside { width: 220px; padding: 24px 16px; background: #fff; border-right: 1px solid #ddd; }
    nav { display: grid; gap: 8px; margin-top: 24px; }
    nav a { padding: 10px; color: inherit; text-decoration: none; border-radius: 8px; }
    nav a:first-child, nav a:hover { background: #eef2f7; }
    main { flex: 1; padding: 28px; overflow: auto; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
    input { padding: 10px 12px; min-width: 260px; border: 1px solid #ccc; border-radius: 8px; }
    section { margin: 28px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .card { padding: 18px; background: #fff; border: 1px solid #ddd; border-radius: 12px; }
    .meta { color: #667085; font-size: 14px; }
  </style>
</head>
<body>
<div class="layout">
  <aside>
    <strong>LOTURA</strong>
    <nav>
      <a href="#">🏠 Inicio</a><a href="#">📥 Inbox</a>
      <a href="#">📚 Mis colecciones</a><a href="#">🌍 Explorar</a>
      <a href="#">🌐 Red</a><a href="#">📦 Importar</a>
      <a href="#">⚙️ Configuración</a>
    </nav>
  </aside>
  <main>
    <header><h1>Inicio</h1><input placeholder="Buscar colecciones, temas o bookmarks…"></header>
    <section>
      <h2>⭐ Colecciones destacadas</h2>
      <div class="grid">
        <article class="card"><h3>Japón Primera Visita</h3><p>Guías, transporte y planificación.</p><p class="meta">43 bookmarks · 8 peers</p></article>
        <article class="card"><h3>Inversión Indexada</h3><p>ETF y recursos fundamentales.</p><p class="meta">29 bookmarks · 5 peers</p></article>
        <article class="card"><h3>Fotografía Básica</h3><p>Fundamentos para empezar.</p><p class="meta">35 bookmarks · 3 peers</p></article>
      </div>
    </section>
    <section>
      <h2>📚 Mis colecciones</h2>
      <div class="grid">
        <article class="card"><h3>Homelab</h3><p>Selfhosting y herramientas.</p><p class="meta">Última sincronización: hace 2 h</p></article>
        <article class="card"><h3>Proyectos</h3><p>Ideas y documentación.</p><p class="meta">Última sincronización: ayer</p></article>
      </div>
    </section>
    <section><h2>🌍 Temas</h2><p>Viajes · Finanzas · Fotografía · Selfhosting · Educación</p></section>
    <section class="card">
      <h2>🌐 Estado de la red</h2>
      <p>Peers conocidos: 24 · Peers conectados: 7 · Colecciones seguidas: 18</p>
    </section>
  </main>
</div>
</body>
</html>
```

### 5.2. Colección

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lotura — Colección</title>
  <style>
    body { margin: 0; font: 16px system-ui, sans-serif; background: #f5f6f8; color: #222; }
    .wrap { max-width: 1400px; margin: auto; padding: 28px; }
    .panel { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 22px; margin-bottom: 18px; }
    .head { display: flex; justify-content: space-between; gap: 24px; align-items: start; }
    .badges, .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge { background: #eef2f7; border-radius: 14px; padding: 5px 10px; font-size: 13px; }
    button { border: 0; border-radius: 8px; padding: 10px 14px; background: #e5e7eb; }
    button.primary { background: #2563eb; color: white; }
    .columns { display: grid; grid-template-columns: 280px 1fr; gap: 18px; }
    .metric { padding: 12px 0; border-bottom: 1px solid #eee; }
    .bookmark { padding: 14px 0; border-bottom: 1px solid #eee; }
    .url, .muted { color: #667085; font-size: 14px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main class="wrap">
  <header class="panel head">
    <div>
      <h1>Japón Primera Visita</h1>
      <p>Guías, transporte, alojamiento y planificación del viaje.</p>
      <div class="badges"><span class="badge">Pública</span><span class="badge">Viajes</span><span class="badge">Sincronizada</span></div>
    </div>
    <div class="actions"><button class="primary">Seguir</button><button>Duplicar</button><button>Compartir</button></div>
  </header>
  <div class="columns">
    <aside>
      <section class="panel">
        <h2>Estado P2P</h2>
        <div class="metric">84 bookmarks</div><div class="metric">8 peers conocidos</div>
        <div class="metric">12 seguidores</div><div class="metric">6 copias conocidas</div>
        <div class="metric">Última sync: hace 2 h</div><div class="metric">Estado: disponible</div>
      </section>
    </aside>
    <section class="panel">
      <h2>Transporte</h2>
      <article class="bookmark"><strong>JR Pass</strong><div class="url">https://japanrailpass.net</div></article>
      <article class="bookmark"><strong>Navitime</strong><div class="url">https://japantravel.navitime.com</div></article>
      <article class="bookmark"><strong>Hyperdia</strong><div class="url">https://www.hyperdia.com</div></article>
      <h2>Alojamiento</h2>
      <article class="bookmark"><strong>Booking</strong><div class="url">https://www.booking.com</div></article>
      <article class="bookmark"><strong>Agoda</strong><div class="url">https://www.agoda.com</div></article>
      <h2>Gastronomía</h2>
      <article class="bookmark"><strong>Tabelog</strong><div class="url">https://tabelog.com</div></article>
    </section>
  </div>
</main>
</body>
</html>
```

### 5.3. Descubrimiento

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lotura — Descubrir</title>
  <style>
    body { margin: 0; font: 16px system-ui, sans-serif; background: #f5f6f8; color: #222; }
    .layout { display: flex; min-height: 100vh; }
    aside { width: 230px; padding: 22px; background: #fff; border-right: 1px solid #ddd; }
    .filter { margin: 8px 0; padding: 9px; border-radius: 7px; background: #f1f3f5; }
    main { flex: 1; padding: 26px; }
    input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; }
    section { margin-top: 28px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { padding: 18px; background: white; border: 1px solid #ddd; border-radius: 12px; }
    .tag { display: inline-block; margin: 4px 4px 4px 0; padding: 4px 8px; border-radius: 12px; background: #eef2f7; font-size: 12px; }
    .meta { color: #667085; font-size: 14px; }
    button { padding: 9px 12px; border: 0; border-radius: 8px; }
    .primary { color: white; background: #2563eb; }
  </style>
</head>
<body>
<div class="layout">
  <aside>
    <h3>🌍 Temas</h3>
    <div class="filter">Viajes</div><div class="filter">Finanzas</div>
    <div class="filter">Fotografía</div><div class="filter">Selfhosting</div>
    <div class="filter">Educación</div><hr>
    <h3>Ordenar</h3>
    <div class="filter">Más replicadas</div><div class="filter">Recientes</div><div class="filter">Actualizadas</div>
  </aside>
  <main>
    <input placeholder="Buscar colecciones, temas o bookmarks…">
    <section><h2>🔥 Tendencia ahora</h2><div class="grid">
      <article class="card"><h3>Japón Primera Visita</h3><p>Transporte, alojamiento y planificación.</p><span class="tag">viajes</span><span class="tag">japón</span><p class="meta">84 bookmarks · 9 peers activos</p><p><button class="primary">Seguir</button> <button>Vista previa</button></p></article>
      <article class="card"><h3>Inversión Indexada</h3><p>Recursos fundamentales para inversión pasiva.</p><span class="tag">finanzas</span><span class="tag">ETF</span><p class="meta">53 bookmarks</p><button class="primary">Seguir</button></article>
    </div></section>
    <section><h2>⭐ Recomendadas</h2><div class="grid">
      <article class="card"><h3>Awesome Selfhosted</h3><p>Software libre para autoalojamiento.</p><p class="meta">321 bookmarks</p></article>
      <article class="card"><h3>Fotografía para Principiantes</h3><p>Una base sólida para empezar.</p><p class="meta">43 bookmarks</p></article>
    </div></section>
    <section><h2>🆕 Nuevas colecciones</h2><div class="grid">
      <article class="card"><h3>Apicultura Básica</h3><p>Introducción al mundo de las abejas.</p><p class="meta">28 bookmarks · publicada hace 2 días</p></article>
      <article class="card"><h3>Home Assistant Essentials</h3><p>Recursos para domótica doméstica.</p><p class="meta">47 bookmarks · publicada ayer</p></article>
    </div></section>
  </main>
</div>
</body>
</html>
```

### 5.4. Bookmark / Resource

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lotura — Resource</title>
  <style>
    body { margin: 0; font: 16px system-ui, sans-serif; background: #f5f6f8; color: #222; }
    .wrap { max-width: 1300px; margin: auto; padding: 26px; }
    .panel { padding: 22px; margin-bottom: 18px; background: white; border: 1px solid #ddd; border-radius: 12px; }
    .head { display: flex; justify-content: space-between; gap: 24px; }
    .url { color: #667085; overflow-wrap: anywhere; }
    .tag { display: inline-block; margin-right: 5px; padding: 4px 8px; border-radius: 12px; background: #eef2f7; font-size: 12px; }
    button { padding: 10px 14px; border: 0; border-radius: 8px; background: #e5e7eb; }
    .primary { color: white; background: #2563eb; }
    .columns { display: grid; grid-template-columns: 300px 1fr; gap: 18px; }
    .statgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .stat { padding: 12px; border-radius: 8px; background: #f7f8fa; }
    .item { padding: 13px 0; border-bottom: 1px solid #eee; }
    textarea { box-sizing: border-box; width: 100%; height: 110px; padding: 12px; border: 1px solid #ccc; border-radius: 8px; }
  </style>
</head>
<body>
<main class="wrap">
  <header class="panel head">
    <div><h1>Japan Guide</h1><p class="url">https://www.japan-guide.com</p>
      <p>Guía para viajar por Japón: transporte, ciudades, alojamiento y planificación.</p>
      <span class="tag">japan</span><span class="tag">travel</span><span class="tag">planning</span>
    </div>
    <div><button class="primary">Guardar</button> <button>Abrir sitio</button> <button>Compartir</button></div>
  </header>
  <div class="columns">
    <aside>
      <section class="panel"><h2>Estadísticas globales</h2><div class="statgrid">
        <div class="stat"><strong>432</strong><br>colecciones</div>
        <div class="stat"><strong>91</strong><br>duplicaciones</div>
        <div class="stat"><strong>2.381</strong><br>guardados</div>
        <div class="stat"><strong>2019</strong><br>primer registro</div>
      </div></section>
      <section class="panel"><h2>Resource</h2><p><strong>Dominio</strong><br>japan-guide.com</p><p><strong>Resource ID</strong><br>r_7f6a8d…</p><p><strong>Disponibilidad</strong><br>Estado observado por la red</p></section>
    </aside>
    <div>
      <section class="panel"><h2>Colecciones que lo incluyen</h2>
        <div class="item">🇯🇵 Japón Primera Visita <span class="url">· 84 bookmarks</span></div>
        <div class="item">🚅 Japón en Tren <span class="url">· 41 bookmarks</span></div>
        <div class="item">🍜 Japón Foodie <span class="url">· 56 bookmarks</span></div>
      </section>
      <section class="panel"><h2>Recursos relacionados</h2>
        <div class="item">Tokyo Cheapo <span class="url">· guardado frecuentemente junto a este</span></div>
        <div class="item">Inside Kyoto <span class="url">· relacionado en 87 colecciones</span></div>
        <div class="item">JR Pass Guide <span class="url">· relacionado en 76 colecciones</span></div>
        <div class="item">Navitime <span class="url">· relacionado en 61 colecciones</span></div>
      </section>
      <section class="panel"><h2>Mis anotaciones</h2><textarea>Visitar antes de preparar el itinerario. Revisar sección JR Pass.</textarea></section>
    </div>
  </div>
</main>
</body>
</html>
```

Estos wireframes no definen el contrato de API ni implican que todas las métricas estén disponibles desde MVP0. La implementación debe seguir el roadmap y mostrar solo información que el nodo pueda respaldar.
