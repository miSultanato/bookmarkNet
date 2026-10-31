import fs from 'bare-fs'
import Hypercore from 'hypercore'
import type { CollectionEvent } from '../events.ts'
import { addBookmark, collectionGenesis, createGroup } from '../events.ts'
import type { DeviceState } from '../device-fold.ts'
import { deriveCollectionKeypair, collectionIdFromPublicKey } from '../keys.ts'

function sameBytes(left: Uint8Array | null, right: Uint8Array): boolean {
  if (left === null || left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

/**
 * Creates or opens the local collection log for a collection in the device log.
 *
 * collectionUuid is the stable local ULID used as the KDF input and storage
 * directory. The public collectionId written to the genesis is the hexadecimal
 * collection public key derived from that UUID.
 */
export async function createCollectionCore(
  dataDir: string,
  collectionUuid: string,
  masterKey: Uint8Array,
  deviceState: DeviceState,
  authorId: string,
  authorPublicKey: Uint8Array,
  authorSecretKey: Uint8Array
): Promise<Hypercore> {
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

  const core = new Hypercore(storagePath, {
    keyPair: {
      publicKey: collectionKeypair.publicKey,
      secretKey: collectionKeypair.secretKey
    },
    valueEncoding: 'json',
    compat: true
  })
  await core.ready()

  if (!sameBytes(core.key, collectionKeypair.publicKey)) {
    await core.close()
    throw new Error('Opened collection core does not match the derived collection public key')
  }

  try {
    // A non-empty core is an existing publication: never duplicate its log.
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
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.groupId.localeCompare(b.groupId))

      for (const group of groups) {
        const event = createGroup({
          authorId,
          groupId: group.groupId,
          name: group.name,
          position: group.position
        })
        await core.append(event)
      }

      const bookmarks = [...deviceState.bookmarks.values()]
        .filter((bookmark) => bookmark.collectionId === collectionUuid && !bookmark.deleted)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.bookmarkId.localeCompare(b.bookmarkId))

      for (const bookmark of bookmarks) {
        const event = addBookmark({
          authorId,
          bookmarkId: bookmark.bookmarkId,
          resourceId: bookmark.resourceId,
          canonicalUrl: bookmark.canonicalUrl,
          title: bookmark.title,
          description: bookmark.description,
          tags: bookmark.tags,
          notes: bookmark.notes,
          groupId: bookmark.groupId
        })
        await core.append(event)
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
