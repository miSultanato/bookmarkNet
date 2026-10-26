import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

interface HttpResult {
  status: number
  body: any
}

function request(port: number, path: string, body?: unknown): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const headers: Record<string, string> = {
      Host: '127.0.0.1:' + port,
      Connection: 'close'
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = String(utf8Bytes(payload).length)
    }
    const req = http.request({
      host: '127.0.0.1',
      port,
      path,
      method: body === undefined ? 'GET' : 'POST',
      headers
    }, (res: any) => {
      let responseBody = ''
      res.on('data', (chunk: unknown) => {
        responseBody += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
      })
      res.on('end', () => {
        let parsed: unknown = {}
        if (responseBody.length > 0) {
          try { parsed = JSON.parse(responseBody) } catch (error) { reject(error); return }
        }
        resolve({ status: res.statusCode ?? 0, body: parsed })
      })
    })
    req.on('error', reject)
    if (payload.length > 0) req.write(payload)
    req.end()
  })
}

const IMPORT_PATH = '/api/v1/import/html'

test('HTML import requires an identity and validates html', async (t) => {
  const dataDir = './tmp-test-import-api-no-identity'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })
  try {
    const config = { ...defaultConfig(), dataDir, port: 0, bind: '127.0.0.1' }
    node = await startNode(config)
    api = await createServer(config, node)

    const noIdentity = await request(api.port, IMPORT_PATH, { html: '<DL></DL>' })
    t.is(noIdentity.status, 401, 'import without identity returns 401')
    t.is(noIdentity.body.error.code, 'NO_IDENTITY', 'missing identity has a stable error code')

    const identity = await request(api.port, '/api/v1/identity/create', {})
    t.is(identity.status, 201, 'identity is created to validate the request body')

    const missingHtml = await request(api.port, IMPORT_PATH, {})
    t.is(missingHtml.status, 400, 'missing html returns 400')
    t.is(missingHtml.body.error.code, 'INVALID_HTML', 'missing html has a stable error code')

    const emptyHtml = await request(api.port, IMPORT_PATH, { html: '' })
    t.is(emptyHtml.status, 400, 'empty html returns 400')
    t.is(emptyHtml.body.error.code, 'INVALID_HTML', 'empty html has a stable error code')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('HTML import rejects request bodies larger than 5 MB', async (t) => {
  const dataDir = './tmp-test-import-api-large-body'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })
  try {
    const config = { ...defaultConfig(), dataDir, port: 0, bind: '127.0.0.1' }
    node = await startNode(config)
    api = await createServer(config, node)
    const identity = await request(api.port, '/api/v1/identity/create', {})
    t.is(identity.status, 201, 'identity is created before oversized import')

    const oversized = await request(api.port, IMPORT_PATH, { html: 'x'.repeat(5 * 1024 * 1024 + 1) })
    t.is(oversized.status, 413, 'oversized request returns 413')
    t.is(oversized.body.error.code, 'PAYLOAD_TOO_LARGE', 'oversized request has a stable error code')
    t.is(oversized.body.error.message, 'El body supera el límite de 5 MB', 'oversized request explains the limit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('HTML import maps bookmarks, collections and nested folders and persists state', async (t) => {
  const dataDir = './tmp-test-import-api'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })
  try {
    const config = { ...defaultConfig(), dataDir, port: 0, bind: '127.0.0.1' }
    node = await startNode(config)
    api = await createServer(config, node)

    const identity = await request(api.port, '/api/v1/identity/create', {})
    t.is(identity.status, 201, 'identity is created before importing')
    t.ok(node.identity !== null, 'node has the created identity')

    const rootHtml = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://example.com/root">Root bookmark</A></DL>'
    const root = await request(api.port, IMPORT_PATH, { html: rootHtml })
    t.is(root.status, 200, 'root bookmark import returns 200')
    t.alike(root.body, {
      imported: { collections: 0, groups: 0, bookmarks: 1 },
      skipped: 0,
      errors: []
    }, 'root bookmark summary is correct')
    const rootBookmark = [...node.state.bookmarks.values()].find((bookmark) => bookmark.canonicalUrl === 'https://example.com/root')
    t.ok(rootBookmark, 'root bookmark is in state')
    t.is(rootBookmark?.collectionId, null, 'root bookmark belongs to global Inbox')
    t.is(rootBookmark?.groupId, null, 'root bookmark has no group')

    const collectionHtml = '<DL><p><DT><H3>Viajes</H3><DL><p><DT><A HREF="https://example.com/paris">París</A><DT><A HREF="https://example.com/rome">Roma</A></DL></DL>'
    const collectionResult = await request(api.port, IMPORT_PATH, { html: collectionHtml })
    t.is(collectionResult.status, 200, 'folder import returns 200')
    t.alike(collectionResult.body, {
      imported: { collections: 1, groups: 0, bookmarks: 2 },
      skipped: 0,
      errors: []
    }, 'folder import summary is correct')
    const travelCollection = [...node.state.collections.values()].find((collection) => !collection.deleted && collection.name === 'Viajes')
    t.ok(travelCollection, 'Viajes collection exists')
    const travelBookmarks = [...node.state.bookmarks.values()].filter((bookmark) =>
      !bookmark.deleted && bookmark.collectionId === travelCollection?.collectionId
    )
    t.is(travelBookmarks.length, 2, 'both bookmarks are in Viajes')
    t.ok(travelBookmarks.every((bookmark) => bookmark.groupId === null), 'collection-level bookmarks have no group')

    const nestedHtml = '<DL><p><DT><H3>Viajes</H3><DL><p><DT><H3>Japón</H3><DL><p><DT><A HREF="https://example.com/tokyo">Tokio</A><DT><H3>Montaña</H3><DL><p><DT><H3>Nieve</H3><DL><p><DT><A HREF="https://example.com/snow">Nieve</A></DL></DL></DL></DL></DL>'
    const nested = await request(api.port, IMPORT_PATH, { html: nestedHtml })
    t.is(nested.status, 200, 'nested folder import returns 200')
    t.alike(nested.body, {
      imported: { collections: 1, groups: 3, bookmarks: 2 },
      skipped: 0,
      errors: []
    }, 'nested import summary includes flattened groups')
    const importedCollection = [...node.state.collections.values()].find((collection) => !collection.deleted && collection.name === 'Viajes (importado)')
    t.ok(importedCollection, 'duplicate collection uses imported suffix')
    const importedGroups = [...node.state.groups.values()].filter((group) =>
      !group.deleted && group.collectionId === importedCollection?.collectionId
    )
    t.ok(importedGroups.some((group) => group.name === 'Japón'), 'level-two folder becomes a group')
    t.ok(importedGroups.some((group) => group.name === 'Japón/Montaña'), 'level-three folder is flattened into path')
    t.ok(importedGroups.some((group) => group.name === 'Japón/Montaña/Nieve'), 'deeper folder is flattened into full path')
    const tokyo = [...node.state.bookmarks.values()].find((bookmark) => bookmark.canonicalUrl === 'https://example.com/tokyo')
    const snow = [...node.state.bookmarks.values()].find((bookmark) => bookmark.canonicalUrl === 'https://example.com/snow')
    const japanGroup = importedGroups.find((group) => group.name === 'Japón')
    const snowGroup = importedGroups.find((group) => group.name === 'Japón/Montaña/Nieve')
    t.is(tokyo?.collectionId, importedCollection?.collectionId, 'nested bookmark belongs to imported collection')
    t.is(tokyo?.groupId, japanGroup?.groupId, 'level-two bookmark belongs to its group')
    t.is(snow?.groupId, snowGroup?.groupId, 'deep bookmark belongs to the flattened path group')

    const invalidAndValid = await request(api.port, IMPORT_PATH, {
      html: '<DL><p><DT><A HREF="javascript:alert(1)">Invalid</A><DT><A HREF="https://example.com/valid">Valid</A></DL>'
    })
    t.is(invalidAndValid.status, 200, 'invalid URL is handled as best effort')
    t.alike(invalidAndValid.body, {
      imported: { collections: 0, groups: 0, bookmarks: 1 },
      skipped: 1,
      errors: [{ url: 'javascript:alert(1)', reason: 'invalid URL' }]
    }, 'invalid URL is skipped and reported while valid bookmark imports')

    const malformed = await request(api.port, IMPORT_PATH, { html: '<html><body>not a bookmark export</body></html>' })
    t.is(malformed.status, 200, 'HTML without DL is treated as an empty tree')
    t.alike(malformed.body, {
      imported: { collections: 0, groups: 0, bookmarks: 0 },
      skipped: 0,
      errors: []
    }, 'empty parser tree has a zero summary')

    const savedCollectionId = importedCollection?.collectionId
    const savedGroupId = snowGroup?.groupId
    await api.close()
    api = null
    await node.close()
    node = null

    node = await startNode(config)
    t.ok(node.state.collections.get(savedCollectionId as string), 'collection survives node restart')
    t.ok(node.state.groups.get(savedGroupId as string), 'group survives node restart')
    t.ok([...node.state.bookmarks.values()].some((bookmark) => bookmark.canonicalUrl === 'https://example.com/snow'), 'bookmark survives node restart')
    t.ok([...node.state.bookmarks.values()].some((bookmark) => bookmark.canonicalUrl === 'https://example.com/root' && bookmark.collectionId === null), 'Inbox bookmark survives node restart')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
