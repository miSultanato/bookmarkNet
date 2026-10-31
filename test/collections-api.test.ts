import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

interface Response { statusCode: number; body: unknown }

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

function collectionBody(response: Response): Record<string, unknown> {
  return (response.body as { collection: Record<string, unknown> }).collection
}

test('collections API supports local collection lifecycle', async (t) => {
  const dataDir = './tmp-test-collections-api'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })
  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)

    const empty = await request(api.port, 'GET', '/api/v1/collections')
    t.is(empty.statusCode, 200, 'empty list returns 200')
    t.alike(empty.body, { collections: [] }, 'empty list has no collections')

    const identity = await request(api.port, 'POST', '/api/v1/identity/create', {})
    t.is(identity.statusCode, 201, 'identity can be created through the API')

    const created = await request(api.port, 'POST', '/api/v1/collections', {
      name: 'Japón 2027', description: 'Viaje', visibility: 'public'
    })
    t.is(created.statusCode, 201, 'create returns 201')
    const collection = collectionBody(created)
    const id = collection.collection_id
    t.is(typeof id === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id), true, 'collection ID is a ULID')
    t.is(collection.name, 'Japón 2027', 'name is returned')
    t.is(collection.description, 'Viaje', 'description is returned')
    t.is(collection.visibility, 'public', 'visibility is returned')
    t.is(collection.language, 'es', 'language defaults to Spanish')
    t.is(typeof collection.created_at, 'string', 'created_at is returned')
    t.is(Object.prototype.hasOwnProperty.call(collection, 'deleted'), false, 'deleted is not exposed')

    t.is((await request(api.port, 'POST', '/api/v1/collections', {})).statusCode, 400, 'missing name returns 400')
    t.is((await request(api.port, 'POST', '/api/v1/collections', { name: 'Inválida', visibility: 'private' })).statusCode, 400, 'invalid visibility returns 400')
    const invalidLanguage = await request(api.port, 'POST', '/api/v1/collections', { name: 'Idioma inválido', language: 'fr' })
    t.is(invalidLanguage.statusCode, 400, 'invalid language returns 400')
    t.alike(invalidLanguage.body, { error: { code: 'INVALID_LANGUAGE', message: 'language must be one of: es, en, eu' } }, 'invalid language error is explicit')

    const english = await request(api.port, 'POST', '/api/v1/collections', { name: 'English', language: 'en' })
    t.is(english.statusCode, 201, 'English collection returns 201')
    t.is(collectionBody(english).language, 'en', 'create accepts English language')
    const englishId = collectionBody(english).collection_id

    const list = await request(api.port, 'GET', '/api/v1/collections')
    t.is(list.statusCode, 200, 'list returns 200')
    const listedCollections = (list.body as { collections: Record<string, unknown>[] }).collections
    t.is(listedCollections.length, 2, 'list contains both collections')
    t.ok(listedCollections.every((item) => typeof item.language === 'string'), 'every listed collection includes language')
    t.is(listedCollections.find((item) => item.collection_id === englishId)?.language, 'en', 'list returns collection language')
    const filtered = await request(api.port, 'GET', '/api/v1/collections?visibility=public')
    t.is((filtered.body as { collections: unknown[] }).collections.length, 2, 'visibility filter returns matching collections')
    t.is((await request(api.port, 'GET', '/api/v1/collections?visibility=private')).statusCode, 400, 'invalid filter returns 400')

    const fetched = await request(api.port, 'GET', '/api/v1/collections/' + id)
    t.is(fetched.statusCode, 200, 'get collection returns 200')
    t.is(collectionBody(fetched).collection_id, id, 'get returns requested collection')
    t.is(collectionBody(fetched).language, 'es', 'get includes language')
    t.is((await request(api.port, 'GET', '/api/v1/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV')).statusCode, 404, 'unknown collection returns 404')

    const renamed = await request(api.port, 'PATCH', '/api/v1/collections/' + id, { name: 'Japón 2027 (v2)' })
    t.is(renamed.statusCode, 200, 'patch returns 200')
    t.is(collectionBody(renamed).name, 'Japón 2027 (v2)', 'patch changes name')
    const translated = await request(api.port, 'PATCH', '/api/v1/collections/' + id, { language: 'eu' })
    t.is(translated.statusCode, 200, 'language patch returns 200')
    t.is(collectionBody(translated).language, 'eu', 'patch changes language')
    const invalidPatchLanguage = await request(api.port, 'PATCH', '/api/v1/collections/' + id, { language: 'fr' })
    t.is(invalidPatchLanguage.statusCode, 400, 'invalid patch language returns 400')
    t.alike(invalidPatchLanguage.body, { error: { code: 'INVALID_LANGUAGE', message: 'language must be one of: es, en, eu' } }, 'invalid patch language error is explicit')
    const cleared = await request(api.port, 'PATCH', '/api/v1/collections/' + id, { description: null })
    t.is(cleared.statusCode, 200, 'null description patch returns 200')
    t.is(Object.prototype.hasOwnProperty.call(collectionBody(cleared), 'description'), false, 'null clears description')
    t.is((await request(api.port, 'PATCH', '/api/v1/collections/' + id, {})).statusCode, 400, 'empty patch returns 400')

    t.is((await request(api.port, 'DELETE', '/api/v1/collections/' + id)).statusCode, 204, 'delete returns 204 without Content-Type')
    t.is((await request(api.port, 'GET', '/api/v1/collections/' + id)).statusCode, 404, 'deleted collection returns 404')
    t.is(((await request(api.port, 'GET', '/api/v1/collections')).body as { collections: unknown[] }).collections.length, 1, 'deleted collection is omitted from list')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('collection writes require an identity', async (t) => {
  const dataDir = './tmp-test-collections-api-no-identity'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })
  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    t.is((await request(api.port, 'POST', '/api/v1/collections', { name: 'Sin identidad' })).statusCode, 401, 'create without identity returns 401')
    t.is((await request(api.port, 'PATCH', '/api/v1/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV', { name: 'No permitido' })).statusCode, 401, 'patch without identity returns 401')
    t.is((await request(api.port, 'DELETE', '/api/v1/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV')).statusCode, 401, 'delete without identity returns 401')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('collection created through the API persists after restarting the node', async (t) => {
  const dataDir = './tmp-test-collections-api-persist'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)

    const identity = await request(api.port, 'POST', '/api/v1/identity/create', {})
    t.is(identity.statusCode, 201, 'identity is created')
    const response = await request(api.port, 'POST', '/api/v1/collections', {
      name: 'Persistencia', description: 'Tras reiniciar', visibility: 'unlisted', language: 'en'
    })
    t.is(response.statusCode, 201, 'collection is created through API')
    const id = collectionBody(response).collection_id

    await api.close()
    api = null
    await node.close()
    node = null

    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)
    const persistedResponse = await request(api.port, 'GET', '/api/v1/collections/' + id)
    t.is(persistedResponse.statusCode, 200, 'collection can be fetched through API after reopening node')
    t.is(collectionBody(persistedResponse).language, 'en', 'language persists across node restart')
    const persisted = node.state.collections.get(id as string)
    t.ok(persisted, 'collection exists after reopening node')
    t.is(persisted?.name, 'Persistencia', 'collection name was restored')
    t.is(persisted?.description, 'Tras reiniciar', 'collection description was restored')
    t.is(persisted?.visibility, 'unlisted', 'collection visibility was restored')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
