import fs from 'bare-fs'
import http from 'bare-http1'
import test from 'brittle'
import { createServer } from '../src/api/server.ts'
import { createIdentity } from '../src/identity/store.ts'
import { utf8Bytes } from '../src/ids.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { deviceMetadata } from '../src/device-events.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'

const ROOT = './tmp-test-backup-api'

interface HttpResult {
  status: number
  body: any
}

function request(port: number, path: string, body: unknown): Promise<HttpResult> {
  const payload = JSON.stringify(body)
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

test('backup and restore API endpoints', async (t) => {
  const sourceDir = ROOT + '/source'
  const allDir = ROOT + '/restore-all'
  const collectionsDir = ROOT + '/restore-collections'
  await fs.rm(ROOT, { recursive: true, force: true })

  const sourceConfig = { ...defaultConfig(), dataDir: sourceDir, port: 0, bind: '127.0.0.1' }
  const allConfig = { ...defaultConfig(), dataDir: allDir, port: 0, bind: '127.0.0.1' }
  const collectionsConfig = { ...defaultConfig(), dataDir: collectionsDir, port: 0, bind: '127.0.0.1' }

  await createIdentity(sourceDir)
  const sourceNode = await startNode(sourceConfig, { swarm: createFakeSwarm() })
  let sourceApi: Awaited<ReturnType<typeof createServer>> | null = null
  let allNode: Awaited<ReturnType<typeof startNode>> | null = null
  let allApi: Awaited<ReturnType<typeof createServer>> | null = null
  let collectionsNode: Awaited<ReturnType<typeof startNode>> | null = null
  let collectionsApi: Awaited<ReturnType<typeof createServer>> | null = null

  try {
    await sourceNode.apply(deviceMetadata({
      authorId: sourceNode.identity!.user_id,
      displayName: 'Fuente'
    }))
    const sourceIdentity = await fs.readFile(sourceDir + '/identity.bmn', 'utf8')
    const sourceEventCount = sourceNode.core.length
    sourceApi = await createServer(sourceConfig, sourceNode)

    const emptyPassword = await request(sourceApi.port, '/api/v1/backup', { password: '' })
    t.is(emptyPassword.status, 400, 'backup rejects an empty password')

    const created = await request(sourceApi.port, '/api/v1/backup', { password: 'backup api password' })
    t.is(created.status, 200, 'manual backup returns 200')
    t.is(typeof created.body.path, 'string', 'backup response contains its path')
    t.is(typeof created.body.createdAt, 'string', 'backup response contains its creation time')
    t.is(typeof created.body.size, 'number', 'backup response contains its size')
    t.is(await fs.stat(created.body.path).then(() => true, () => false), true, 'backup file exists')

    const emptyRestorePassword = await request(sourceApi.port, '/api/v1/restore', {
      backupPath: created.body.path,
      password: '',
      mode: 'all'
    })
    t.is(emptyRestorePassword.status, 400, 'restore rejects an empty password')

    const invalidMode = await request(sourceApi.port, '/api/v1/restore', {
      backupPath: created.body.path,
      password: 'backup api password',
      mode: 'invalid'
    })
    t.is(invalidMode.status, 400, 'restore rejects an invalid mode')

    const missingBackup = await request(sourceApi.port, '/api/v1/restore', {
      backupPath: ROOT + '/missing.bmn',
      password: 'backup api password',
      mode: 'all'
    })
    t.is(missingBackup.status, 400, 'restore rejects a missing backup file')

    await createIdentity(collectionsDir)
    collectionsNode = await startNode(collectionsConfig, { swarm: createFakeSwarm() })
    const collectionsIdentity = await fs.readFile(collectionsDir + '/identity.bmn', 'utf8')
    collectionsApi = await createServer(collectionsConfig, collectionsNode)
    const collectionsRestore = await request(collectionsApi.port, '/api/v1/restore', {
      backupPath: created.body.path,
      password: 'backup api password',
      mode: 'collections-only'
    })
    t.is(collectionsRestore.status, 200, 'collections-only restore returns 200')
    t.alike(collectionsRestore.body, {
      status: 'pending',
      message: 'Reinicia el nodo para completar la restauración'
    }, 'collections-only restore requests a restart')
    const collectionsPendingPath = collectionsDir + '/restore-pending.json'
    t.is(await fs.stat(collectionsPendingPath).then(() => true, () => false), true, 'collections-only restore writes pending file')
    const collectionsPending = JSON.parse(await fs.readFile(collectionsPendingPath, 'utf8'))
    t.is(collectionsPending.backupPath, created.body.path, 'pending restore stores backup path')
    t.is(collectionsPending.mode, 'collections-only', 'pending restore stores mode')
    t.is(collectionsPending.password, 'backup api password', 'pending restore stores password')
    await collectionsApi.close()
    collectionsApi = null
    await collectionsNode.close()
    collectionsNode = null
    collectionsNode = await startNode(collectionsConfig, { swarm: createFakeSwarm() })
    t.is(await fs.readFile(collectionsDir + '/identity.bmn', 'utf8'), collectionsIdentity, 'collections-only restore preserves identity after restart')
    t.is(collectionsNode.core.length, sourceEventCount, 'collections-only restore applies device_core after restart')
    t.is(await fs.stat(collectionsPendingPath).then(() => true, () => false), false, 'collections-only pending file is removed after restart')

    await createIdentity(allDir)
    allNode = await startNode(allConfig, { swarm: createFakeSwarm() })
    allApi = await createServer(allConfig, allNode)
    const allRestore = await request(allApi.port, '/api/v1/restore', {
      backupPath: created.body.path,
      password: 'backup api password',
      mode: 'all'
    })
    t.is(allRestore.status, 200, 'all restore returns 200')
    t.alike(allRestore.body, {
      status: 'pending',
      message: 'Reinicia el nodo para completar la restauración'
    }, 'all restore requests a restart')
    const allPendingPath = allDir + '/restore-pending.json'
    t.is(await fs.stat(allPendingPath).then(() => true, () => false), true, 'all restore writes pending file')
    await allApi.close()
    allApi = null
    await allNode.close()
    allNode = null
    allNode = await startNode(allConfig, { swarm: createFakeSwarm() })
    t.is(await fs.readFile(allDir + '/identity.bmn', 'utf8'), sourceIdentity, 'all restore restores identity after restart')
    t.is(allNode.identity?.user_id, sourceNode.identity?.user_id, 'all restore restores the node identity')
    t.is(allNode.core.length, sourceEventCount, 'all restore applies device_core after restart')
    t.is(await fs.stat(allPendingPath).then(() => true, () => false), false, 'all pending file is removed after restart')
  } finally {
    if (sourceApi !== null) await sourceApi.close()
    if (allApi !== null) await allApi.close()
    if (collectionsApi !== null) await collectionsApi.close()
    if (allNode !== null) await allNode.close()
    if (collectionsNode !== null) await collectionsNode.close()
    await sourceNode.close()
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
