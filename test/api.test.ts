import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

const DATA_DIR = './tmp-test-api'

interface HttpResult {
  status: number
  body: any
  connection: string | undefined
}

function request(port: number, path: string, method = 'GET', headers: Record<string, string> = {}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        Host: `127.0.0.1:${port}`,
        Connection: 'close',
        ...headers
      }
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk.toString() })
      res.on('end', () => {
        let parsed: any
        try {
          parsed = JSON.parse(body)
        } catch {
          parsed = body
        }
        const connection = res.headers['connection']
        resolve({ status: res.statusCode ?? 0, body: parsed, connection: typeof connection === 'string' ? connection : undefined })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

test('local API health, identity routes and request security checks', async (t) => {
  await fs.rm(DATA_DIR, { recursive: true, force: true })
  const config = { ...defaultConfig(), dataDir: DATA_DIR, port: 0, bind: '127.0.0.1' }
  const node = await startNode(config)
  let api: Awaited<ReturnType<typeof createServer>> | null = null

  try {
    api = await createServer(config, node)
    const host = `127.0.0.1:${api.port}`
    const origin = `http://${host}`

    const health = await request(api.port, '/health')
    t.is(health.status, 200, 'health returns 200')
    t.alike(health.body, { status: 'ok' }, 'health response is ok')

    const empty = await request(api.port, '/api/v1/identity')
    t.is(empty.status, 200, 'identity read without identity returns 200')
    t.is(empty.connection?.toLowerCase(), 'close', 'API response disables keep-alive')
    t.alike(empty.body, { identity: null }, 'identity is null before creation')

    const created = await request(api.port, '/api/v1/identity/create', 'POST', {
      Origin: origin,
      'Content-Type': 'application/json'
    })
    t.is(created.status, 201, 'identity creation returns 201')
    t.is(typeof created.body.user_id, 'string', 'creation returns user_id')
    t.ok(node.identity !== null, 'node identity is updated after API creation')
    t.is(node.identity?.user_id, created.body.user_id, 'node identity matches API response')
    t.is(created.body.public_key.startsWith('pk_user_'), true, 'creation returns serialized public key')
    t.alike(created.body.profile, {}, 'creation returns profile')

    const loaded = await request(api.port, '/api/v1/identity')
    t.is(loaded.status, 200, 'identity read after creation returns 200')
    t.ok(loaded.body.identity !== null, 'identity endpoint returns the stored identity')
    t.is(typeof loaded.body.identity.user_id, 'string', 'identity response includes user_id')
    t.is(loaded.body.identity.public_key.startsWith('pk_user_'), true, 'identity response includes public key')
    t.alike(loaded.body.identity.profile, {}, 'identity response includes profile')
    t.is(Object.prototype.hasOwnProperty.call(loaded.body.identity, 'private_key'), false, 'identity response excludes private key')

    const duplicate = await request(api.port, '/api/v1/identity/create', 'POST', {
      Origin: origin,
      'Content-Type': 'application/json'
    })
    t.is(duplicate.status, 409, 'second identity creation returns 409')

    const missing = await request(api.port, '/nope')
    t.is(missing.status, 404, 'unknown route returns 404')

    const noContentType = await request(api.port, '/api/v1/identity/create', 'POST', {
      Origin: origin
    })
    t.is(noContentType.status, 415, 'mutation without JSON content type returns 415')

    const badOrigin = await request(api.port, '/api/v1/identity/create', 'POST', {
      Origin: 'http://evil.example',
      'Content-Type': 'application/json'
    })
    t.is(badOrigin.status, 403, 'origin mismatch returns 403')

    const badHost = await request(api.port, '/health', 'GET', { Host: 'evil.example' })
    t.is(badHost.status, 421, 'unapproved host returns 421')
  } finally {
    if (api !== null) await api.close()
    await node.close()
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})


test('API serves the UI while the node loads and becomes ready after setNode', async (t) => {
  const dataDir = './tmp-test-api-not-ready'
  await fs.rm(dataDir, { recursive: true, force: true })
  const config = { ...defaultConfig(), dataDir, port: 0, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null

  try {
    api = await createServer(config, null)
    const loadingIdentity = await request(api.port, '/api/v1/identity')
    t.is(loadingIdentity.status, 503, 'identity returns 503 while node is loading')
    t.alike(loadingIdentity.body, {
      error: {
        code: 'NOT_READY',
        message: 'El nodo está cargando. Reintenta en unos segundos.'
      }
    }, 'loading response has NOT_READY error')
    const loadingHealth = await request(api.port, '/health')
    t.is(loadingHealth.status, 503, 'health returns 503 while node is loading')
    t.alike(loadingHealth.body, { status: 'loading' }, 'health indicates loading')

    const index = await request(api.port, '/')
    t.is(index.status, 200, 'UI is served while node is loading')
    t.ok(typeof index.body === 'string' && index.body.includes('<title>Lotura</title>'), 'root response contains UI HTML')

    node = await startNode(config)
    api.setNode(node)
    const readyIdentity = await request(api.port, '/api/v1/identity')
    t.is(readyIdentity.status, 200, 'identity returns 200 after setNode')
    t.alike(readyIdentity.body, { identity: null }, 'identity handler works after node is ready')
    const readyHealth = await request(api.port, '/health')
    t.is(readyHealth.status, 200, 'health returns 200 after setNode')
    t.alike(readyHealth.body, { status: 'ok' }, 'health indicates ready')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
