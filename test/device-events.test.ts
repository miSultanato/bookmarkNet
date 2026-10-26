import test from 'brittle'
import {
  deviceAddBookmark,
  deviceCreateCollection,
  deviceCreateGroup,
  deviceDeleteCollection,
  deviceDeleteGroup,
  deviceEditBookmark,
  deviceMetadata,
  deviceMoveBookmark,
  deviceReorderBookmark,
  deviceRemoveBookmark,
  deviceUpdateCollection
} from '../src/device-events.ts'
import { isEventId, isGroupId, isUserId } from '../src/ids.ts'

const AUTHOR_ID = 'u_0123456789abcdef'
const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const GROUP_ID = 'g_0123456789ab'
const RESOURCE_ID = 'r_' + 'a'.repeat(64)
const COLLECTION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

function expectRangeError(t: any, fn: () => unknown): void {
  let thrown: unknown
  try { fn() } catch (error) { thrown = error }
  t.ok(thrown instanceof RangeError)
}

function assertCommon(t: any, event: any, type: string): void {
  t.is(event.schema_version, 1)
  t.ok(isEventId(event.event_id))
  t.is(event.event_type, type)
  t.is(event.author_id, AUTHOR_ID)
  t.ok(isUserId(event.author_id))
  t.ok(typeof event.created_at === 'string')
  t.ok(Number.isFinite(Date.parse(event.created_at)))
}

test('deviceMetadata constructs event and permits an empty profile payload', (t) => {
  const event = deviceMetadata({ authorId: AUTHOR_ID })
  assertCommon(t, event, 'device_metadata')
  t.alike(event.payload, {})
  const profile = deviceMetadata({ authorId: AUTHOR_ID, displayName: 'Marta', bio: 'Hola', avatar: 'https://example.com/a.png' })
  t.is(profile.payload.displayName, 'Marta')
  t.is(profile.payload.bio, 'Hola')
  t.is(profile.payload.avatar, 'https://example.com/a.png')
})

test('deviceCreateCollection constructs event', (t) => {
  const event = deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: 'Viajes', visibility: 'public' })
  assertCommon(t, event, 'device_create_collection')
  t.is(event.payload.collectionId, COLLECTION_ID)
  t.is(event.payload.visibility, 'public')
  t.is(event.payload.language, 'es')
  const english = deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: 'Travel', visibility: 'public', language: 'en' })
  t.is(english.payload.language, 'en')
  expectRangeError(t, () => deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: 'Bad', visibility: 'public', language: 'fr' as any }))
})

test('deviceUpdateCollection constructs event and accepts null description', (t) => {
  const event = deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { description: null, visibility: 'unlisted' } })
  assertCommon(t, event, 'device_update_collection')
  t.is(event.payload.changes.description, null)
  t.is(event.payload.changes.visibility, 'unlisted')
  const basque = deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { language: 'eu' } })
  t.is(basque.payload.changes.language, 'eu')
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { language: 'fr' as any } }))
})

test('deviceDeleteCollection constructs event', (t) => {
  const event = deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID })
  assertCommon(t, event, 'device_delete_collection')
  t.is(event.payload.collectionId, COLLECTION_ID)
})

test('deviceAddBookmark constructs event and normalizes missing group to Inbox', (t) => {
  const event = deviceAddBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID,
    resourceId: RESOURCE_ID, canonicalUrl: 'https://example.com/', title: 'Example', tags: []
  })
  assertCommon(t, event, 'device_add_bookmark')
  t.is(event.payload.bookmarkId, BOOKMARK_ID)
  t.is(event.payload.groupId, null)
  const grouped = deviceAddBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID,
    resourceId: RESOURCE_ID, canonicalUrl: 'https://example.com/', title: 'Example', tags: [], groupId: GROUP_ID
  })
  t.is(grouped.payload.groupId, GROUP_ID)
})

test('deviceEditBookmark accepts an empty title', (t) => {
  const event = deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { title: '' } })
  assertCommon(t, event, 'device_edit_bookmark')
  t.is(event.payload.changes.title, '')
})

test('deviceEditBookmark rejects a null title', (t) => {
  expectRangeError(t, () => deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { title: null as any } }))
})

test('deviceRemoveBookmark constructs event', (t) => {
  const event = deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID })
  assertCommon(t, event, 'device_remove_bookmark')
  t.is(event.payload.bookmarkId, BOOKMARK_ID)
})

test('deviceMoveBookmark constructs event', (t) => {
  const event = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: null })
  assertCommon(t, event, 'device_move_bookmark')
  t.is(event.payload.collectionId, COLLECTION_ID)
  t.is(event.payload.groupId, null)
})

test('deviceMoveBookmark requires collectionId and supports global Inbox', (t) => {
  let missingError: unknown
  try {
    deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: undefined as any, groupId: null })
  } catch (error) {
    missingError = error
  }
  t.ok(missingError instanceof RangeError)
  t.is((missingError as Error).message, 'collectionId is required (use null for global Inbox)')

  const inbox = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, groupId: null })
  t.is(inbox.payload.collectionId, null)
  t.is(inbox.payload.groupId, null)

  expectRangeError(t, () => deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, groupId: GROUP_ID
  }))
})

