import fs from 'bare-fs'
import Hyperbee from 'hyperbee'
import Hypercore from 'hypercore'
import { join } from 'bare-path'
import type { DeviceState } from '../device-fold.ts'
import type { CollectionState } from '../fold.ts'

export interface MaterializedViewHandle {
  db: Hyperbee
  close(): Promise<void>
}

interface SerializedDeviceState {
  profile: DeviceState['profile']
  collections: Array<[string, DeviceState['collections'] extends Map<string, infer V> ? V : never]>
  bookmarks: Array<[string, DeviceState['bookmarks'] extends Map<string, infer V> ? V : never]>
  groups: Array<[string, DeviceState['groups'] extends Map<string, infer V> ? V : never]>
}

interface SerializedCollectionState {
  collection: CollectionState['collection']
  bookmarks: Array<[string, CollectionState['bookmarks'] extends Map<string, infer V> ? V : never]>
  groups: Array<[string, CollectionState['groups'] extends Map<string, infer V> ? V : never]>
}

function serializeDeviceState(state: DeviceState): SerializedDeviceState {
  return {
    profile: state.profile,
    collections: [...state.collections.entries()],
    bookmarks: [...state.bookmarks.entries()],
    groups: [...state.groups.entries()]
  }
}

function deserializeDeviceState(value: SerializedDeviceState): DeviceState {
  return {
    profile: value.profile,
    collections: new Map(value.collections),
    bookmarks: new Map(value.bookmarks),
    groups: new Map(value.groups)
  }
}

function serializeCollectionState(state: CollectionState): SerializedCollectionState {
  return {
    collection: state.collection,
    bookmarks: [...state.bookmarks.entries()],
    groups: [...state.groups.entries()]
  }
}

function deserializeCollectionState(value: SerializedCollectionState): CollectionState {
  return {
    collection: value.collection,
    bookmarks: new Map(value.bookmarks),
    groups: new Map(value.groups)
  }
}

/** Abre la base Hyperbee persistente de las vistas materializadas locales. */
export async function openMaterializedView(dataDir: string): Promise<MaterializedViewHandle> {
  if (typeof dataDir !== 'string' || dataDir.length === 0) {
    throw new RangeError('dataDir debe ser una ruta no vacía')
  }

  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const storagePath = join(dataDir, 'materialized-view')
  const core = new Hypercore(storagePath)
  const db = new Hyperbee(core, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  try {
    await db.ready()
  } catch (error) {
    await db.close()
    throw error
  }

  return {
    db,
    close: async () => {
      await db.close()
    }
  }
}

/** Cierra Hyperbee y el Hypercore que utiliza como almacenamiento. */
export async function closeMaterializedView(handle: MaterializedViewHandle): Promise<void> {
  await handle.close()
}

export async function getDeviceState(handle: MaterializedViewHandle): Promise<DeviceState | null> {
  const entry = await handle.db.get('device:state')
  if (entry === null) return null
  return deserializeDeviceState(entry.value as SerializedDeviceState)
}

export async function setDeviceState(handle: MaterializedViewHandle, state: DeviceState): Promise<void> {
  await handle.db.put('device:state', serializeDeviceState(state))
}

export async function getCollectionState(
  handle: MaterializedViewHandle,
  collectionId: string
): Promise<CollectionState | null> {
  const entry = await handle.db.get('collection:' + collectionId)
  if (entry === null) return null
  return deserializeCollectionState(entry.value as SerializedCollectionState)
}

export async function setCollectionState(
  handle: MaterializedViewHandle,
  collectionId: string,
  state: CollectionState
): Promise<void> {
  await handle.db.put('collection:' + collectionId, serializeCollectionState(state))
}

export async function getLastProcessedEvent(
  handle: MaterializedViewHandle,
  coreId: string
): Promise<number | null> {
  const entry = await handle.db.get('sync:' + coreId)
  if (entry === null) return null
  return entry.value as number
}

export async function setLastProcessedEvent(
  handle: MaterializedViewHandle,
  coreId: string,
  eventIndex: number
): Promise<void> {
  await handle.db.put('sync:' + coreId, eventIndex)
}
