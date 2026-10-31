import fs from 'bare-fs'
import test from 'brittle'
import { deviceMetadata } from '../src/device-events.ts'
import { userKeypairFromMasterKey } from '../src/identity.ts'
import { createIdentity, identityToApi } from '../src/identity/store.ts'
import { userIdFromPublicKey } from '../src/ids.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { createFakeSwarm } from './helpers/fake-swarm.ts'
import { appendEvent } from '../src/storage/device-core.ts'

const DATA_DIR = './tmp-test-start'

function authorId(): string {
  const masterKey = Uint8Array.from({ length: 32 }, (_, i) => i)
  const userPair = userKeypairFromMasterKey(masterKey)
  return userIdFromPublicKey(userPair.publicKey)
}

test('startNode opens an empty core', async (t) => {
  const dataDir = DATA_DIR + '-empty'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode({ ...defaultConfig(), dataDir }, { swarm: createFakeSwarm() })
    t.alike(node.state.profile, {}, 'empty core has an empty profile')
    t.is(node.state.collections.size, 0, 'empty core has no collections')
    t.is(node.state.bookmarks.size, 0, 'empty core has no bookmarks')
    t.is(node.state.groups.size, 0, 'empty core has no groups')
    t.is(node.core.length, 0, 'empty core has no events')
  } finally {
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('startNode folds persisted device events after restart', async (t) => {
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(DATA_DIR, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir: DATA_DIR }
    node = await startNode(config, { swarm: createFakeSwarm() })
    const event = deviceMetadata({ authorId: authorId(), displayName: 'Marta' })
    await appendEvent(node.core, event)
    await node.close()
    node = null

    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.core.length, 1, 'event remains after reopening')
    t.is(node.state.profile.displayName, 'Marta', 'device fold restores persisted profile metadata')
    await node.close()
    node = null
  } finally {
    if (node !== null) await node.close()
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})

test('startNode loads an existing identity', async (t) => {
  const dataDir = DATA_DIR + '-identity'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir }
    const created = await createIdentity(dataDir)
    const expected = identityToApi(created)
    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.identity !== null, true, 'identity is available on the node')
    t.is(node.identity?.user_id, expected.user_id, 'node identity matches the created identity')
  } finally {
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('startNode returns null identity when none is stored', async (t) => {
  const dataDir = DATA_DIR + '-no-identity'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    node = await startNode({ ...defaultConfig(), dataDir }, { swarm: createFakeSwarm() })
    t.is(node.identity, null, 'node has no identity when identity.bmn is absent')
  } finally {
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('startNode devuelve un Node con swarm', async (t) => {
  const dataDir = DATA_DIR + '-swarm'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const node = await startNode({ ...defaultConfig(), dataDir }, { ...defaultConfig(), dataDir })
    t.ok(node.swarm !== null, 'node tiene un swarm')
    await node.close()
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('startNode close cierra el swarm sin lanzar', async (t) => {
  const dataDir = DATA_DIR + '-close-swarm'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const node = await startNode({ ...defaultConfig(), dataDir }, { ...defaultConfig(), dataDir })
    await node.close()
    t.pass('close resuelve sin lanzar')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('Node.apply persists events before updating state', async (t) => {
  const dataDir = DATA_DIR + '-apply-persist'
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir }
    node = await startNode(config, { swarm: createFakeSwarm() })
    const event = deviceMetadata({ authorId: authorId(), displayName: 'Persistida' })
    await node.apply(event)
    t.is(node.core.length, 1, 'apply appends the event to device_core')
    t.is(node.state.profile.displayName, 'Persistida', 'apply updates in-memory state')

    await node.close()
    node = null
    node = await startNode(config, { swarm: createFakeSwarm() })
    t.is(node.core.length, 1, 'event remains in device_core after restart')
    t.is(node.state.profile.displayName, 'Persistida', 'fold restores state from the applied event')
  } finally {
    if (node !== null) await node.close()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('node.close() is idempotent when called concurrently', async (t) => {
  const dataDir = DATA_DIR + '-concurrent-close'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const node = await startNode({ ...defaultConfig(), dataDir }, { swarm: createFakeSwarm() })
    const closePromise1 = node.close()
    const closePromise2 = node.close()

    t.is(closePromise1, closePromise2, 'both close calls return the same promise instance')

    await Promise.all([closePromise1, closePromise2])
    t.pass('both close calls resolve without errors')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