test('deviceReorderBookmark constructs event', (t) => {
  const event = deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: GROUP_ID, position: 0 })
  assertCommon(t, event, 'device_reorder_bookmark')
  t.is(event.payload.position, 0)
})

test('deviceCreateGroup constructs event', (t) => {
  const event = deviceCreateGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID, name: 'Leer', position: 1 })
  assertCommon(t, event, 'device_create_group')
  t.is(event.payload.groupId, GROUP_ID)
})

test('deviceDeleteGroup constructs event', (t) => {
  const event = deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID })
  assertCommon(t, event, 'device_delete_group')
  t.is(event.payload.collectionId, COLLECTION_ID)
})

test('all device event constructors reject invalid authorId', (t) => {
  expectRangeError(t, () => deviceMetadata({ authorId: 'bad' }))
  expectRangeError(t, () => deviceCreateCollection({ authorId: 'bad', collectionId: COLLECTION_ID, name: 'x', visibility: 'public' }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: 'bad', collectionId: COLLECTION_ID, changes: { name: 'x' } }))
  expectRangeError(t, () => deviceDeleteCollection({ authorId: 'bad', collectionId: COLLECTION_ID }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => deviceEditBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, changes: { notes: null } }))
  expectRangeError(t, () => deviceRemoveBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID }))
  expectRangeError(t, () => deviceMoveBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: null }))
  expectRangeError(t, () => deviceReorderBookmark({ authorId: 'bad', bookmarkId: BOOKMARK_ID, groupId: null, position: 0 }))
  expectRangeError(t, () => deviceCreateGroup({ authorId: 'bad', groupId: GROUP_ID, collectionId: COLLECTION_ID, name: 'x', position: 0 }))
  expectRangeError(t, () => deviceDeleteGroup({ authorId: 'bad', groupId: GROUP_ID, collectionId: COLLECTION_ID }))
})

test('collection constructors validate required fields and visibility', (t) => {
  expectRangeError(t, () => deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: '', name: 'x', visibility: 'public' }))
  expectRangeError(t, () => deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: '', visibility: 'public' }))
  expectRangeError(t, () => deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: 'x', visibility: 'private' as any }))
  expectRangeError(t, () => deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: 'x', visibility: 'public', language: 'fr' as any }))
  expectRangeError(t, () => deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, name: 'x', visibility: 'public', description: 1 as any }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: '', changes: { name: 'x' } }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: {} }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { name: '' } }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { visibility: 'private' as any } }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { language: 'fr' as any } }))
  expectRangeError(t, () => deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { description: 2 as any } }))
  expectRangeError(t, () => deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: '' }))
})

test('bookmark constructors validate IDs, strings, tags, groups, and non-empty changes', (t) => {
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: 'bad', collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: '', resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: 'bad', canonicalUrl: 'x', title: 'x', tags: [] }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: '', title: 'x', tags: [] }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: '', tags: [] }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: 'bad' as any }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [1] as any }))
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [], groupId: 'bad' }))
  const globalInbox = deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [], groupId: null })
  t.is(globalInbox.payload.collectionId, null)
  expectRangeError(t, () => deviceAddBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, resourceId: RESOURCE_ID, canonicalUrl: 'x', title: 'x', tags: [], groupId: GROUP_ID }))
  expectRangeError(t, () => deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: 'bad', changes: { title: 'x' } }))
  expectRangeError(t, () => deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: {} }))
  expectRangeError(t, () => deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { title: 1 as any } }))
  expectRangeError(t, () => deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { tags: 'bad' as any } }))
  expectRangeError(t, () => deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: 'bad' }))
  expectRangeError(t, () => deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: 'bad' }))
  const moveRoot = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: null })
  const moveGroup = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: GROUP_ID })
  const moveInbox = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, groupId: null })
  t.is(moveRoot.payload.collectionId, COLLECTION_ID)
  t.is(moveGroup.payload.groupId, GROUP_ID)
  t.is(moveInbox.payload.collectionId, null)
  expectRangeError(t, () => deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, groupId: GROUP_ID }))
  expectRangeError(t, () => deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: 'bad', position: 0 }))
  expectRangeError(t, () => deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: null, position: -1 }))
  expectRangeError(t, () => deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: null, position: 1.5 }))
})

test('group constructors validate IDs, names, collections, and positions', (t) => {
  t.ok(isGroupId(GROUP_ID))
  expectRangeError(t, () => deviceCreateGroup({ authorId: AUTHOR_ID, groupId: 'bad', collectionId: COLLECTION_ID, name: 'x', position: 0 }))
  expectRangeError(t, () => deviceCreateGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: '', name: 'x', position: 0 }))
  expectRangeError(t, () => deviceCreateGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID, name: '', position: 0 }))
  expectRangeError(t, () => deviceCreateGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID, name: 'x', position: -1 }))
  expectRangeError(t, () => deviceCreateGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID, name: 'x', position: 0.5 }))
  expectRangeError(t, () => deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: 'bad', collectionId: COLLECTION_ID }))
  expectRangeError(t, () => deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: '' }))
})
