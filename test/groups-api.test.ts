import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { utf8Bytes } from '../src/ids.ts'
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

async function createIdentityAndCollection(port: number, name = 'Colección de grupos'): Promise<string> {
  const identity = await request(port, 'POST', '/api/v1/identity/create', {})
  if (identity.statusCode !== 201) throw new Error('Could not create test identity')
  const collection = await request(port, 'POST', '/api/v1/collections', { name })
  if (collection.statusCode !== 201) throw new Error('Could not create test collection')
  return collection.body.collection.collection_id as string
}

test('groups API creates, lists, filters and soft-deletes groups', async (t) => {
  const dataDir = './tmp-test-groups-api'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)

    const empty = await request(api.port, 'GET', '/api/v1/groups')
    t.is(empty.statusCode, 200, 'empty list returns 200')
    t.alike(empty.body.groups, [], 'empty list contains no groups')

    const collectionId = await createIdentityAndCollection(api.port)
    const created = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Transporte',
      collection_id: collectionId
    })
    t.is(created.statusCode, 201, 'group creation returns 201')
    const group = created.body.group as Record<string, any>
    t.ok(/^g_[0-9a-f]{12}$/.test(group.group_id), 'group ID uses g_ format')
    t.is(group.collection_id, collectionId, 'created group belongs to requested collection')
    t.is(group.name, 'Transporte', 'group name is returned')
    t.is(group.position, 0, 'first group position is zero')
    t.ok(typeof group.created_at === 'string' && !Number.isNaN(Date.parse(group.created_at)), 'created_at is returned as a timestamp')
    t.is(Object.prototype.hasOwnProperty.call(group, 'deleted'), false, 'deleted is not exposed')

    const secondInCollection = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Bicicleta',
      collection_id: collectionId
    })
    t.is(secondInCollection.statusCode, 201, 'second group in collection is created')
    t.is(secondInCollection.body.group.position, 1, 'position counts active groups in the same collection')

    const otherCollection = await request(api.port, 'POST', '/api/v1/collections', { name: 'Otra colección' })
    t.is(otherCollection.statusCode, 201, 'second collection is created')
    const otherCollectionId = otherCollection.body.collection.collection_id as string
    const inOtherCollection = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Trabajo',
      collection_id: otherCollectionId
    })
    t.is(inOtherCollection.statusCode, 201, 'group in another collection is created')
    t.is(inOtherCollection.body.group.position, 0, 'position starts at zero for each collection')

    const missingName = await request(api.port, 'POST', '/api/v1/groups', {
      name: '  ',
      collection_id: collectionId
    })
    t.is(missingName.statusCode, 400, 'empty name returns 400')
    t.is(missingName.body.error.code, 'INVALID_NAME', 'empty name has an explicit error')
    const missingCollection = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'No collection',
      collection_id: 'missing-collection'
    })
    t.is(missingCollection.statusCode, 400, 'unknown collection returns 400')
    t.is(missingCollection.body.error.code, 'COLLECTION_NOT_FOUND', 'unknown collection has an explicit error')

    const listed = await request(api.port, 'GET', '/api/v1/groups')
    t.is(listed.statusCode, 200, 'list returns 200')
    t.is(listed.body.groups.length, 3, 'list returns all active groups')
    const filtered = await request(api.port, 'GET', '/api/v1/groups?collection_id=' + collectionId)
    t.is(filtered.statusCode, 200, 'collection filter returns 200')
    t.is(filtered.body.groups.length, 2, 'collection filter returns only matching groups')
    t.is(filtered.body.groups[0].group_id, group.group_id, 'groups are ordered by creation time')
    const unknownFilter = await request(api.port, 'GET', '/api/v1/groups?collection_id=missing-collection')
    t.is(unknownFilter.statusCode, 200, 'unknown collection filter returns 200')
    t.alike(unknownFilter.body.groups, [], 'unknown collection filter returns an empty list')

    const deleted = await request(api.port, 'DELETE', '/api/v1/groups/' + group.group_id)
    t.is(deleted.statusCode, 204, 'DELETE returns 204 without Content-Type')
    t.is(deleted.body, undefined, 'DELETE response has no body')
    t.is(node.state.groups.get(group.group_id)?.deleted, true, 'DELETE marks group as deleted in state')
    const afterDelete = await request(api.port, 'GET', '/api/v1/groups')
    t.is(afterDelete.body.groups.length, 2, 'deleted group is hidden from list')
    t.is((await request(api.port, 'DELETE', '/api/v1/groups/' + group.group_id)).statusCode, 404, 'deleting an already deleted group returns 404')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('group creation and deletion require an identity', async (t) => {
  const dataDir = './tmp-test-groups-api-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const created = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Sin identidad',
      collection_id: 'does-not-matter'
    })
    t.is(created.statusCode, 401, 'POST without identity returns 401')
    t.is(created.body.error.code, 'NO_IDENTITY', 'POST missing identity error is explicit')
    const deleted = await request(api.port, 'DELETE', '/api/v1/groups/g_000000000000')
    t.is(deleted.statusCode, 401, 'DELETE without identity returns 401')
    t.is(deleted.body.error.code, 'NO_IDENTITY', 'DELETE missing identity error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('group created through API persists after restarting the node', async (t) => {
  const dataDir = './tmp-test-groups-api-persist'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Persistencia de grupos')
    const created = await request(api.port, 'POST', '/api/v1/groups', {
      name: 'Persistente',
      collection_id: collectionId
    })
    t.is(created.statusCode, 201, 'group is created through API')
    const groupId = created.body.group.group_id as string

    await api.close()
    api = null
    await node.close()
    node = null

    node = await startNode(config, { swarm: createFakeSwarm() })
    const persisted = node.state.groups.get(groupId)
    t.ok(persisted, 'group exists after reopening node')
    t.is(persisted?.name, 'Persistente', 'group name was restored')
    t.is(persisted?.collectionId, collectionId, 'group collection association was restored')
    t.is(persisted?.deleted, false, 'group is active after reopening')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})


