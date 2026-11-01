import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { canonicalizeUrl } from '../src/canonicalize.ts'
import { resourceIdFromCanonicalUrl, utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

interface Response {
  statusCode: number
  body: any
}

function request(port: number, method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const headers: Record<string, string> = { Host: '127.0.0.1:' + port }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = String(utf8Bytes(payload).length)
    }
    Object.assign(headers, extraHeaders)
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
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Colección principal')
    const otherCollectionId = (await request(api.port, 'POST', '/api/v1/collections', { name: 'Otra colección' })).body.collection.collection_id as string

    const otherGroupResponse = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Grupo de otra colección',
      collection_id: otherCollectionId
    })
    t.is(otherGroupResponse.statusCode, 201, 'group in another collection is created through API')
    const groupId = otherGroupResponse.body.group.group_id as string
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

    const sameCollectionGroupResponse = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Grupo de la colección principal',
      collection_id: collectionId
    })
    t.is(sameCollectionGroupResponse.statusCode, 201, 'group in the same collection is created through API')
    const sameCollectionGroupId = sameCollectionGroupResponse.body.group.group_id as string
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

    const globalInbox = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/global-inbox-implicit',
      title: 'Inbox global implícito'
    })
    t.is(globalInbox.statusCode, 201, 'bookmark without collection_id is created in global Inbox')
    t.is(bookmarkBody(globalInbox).collection_id, null, 'implicit global Inbox has collection_id null')
    t.is(bookmarkBody(globalInbox).group_id, null, 'implicit global Inbox has group_id null')

    const explicitGlobalInbox = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/global-inbox-explicit',
      collection_id: null,
      title: 'Inbox global explícito'
    })
    t.is(explicitGlobalInbox.statusCode, 201, 'bookmark with collection_id null is created')
    t.is(bookmarkBody(explicitGlobalInbox).collection_id, null, 'explicit global Inbox has collection_id null')

    const invalidGlobalGroup = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/global-inbox-group',
      collection_id: null,
      group_id: sameCollectionGroupId
    })
    t.is(invalidGlobalGroup.statusCode, 400, 'global Inbox cannot contain a group')
    t.is(invalidGlobalGroup.body.error.code, 'INVALID_GROUP_FOR_INBOX', 'global Inbox group error is explicit')

    const inboxList = await request(api.port, 'GET', '/api/v1/bookmarks?inbox=true')
    t.is(inboxList.statusCode, 200, 'global Inbox filter returns 200')
    t.is(inboxList.body.bookmarks.length, 2, 'global Inbox filter returns only global Inbox bookmarks')
    t.ok(inboxList.body.bookmarks.every((item: Record<string, any>) => item.collection_id === null), 'Inbox filter excludes collection bookmarks')
    const invalidInboxQuery = await request(api.port, 'GET', '/api/v1/bookmarks?inbox=true&collection_id=' + collectionId)
    t.is(invalidInboxQuery.statusCode, 400, 'Inbox and collection filters cannot be combined')
    t.is(invalidInboxQuery.body.error.code, 'INVALID_QUERY', 'mutually exclusive filters return INVALID_QUERY')

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

