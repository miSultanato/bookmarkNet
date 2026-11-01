import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { utf8Bytes } from '../src/ids.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

const ROOT = './tmp-test-identity-recovery-api'

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

test('identity recovery API generates, validates and imports a 24-word BIP39 phrase', async (t) => {
  const sourceDir = ROOT + '/source'
  const targetDir = ROOT + '/target'
  await fs.rm(ROOT, { recursive: true, force: true })
  const sourceConfig = { ...defaultConfig(), dataDir: sourceDir, port: 0, bind: '127.0.0.1' }
  const targetConfig = { ...defaultConfig(), dataDir: targetDir, port: 0, bind: '127.0.0.1' }
  const sourceNode = await startNode(sourceConfig, { swarm: createFakeSwarm() })
  const targetNode = await startNode(targetConfig, { swarm: createFakeSwarm() })
  let sourceApi: Awaited<ReturnType<typeof createServer>> | null = null
  let targetApi: Awaited<ReturnType<typeof createServer>> | null = null

  try {
    sourceApi = await createServer(sourceConfig, sourceNode)
    targetApi = await createServer(targetConfig, targetNode)

    const missingIdentity = await request(sourceApi.port, '/api/v1/identity/recovery/generate')
    t.is(missingIdentity.status, 404, 'generate without an identity returns 404')

    const created = await request(sourceApi.port, '/api/v1/identity/create', {})
    t.is(created.status, 201, 'source identity is created')

    const generated = await request(sourceApi.port, '/api/v1/identity/recovery/generate', {})
    t.is(generated.status, 200, 'recovery phrase generation returns 200')
    t.is(Array.isArray(generated.body.words), true, 'response contains the word array')
    t.is(generated.body.words.length, 24, 'response contains 24 words')
    t.is(generated.body.phrase.split(' ').length, 24, 'phrase contains 24 words')

    const validated = await request(sourceApi.port, '/api/v1/identity/recovery/validate', {
      phrase: generated.body.phrase
    })
    t.is(validated.status, 200, 'validation returns 200')
    t.is(validated.body.valid, true, 'generated phrase validates')

    const invalid = await request(targetApi.port, '/api/v1/identity/recovery/import', {
      phrase: Array(23).fill('abandon').concat('ability').join(' ')
    })
    t.is(invalid.status, 400, 'invalid phrase import returns 400')

    const imported = await request(targetApi.port, '/api/v1/identity/recovery/import', {
      phrase: generated.body.phrase
    })
    t.is(imported.status, 201, 'valid phrase imports identity with 201')
    t.is(imported.body.identity.user_id, created.body.user_id, 'recovered identity has the original user ID')
    t.is(targetNode.identity?.user_id, created.body.user_id, 'running node adopts the recovered identity')
  } finally {
    if (sourceApi !== null) await sourceApi.close()
    if (targetApi !== null) await targetApi.close()
    await sourceNode.close()
    await targetNode.close()
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
