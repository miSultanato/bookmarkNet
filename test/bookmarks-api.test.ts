import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { canonicalizeUrl } from '../src/canonicalize.ts'
import { deviceCreateGroup } from '../src/device-events.ts'
import { newGroupId, resourceIdFromCanonicalUrl, utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

interface Response {
  statusCode: number
  body: any
}

function request(port: number, method: string, path: string, body?: unknown): Promise<Response> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const headers: Record<string, string> = { Host: '127.0.0.1:' + port }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = String(utf8Bytes(payload).length)
    }
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res: any) => {
      let responseBody = ''
      res.on('data', (chunk: unknown) => {
        responseBody += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
      })
      res.on('end', () => {
        let parsed: unknown
        if (responseBody.length > 0) {
          try { parsed = JSON.parse(responseBody) } catch (error) { reject(error); return }
        }
        resolve({ statusCode: res.statusCode, body: parsed })
      })
    })
    req.on('error', reject)
    if (payload.length > 0) req.write(payload)
    req.end()
  })
}

function bookmarkBody(response: Response): Record<string, any> {
  return response.body.bookmark as Record<string, any>
}

async function createIdentityAndCollection(port: number, name = 'Bookmarks'): Promise<string> {
  const identity = await request(port, 'POST', '/api/v1/identity/create', {})
  if (identity.statusCode !== 201) throw new Error('Could not create test identity')
  const collection = await request(port, 'POST', '/api/v1/collections', { name })
  if (collection.statusCode !== 201) throw new Error('Could not create test collection')
  return collection.body.collection.collection_id as string
}

