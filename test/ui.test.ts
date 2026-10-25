import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'

interface Response {
  statusCode: number
  contentType: string | undefined
  body: string
}

function request(port: number, path: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      method: 'GET',
      path,
      headers: { Host: '127.0.0.1:' + port }
    }, (res: any) => {
      let body = ''
      res.on('data', (chunk: unknown) => {
        body += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
      })
      res.on('end', () => {
        const contentType = res.headers['content-type']
        resolve({
          statusCode: res.statusCode,
          contentType: typeof contentType === 'string' ? contentType : undefined,
          body
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

test('local UI static assets are served safely alongside the API', async (t) => {
  const dataDir = './tmp-test-ui'
  const config = { ...defaultConfig(), port: 0, dataDir, bind: '127.0.0.1' }
  let api: Awaited<ReturnType<typeof createServer>> | null = null
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode(config)
    api = await createServer(config, node)

    const index = await request(api.port, '/')
    t.is(index.statusCode, 200, 'root serves the UI')
    t.ok(index.contentType?.startsWith('text/html; charset=utf-8'), 'index has HTML content type')
    t.ok(index.body.includes('<title>BookmarkNet</title>'), 'index contains the app title')

    const style = await request(api.port, '/assets/style.css')
    t.is(style.statusCode, 200, 'stylesheet is served')
    t.ok(style.contentType?.startsWith('text/css; charset=utf-8'), 'stylesheet has CSS content type')
    t.ok(style.body.includes(':root'), 'stylesheet contains CSS variables')

    const app = await request(api.port, '/assets/app.js')
    t.is(app.statusCode, 200, 'application module is served')
    t.ok(app.contentType?.startsWith('text/javascript; charset=utf-8'), 'application module has JavaScript content type')
    t.ok(app.body.includes("from './api.js'"), 'application module imports the API helper')
    t.ok(app.body.includes('hashchange'), 'application module listens for hash changes')

    const apiModule = await request(api.port, '/assets/api.js')
    t.is(apiModule.statusCode, 200, 'API helper module is served')
    t.ok(apiModule.body.includes('fetch('), 'API helper uses fetch')
    t.ok(apiModule.body.includes('/api/v1/identity'), 'API helper calls the identity endpoint')

    const onboarding = await request(api.port, '/assets/onboarding.js')
    t.is(onboarding.statusCode, 200, 'onboarding module is served')
    t.ok(onboarding.body.includes('createIdentity'), 'onboarding module creates an identity')

    const bookmarks = await request(api.port, '/assets/bookmarks.js')
    t.is(bookmarks.statusCode, 200, 'bookmarks module is served')
    t.ok(bookmarks.body.includes('Mis bookmarks'), 'bookmarks module contains the placeholder title')

    const missing = await request(api.port, '/assets/nope.css')
    t.is(missing.statusCode, 404, 'missing static asset returns 404')

    const traversal = await request(api.port, '/assets/%2e%2e/src/main.ts')
    t.ok(traversal.statusCode === 400 || traversal.statusCode === 404, 'path traversal is rejected')

    const identity = await request(api.port, '/api/v1/identity')
    t.is(identity.statusCode, 200, 'identity API still returns 200')
    t.ok(identity.body.includes('"identity":null'), 'identity API reports no identity on a fresh node')
  } finally {
    if (api !== null) await api.close()
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
