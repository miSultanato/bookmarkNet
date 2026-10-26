import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { utf8Bytes } from '../src/ids.ts'

const ROOT = './tmp-test-identity-api'

interface HttpResult {
  status: number
  body: any
}

function request(port: number, path: string, body?: unknown): Promise<HttpResult> {
  const payload = body === undefined ? '' : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
        'Content-Length': String(utf8Bytes(payload).length),
        Connection: 'close'
      }
    }, (res) => {
      let response = ''
      res.on('data', (chunk) => { response += chunk.toString() })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(response) })
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on('error', reject)
    req.end(payload)
  })
}

test('identity export and import API endpoints', async (t) => {
  const sourceDir = ROOT + '/source'
  const targetDir = ROOT + '/target'
  await fs.rm(ROOT, { recursive: true, force: true })
  const sourceConfig = { ...defaultConfig(), dataDir: sourceDir, port: 0, bind: '127.0.0.1' }
  const targetConfig = { ...defaultConfig(), dataDir: targetDir, port: 0, bind: '127.0.0.1' }
  const sourceNode = await startNode(sourceConfig)
  const targetNode = await startNode(targetConfig)
  let sourceApi: Awaited<ReturnType<typeof createServer>> | null = null
  let targetApi: Awaited<ReturnType<typeof createServer>> | null = null

  try {
    sourceApi = await createServer(sourceConfig, sourceNode)
    targetApi = await createServer(targetConfig, targetNode)

    const noIdentity = await request(sourceApi.port, '/api/v1/identity/export', { password: '12345678' })
    t.is(noIdentity.status, 404, 'export without identity returns 404')
    t.is(noIdentity.body.error.code, 'NO_IDENTITY', 'missing identity has a stable error code')

    const shortPassword = await request(sourceApi.port, '/api/v1/identity/export', { password: 'short' })
    t.is(shortPassword.status, 400, 'export with short password returns 400')
    t.is(shortPassword.body.error.code, 'INVALID_PASSWORD', 'short export password is rejected')

    const created = await request(sourceApi.port, '/api/v1/identity/create', {})
    t.is(created.status, 201, 'source identity is created')

    const exported = await request(sourceApi.port, '/api/v1/identity/export', { password: '12345678' })
    t.is(exported.status, 200, 'export returns 200')
    t.is(exported.body.version, 1, 'export response is the identity blob itself')
    t.is(typeof exported.body.salt, 'string', 'export response contains salt')
    t.is(typeof exported.body.ciphertext, 'string', 'export response contains ciphertext')

    const wrongPassword = await request(targetApi.port, '/api/v1/identity/import', {
      password: '87654321',
      identity_blob: exported.body
    })
    t.is(wrongPassword.status, 400, 'import with wrong password returns 400')

    const imported = await request(targetApi.port, '/api/v1/identity/import', {
      password: '12345678',
      identity_blob: exported.body
    })
    t.is(imported.status, 201, 'import restores identity with 201')
    t.is(imported.body.identity.user_id, created.body.user_id, 'imported identity has same user ID')
    t.is(targetNode.identity?.user_id, created.body.user_id, 'node identity updates after import')

    const duplicate = await request(targetApi.port, '/api/v1/identity/import', {
      password: '12345678',
      identity_blob: exported.body
    })
    t.is(duplicate.status, 409, 'import over existing identity returns 409')
    t.is(duplicate.body.error.code, 'IDENTITY_EXISTS', 'existing identity has a stable error code')
  } finally {
    if (sourceApi !== null) await sourceApi.close()
    if (targetApi !== null) await targetApi.close()
    await sourceNode.close()
    await targetNode.close()
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
