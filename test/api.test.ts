import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'

const DATA_DIR = './tmp-test-api'

interface HttpResult {
  status: number
  body: any
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
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) })
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

test('local API health, identity routes and request security checks', async (t) => {
  await fs.rm(DATA_DIR, { recursive: true, force: true })
  const config = { ...defaultConfig(), dataDir: DATA_DIR, port: 0, bind: '127.0.0.1' }
  const api = await createServer(config, DATA_DIR)
  const host = `127.0.0.1:${api.port}`
  const origin = `http://${host}`

  try {
    const health = await request(api.port, '/health')
    t.is(health.status, 200, 'health returns 200')
    t.alike(health.body, { status: 'ok' }, 'health response is ok')

    const empty = await request(api.port, '/api/v1/identity')
    t.is(empty.status, 200, 'identity read without identity returns 200')
    t.alike(empty.body, { identity: null }, 'identity is null before creation')

    const created = await request(api.port, '/api/v1/identity/create', 'POST', {
      Origin: origin,
      'Content-Type': 'application/json'
    })
    t.is(created.status, 201, 'identity creation returns 201')
    t.is(typeof created.body.user_id, 'string', 'creation returns user_id')
    t.is(created.body.public_key.startsWith('pk_user_'), true, 'creation returns serialized public key')
    t.alike(created.body.profile, {}, 'creation returns profile')

    const loaded = await request(api.port, '/api/v1/identity')
    t.is(loaded.status, 200, 'identity read after creation returns 200')
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
    await api.close()
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})
