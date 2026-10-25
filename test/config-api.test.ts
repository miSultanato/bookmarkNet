import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { utf8Bytes } from '../src/ids.ts'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

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

test('config API requires identity and never exposes dataDir', async (t) => {
  const dataDir = './tmp-test-config-api'
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = {
      ...defaultConfig(),
      port: 0,
      dataDir,
      logLevel: 'debug' as const,
      openBrowserOnStart: false,
      allowedHosts: ['localhost', '127.0.0.1'],
      bind: '127.0.0.1'
    }
    node = await startNode(config)
    api = await createServer(config, node)

    const noIdentity = await request(api.port, 'GET', '/api/v1/config')
    t.is(noIdentity.statusCode, 401, 'GET config without identity returns 401')
    t.is(noIdentity.body.error.code, 'NO_IDENTITY', 'missing identity has explicit error')

    const identity = await request(api.port, 'POST', '/api/v1/identity/create', {})
    t.is(identity.statusCode, 201, 'identity is created')
    const response = await request(api.port, 'GET', '/api/v1/config')
    t.is(response.statusCode, 200, 'GET config with identity returns 200')
    t.is(response.body.config.port, 0, 'response includes configured port')
    t.is(response.body.config.logLevel, 'debug', 'response includes logLevel')
    t.is(response.body.config.openBrowserOnStart, false, 'response includes openBrowserOnStart')
    t.alike(response.body.config.allowedHosts, ['localhost', '127.0.0.1'], 'response includes allowedHosts')
    t.is(response.body.config.bind, '127.0.0.1', 'response includes bind')
    t.is(!('dataDir' in response.body.config), true, 'response does not expose dataDir')
    t.is(!('data_dir' in response.body.config), true, 'response does not expose data_dir')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