test('bookmark move endpoint handles Inbox, collections and groups', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-move'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Destino')
    const otherCollectionResponse = await request(api.port, 'POST', '/api/v1/collections', { name: 'Otra colección' })
    const otherCollectionId = otherCollectionResponse.body.collection.collection_id as string
    const groupResponse = await request(api.port, 'POST', '/api/v1/groups', { name: 'Grupo destino', collection_id: collectionId })
    const groupId = groupResponse.body.group.group_id as string

    const global = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/move-global', title: 'Desde Inbox'
    })
    t.is(global.statusCode, 201, 'global Inbox bookmark is created')
    const globalId = bookmarkBody(global).bookmark_id as string
    const intoCollection = await request(api.port, 'POST', '/api/v1/bookmarks/' + globalId + '/move', {
      collection_id: collectionId, group_id: null
    })
    t.is(intoCollection.statusCode, 200, 'moving from global Inbox to a collection returns 200')
    t.is(bookmarkBody(intoCollection).collection_id, collectionId, 'target collection is applied')
    t.is(bookmarkBody(intoCollection).group_id, null, 'bookmark remains in collection Inbox')
    t.is(bookmarkBody(intoCollection).position, null, 'collection move resets position')

    const toGroup = await request(api.port, 'POST', '/api/v1/bookmarks/' + globalId + '/move', { group_id: groupId })
    t.is(toGroup.statusCode, 200, 'moving to a group returns 200')
    t.is(bookmarkBody(toGroup).collection_id, collectionId, 'group move keeps collection unchanged')
    t.is(bookmarkBody(toGroup).group_id, groupId, 'group move applies target group')
    t.is(bookmarkBody(toGroup).position, null, 'group move resets position')

    const toGlobalInbox = await request(api.port, 'POST', '/api/v1/bookmarks/' + globalId + '/move', { collection_id: null })
    t.is(toGlobalInbox.statusCode, 200, 'moving to global Inbox returns 200')
    t.is(bookmarkBody(toGlobalInbox).collection_id, null, 'global Inbox move clears collection')
    t.is(bookmarkBody(toGlobalInbox).group_id, null, 'global Inbox move clears group')

    const emptyMove = await request(api.port, 'POST', '/api/v1/bookmarks/' + globalId + '/move', {})
    t.is(emptyMove.statusCode, 400, 'empty move is rejected')
    t.is(emptyMove.body.error.code, 'EMPTY_MOVE', 'empty move returns EMPTY_MOVE')

    const invalidInboxGroup = await request(api.port, 'POST', '/api/v1/bookmarks/' + globalId + '/move', {
      collection_id: null, group_id: groupId
    })
    t.is(invalidInboxGroup.statusCode, 400, 'global Inbox cannot target a group')
    t.is(invalidInboxGroup.body.error.code, 'INVALID_GROUP_FOR_INBOX', 'invalid Inbox group returns explicit error')

    const mismatch = await request(api.port, 'POST', '/api/v1/bookmarks/' + globalId + '/move', {
      collection_id: otherCollectionId, group_id: groupId
    })
    t.is(mismatch.statusCode, 400, 'group from another collection is rejected')
    t.is(mismatch.body.error.code, 'GROUP_NOT_FOUND', 'cross-collection group returns GROUP_NOT_FOUND')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark move requires an identity', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-move-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const response = await request(api.port, 'POST', '/api/v1/bookmarks/01ARZ3NDEKTSV4RRFFQ69G5FAV/move', { collection_id: null })
    t.is(response.statusCode, 401, 'move without identity returns 401')
    t.is(response.body.error.code, 'NO_IDENTITY', 'missing identity error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark move persists after restarting the node', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-move-persist'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Persistencia move')
    const otherCollection = await request(api.port, 'POST', '/api/v1/collections', { name: 'Colección destino' })
    const targetCollectionId = otherCollection.body.collection.collection_id as string
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/move-persist', collection_id: collectionId, title: 'Persistir move'
    })
    const bookmarkId = bookmarkBody(created).bookmark_id as string
    const moved = await request(api.port, 'POST', '/api/v1/bookmarks/' + bookmarkId + '/move', {
      collection_id: targetCollectionId
    })
    t.is(moved.statusCode, 200, 'move succeeds before restart')

    await api.close()
    api = null
    await node.close()
    node = null
    node = await startNode(config, { swarm: createFakeSwarm() })
    const persisted = node.state.bookmarks.get(bookmarkId)
    t.is(persisted?.collectionId, targetCollectionId, 'target collection is restored after restart')
    t.is(persisted?.groupId, null, 'group is restored as null after restart')
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
    node = await startNode(config, { swarm: createFakeSwarm() })
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
    node = await startNode(config, { swarm: createFakeSwarm() })
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

    node = await startNode(config, { swarm: createFakeSwarm() })
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


