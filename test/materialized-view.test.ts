import fs from 'bare-fs'
import { join } from 'node:path'
import test from 'brittle'
import { emptyDeviceState } from '../src/device-fold.ts'
import type { DeviceState } from '../src/device-fold.ts'
import { emptyState } from '../src/fold.ts'
import type { CollectionState } from '../src/fold.ts'
import { ulid } from '../src/ulid.ts'
import {
  closeMaterializedView,
  getCollectionState,
  getDeviceState,
  getLastProcessedEvent,
  openMaterializedView,
  setCollectionState,
  setDeviceState,
  setLastProcessedEvent
} from '../src/storage/materialized-view.ts'

function makeDeviceState(): DeviceState {
  const state = emptyDeviceState()
  state.profile.displayName = 'Marta'
  state.collections.set('collection-a', {
    collectionId: 'collection-a',
    name: 'Viajes',
    visibility: 'public',
    language: 'es',
    deleted: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  })
  state.bookmarks.set('bookmark-a', {
    bookmarkId: 'bookmark-a',
    collectionId: 'collection-a',
    resourceId: 'resource-a',
    canonicalUrl: 'https://example.com/a',
    title: 'Ejemplo',
    tags: ['test'],
    groupId: null,
    position: null,
    deleted: false,
    createdAt: '2026-01-02T00:00:00.000Z'
  })
  return state
}

function makeCollectionState(name: string, bookmarkId: string): CollectionState {
  const state = emptyState()
  state.collection = {
    collectionId: 'public-' + name,
    collectionPublicKey: 'public-key-' + name,
    authorId: 'author-a',
    authorPublicKey: 'author-public-key',
    name,
    visibility: 'unlisted',
    language: 'es',
    forkedFrom: null,
    migratedFrom: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    unpublished: false
  }
  state.bookmarks.set(bookmarkId, {
    bookmarkId,
    resourceId: 'resource-' + bookmarkId,
    canonicalUrl: 'https://example.com/' + bookmarkId,
    title: name,
    tags: [],
    groupId: null,
    position: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    deleted: false
  })
  return state
}

test('materialized-view persists device state across close and reopen', async (t) => {
  const dataDir = join('.', 'tmp-test-materialized-view-' + ulid())
  let handle: Awaited<ReturnType<typeof openMaterializedView>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const expected = makeDeviceState()
    handle = await openMaterializedView(dataDir)
    t.is(await getDeviceState(handle), null, 'la vista nueva no contiene device state')
    await setDeviceState(handle, expected)
    await closeMaterializedView(handle)
    handle = null

    handle = await openMaterializedView(dataDir)
    const actual = await getDeviceState(handle)
    t.ok(actual !== null, 'device state se recupera tras reabrir')
    if (actual === null) return
    t.alike(actual.profile, expected.profile)
    t.alike([...actual.collections.entries()], [...expected.collections.entries()])
    t.alike([...actual.bookmarks.entries()], [...expected.bookmarks.entries()])
    t.alike([...actual.groups.entries()], [...expected.groups.entries()])
  } finally {
    if (handle !== null) await closeMaterializedView(handle)
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('materialized-view keeps collection states isolated by collection id', async (t) => {
  const dataDir = join('.', 'tmp-test-materialized-view-collections-' + ulid())
  let handle: Awaited<ReturnType<typeof openMaterializedView>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    handle = await openMaterializedView(dataDir)
    const first = makeCollectionState('Primera', 'bookmark-first')
    const second = makeCollectionState('Segunda', 'bookmark-second')
    await setCollectionState(handle, 'collection-first', first)
    await setCollectionState(handle, 'collection-second', second)

    const actualFirst = await getCollectionState(handle, 'collection-first')
    const actualSecond = await getCollectionState(handle, 'collection-second')
    t.ok(actualFirst !== null)
    t.ok(actualSecond !== null)
    if (actualFirst === null || actualSecond === null) return
    t.is(actualFirst.collection?.name, 'Primera')
    t.is(actualSecond.collection?.name, 'Segunda')
    t.alike([...actualFirst.bookmarks.keys()], ['bookmark-first'])
    t.alike([...actualSecond.bookmarks.keys()], ['bookmark-second'])
    t.is(await getCollectionState(handle, 'missing'), null)
  } finally {
    if (handle !== null) await closeMaterializedView(handle)
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('materialized-view persists last processed event indexes', async (t) => {
  const dataDir = join('.', 'tmp-test-materialized-view-sync-' + ulid())
  let handle: Awaited<ReturnType<typeof openMaterializedView>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    handle = await openMaterializedView(dataDir)
    t.is(await getLastProcessedEvent(handle, 'device-core'), null)
    await setLastProcessedEvent(handle, 'device-core', 42)
    await setLastProcessedEvent(handle, 'collection-core-a', 7)
    t.is(await getLastProcessedEvent(handle, 'device-core'), 42)
    t.is(await getLastProcessedEvent(handle, 'collection-core-a'), 7)
  } finally {
    if (handle !== null) await closeMaterializedView(handle)
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('materialized-view key namespaces do not collide', async (t) => {
  const dataDir = join('.', 'tmp-test-materialized-view-keys-' + ulid())
  let handle: Awaited<ReturnType<typeof openMaterializedView>> | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    handle = await openMaterializedView(dataDir)
    const deviceState = makeDeviceState()
    const collectionState = makeCollectionState('Colisión', 'bookmark-collision')
    await setDeviceState(handle, deviceState)
    await setCollectionState(handle, 'state', collectionState)
    await setLastProcessedEvent(handle, 'state', 99)

    const actualDevice = await getDeviceState(handle)
    const actualCollection = await getCollectionState(handle, 'state')
    const actualSync = await getLastProcessedEvent(handle, 'state')
    t.ok(actualDevice !== null)
    t.ok(actualCollection !== null)
    if (actualDevice === null || actualCollection === null) return
    t.is(actualDevice.profile.displayName, 'Marta')
    t.is(actualCollection.collection?.name, 'Colisión')
    t.is(actualSync, 99)
  } finally {
    if (handle !== null) await closeMaterializedView(handle)
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
