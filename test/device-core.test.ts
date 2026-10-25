import fs from 'bare-fs'
import test from 'brittle'
import { addBookmark, collectionGenesis } from '../src/events.ts'
import { userKeypairFromMasterKey } from '../src/identity.ts'
import { resourceIdFromCanonicalUrl, toHex, userIdFromPublicKey } from '../src/ids.ts'
import { deriveCollectionKeypair } from '../src/keys.ts'
import {
  appendEvent,
  closeDeviceCore,
  openDeviceCore,
  readAllEvents
} from '../src/storage/index.ts'
import type { CollectionEvent } from '../src/events.ts'
import type Hypercore from 'hypercore'

const DATA_DIR = './tmp-test-device-core'
const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const COLLECTION_UUID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

function fixedSeed(): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => i)
}

function makeEvents(): CollectionEvent[] {
  const masterKey = fixedSeed()
  const userPair = userKeypairFromMasterKey(masterKey)
  const collectionPair = deriveCollectionKeypair(masterKey, COLLECTION_UUID)
  const authorId = userIdFromPublicKey(userPair.publicKey)

  const genesis = collectionGenesis({
    collectionId: toHex(collectionPair.publicKey),
    collectionPublicKey: collectionPair.publicKey,
    authorId,
    authorPublicKey: userPair.publicKey,
    secretKey: userPair.secretKey,
    name: 'Prueba de persistencia',
    visibility: 'public'
  })
  const bookmark = addBookmark({
    authorId,
    bookmarkId: BOOKMARK_ID,
    resourceId: resourceIdFromCanonicalUrl('https://example.com/'),
    canonicalUrl: 'https://example.com/',
    title: 'Ejemplo persistente',
    tags: ['test']
  })

  return [genesis, bookmark]
}

test('device-core appends, reads in order, and persists across reopening', async (t) => {
  let core: Hypercore | null = null

  await fs.rm(DATA_DIR, { recursive: true, force: true })
  try {
    const expected = makeEvents()
    core = await openDeviceCore(DATA_DIR)
    t.is(core.length, 0, 'new device core starts empty')

    const firstIndex = await appendEvent(core, expected[0])
    t.is(firstIndex, 0, 'genesis is stored at block zero')
    t.is(core.length, 1, 'one event has been appended')

    const secondIndex = await appendEvent(core, expected[1])
    t.is(secondIndex, 1, 'bookmark is stored at block one')
    t.is(core.length, 2, 'two events have been appended')

    const firstRead = await readAllEvents(core)
    t.is(firstRead.length, 2)
    t.is(firstRead[0].event_id, expected[0].event_id)
    t.is(firstRead[0].event_type, expected[0].event_type)
    t.is(firstRead[1].event_id, expected[1].event_id)
    t.is(firstRead[1].event_type, expected[1].event_type)

    await closeDeviceCore(core)
    core = null

    core = await openDeviceCore(DATA_DIR)
    t.is(core.length, 2, 'event log survives reopening')
    const reopenedEvents = await readAllEvents(core)
    t.is(reopenedEvents.length, 2)
    t.is(reopenedEvents[0].event_id, expected[0].event_id)
    t.is(reopenedEvents[0].event_type, expected[0].event_type)
    t.is(reopenedEvents[1].event_id, expected[1].event_id)
    t.is(reopenedEvents[1].event_type, expected[1].event_type)
  } finally {
    if (core !== null) await closeDeviceCore(core)
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})
