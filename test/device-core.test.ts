import fs from 'bare-fs'
import test from 'brittle'
import { deviceAddBookmark, deviceMetadata } from '../src/device-events.ts'
import { userKeypairFromMasterKey } from '../src/identity.ts'
import { resourceIdFromCanonicalUrl, userIdFromPublicKey } from '../src/ids.ts'
import {
  appendEvent,
  closeDeviceCore,
  openDeviceCore,
  readAllEvents
} from '../src/storage/index.ts'
import type { DeviceEvent } from '../src/device-events.ts'
import type Hypercore from 'hypercore'

const DATA_DIR = './tmp-test-device-core'
const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

function fixedSeed(): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => i)
}

function makeEvents(): DeviceEvent[] {
  const userPair = userKeypairFromMasterKey(fixedSeed())
  const authorId = userIdFromPublicKey(userPair.publicKey)

  const metadata = deviceMetadata({ authorId, displayName: 'Marta' })
  const bookmark = deviceAddBookmark({
    authorId,
    bookmarkId: BOOKMARK_ID,
    collectionId: 'local-collection-1',
    resourceId: resourceIdFromCanonicalUrl('https://example.com/'),
    canonicalUrl: 'https://example.com/',
    title: 'Ejemplo persistente',
    tags: ['test']
  })

  return [metadata, bookmark]
}

test('device-core appends, reads in order, and persists across reopening', async (t) => {
  let core: Hypercore | null = null

  await fs.rm(DATA_DIR, { recursive: true, force: true })
  try {
    const expected = makeEvents()
    core = await openDeviceCore(DATA_DIR)
    t.is(core.length, 0, 'new device core starts empty')

    const firstIndex = await appendEvent(core, expected[0])
    t.is(firstIndex, 0, 'metadata is stored at block zero')
    t.is(core.length, 1, 'one event has been appended')

    const secondIndex = await appendEvent(core, expected[1])
    t.is(secondIndex, 1, 'bookmark is stored at block one')
    t.is(core.length, 2, 'two events have been appended')

    const firstRead = await readAllEvents(core)
    t.is(firstRead.length, 2)
    t.is(firstRead[0].event_id, expected[0].event_id)
    t.is(firstRead[0].event_type, 'device_metadata')
    t.is(firstRead[1].event_id, expected[1].event_id)
    t.is(firstRead[1].event_type, 'device_add_bookmark')

    await closeDeviceCore(core)
    core = null

    core = await openDeviceCore(DATA_DIR)
    t.is(core.length, 2, 'event log survives reopening')
    const reopenedEvents = await readAllEvents(core)
    t.is(reopenedEvents.length, 2)
    t.is(reopenedEvents[0].event_id, expected[0].event_id)
    t.is(reopenedEvents[0].event_type, 'device_metadata')
    t.is(reopenedEvents[1].event_id, expected[1].event_id)
    t.is(reopenedEvents[1].event_type, 'device_add_bookmark')
  } finally {
    if (core !== null) await closeDeviceCore(core)
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})

