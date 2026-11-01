import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

interface Response { statusCode: number; body: any }

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

test('profile API requires identity and supports merge, clear and persistence', async (t) => {
  const dataDir = './tmp-test-profile-api'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
    node = await startNode(config, { swarm: createFakeSwarm() })
    api = await createServer(config, node)

    const noIdentity = await request(api.port, 'GET', '/api/v1/profile')
    t.is(noIdentity.statusCode, 401, 'GET profile without identity returns 401')
    t.is(noIdentity.body.error.code, 'NO_IDENTITY', 'missing identity has explicit error')
    const noIdentityPatch = await request(api.port, 'PATCH', '/api/v1/profile', { bio: 'No' })
    t.is(noIdentityPatch.statusCode, 401, 'PATCH profile without identity returns 401')

    const identity = await request(api.port, 'POST', '/api/v1/identity/create', {})
    t.is(identity.statusCode, 201, 'identity is created')
    const empty = await request(api.port, 'GET', '/api/v1/profile')
    t.is(empty.statusCode, 200, 'empty profile returns 200')
    t.alike(empty.body, { profile: {} }, 'empty profile omits absent fields')

    const created = await request(api.port, 'PATCH', '/api/v1/profile', {
      display_name: 'Marta',
      bio: 'Bookmarks de viaje',
      avatar: 'https://example.test/avatar.png'
    })
    t.is(created.statusCode, 200, 'profile patch returns 200')
    t.alike(created.body.profile, {
      display_name: 'Marta',
      bio: 'Bookmarks de viaje',
      avatar: 'https://example.test/avatar.png'
    }, 'API maps profile fields into snake case')

    const merged = await request(api.port, 'PATCH', '/api/v1/profile', { bio: 'Rutas y lecturas' })
    t.is(merged.statusCode, 200, 'partial profile patch returns 200')
    t.alike(merged.body.profile, {
      display_name: 'Marta',
      bio: 'Rutas y lecturas',
      avatar: 'https://example.test/avatar.png'
    }, 'omitted fields are preserved by merge')

    const cleared = await request(api.port, 'PATCH', '/api/v1/profile', { display_name: null, avatar: null })
    t.is(cleared.statusCode, 200, 'null clears profile fields')
    t.alike(cleared.body.profile, { bio: 'Rutas y lecturas' }, 'cleared fields are omitted from response')
    t.is(node.state.profile.displayName, undefined, 'displayName is removed from state')
    t.is(node.state.profile.avatar, undefined, 'avatar is removed from state')
    t.is(node.state.profile.bio, 'Rutas y lecturas', 'remaining bio is kept in state')

    const emptyChanges = await request(api.port, 'PATCH', '/api/v1/profile', {})
    t.is(emptyChanges.statusCode, 400, 'empty patch returns 400')
    t.is(emptyChanges.body.error.code, 'EMPTY_CHANGES', 'empty patch has explicit error')
    const invalid = await request(api.port, 'PATCH', '/api/v1/profile', { bio: 42 })
    t.is(invalid.statusCode, 400, 'non-string field returns 400')
    t.is(invalid.body.error.code, 'INVALID_CHANGE', 'invalid field has explicit error')

    await api.close()
    api = null
    await node.close()
    node = null

    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.identity !== null, true, 'identity is restored after reopening node')
    t.alike(node.state.profile, { bio: 'Rutas y lecturas' }, 'profile changes persist after reopening node')
    api = await createServer(config, node)
    const persisted = await request(api.port, 'GET', '/api/v1/profile')
    t.is(persisted.statusCode, 200, 'persisted profile can be read')
    t.alike(persisted.body.profile, { bio: 'Rutas y lecturas' }, 'persisted profile response matches stored state')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