test('bookmarks API creates, lists, filters and fetches local bookmarks', async (t) => {
  const dataDir = './tmp-test-bookmarks-api'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config)
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Colección principal')
    const otherCollectionId = (await request(api.port, 'POST', '/api/v1/collections', { name: 'Otra colección' })).body.collection.collection_id as string

    // Workaround until the groups API is implemented: create a group directly in the local device log.
    const groupId = newGroupId()
    await node.apply(deviceCreateGroup({
      authorId: node.identity!.user_id,
      groupId,
      collectionId: otherCollectionId,
      name: 'Grupo de otra colección',
      position: 0
    }))
    const wrongGroup = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/path', collection_id: collectionId, group_id: groupId
    })
    t.is(wrongGroup.statusCode, 400, 'group from another collection is rejected')
    t.is(wrongGroup.body.error.code, 'GROUP_NOT_FOUND', 'wrong group returns GROUP_NOT_FOUND')

    const invalidUrl = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'ftp://example.com/file', collection_id: collectionId
    })
    t.is(invalidUrl.statusCode, 400, 'unsupported URL scheme returns 400')
    t.is(invalidUrl.body.error.code, 'INVALID_URL', 'invalid URL returns INVALID_URL')

    const missingCollection = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/path', collection_id: 'missing-collection'
    })
    t.is(missingCollection.statusCode, 400, 'missing collection returns 400')
    t.is(missingCollection.body.error.code, 'COLLECTION_NOT_FOUND', 'missing collection error is explicit')

    const originalUrl = 'https://example.com/path?utm_source=x'
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: originalUrl,
      collection_id: collectionId,
      title: 'Example',
      tags: ['a', 'b']
    })
    t.is(created.statusCode, 201, 'create returns 201')
    const bookmark = bookmarkBody(created)
    const canonicalUrl = canonicalizeUrl(originalUrl)
    t.is(typeof bookmark.bookmark_id, 'string', 'bookmark_id is returned')
    t.is(bookmark.resource_id, resourceIdFromCanonicalUrl(canonicalUrl), 'resource_id matches canonical URL hash')
    t.is(bookmark.canonical_url, canonicalUrl, 'tracking parameter is removed from canonical URL')
    t.is(bookmark.canonical_url.includes('utm_source'), false, 'canonical URL does not include utm_source')
    t.is(bookmark.title, 'Example', 'title is returned')
    t.alike(bookmark.tags, ['a', 'b'], 'tags are returned')
    t.is(bookmark.collection_id, collectionId, 'collection_id is returned')
    t.is(bookmark.group_id, null, 'bookmark starts in Inbox')
    t.is(bookmark.position, null, 'position is null until reordered')
    t.is(Object.prototype.hasOwnProperty.call(bookmark, 'deleted'), false, 'deleted is not exposed')

    const sameCollectionGroupId = newGroupId()
    await node.apply(deviceCreateGroup({
      authorId: node.identity!.user_id,
      groupId: sameCollectionGroupId,
      collectionId,
      name: 'Grupo de la colección principal',
      position: 0
    }))
    const grouped = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://different.test/grouped',
      collection_id: collectionId,
      title: 'Grouped',
      tags: ['group'],
      group_id: sameCollectionGroupId
    })
    t.is(grouped.statusCode, 201, 'bookmark can be created in a group from its collection')

    const list = await request(api.port, 'GET', '/api/v1/bookmarks')
    t.is(list.statusCode, 200, 'list returns 200')
    t.is(list.body.bookmarks.length, 2, 'list returns both bookmarks')
    t.is(list.body.bookmarks[0].bookmark_id, bookmark.bookmark_id, 'list is ordered by creation time')

    const byCollection = await request(api.port, 'GET', '/api/v1/bookmarks?collection_id=' + collectionId)
    t.is(byCollection.statusCode, 200, 'collection filter returns 200')
    t.is(byCollection.body.bookmarks.length, 2, 'collection filter returns matching bookmarks')
    const byGroup = await request(api.port, 'GET', '/api/v1/bookmarks?group_id=' + sameCollectionGroupId)
    t.is(byGroup.body.bookmarks.length, 1, 'group filter returns matching bookmark')
    t.is(byGroup.body.bookmarks[0].bookmark_id, bookmarkBody(grouped).bookmark_id, 'group filter returns the grouped bookmark')
    const emptyCollection = await request(api.port, 'GET', '/api/v1/bookmarks?collection_id=missing-collection')
    t.is(emptyCollection.body.bookmarks.length, 0, 'unknown collection filter returns no bookmarks')
    const byTag = await request(api.port, 'GET', '/api/v1/bookmarks?tag=a')
    t.is(byTag.body.bookmarks.length, 1, 'tag filter returns matching bookmark')
    t.is((await request(api.port, 'GET', '/api/v1/bookmarks?tag=missing')).body.bookmarks.length, 0, 'tag filter excludes non-matches')
    const byQuery = await request(api.port, 'GET', '/api/v1/bookmarks?q=example')
    t.is(byQuery.body.bookmarks.length, 1, 'case-insensitive text query returns matching bookmark')

    const fetched = await request(api.port, 'GET', '/api/v1/bookmarks/' + bookmark.bookmark_id)
    t.is(fetched.statusCode, 200, 'get by ID returns 200')
    t.is(bookmarkBody(fetched).bookmark_id, bookmark.bookmark_id, 'get by ID returns requested bookmark')
    t.is((await request(api.port, 'GET', '/api/v1/bookmarks/01ARZ3NDEKTSV4RRFFQ69G5FAV')).statusCode, 404, 'unknown bookmark returns 404')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark writes require an identity', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config)
    api = await createServer(config, node)
    const response = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/', collection_id: 'does-not-matter'
    })
    t.is(response.statusCode, 401, 'create without identity returns 401')
    t.is(response.body.error.code, 'NO_IDENTITY', 'missing identity error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark created through API persists after restarting the node', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-persist'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config)
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Persistencia')
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/persist?utm_source=test',
      collection_id: collectionId,
      title: 'Persistente',
      tags: ['persist']
    })
    t.is(created.statusCode, 201, 'bookmark is created through API')
    const bookmarkId = bookmarkBody(created).bookmark_id as string

    await api.close()
    api = null
    await node.close()
    node = null

    node = await startNode(config)
    const persisted = node.state.bookmarks.get(bookmarkId)
    t.ok(persisted, 'bookmark exists after reopening node')
    t.is(persisted?.title, 'Persistente', 'bookmark title was restored')
    t.is(persisted?.canonicalUrl, 'https://example.com/persist', 'canonical URL was restored')
    t.is(persisted?.collectionId, collectionId, 'collection association was restored')
    t.is(persisted?.deleted, false, 'bookmark is active after reopening')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
