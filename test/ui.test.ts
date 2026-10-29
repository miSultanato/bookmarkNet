import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

interface Response {
  statusCode: number
  contentType: string | undefined
  body: string
}

function request(port: number, path: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      method: 'GET',
      path,
      headers: { Host: '127.0.0.1:' + port }
    }, (res: any) => {
      let body = ''
      res.on('data', (chunk: unknown) => {
        body += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
      })
      res.on('end', () => {
        const contentType = res.headers['content-type']
        resolve({
          statusCode: res.statusCode,
          contentType: typeof contentType === 'string' ? contentType : undefined,
          body
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

test('local UI static assets are served safely alongside the API', async (t) => {
  const dataDir = './tmp-test-ui'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config)
    api = await createServer(config, node)

    const index = await request(api.port, '/')
    t.is(index.statusCode, 200, 'root serves the UI')
    t.ok(index.contentType?.startsWith('text/html; charset=utf-8'), 'index has HTML content type')
    t.ok(index.body.includes('<title>Lotura</title>'), 'index contains the Lotura app title')
    t.ok(index.body.includes('href="/assets/favicon.svg" type="image/svg+xml"'), 'index links the SVG favicon')
    const topbar = index.body.split('<header class="topbar">')[1]?.split('</header>')[0] ?? ''
    const sidebar = index.body.split('<aside class="sidebar"')[1]?.split('</aside>')[0] ?? ''
    t.ok(topbar.includes('<a href="#/" class="logo">LOTURA</a>'), 'topbar displays the Lotura wordmark linked to home')
    t.ok(sidebar.includes('<nav class="nav">'), 'sidebar starts with the navigation')
    t.ok(!sidebar.includes('/assets/logo.svg') && !sidebar.includes('Lotura'), 'sidebar has no duplicate logo or wordmark')
    t.ok(index.body.includes('class="sidebar"'), 'index includes the navigation sidebar')
    t.ok(index.body.includes('class="main"'), 'index includes the main layout area')
    t.ok(index.body.includes('Mis colecciones'), 'sidebar includes collections navigation')
    t.ok(index.body.includes('Configuración'), 'sidebar includes settings navigation')

    const favicon = await request(api.port, '/assets/favicon.svg')
    t.is(favicon.statusCode, 200, 'favicon SVG is served')
    t.ok(favicon.contentType?.startsWith('image/svg+xml'), 'favicon has SVG content type')
    t.ok(favicon.body.includes('lotura-gradient'), 'favicon contains the Lotura gradient')

    const logo = await request(api.port, '/assets/logo.svg')
    t.is(logo.statusCode, 200, 'logo SVG is served')
    t.ok(logo.contentType?.startsWith('image/svg+xml'), 'logo has SVG content type')
    t.ok(logo.body.includes('viewBox="0 0 300 300"'), 'logo SVG has a square viewBox')
    t.is((logo.body.match(/<rect /g) ?? []).length, 5, 'logo SVG contains five modules')

    const style = await request(api.port, '/assets/style.css')
    t.is(style.statusCode, 200, 'stylesheet is served')
    t.ok(style.contentType?.startsWith('text/css; charset=utf-8'), 'stylesheet has CSS content type')
    t.ok(style.body.includes(':root'), 'stylesheet contains CSS variables')
    t.ok(style.body.includes('--bg: #f5f6f8'), 'stylesheet uses the MVP0 background')
    t.ok(style.body.includes('width: 240px'), 'stylesheet uses the 240px sidebar')
    t.ok(style.body.includes('.nav { display: flex; flex-direction: column; gap: 10px; }'), 'stylesheet aligns sidebar navigation at the top')
    t.ok(style.body.includes('--bg: #f5f6f8'), 'stylesheet content is served from the generated in-memory bundle')

    const app = await request(api.port, '/assets/app.js')
    t.is(app.statusCode, 200, 'application module in src/ui root is served through the static fallback')
    t.ok(app.contentType?.startsWith('text/javascript; charset=utf-8'), 'application module has JavaScript content type')
    t.ok(app.body.includes("from './api.js'"), 'application module imports the API helper')
    t.ok(app.body.includes('hashchange'), 'application module listens for hash changes')
    t.ok(app.body.includes('updateNavigation'), 'application module updates active sidebar navigation')
    t.ok(app.body.includes("'#/inbox'"), 'application module routes Inbox separately')
    t.ok(app.body.includes("'#/collections'"), 'application module routes collections separately')
    t.ok(app.body.includes("'#/import'"), 'application module routes import separately')
    t.ok(app.body.includes("query.get('tab') === 'collections'"), 'legacy collection tab redirects to collections route')
    t.ok(app.body.includes("navigate(query.get('tab') === 'collections' ? '#/collections' : '#/inbox')"), 'legacy bookmarks routes redirect to Inbox or collections')
    t.ok(app.body.includes("requestedRoute === '#/settings#import'"), 'legacy settings import route redirects to import')

    const welcome = await request(api.port, '/assets/welcome.js')
    t.is(welcome.statusCode, 200, 'marketing welcome module is served')
    t.ok(welcome.contentType?.startsWith('text/javascript; charset=utf-8'), 'welcome module has JavaScript content type')
    t.ok(welcome.body.includes('onStart'), 'welcome module supports the start callback')
    t.ok(welcome.body.includes('Save links.'), 'welcome module includes the English translation')
    t.ok(welcome.body.includes('Gorde estekak.'), 'welcome module includes the Basque translation')

    const apiModule = await request(api.port, '/assets/api.js')
    t.is(apiModule.statusCode, 200, 'API helper module is served')
    t.ok(apiModule.body.includes('fetch('), 'API helper uses fetch')
    t.ok(apiModule.body.includes('/api/v1/identity'), 'API helper calls the identity endpoint')
    t.ok(apiModule.body.includes('getInboxBookmarks'), 'API helper exposes the Inbox request')
    t.ok(apiModule.body.includes('createCollection'), 'API helper exposes collection creation')
    t.ok(apiModule.body.includes('moveBookmark'), 'API helper exposes bookmark moves')
    t.ok(apiModule.body.includes('getCollection'), 'API helper exposes collection retrieval')
    t.ok(apiModule.body.includes('getBookmark'), 'API helper exposes bookmark retrieval')
    t.ok(apiModule.body.includes('updateBookmark'), 'API helper exposes bookmark updates')
    t.ok(apiModule.body.includes('updateCollection'), 'API helper exposes collection updates')
    t.ok(apiModule.body.includes('deleteCollection'), 'API helper exposes collection deletion')
    t.ok(apiModule.body.includes('getCollectionBookmarks'), 'API helper exposes collection bookmark listing')
    t.ok(apiModule.body.includes('createBookmark'), 'API helper exposes bookmark creation')
    t.ok(apiModule.body.includes('deleteBookmark'), 'API helper exposes bookmark deletion')
    t.ok(apiModule.body.includes('getGroups'), 'API helper exposes group listing')
    t.ok(apiModule.body.includes('createGroup'), 'API helper exposes group creation')
    t.ok(apiModule.body.includes('deleteGroup'), 'API helper exposes group deletion')
    t.ok(apiModule.body.includes('getProfile'), 'API helper exposes profile retrieval')
    t.ok(apiModule.body.includes('updateProfile'), 'API helper exposes profile updates')
    t.ok(apiModule.body.includes('getConfig'), 'API helper exposes configuration retrieval')

    const settings = await request(api.port, '/assets/settings.js')
    t.is(settings.statusCode, 200, 'settings module is served')
    t.ok(settings.contentType?.startsWith('text/javascript; charset=utf-8'), 'settings module has JavaScript content type')
    t.ok(settings.body.includes('getProfile'), 'settings module loads profile data')
    t.ok(settings.body.includes('getConfig'), 'settings module loads configuration data')

    const collection = await request(api.port, '/assets/collection.js')
    t.is(collection.statusCode, 200, 'collection module is served')
    t.ok(collection.contentType?.startsWith('text/javascript; charset=utf-8'), 'collection module has JavaScript content type')
    t.ok(collection.body.includes('getCollection'), 'collection module loads a collection')
    t.ok(collection.body.includes('getGroups'), 'collection module loads groups')
    t.ok(collection.body.includes('createGroup'), 'collection module can create groups')
    t.ok(collection.body.includes("element('header', 'collection-header')"), 'collection has a header card')
    t.ok(collection.body.includes("element('aside', 'collection-info')"), 'collection has a local information sidebar')
    t.ok(collection.body.includes('Pública') && collection.body.includes('Privada'), 'collection shows visibility badges')
    t.ok(collection.body.includes('language'), 'collection screen displays and edits the collection language')
    t.ok(collection.body.includes('Editar') && collection.body.includes('Eliminar colección'), 'collection header exposes edit and delete actions')
    t.ok(collection.body.includes('modal-overlay') && collection.body.includes('Añadir bookmark') && collection.body.includes('Crear grupo'), 'collection forms are available in modal overlays')
    t.ok(collection.body.includes('titleInput.maxLength = 200') && collection.body.includes('groupNameInput.maxLength = 100'), 'bookmark titles and group names have character limits')
    t.ok(collection.body.includes('class="group-row"') || collection.body.includes("element('a', 'group-row')"), 'collection lists groups as compact rows')
    t.ok(collection.body.includes("element('h2', '', 'Sin grupo')"), 'ungrouped bookmarks have their own section')
    t.ok(!/peers|seguidores|Seguir|Duplicar|Compartir|métricas P2P/i.test(collection.body), 'collection excludes MVP2+ social and P2P features')


    const bookmark = await request(api.port, '/assets/bookmark.js')
    t.is(bookmark.statusCode, 200, 'bookmark detail module is served')
    t.ok(bookmark.contentType?.startsWith('text/javascript; charset=utf-8'), 'bookmark module has JavaScript content type')
    t.ok(bookmark.body.includes('getBookmark'), 'bookmark module loads a bookmark')
    t.ok(bookmark.body.includes('updateBookmark'), 'bookmark module can update a bookmark')

    const onboarding = await request(api.port, '/assets/onboarding.js')
    t.is(onboarding.statusCode, 200, 'onboarding module is served')
    t.ok(onboarding.body.includes('createIdentity'), 'onboarding module creates an identity')
    t.ok(onboarding.body.includes('importHtml') || onboarding.body.includes('FileReader'), 'onboarding supports HTML bookmark import')

    t.ok(apiModule.body.includes('importHtml'), 'API client exposes importHtml')
    t.ok(apiModule.body.includes('/api/v1/import/html'), 'API client calls the HTML import endpoint')

    const inbox = await request(api.port, '/assets/inbox.js')
    t.is(inbox.statusCode, 200, 'Inbox screen module is served')
    t.ok(inbox.body.includes('state.inboxBookmarks'), 'Inbox screen renders Inbox bookmarks')
    t.ok(inbox.body.includes('moveBookmark'), 'Inbox screen can move bookmarks to a collection')

    const collections = await request(api.port, '/assets/collections.js')
    t.is(collections.statusCode, 200, 'collections screen module is served')
    t.ok(collections.body.includes('createCollection'), 'collections screen can create collections')
    t.ok(collections.body.includes('#/collections/'), 'collections screen links to collection details')
    t.ok(collections.body.includes('collection-count'), 'collections screen shows bookmark counts')
    t.ok(collections.body.includes('language'), 'collections screen supports selecting a language')
    t.ok(collections.body.includes('Español (ES)'), 'collections screen offers Spanish')
    t.ok(collections.body.includes('English (EN)'), 'collections screen offers English')
    t.ok(collections.body.includes('Euskara (EU)'), 'collections screen offers Basque')

    const importScreen = await request(api.port, '/assets/import.js')
    t.is(importScreen.statusCode, 200, 'import screen module is served')
    t.ok(importScreen.body.includes("file"), 'import screen has a file input')
    t.ok(importScreen.body.includes('importHtml'), 'import screen calls the HTML import API')
    t.ok(importScreen.body.includes('FileReader'), 'import screen reads the selected file with FileReader')
    t.ok(importScreen.body.includes('Importados:'), 'import screen displays an import summary')
    t.ok(importScreen.body.includes('Importar otro archivo'), 'import screen allows importing another file')
    t.ok(importScreen.body.includes('import-errors'), 'import screen renders detailed import errors')

    const oldBookmarks = await request(api.port, '/assets/bookmarks.js')
    t.is(oldBookmarks.statusCode, 404, 'legacy bookmarks module is no longer served')

    const missingSvg = await request(api.port, '/assets/no-existe.svg')
    t.is(missingSvg.statusCode, 404, 'unknown generated SVG asset returns 404')

    const missing = await request(api.port, '/assets/nope.css')
    t.is(missing.statusCode, 404, 'missing static asset returns 404')

    const traversal = await request(api.port, '/assets/%2e%2e/src/main.ts')
    t.ok(traversal.statusCode === 400 || traversal.statusCode === 404, 'path traversal is rejected')

    const identity = await request(api.port, '/api/v1/identity')
    t.is(identity.statusCode, 200, 'identity API still returns 200')
    t.ok(identity.body.includes('"identity":null'), 'identity API reports no identity on a fresh node')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
