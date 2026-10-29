import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

interface Response { statusCode: number; body: any }

function request(port: number, path: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, method: 'GET', path,
      headers: { Host: '127.0.0.1:' + port }
    }, (res: any) => {
      let payload = ''
      res.on('data', (chunk: unknown) => {
        payload += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
      })
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: payload ? JSON.parse(payload) : undefined }) }
        catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function post(port: number, path: string, body: unknown): Promise<Response> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = http.request({
      host: '127.0.0.1', port, method: 'POST', path,
      headers: {
        Host: '127.0.0.1:' + port,
        'Content-Type': 'application/json',
        'Content-Length': String(utf8Bytes(payload).length)
      }
    }, (res: any) => {
      let responseBody = ''
      res.on('data', (chunk: unknown) => {
        responseBody += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
      })
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: responseBody ? JSON.parse(responseBody) : undefined }) }
        catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

test('local search API filters bookmarks, collections and groups', async (t) => {
  const dataDir = './tmp-test-search-api'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })
  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config)
    api = await createServer(config, node)

    const noIdentity = await request(api.port, '/api/v1/search?q=jap%C3%B3n')
    t.is(noIdentity.statusCode, 401, 'search without identity returns 401')
    t.is(noIdentity.body.error.code, 'NO_IDENTITY', 'missing identity error is explicit')

    t.is((await post(api.port, '/api/v1/identity/create', {})).statusCode, 201, 'identity is created')
    t.is((await post(api.port, '/api/v1/collections', { name: 'Viajes', description: 'Asia' })).statusCode, 201, 'first collection is created')
    const collectionResponse = await post(api.port, '/api/v1/collections', { name: 'Lecturas', description: 'Libros' })
    t.is(collectionResponse.statusCode, 201, 'second collection is created')
    const collectionId = collectionResponse.body.collection.collection_id
    const tripResponse = await post(api.port, '/api/v1/collections', { name: 'Viajes Japón', description: 'Itinerario' })
    const tripCollectionId = tripResponse.body.collection.collection_id

    const groupResponse = await post(api.port, '/api/v1/groups', { name: 'Asia oriental', collection_id: tripCollectionId })
    t.is(groupResponse.statusCode, 201, 'group is created')
    const groupId = groupResponse.body.group.group_id

    const japan = await post(api.port, '/api/v1/bookmarks', {
      url: 'https://example.com/japon', title: 'Japón', tags: ['vacaciones', 'sakura'], collection_id: tripCollectionId, group_id: groupId
    })
    t.is(japan.statusCode, 201, 'Japan bookmark is created')
    const tokyo = await post(api.port, '/api/v1/bookmarks', {
      url: 'https://example.com/tokio', title: 'Tokio', tags: ['metro'], collection_id: tripCollectionId
    })
    t.is(tokyo.statusCode, 201, 'Tokyo bookmark is created')
    const another = await post(api.port, '/api/v1/bookmarks', {
      url: 'https://example.com/novela', title: 'Novela', tags: ['lectura'], collection_id: collectionId
    })
    t.is(another.statusCode, 201, 'third bookmark is created')

    const byTitle = await request(api.port, '/api/v1/search?q=JAP%C3%93N')
    t.is(byTitle.statusCode, 200, 'title search returns 200')
    t.is(byTitle.body.bookmarks.length, 1, 'title search returns one bookmark')
    t.is(byTitle.body.bookmarks[0].title, 'Japón', 'title matching is case-insensitive')
    t.is(byTitle.body.collections.length, 1, 'collection name also matches the same query')
    t.is(byTitle.body.groups.length, 0, 'unmatched groups are omitted')

    const byCollection = await request(api.port, '/api/v1/search?q=Lecturas')
    t.is(byCollection.statusCode, 200, 'collection search returns 200')
    t.is(byCollection.body.collections.length, 1, 'matching collection is returned')
    t.is(byCollection.body.collections[0].name, 'Lecturas', 'collection name is included')
    t.is(byCollection.body.bookmarks.length, 0, 'nonmatching bookmarks are omitted')

    const byTag = await request(api.port, '/api/v1/search?q=sakura')
    t.is(byTag.statusCode, 200, 'tag search returns 200')
    t.is(byTag.body.bookmarks.length, 1, 'tag match returns bookmark')
    t.is(byTag.body.bookmarks[0].bookmark_id, japan.body.bookmark.bookmark_id, 'tag result identifies correct bookmark')

    const byGroup = await request(api.port, '/api/v1/search?q=oriental')
    t.is(byGroup.body.groups.length, 1, 'matching group is returned')
    t.is(byGroup.body.groups[0].group_id, groupId, 'group result includes group ID')
    t.is(byGroup.body.groups[0].bookmarks_count, 1, 'group bookmark count is calculated')

    const absent = await request(api.port, '/api/v1/search?q=sinresultados')
    t.is(absent.statusCode, 200, 'unknown term returns 200')
    t.alike(absent.body, { collections: [], groups: [], bookmarks: [] }, 'unknown term returns empty categories')
    const missing = await request(api.port, '/api/v1/search')
    t.is(missing.statusCode, 400, 'missing q returns 400')
    t.is(missing.body.error.code, 'INVALID_QUERY', 'missing q error is explicit')
    const empty = await request(api.port, '/api/v1/search?q=%20%20')
    t.is(empty.statusCode, 400, 'blank q returns 400')
    t.is(empty.body.error.code, 'INVALID_QUERY', 'blank q error is explicit')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