test('bookmark PATCH and DELETE endpoints validate changes and soft-delete', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-patch-delete'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'PATCH y DELETE')
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/edit',
      collection_id: collectionId,
      title: 'Original',
      description: 'Descripción inicial',
      tags: ['uno', 'dos'],
      notes: 'Notas iniciales'
    })
    t.is(created.statusCode, 201, 'bookmark fixture created')
    const id = bookmarkBody(created).bookmark_id as string
    const path = '/api/v1/bookmarks/' + id

    const changed = await request(api.port, 'PATCH', path, { title: 'Nuevo título' })
    t.is(changed.statusCode, 200, 'PATCH title returns 200')
    t.is(bookmarkBody(changed).title, 'Nuevo título', 'title is updated')
    t.is(bookmarkBody(changed).canonical_url, 'https://example.com/edit', 'canonical URL remains unchanged')
    t.is(bookmarkBody(changed).collection_id, collectionId, 'collection remains unchanged')
    t.alike(bookmarkBody(changed).tags, ['uno', 'dos'], 'tags remain unchanged')
    t.is(bookmarkBody(changed).description, 'Descripción inicial', 'description remains unchanged')

    const noDescription = await request(api.port, 'PATCH', path, { description: null })
    t.is(noDescription.statusCode, 200, 'description null returns 200')
    t.is(Object.prototype.hasOwnProperty.call(bookmarkBody(noDescription), 'description'), false, 'description null removes field')
    const noNotes = await request(api.port, 'PATCH', path, { notes: null })
    t.is(noNotes.statusCode, 200, 'notes null returns 200')
    t.is(Object.prototype.hasOwnProperty.call(bookmarkBody(noNotes), 'notes'), false, 'notes null removes field')

    const emptyTags = await request(api.port, 'PATCH', path, { tags: [] })
    t.is(emptyTags.statusCode, 200, 'empty tags array is accepted')
    t.alike(bookmarkBody(emptyTags).tags, [], 'tags can be cleared with an empty array')
    const emptyTitle = await request(api.port, 'PATCH', path, { title: '' })
    t.is(emptyTitle.statusCode, 200, 'empty title is accepted')
    t.is(bookmarkBody(emptyTitle).title, '', 'empty title is preserved')

    const nullTitle = await request(api.port, 'PATCH', path, { title: null })
    t.is(nullTitle.statusCode, 400, 'null title is rejected')
    t.is(nullTitle.body.error.code, 'INVALID_CHANGE', 'null title returns INVALID_CHANGE')
    t.is(nullTitle.body.error.message, 'title cannot be null', 'null title error explains the rule')
    const nullTags = await request(api.port, 'PATCH', path, { tags: null })
    t.is(nullTags.statusCode, 400, 'null tags are rejected')
    t.is(nullTags.body.error.code, 'INVALID_CHANGE', 'null tags returns INVALID_CHANGE')
    t.is(nullTags.body.error.message, 'tags cannot be null', 'null tags error explains the rule')
    const emptyChanges = await request(api.port, 'PATCH', path, {})
    t.is(emptyChanges.statusCode, 400, 'empty patch is rejected')
    t.is(emptyChanges.body.error.code, 'EMPTY_CHANGES', 'empty patch returns EMPTY_CHANGES')

    const missing = await request(api.port, 'PATCH', '/api/v1/bookmarks/01ARZ3NDEKTSV4RRFFQ69G5FAV', { title: 'Missing' })
    t.is(missing.statusCode, 404, 'PATCH unknown bookmark returns 404')
    const badOrigin = await request(api.port, 'PATCH', path, { title: 'No debe aplicarse' }, { Origin: 'http://evil.test' })
    t.is(badOrigin.statusCode, 403, 'PATCH rejects Origin that does not match Host')
    t.is(bookmarkBody(await request(api.port, 'GET', path)).title, '', 'rejected Origin does not mutate bookmark')

    const removed = await request(api.port, 'DELETE', path)
    t.is(removed.statusCode, 204, 'DELETE returns 204 without Content-Type or body')
    t.is(removed.body, undefined, 'DELETE response has no body')
    t.is((await request(api.port, 'GET', path)).statusCode, 404, 'deleted bookmark is hidden from GET')
    t.is((await request(api.port, 'DELETE', path)).statusCode, 404, 'second DELETE returns 404')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark PATCH and DELETE require an identity', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-mutations-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
    const patched = await request(api.port, 'PATCH', '/api/v1/bookmarks/' + id, { title: 'Sin identidad' })
    t.is(patched.statusCode, 401, 'PATCH without identity returns 401')
    t.is(patched.body.error.code, 'NO_IDENTITY', 'PATCH missing identity error is explicit')
    const deleted = await request(api.port, 'DELETE', '/api/v1/bookmarks/' + id)
    t.is(deleted.statusCode, 401, 'DELETE without identity returns 401')
    t.is(deleted.body.error.code, 'NO_IDENTITY', 'DELETE missing identity error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark PATCH changes persist after restarting the node', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-patch-persist'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Persistencia PATCH')
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/persist-patch',
      collection_id: collectionId,
      title: 'Antes'
    })
    t.is(created.statusCode, 201, 'bookmark created through API')
    const id = bookmarkBody(created).bookmark_id as string
    const patched = await request(api.port, 'PATCH', '/api/v1/bookmarks/' + id, { title: 'Título persistido' })
    t.is(patched.statusCode, 200, 'PATCH succeeds before restart')

    await api.close()
    api = null
    await node.close()
    node = null
    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.state.bookmarks.get(id)?.title, 'Título persistido', 'updated title is restored from the device log')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})


