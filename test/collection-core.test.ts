import fs from 'bare-fs'
import test from 'brittle'
import { genesisSigningHash } from '../src/events.ts'
import {
  deserializeSignature,
  userKeypairFromMasterKey,
  verify
} from '../src/identity.ts'
import { resourceIdFromCanonicalUrl, userIdFromPublicKey } from '../src/ids.ts'
import type { DeviceState } from '../src/device-fold.ts'
import { deriveCollectionKeypair, collectionIdFromPublicKey } from '../src/keys.ts'
import { ulid } from '../src/ulid.ts'
import {
  closeCollectionCore,
  createCollectionCore,
  openExistingCollectionCore,
  readCollectionEvents
} from '../src/storage/index.ts'
import type Hypercore from 'hypercore'

const DATA_DIR = './tmp-test-collection-core'
const COLLECTION_UUID = ulid()
const GROUP_ID = 'g_0123456789ab'
const BOOKMARK_IN_GROUP = '01ARZ3NDEKTSV4RRFFQ69G5FA1'
const BOOKMARK_IN_ROOT = '01ARZ3NDEKTSV4RRFFQ69G5FA2'

function fixedSeed(): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => i)
}

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

function makeDeviceState(): DeviceState {
  const createdAt = '2026-01-01T00:00:00.000Z'
  return {
    profile: {},
    collections: new Map([[
      COLLECTION_UUID,
      {
        collectionId: COLLECTION_UUID,
        name: 'Viajes',
        description: 'Lugares para visitar',
        visibility: 'public',
        language: 'es',
        deleted: false,
        createdAt
      }
    ]]),
    groups: new Map([[
      GROUP_ID,
      {
        groupId: GROUP_ID,
        collectionId: COLLECTION_UUID,
        name: 'Japón',
        position: 0,
        deleted: false,
        createdAt: '2026-01-02T00:00:00.000Z'
      }
    ]]),
    bookmarks: new Map([
      [BOOKMARK_IN_GROUP, {
        bookmarkId: BOOKMARK_IN_GROUP,
        collectionId: COLLECTION_UUID,
        resourceId: resourceIdFromCanonicalUrl('https://example.com/japan'),
        canonicalUrl: 'https://example.com/japan',
        title: 'Japón',
        description: 'Guía de viaje',
        tags: ['viaje', 'japon'],
        notes: 'Planificar ruta',
        groupId: GROUP_ID,
        position: null,
        deleted: false,
        createdAt: '2026-01-03T00:00:00.000Z'
      }],
      [BOOKMARK_IN_ROOT, {
        bookmarkId: BOOKMARK_IN_ROOT,
        collectionId: COLLECTION_UUID,
        resourceId: resourceIdFromCanonicalUrl('https://example.com/packing'),
        canonicalUrl: 'https://example.com/packing',
        title: 'Equipaje',
        tags: ['preparativos'],
        groupId: null,
        position: null,
        deleted: false,
        createdAt: '2026-01-04T00:00:00.000Z'
      }]
    ])
  }
}

test('collection-core creates a signed genesis and converts device state', async (t) => {
  let core: Hypercore | null = null
  await fs.rm(DATA_DIR, { recursive: true, force: true })

  try {
    const masterKey = fixedSeed()
    const authorKeypair = userKeypairFromMasterKey(masterKey)
    const authorId = userIdFromPublicKey(authorKeypair.publicKey)
    const collectionKeypair = deriveCollectionKeypair(masterKey, COLLECTION_UUID)
    const collectionId = collectionIdFromPublicKey(collectionKeypair.publicKey)

    core = await createCollectionCore(
      DATA_DIR,
      COLLECTION_UUID,
      masterKey,
      authorId,
      authorKeypair.publicKey,
      authorKeypair.secretKey,
      makeDeviceState()
    )

    t.is(core.length, 4, 'genesis, one group, and two bookmarks are appended')
    t.is(toHex(core.key as Uint8Array), collectionId, 'core.key equals collectionId')

    const events = await readCollectionEvents(core)
    t.is(events.length, 4)
    t.alike(events.map((event) => event.event_type), [
      'collection_genesis',
      'create_group',
      'add_bookmark',
      'add_bookmark'
    ])

    const genesis = events[0]
    t.is(genesis.event_type, 'collection_genesis')
    if (genesis.event_type !== 'collection_genesis') throw new Error('Expected collection_genesis at block zero')
    t.is(genesis.payload.collection_id, collectionId)
    t.is(genesis.payload.visibility, 'unlisted', 'el génesis de una colección nueva no publicada es unlisted')

    const signingParams = {
      collectionId,
      collectionPublicKey: collectionKeypair.publicKey,
      authorId,
      authorPublicKey: authorKeypair.publicKey,
      name: 'Viajes',
      visibility: 'unlisted' as const,
      language: 'es' as const,
      forkedFrom: null,
      migratedFrom: null
    }
    const signature = deserializeSignature(genesis.payload.signature_by_owner)
    t.ok(verify(signature, genesisSigningHash(signingParams), authorKeypair.publicKey))

    const groupEvent = events[1]
    if (groupEvent.event_type !== 'create_group') throw new Error('Expected create_group at block one')
    t.is(groupEvent.payload.group_id, GROUP_ID)

    const firstBookmark = events[2]
    if (firstBookmark.event_type !== 'add_bookmark') throw new Error('Expected add_bookmark at block two')
    t.is(firstBookmark.payload.bookmark_id, BOOKMARK_IN_GROUP)
    t.is(firstBookmark.payload.group_id, GROUP_ID)

    const secondBookmark = events[3]
    if (secondBookmark.event_type !== 'add_bookmark') throw new Error('Expected add_bookmark at block three')
    t.is(secondBookmark.payload.bookmark_id, BOOKMARK_IN_ROOT)
    t.is(secondBookmark.payload.group_id, null)

    await closeCollectionCore(core)
    core = null
  } finally {
    if (core !== null) await closeCollectionCore(core)
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})


test('collection-core reopens an existing log without rewriting its events', async (t) => {
  const dataDir = DATA_DIR + '-reopen'
  let core: Hypercore | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const masterKey = fixedSeed()
    const authorKeypair = userKeypairFromMasterKey(masterKey)
    const authorId = userIdFromPublicKey(authorKeypair.publicKey)

    core = await createCollectionCore(
      dataDir,
      COLLECTION_UUID,
      masterKey,
      authorId,
      authorKeypair.publicKey,
      authorKeypair.secretKey,
      makeDeviceState()
    )
    const originalEvents = await readCollectionEvents(core)
    const originalLength = core.length

    await closeCollectionCore(core)
    core = null

    core = await openExistingCollectionCore(dataDir, COLLECTION_UUID, masterKey)
    const reopenedEvents = await readCollectionEvents(core)

    t.is(core.length, originalLength, 'la reapertura conserva el número de bloques')
    t.alike(reopenedEvents, originalEvents, 'la reapertura conserva todos los eventos')
  } finally {
    if (core !== null) await closeCollectionCore(core)
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
