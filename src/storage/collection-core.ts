import fs from 'bare-fs'
import Hypercore from 'hypercore'
import type { CollectionEvent } from '../events.ts'
import { addBookmark, collectionGenesis, createGroup } from '../events.ts'
import type { DeviceState } from '../device-fold.ts'
import { deriveCollectionKeypair, collectionIdFromPublicKey } from '../keys.ts'

const COLLECTION_UUID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/

function requireBytes(value: unknown, length: number, field: string): asserts value is Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== length) {
    throw new RangeError(field + ' must contain exactly ' + length + ' bytes')
  }
}

/**
 * Creates or opens the collection log for a local collection.
 *
 * collectionUuid is the device-local ULID and KDF input. collectionId is
 * derived from the collection public key and is stored in the genesis.
 */
export async function createCollectionCore(
  dataDir: string,
  collectionUuid: string,
  masterKey: Uint8Array,
  authorId: string,
  authorPublicKey: Uint8Array,
  authorSecretKey: Uint8Array,
  deviceState: DeviceState
): Promise<Hypercore> {
  if (typeof dataDir !== 'string' || dataDir.length === 0) {
    throw new RangeError('dataDir must be a non-empty string')
  }
  if (typeof collectionUuid !== 'string' || !COLLECTION_UUID_RE.test(collectionUuid)) {
    throw new RangeError('collectionUuid must be a 26-character uppercase ULID')
  }
  requireBytes(masterKey, 32, 'masterKey')
  if (typeof authorId !== 'string' || authorId.length === 0) {
    throw new RangeError('authorId must be a non-empty string')
  }
  requireBytes(authorPublicKey, 32, 'authorPublicKey')
  requireBytes(authorSecretKey, 64, 'authorSecretKey')
  if (deviceState === null || typeof deviceState !== 'object' ||
      !(deviceState.collections instanceof Map) ||
      !(deviceState.groups instanceof Map) ||
      !(deviceState.bookmarks instanceof Map)) {
    throw new RangeError('deviceState must contain collections, groups, and bookmarks maps')
  }

  const collection = deviceState.collections.get(collectionUuid)
  if (!collection || collection.deleted) {
    throw new RangeError('Collection does not exist or is deleted in device state')
  }

  const collectionKeypair = deriveCollectionKeypair(masterKey, collectionUuid)
  const collectionId = collectionIdFromPublicKey(collectionKeypair.publicKey)
  const collectionsDir = dataDir.replace(/\/+$/, '') + '/collections'
  const storagePath = collectionsDir + '/' + collectionUuid

  await fs.mkdir(collectionsDir, { recursive: true, mode: 0o700 })
  await fs.mkdir(storagePath, { recursive: true, mode: 0o700 })

  // compat keeps core.key equal to the Ed25519 public key, as required by
  // collection_id. Hypercore v11 otherwise exposes the v2 manifest hash.
  const core = new Hypercore(storagePath, {
    keyPair: {
      publicKey: collectionKeypair.publicKey,
      secretKey: collectionKeypair.secretKey
    },
    valueEncoding: 'json',
    compat: true
  })
  await core.ready()

  try {
    if (core.length === 0) {
      const genesis = collectionGenesis({
        collectionId,
        collectionPublicKey: collectionKeypair.publicKey,
        authorId,
        authorPublicKey,
        secretKey: authorSecretKey,
        name: collection.name,
        description: collection.description,
        visibility: collection.visibility,
        language: collection.language,
        forkedFrom: null,
        migratedFrom: null
      })
      await core.append(genesis)

      const groups = [...deviceState.groups.values()]
        .filter((group) => group.collectionId === collectionUuid && !group.deleted)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      for (const group of groups) {
        await core.append(createGroup({
          authorId,
          groupId: group.groupId,
          name: group.name,
          position: group.position
        }))
      }

      const bookmarks = [...deviceState.bookmarks.values()]
        .filter((bookmark) => bookmark.collectionId === collectionUuid && !bookmark.deleted)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      for (const bookmark of bookmarks) {
        await core.append(addBookmark({
          authorId,
          bookmarkId: bookmark.bookmarkId,
          resourceId: bookmark.resourceId,
          canonicalUrl: bookmark.canonicalUrl,
          title: bookmark.title,
          description: bookmark.description,
          tags: bookmark.tags,
          notes: bookmark.notes,
          groupId: bookmark.groupId
        }))
      }
    }

    return core
  } catch (error) {
    await core.close()
    throw error
  }
}

/** Reads all collection events in append order. */
export async function readCollectionEvents(core: Hypercore): Promise<CollectionEvent[]> {
  const events: CollectionEvent[] = []
  for (let i = 0; i < core.length; i++) {
    events.push(await core.get(i) as CollectionEvent)
  }
  return events
}

/** Closes the local collection log. */
export async function closeCollectionCore(core: Hypercore): Promise<void> {
  await core.close()
}