test('bookmark reorder endpoint validates group and position and materializes order', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-reorder'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Reorder')
    const group1 = await request(api.port, 'POST', '/api/v1/groups', { name: 'Primero', collection_id: collectionId })
    const group2 = await request(api.port, 'POST', '/api/v1/groups', { name: 'Segundo', collection_id: collectionId })
    const groupId = group1.body.group.group_id as string
    const otherGroupId = group2.body.group.group_id as string

    const makeBookmark = async (suffix: string, group_id: string) => {
      const response = await request(api.port, 'POST', '/api/v1/bookmarks', {
        url: 'https://example.com/reorder-' + suffix,
        collection_id: collectionId,
        title: suffix,
        group_id
      })
      t.is(response.statusCode, 201, 'bookmark ' + suffix + ' is created in group')
      return bookmarkBody(response).bookmark_id as string
    }
    const firstId = await makeBookmark('first', groupId)
    const secondId = await makeBookmark('second', groupId)
    const thirdId = await makeBookmark('third', groupId)
    const elsewhereId = await makeBookmark('elsewhere', otherGroupId)

    const reordered = await request(api.port, 'POST', '/api/v1/bookmarks/' + thirdId + '/reorder', {
      group_id: groupId, position: 0
    })
    t.is(reordered.statusCode, 200, 'reorder returns 200')
    t.is(bookmarkBody(reordered).position, 0, 'bookmark position is updated')
    t.is(node.state.bookmarks.get(thirdId)?.position, 0, 'fold materializes requested position')
    const tooLarge = await request(api.port, 'POST', '/api/v1/bookmarks/' + firstId + '/reorder', {
      group_id: groupId, position: 999
    })
    t.is(tooLarge.statusCode, 200, 'position beyond group size is accepted')
    t.is(bookmarkBody(tooLarge).position, 2, 'position beyond group size moves bookmark to end')
    const wrongGroup = await request(api.port, 'POST', '/api/v1/bookmarks/' + firstId + '/reorder', {
      group_id: otherGroupId, position: 0
    })
    t.is(wrongGroup.statusCode, 400, 'reorder in another group is rejected')
    t.is(wrongGroup.body.error.code, 'INVALID_GROUP', 'wrong group returns INVALID_GROUP')
    t.is(wrongGroup.body.error.message, 'bookmark is not in the given group', 'wrong group explains the constraint')
    const negative = await request(api.port, 'POST', '/api/v1/bookmarks/' + secondId + '/reorder', {
      group_id: groupId, position: -1
    })
    t.is(negative.statusCode, 400, 'negative position is rejected')
    t.is(negative.body.error.code, 'INVALID_POSITION', 'negative position returns INVALID_POSITION')
    const missingGroup = await request(api.port, 'POST', '/api/v1/bookmarks/' + secondId + '/reorder', {
      group_id: 'g_000000000000', position: 0
    })
    t.is(missingGroup.statusCode, 400, 'unknown group is rejected')
    t.is(missingGroup.body.error.code, 'GROUP_NOT_FOUND', 'unknown group returns GROUP_NOT_FOUND')
    t.ok(elsewhereId.length > 0, 'second group fixture remains available')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark reorder requires an identity', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-reorder-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const response = await request(api.port, 'POST', '/api/v1/bookmarks/01ARZ3NDEKTSV4RRFFQ69G5FAV/reorder', {
      group_id: null, position: 0
    })
    t.is(response.statusCode, 401, 'reorder without identity returns 401')
    t.is(response.body.error.code, 'NO_IDENTITY', 'missing identity error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('bookmark reorder persists after restarting the node', async (t) => {
  const dataDir = './tmp-test-bookmarks-api-reorder-persist'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Persistencia reorder')
    const group = await request(api.port, 'POST', '/api/v1/groups', { name: 'Orden', collection_id: collectionId })
    const groupId = group.body.group.group_id as string
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/reorder-persist',
      collection_id: collectionId,
      title: 'Persistir orden',
      group_id: groupId
    })
    const bookmarkId = bookmarkBody(created).bookmark_id as string
    const reordered = await request(api.port, 'POST', '/api/v1/bookmarks/' + bookmarkId + '/reorder', {
      group_id: groupId, position: 0
    })
    t.is(reordered.statusCode, 200, 'reorder succeeds before restart')

    await api.close()
    api = null
    await node.close()
    node = null
    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.state.bookmarks.get(bookmarkId)?.position, 0, 'position is restored after restart')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
