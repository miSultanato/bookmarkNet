import test from 'brittle'
import sodium from 'sodium-native'
import {
  addBookmark,
  collectionGenesis,
  collectionUnpublished,
  createGroup,
  deleteGroup,
  editBookmark,
  genesisSigningHash,
  moveBookmark,
  reorderBookmark,
  removeBookmark,
  updateMetadata
} from '../src/events.ts'
import {
  deserializeSignature,
  sign,
  userKeypairFromMasterKey,
  serializeSignature,
  verify
} from '../src/identity.ts'
import {
  isBookmarkId,
  isCollectionId,
  isEventId,
  isGroupId,
  isResourceId,
  isUserId,
  toHex,
  utf8Bytes,
  userIdFromPublicKey
} from '../src/ids.ts'
import { deriveCollectionKeypair } from '../src/keys.ts'

const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const GROUP_ID = 'g_0123456789ab'
const RESOURCE_ID = 'r_' + 'a'.repeat(64)
const OTHER_COLLECTION_ID = 'b'.repeat(64)

function fixedSeed(start = 0): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (start + i) & 0xff)
}

function expectRangeError(t: any, fn: () => unknown): void {
  let thrown: unknown
  try {
    fn()
  } catch (error) {
    thrown = error
  }
  t.ok(thrown instanceof RangeError)
}

const userPair = userKeypairFromMasterKey(fixedSeed())
const AUTHOR_ID = userIdFromPublicKey(userPair.publicKey)
const collectionPair = deriveCollectionKeypair(fixedSeed(), '01ARZ3NDEKTSV4RRFFQ69G5FAV')
const COLLECTION_ID = toHex(collectionPair.publicKey)

function assertCommonEvent(t: any, event: any, eventType: string): void {
  t.is(event.schema_version, 1)
  t.ok(isEventId(event.event_id))
  t.is(event.event_type, eventType)
  t.is(event.author_id, AUTHOR_ID)
  t.ok(isUserId(event.author_id))
  t.ok(typeof event.created_at === 'string')
  t.ok(Number.isFinite(Date.parse(event.created_at)))
  t.is(new Date(event.created_at).toISOString(), event.created_at)
}

function genesisParams(overrides: Record<string, unknown> = {}): any {
  return {
    collectionId: COLLECTION_ID,
    collectionPublicKey: collectionPair.publicKey,
    authorId: AUTHOR_ID,
    authorPublicKey: userPair.publicKey,
    secretKey: userPair.secretKey,
    name: 'Mi colección',
    description: 'Descripción',
    visibility: 'public',
    forkedFrom: null,
    migratedFrom: null,
    ...overrides
  }
}

test('addBookmark constructs a correctly shaped event', (t) => {
  const event = addBookmark({
    authorId: AUTHOR_ID,
    bookmarkId: BOOKMARK_ID,
    resourceId: RESOURCE_ID,
    canonicalUrl: 'https://example.com/',
    title: 'Ejemplo',
    tags: ['uno', 'dos']
  })
  assertCommonEvent(t, event, 'add_bookmark')
  t.is(event.payload.bookmark_id, BOOKMARK_ID)
  t.is(event.payload.resource_id, RESOURCE_ID)
  t.is(event.payload.canonical_url, 'https://example.com/')
  t.is(event.payload.group_id, null)
  t.ok(!Object.prototype.hasOwnProperty.call(event.payload, 'description'))
  t.ok(!Object.prototype.hasOwnProperty.call(event.payload, 'notes'))
  t.ok(isBookmarkId(event.payload.bookmark_id))
  t.ok(isResourceId(event.payload.resource_id))
})

test('addBookmark preserves optional fields and explicit group', (t) => {
  const event = addBookmark({
    authorId: AUTHOR_ID,
    bookmarkId: BOOKMARK_ID,
    resourceId: RESOURCE_ID,
    canonicalUrl: 'https://example.com/',
    title: 'Ejemplo',
    description: 'Descripción',
    notes: 'Nota',
    tags: [],
    groupId: GROUP_ID
  })
  t.is(event.payload.description, 'Descripción')
  t.is(event.payload.notes, 'Nota')
  t.is(event.payload.group_id, GROUP_ID)
})

test('editBookmark constructs changes including explicit null deletion', (t) => {
  const event = editBookmark({
    authorId: AUTHOR_ID,
    bookmarkId: BOOKMARK_ID,
    changes: { title: 'Nuevo título', notes: null, tags: ['x'] }
  })
  assertCommonEvent(t, event, 'edit_bookmark')
  t.is(event.payload.bookmark_id, BOOKMARK_ID)
  t.is(event.payload.changes.title, 'Nuevo título')
  t.is(event.payload.changes.notes, null)
  t.alike(event.payload.changes.tags, ['x'])
})

