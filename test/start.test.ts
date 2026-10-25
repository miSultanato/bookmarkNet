import fs from 'bare-fs'
import test from 'brittle'
import { collectionGenesis } from '../src/events.ts'
import { userKeypairFromMasterKey } from '../src/identity.ts'
import { toHex, userIdFromPublicKey } from '../src/ids.ts'
import { deriveCollectionKeypair } from '../src/keys.ts'
import { defaultConfig } from '../src/node/config.ts'
import { startNode } from '../src/node/start.ts'
import { appendEvent } from '../src/storage/device-core.ts'

const DATA_DIR = './tmp-test-start'
const COLLECTION_UUID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

function genesisEvent() {
  const masterKey = Uint8Array.from({ length: 32 }, (_, i) => i)
  const userPair = userKeypairFromMasterKey(masterKey)
  const collectionPair = deriveCollectionKeypair(masterKey, COLLECTION_UUID)
  const authorId = userIdFromPublicKey(userPair.publicKey)
  return collectionGenesis({
    collectionId: toHex(collectionPair.publicKey),
    collectionPublicKey: collectionPair.publicKey,
    authorId,
    authorPublicKey: userPair.publicKey,
    secretKey: userPair.secretKey,
    name: 'Colección persistente',
    visibility: 'public'
  })
}

test('startNode opens an empty core and folds persisted events after restart', async (t) => {
  let node: Awaited<ReturnType<typeof startNode>> | null = null
  await fs.rm(DATA_DIR, { recursive: true, force: true })

  try {
    const config = { ...defaultConfig(), dataDir: DATA_DIR }
    node = await startNode(config)
    t.is(node.state.collection, null, 'empty core has no collection')
    t.is(node.core.length, 0, 'empty core has no events')

    await appendEvent(node.core, genesisEvent())
    await node.close()
    node = null

    node = await startNode(config)
    t.is(node.core.length, 1, 'event remains after reopening')
    t.is(node.state.collection?.name, 'Colección persistente', 'fold restores genesis collection')
    await node.close()
    node = null
    t.pass('close resolves without throwing')
  } finally {
    if (node !== null) await node.close()
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})