test('groups API moves bookmarks and validates group and collection', async (t) => {
  const dataDir = './tmp-test-groups-api-move'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Mover bookmarks')
    const otherCollection = await request(api.port, 'POST', '/api/v1/collections', { name: 'Otra colección' })
    const otherCollectionId = otherCollection.body.collection.collection_id as string
    const group = await request(api.port, 'POST', '/api/v1/groups', { name: 'Lectura', collection_id: collectionId })
    const otherGroup = await request(api.port, 'POST', '/api/v1/groups', { name: 'Otro grupo', collection_id: otherCollectionId })
    const groupId = group.body.group.group_id as string
    const otherGroupId = otherGroup.body.group.group_id as string
    const bookmarkResponse = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/move',
      collection_id: collectionId,
      title: 'Moverme'
    })
    t.is(bookmarkResponse.statusCode, 201, 'bookmark fixture is created')
    const bookmarkId = bookmarkResponse.body.bookmark.bookmark_id as string

    const moved = await request(api.port, 'POST', '/api/v1/groups/' + groupId + '/move', { bookmark_id: bookmarkId })
    t.is(moved.statusCode, 200, 'moving bookmark returns 200')
    t.is(moved.body.bookmark.group_id, groupId, 'bookmark is assigned to target group')
    t.is(moved.body.bookmark.position, null, 'move resets position to null')
    const missingGroup = await request(api.port, 'POST', '/api/v1/groups/g_000000000000/move', { bookmark_id: bookmarkId })
    t.is(missingGroup.statusCode, 404, 'unknown group returns 404')
    t.is(missingGroup.body.error.code, 'GROUP_NOT_FOUND', 'unknown group has explicit error')
    const missingBookmark = await request(api.port, 'POST', '/api/v1/groups/' + groupId + '/move', { bookmark_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' })
    t.is(missingBookmark.statusCode, 404, 'unknown bookmark returns 404')
    t.is(missingBookmark.body.error.code, 'BOOKMARK_NOT_FOUND', 'unknown bookmark has explicit error')
    const mismatch = await request(api.port, 'POST', '/api/v1/groups/' + otherGroupId + '/move', { bookmark_id: bookmarkId })
    t.is(mismatch.statusCode, 400, 'cross-collection move returns 400')
    t.is(mismatch.body.error.code, 'COLLECTION_MISMATCH', 'cross-collection move has explicit error')

    const globalInboxBookmark = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/global-inbox-move',
      title: 'Inbox global'
    })
    t.is(globalInboxBookmark.statusCode, 201, 'global Inbox bookmark fixture is created')
    const globalInboxMove = await request(api.port, 'POST', '/api/v1/groups/' + groupId + '/move', {
      bookmark_id: globalInboxBookmark.body.bookmark.bookmark_id
    })
    t.is(globalInboxMove.statusCode, 400, 'moving global Inbox bookmark to a collection group returns 400')
    t.is(globalInboxMove.body.error.code, 'COLLECTION_MISMATCH', 'global Inbox move has explicit collection mismatch error')

  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('moving bookmarks requires an identity', async (t) => {
  const dataDir = './tmp-test-groups-api-move-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const response = await request(api.port, 'POST', '/api/v1/groups/g_000000000000/move', { bookmark_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' })
    t.is(response.statusCode, 401, 'move without identity returns 401')
    t.is(response.body.error.code, 'NO_IDENTITY', 'missing identity error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('moving a bookmark persists after restarting the node', async (t) => {
  const dataDir = './tmp-test-groups-api-move-persist'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const collectionId = await createIdentityAndCollection(api.port, 'Persistencia de move')
    const group = await request(api.port, 'POST', '/api/v1/groups', { name: 'Persistente', collection_id: collectionId })
    const groupId = group.body.group.group_id as string
    const created = await request(api.port, 'POST', '/api/v1/bookmarks', {
      url: 'https://example.com/move-persist',
      collection_id: collectionId,
      title: 'Mover y persistir'
    })
    const bookmarkId = created.body.bookmark.bookmark_id as string
    const moved = await request(api.port, 'POST', '/api/v1/groups/' + groupId + '/move', { bookmark_id: bookmarkId })
    t.is(moved.statusCode, 200, 'move succeeds before restart')

    await api.close()
    api = null
    await node.close()
    node = null
    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.state.bookmarks.get(bookmarkId)?.groupId, groupId, 'new groupId is restored after restart')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