test('removeBookmark constructs a correctly shaped event', (t) => {
  const event = removeBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID })
  assertCommonEvent(t, event, 'remove_bookmark')
  t.is(event.payload.bookmark_id, BOOKMARK_ID)
})

test('moveBookmark constructs a correctly shaped event', (t) => {
  const event = moveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: null })
  assertCommonEvent(t, event, 'move_bookmark')
  t.is(event.payload.group_id, null)
})

test('reorderBookmark constructs a correctly shaped event', (t) => {
  const event = reorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: GROUP_ID, position: 0 })
  assertCommonEvent(t, event, 'reorder_bookmark')
  t.is(event.payload.group_id, GROUP_ID)
  t.is(event.payload.position, 0)
})

test('updateMetadata constructs a correctly shaped event', (t) => {
  const event = updateMetadata({ authorId: AUTHOR_ID, changes: { name: 'Renombrada', visibility: 'unlisted' } })
  assertCommonEvent(t, event, 'update_metadata')
  t.is(event.payload.changes.name, 'Renombrada')
  t.is(event.payload.changes.visibility, 'unlisted')
})

test('createGroup constructs a correctly shaped event', (t) => {
  const event = createGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, name: 'Lectura', position: 2 })
  assertCommonEvent(t, event, 'create_group')
  t.is(event.payload.group_id, GROUP_ID)
  t.is(event.payload.name, 'Lectura')
  t.is(event.payload.position, 2)
})

test('deleteGroup constructs a correctly shaped event', (t) => {
  const event = deleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID })
  assertCommonEvent(t, event, 'delete_group')
  t.is(event.payload.group_id, GROUP_ID)
})

test('collectionUnpublished constructs a correctly shaped event', (t) => {
  const event = collectionUnpublished({ authorId: AUTHOR_ID })
  assertCommonEvent(t, event, 'collection_unpublished')
  t.is(event.payload.migrated_to, null)
  t.ok(!Object.prototype.hasOwnProperty.call(event.payload, 'message'))
  const withOptionals = collectionUnpublished({ authorId: AUTHOR_ID, message: 'Hasta luego', migratedTo: OTHER_COLLECTION_ID })
  t.is(withOptionals.payload.message, 'Hasta luego')
  t.is(withOptionals.payload.migrated_to, OTHER_COLLECTION_ID)
})

test('all non-genesis constructors reject an invalid author ID', (t) => {
  expectRangeError(t, () => addBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => editBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, changes: { title: 'x' } }))
  expectRangeError(t, () => removeBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID }))
  expectRangeError(t, () => moveBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, groupId: null }))
  expectRangeError(t, () => reorderBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, groupId: null, position: 0 }))
  expectRangeError(t, () => updateMetadata({ authorId: 'bad', changes: { name: 'x' } }))
  expectRangeError(t, () => createGroup({ authorId: 'bad', groupId: GROUP_ID, name: 'x', position: 0 }))
  expectRangeError(t, () => deleteGroup({ authorId: 'bad', groupId: GROUP_ID }))
  expectRangeError(t, () => collectionUnpublished({ authorId: 'bad' }))
})

test('bookmark constructors validate required IDs and values', (t) => {
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: 'bad', resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, resourceId: 'bad', canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, resourceId: RESOURCE_ID, canonicalUrl: '', title: 'x', tags: [] }))
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: '', tags: [] }))
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: 'no' as any }))
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [1] as any }))
  expectRangeError(t, () => addBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [], groupId: 'bad' }))
  expectRangeError(t, () => editBookmark({ authorId: AUTHOR_ID, bookmarkId: 'bad', changes: { title: 'x' } }))
  expectRangeError(t, () => editBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: {} }))
  expectRangeError(t, () => editBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { tags: ['x', 1] as any } }))
  expectRangeError(t, () => removeBookmark({ authorId: AUTHOR_ID, bookmarkId: 'bad' }))
  expectRangeError(t, () => moveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: 'bad' }))
  expectRangeError(t, () => reorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: 'bad', position: 0 }))
  expectRangeError(t, () => reorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: null, position: -1 }))
  expectRangeError(t, () => reorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: null, position: 1.5 }))
})

test('metadata, group, and unpublished constructors validate fields', (t) => {
  expectRangeError(t, () => updateMetadata({ authorId: AUTHOR_ID, changes: {} }))
  expectRangeError(t, () => updateMetadata({ authorId: AUTHOR_ID, changes: { visibility: 'private' as any } }))
  expectRangeError(t, () => updateMetadata({ authorId: AUTHOR_ID, changes: { name: '' } }))
  expectRangeError(t, () => createGroup({ authorId: AUTHOR_ID, groupId: 'bad', name: 'x', position: 0 }))
  expectRangeError(t, () => createGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, name: '', position: 0 }))
  expectRangeError(t, () => createGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, name: 'x', position: -1 }))
  expectRangeError(t, () => createGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, name: 'x', position: 1.1 }))
  expectRangeError(t, () => deleteGroup({ authorId: AUTHOR_ID, groupId: 'bad' }))
  expectRangeError(t, () => collectionUnpublished({ authorId: AUTHOR_ID, migratedTo: 'bad' }))
})

test('collectionGenesis signs the SHA-256 hash of its specified fields', (t) => {
  const params = genesisParams()
  const event = collectionGenesis(params)
  assertCommonEvent(t, event, 'collection_genesis')
  t.is(event.payload.collection_id, COLLECTION_ID)
  t.ok(isCollectionId(event.payload.collection_id))
  t.is(event.payload.collection_public_key, 'pk_col_' + toHex(collectionPair.publicKey))
  t.is(event.payload.author_public_key, 'pk_user_' + toHex(userPair.publicKey))
  t.is(event.payload.signature_by_owner, serializeSignature(deserializeSignature(event.payload.signature_by_owner)))
  const hash = genesisSigningHash(params)
  const signature = deserializeSignature(event.payload.signature_by_owner)
  t.ok(verify(signature, hash, userPair.publicKey))
})

test('genesisSigningHash uses null bytes between signing fields', (t) => {
  const params = genesisParams({ name: 'a' })
  const fields = [
    params.collectionId,
    toHex(params.collectionPublicKey),
    params.authorId,
    toHex(params.authorPublicKey),
    params.name,
    params.visibility,
    params.forkedFrom ?? '',
    params.migratedFrom ?? ''
  ]
  const expectedHash = new Uint8Array(32)
  sodium.crypto_hash_sha256(expectedHash, utf8Bytes(fields.join('\x00')))
  const legacyHash = new Uint8Array(32)
  sodium.crypto_hash_sha256(legacyHash, utf8Bytes(fields.join('')))

  t.alike(genesisSigningHash(params), expectedHash)
  t.ok(toHex(expectedHash) !== toHex(legacyHash))
})

test('genesis signature fails verification when a signed field changes', (t) => {
  const params = genesisParams()
  const event = collectionGenesis(params)
  const alteredHash = genesisSigningHash({ ...params, name: 'Otro nombre' })
  t.ok(!verify(deserializeSignature(event.payload.signature_by_owner), alteredHash, userPair.publicKey))
})

test('genesis description is excluded from the signing hash', (t) => {
  const firstParams = genesisParams({ description: 'Primera descripción' })
  const secondParams = genesisParams({ description: 'Otra descripción' })
  const first = collectionGenesis(firstParams)
  const second = collectionGenesis(secondParams)
  t.alike(genesisSigningHash(firstParams), genesisSigningHash(secondParams))
  t.is(first.payload.signature_by_owner, second.payload.signature_by_owner)
  t.ok(verify(
    deserializeSignature(first.payload.signature_by_owner),
    genesisSigningHash(secondParams),
    userPair.publicKey
  ))
})

test('genesis validates IDs, keys, visibility, and provenance', (t) => {
  expectRangeError(t, () => collectionGenesis(genesisParams({ collectionId: 'bad' })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ collectionId: 'c'.repeat(64) })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ collectionPublicKey: new Uint8Array(31) })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ authorId: 'bad' })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ authorPublicKey: new Uint8Array(31) })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ authorId: 'u_' + '0'.repeat(16) })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ secretKey: new Uint8Array(63) })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ name: '' })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ visibility: 'private' })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ forkedFrom: 'bad' })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ migratedFrom: 'bad' })))
  expectRangeError(t, () => collectionGenesis(genesisParams({ forkedFrom: OTHER_COLLECTION_ID, migratedFrom: 'c'.repeat(64) })))
})

test('forked_from and migrated_from participate in the genesis hash', (t) => {
  const originalParams = genesisParams({ forkedFrom: null, migratedFrom: null })
  const forkedParams = genesisParams({ forkedFrom: OTHER_COLLECTION_ID, migratedFrom: null })
  const original = collectionGenesis(originalParams)
  const forked = collectionGenesis(forkedParams)
  t.ok(toHex(genesisSigningHash(originalParams)) !== toHex(genesisSigningHash(forkedParams)))
  t.ok(original.payload.signature_by_owner !== forked.payload.signature_by_owner)
  t.ok(verify(
    deserializeSignature(forked.payload.signature_by_owner),
    genesisSigningHash(forkedParams),
    userPair.publicKey
  ))
})

test('genesisSigningHash rejects invalid signing parameters', (t) => {
  expectRangeError(t, () => genesisSigningHash({ ...genesisParams(), visibility: 'private' }))
  expectRangeError(t, () => genesisSigningHash({ ...genesisParams(), forkedFrom: OTHER_COLLECTION_ID, migratedFrom: OTHER_COLLECTION_ID }))
})
