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
import type { DeviceEvent } from '../src/device-events.ts'
import { applyDeviceEvent, emptyDeviceState, foldDeviceEvents } from '../src/device-fold.ts'

const AUTHOR_ID = 'u_0123456789abcdef'
const COLLECTION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const BOOKMARK_2 = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const BOOKMARK_3 = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
const GROUP_ID = 'g_0123456789ab'
const RESOURCE_ID = 'r_' + 'a'.repeat(64)
const T1 = '2026-10-24T10:00:00.000Z'
const T2 = '2026-10-24T11:00:00.000Z'
const T3 = '2026-10-24T12:00:00.000Z'

function at<T extends DeviceEvent>(event: T, createdAt: string): T {
  return { ...event, created_at: createdAt }
}

function collection(createdAt = T1, id = COLLECTION_ID) {
  return at(deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: id, name: 'Colección', visibility: 'public', description: 'Descripción' }), createdAt)
}
function group(createdAt = T1, groupId = GROUP_ID, collectionId = COLLECTION_ID) {
  return at(deviceCreateGroup({ authorId: AUTHOR_ID, groupId, collectionId, name: 'Lectura', position: 2 }), createdAt)
}
function bookmark(id = BOOKMARK_ID, groupId: string | null = null, createdAt = T1, collectionId: string | null = COLLECTION_ID) {
  return at(deviceAddBookmark({
    authorId: AUTHOR_ID, bookmarkId: id, collectionId, resourceId: RESOURCE_ID,
    canonicalUrl: 'https://example.com/', title: 'Título', description: 'Descripción bookmark',
    tags: ['uno', 'dos'], notes: 'Nota', groupId
  }), createdAt)
}
function eventOn(event: DeviceEvent, createdAt = T2): DeviceEvent {
  return at(event, createdAt)
}
function initial(withGroup = false) {
  let state = applyDeviceEvent(emptyDeviceState(), collection())
  if (withGroup) state = applyDeviceEvent(state, group())
  return state
}

test('emptyDeviceState returns empty profile and Maps', (t) => {
  const state = emptyDeviceState()
  t.alike(state.profile, {})
  t.is(state.collections.size, 0)
  t.is(state.bookmarks.size, 0)
  t.is(state.groups.size, 0)
})

test('device_metadata replaces profile, removes absent fields and accepts empty profile', (t) => {
  let state = applyDeviceEvent(emptyDeviceState(), deviceMetadata({ authorId: AUTHOR_ID, displayName: 'Marta', bio: 'Hola', avatar: 'avatar' }))
  t.alike(state.profile, { displayName: 'Marta', bio: 'Hola', avatar: 'avatar' })
  state = applyDeviceEvent(state, deviceMetadata({ authorId: AUTHOR_ID, displayName: 'Ana' }))
  t.alike(state.profile, { displayName: 'Ana' })
  state = applyDeviceEvent(state, deviceMetadata({ authorId: AUTHOR_ID }))
  t.alike(state.profile, {})
})

test('device_create_collection creates once with timestamps and optional description', (t) => {
  let state = applyDeviceEvent(emptyDeviceState(), collection(T1))
  t.alike(state.collections.get(COLLECTION_ID), {
    collectionId: COLLECTION_ID, name: 'Colección', description: 'Descripción',
    visibility: 'public', language: 'es', deleted: false, createdAt: T1
  })
  const second = applyDeviceEvent(state, collection(T2))
  t.is(second, state)
  t.is(second.collections.get(COLLECTION_ID)?.createdAt, T1)
  const withoutDescription = applyDeviceEvent(emptyDeviceState(), deviceCreateCollection({
    authorId: AUTHOR_ID, collectionId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ', name: 'Sin descripción', visibility: 'unlisted'
  }))
  t.is(Object.prototype.hasOwnProperty.call(withoutDescription.collections.get('01ARZ3NDEKTSV4RRFFQ69G5FAZ'), 'description'), false)
  t.is(withoutDescription.collections.get('01ARZ3NDEKTSV4RRFFQ69G5FAZ')?.language, 'es')

  const englishEvent = deviceCreateCollection({ authorId: AUTHOR_ID, collectionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW', name: 'English', visibility: 'public', language: 'en' })
  const english = applyDeviceEvent(emptyDeviceState(), englishEvent)
  t.is(english.collections.get('01ARZ3NDEKTSV4RRFFQ69G5FAW')?.language, 'en')

  const malformed = collection()
  delete (malformed.payload as any).language
  const defaulted = applyDeviceEvent(emptyDeviceState(), malformed)
  t.is(defaulted.collections.get(COLLECTION_ID)?.language, 'es')
})

test('device_update_collection ignores missing/deleted collection and applies only present changes', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { name: 'Nueva' } })), empty)
  const state = initial()
  const updated = applyDeviceEvent(state, eventOn(deviceUpdateCollection({
    authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { name: 'Nueva', description: null, visibility: 'unlisted', language: 'eu' }
  }), T2))
  t.is(updated.collections.get(COLLECTION_ID)?.name, 'Nueva')
  t.is(updated.collections.get(COLLECTION_ID)?.visibility, 'unlisted')
  t.is(updated.collections.get(COLLECTION_ID)?.language, 'eu')
  t.is(Object.prototype.hasOwnProperty.call(updated.collections.get(COLLECTION_ID), 'description'), false)
  t.is(updated.collections.get(COLLECTION_ID)?.updatedAt, T2)
  t.is(state.collections.get(COLLECTION_ID)?.name, 'Colección')
  t.is(state.collections.get(COLLECTION_ID)?.language, 'es')
  const deleted = applyDeviceEvent(updated, eventOn(deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID }), T3))
  t.is(applyDeviceEvent(deleted, deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { name: 'Ignorar' } })), deleted)

  const unchanged = applyDeviceEvent(state, deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { name: 'Solo nombre' } }))
  t.is(unchanged.collections.get(COLLECTION_ID)?.language, 'es')
})

test('device_delete_collection ignores missing/repeated events and cascades permanently', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID })), empty)
  let state = applyDeviceEvent(initial(true), bookmark(BOOKMARK_ID, GROUP_ID))
  const deleted = applyDeviceEvent(state, eventOn(deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID }), T2))
  t.is(deleted.collections.get(COLLECTION_ID)?.deleted, true)
  t.is(deleted.collections.get(COLLECTION_ID)?.updatedAt, T2)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.deleted, true)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.updatedAt, T2)
  t.is(deleted.groups.get(GROUP_ID)?.deleted, true)
  t.is(deleted.groups.get(GROUP_ID)?.updatedAt, T2)
  t.is(applyDeviceEvent(deleted, eventOn(deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID }), T3)), deleted)
  const duplicateCollection = applyDeviceEvent(deleted, collection(T3))
  t.is(duplicateCollection, deleted)
  t.is(duplicateCollection.bookmarks.get(BOOKMARK_ID)?.deleted, true)
})

test('device_add_bookmark ignores invalid parents and duplicates; null collection means global Inbox', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, bookmark()), empty)
  const state = initial()
  const added = applyDeviceEvent(state, bookmark())
  t.is(added.bookmarks.get(BOOKMARK_ID)?.position, null)
  t.is(added.bookmarks.get(BOOKMARK_ID)?.deleted, false)
  t.is(added.bookmarks.get(BOOKMARK_ID)?.createdAt, T1)
  t.is(added.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  t.is(applyDeviceEvent(added, bookmark(BOOKMARK_ID, null, T2)), added)
  t.is(applyDeviceEvent(state, bookmark(BOOKMARK_ID, GROUP_ID)), state)
  const globalInbox = applyDeviceEvent(emptyDeviceState(), bookmark(BOOKMARK_ID, null, T1, null))
  t.is(globalInbox.bookmarks.get(BOOKMARK_ID)?.collectionId, null)
  t.is(globalInbox.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  const malformed = bookmark(BOOKMARK_2, null, T1, null)
  ;(malformed.payload as any).groupId = GROUP_ID
  t.is(applyDeviceEvent(emptyDeviceState(), malformed).bookmarks.size, 0)
  const withGroup = applyDeviceEvent(initial(), group())
  const groupedBookmark = applyDeviceEvent(withGroup, bookmark(BOOKMARK_ID, GROUP_ID))
  t.is(groupedBookmark.bookmarks.get(BOOKMARK_ID)?.groupId, GROUP_ID)
  const deletedGroup = applyDeviceEvent(withGroup, deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID }))
  t.is(applyDeviceEvent(deletedGroup, bookmark(BOOKMARK_ID, GROUP_ID)), deletedGroup)
})

test('device_edit_bookmark handles nulls, empty values, missing and deleted bookmarks', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { title: 'x' } })), empty)
  const added = applyDeviceEvent(initial(), bookmark())
  const nullChanges = deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { title: 'temporal' } })
  ;(nullChanges.payload.changes as any).title = null
  ;(nullChanges.payload.changes as any).tags = null
  const edited = applyDeviceEvent(added, eventOn(nullChanges, T2))
  t.is(edited.bookmarks.get(BOOKMARK_ID)?.title, 'Título')
  t.alike(edited.bookmarks.get(BOOKMARK_ID)?.tags, ['uno', 'dos'])
  t.is(edited.bookmarks.get(BOOKMARK_ID)?.updatedAt, T2)
  const clearChanges = deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { description: null, notes: null, title: 'temporal', tags: [] } })
  ;(clearChanges.payload.changes as any).title = ''
  const cleared = applyDeviceEvent(edited, eventOn(clearChanges, T3))
  t.is(cleared.bookmarks.get(BOOKMARK_ID)?.title, '')
  t.alike(cleared.bookmarks.get(BOOKMARK_ID)?.tags, [])
  t.is(Object.prototype.hasOwnProperty.call(cleared.bookmarks.get(BOOKMARK_ID), 'description'), false)
  t.is(Object.prototype.hasOwnProperty.call(cleared.bookmarks.get(BOOKMARK_ID), 'notes'), false)
  const removed = applyDeviceEvent(cleared, deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID }))
  t.is(applyDeviceEvent(removed, deviceEditBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, changes: { title: 'Ignorar' } })), removed)
})

test('device_remove_bookmark soft-deletes once', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID })), empty)
  const added = applyDeviceEvent(initial(), bookmark())
  const removed = applyDeviceEvent(added, eventOn(deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID }), T2))
  t.is(removed.bookmarks.get(BOOKMARK_ID)?.deleted, true)
  t.is(removed.bookmarks.get(BOOKMARK_ID)?.updatedAt, T2)
  t.is(applyDeviceEvent(removed, deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID })), removed)
})

test('device_move_bookmark handles global Inbox, collections, groups, and invalid destinations', (t) => {
  const empty = emptyDeviceState()
  const noBookmark = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: null })
  t.is(applyDeviceEvent(empty, noBookmark), empty)

  const COLLECTION_2 = '01ARZ3NDEKTSV4RRFFQ69G5FAZ'
  let state = applyDeviceEvent(initial(true), bookmark(BOOKMARK_ID, GROUP_ID))
  state = applyDeviceEvent(state, deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: GROUP_ID, position: 0 }))
  state = applyDeviceEvent(state, collection(T1, COLLECTION_2))
  const crossCollection = applyDeviceEvent(state, eventOn(deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_2, groupId: null
  }), T2))
  t.is(crossCollection.bookmarks.get(BOOKMARK_ID)?.collectionId, COLLECTION_2)
  t.is(crossCollection.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  t.is(crossCollection.bookmarks.get(BOOKMARK_ID)?.position, null)
  t.is(crossCollection.bookmarks.get(BOOKMARK_ID)?.updatedAt, T2)

  const backToCollection = applyDeviceEvent(crossCollection, deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: null
  }))
  const grouped = applyDeviceEvent(backToCollection, eventOn(deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: GROUP_ID
  }), T3))
  t.is(grouped.bookmarks.get(BOOKMARK_ID)?.groupId, GROUP_ID)
  t.is(grouped.bookmarks.get(BOOKMARK_ID)?.position, null)

  const inbox = applyDeviceEvent(grouped, deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, groupId: null
  }))
  t.is(inbox.bookmarks.get(BOOKMARK_ID)?.collectionId, null)
  t.is(inbox.bookmarks.get(BOOKMARK_ID)?.groupId, null)

  const malformed = deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: null, groupId: null })
  ;(malformed.payload as any).groupId = GROUP_ID
  t.is(applyDeviceEvent(inbox, malformed), inbox)

  const missingCollection = deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: '01ARZ3NDEKTSV4RRFFQ69G5FAY', groupId: null
  })
  t.is(applyDeviceEvent(inbox, missingCollection), inbox)

  const deletedCollection = applyDeviceEvent(state, deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_2 }))
  t.is(applyDeviceEvent(deletedCollection, deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_2, groupId: null
  })), deletedCollection)

  const otherGroup = 'g_abcdef123456'
  const withOtherCollectionGroup = applyDeviceEvent(state, group(T1, otherGroup, COLLECTION_2))
  const wrongCollectionGroup = deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: otherGroup
  })
  t.is(applyDeviceEvent(withOtherCollectionGroup, wrongCollectionGroup), withOtherCollectionGroup)

  const deletedGroup = applyDeviceEvent(grouped, deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID }))
  t.is(applyDeviceEvent(deletedGroup, deviceMoveBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: GROUP_ID
  })), deletedGroup)
})

test('device_reorder_bookmark materializes by createdAt and bookmarkId, clamps and ignores deleted items', (t) => {
  let state = applyDeviceEvent(initial(true), bookmark(BOOKMARK_2, GROUP_ID, T1))
  state = applyDeviceEvent(state, bookmark(BOOKMARK_ID, GROUP_ID, T1))
  state = applyDeviceEvent(state, bookmark(BOOKMARK_3, GROUP_ID, T2))
  const reordered = applyDeviceEvent(state, eventOn(deviceReorderBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_2, groupId: GROUP_ID, position: 0
  }), T3))
  t.is(reordered.bookmarks.get(BOOKMARK_2)?.position, 0)
  t.is(reordered.bookmarks.get(BOOKMARK_ID)?.position, 1)
  t.is(reordered.bookmarks.get(BOOKMARK_3)?.position, 2)
  t.is(reordered.bookmarks.get(BOOKMARK_2)?.updatedAt, T3)
  const end = applyDeviceEvent(reordered, deviceReorderBookmark({
    authorId: AUTHOR_ID, bookmarkId: BOOKMARK_2, groupId: GROUP_ID, position: 100
  }))
  t.is(end.bookmarks.get(BOOKMARK_2)?.position, 2)
  t.is(end.bookmarks.get(BOOKMARK_ID)?.position, 0)
  t.is(end.bookmarks.get(BOOKMARK_3)?.position, 1)
  const wrongGroup = applyDeviceEvent(end, deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_2, groupId: null, position: 0 }))
  t.is(wrongGroup, end)
  const removed = applyDeviceEvent(end, deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID }))
  const deletedPosition = removed.bookmarks.get(BOOKMARK_ID)?.position
  const final = applyDeviceEvent(removed, deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_3, groupId: GROUP_ID, position: 0 }))
  t.is(final.bookmarks.get(BOOKMARK_ID)?.position, deletedPosition)
  t.is(final.bookmarks.get(BOOKMARK_ID)?.deleted, true)
  t.is(final.bookmarks.get(BOOKMARK_3)?.position, 0)
  t.is(final.bookmarks.get(BOOKMARK_2)?.position, 1)
  t.is(applyDeviceEvent(emptyDeviceState(), deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: null, position: 0 })).bookmarks.size, 0)
})

test('device_create_group requires active collection and ignores duplicates', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, group()), empty)
  const state = initial()
  const created = applyDeviceEvent(state, group(T1))
  t.alike(created.groups.get(GROUP_ID), {
    groupId: GROUP_ID, collectionId: COLLECTION_ID, name: 'Lectura',
    position: 2, deleted: false, createdAt: T1
  })
  t.is(applyDeviceEvent(created, group(T2)), created)
})

test('device_delete_group leaves active bookmarks in their collection root', (t) => {
  const empty = emptyDeviceState()
  t.is(applyDeviceEvent(empty, deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID })), empty)
  let state = applyDeviceEvent(initial(true), bookmark(BOOKMARK_ID, GROUP_ID))
  state = applyDeviceEvent(state, bookmark(BOOKMARK_2, GROUP_ID))
  state = applyDeviceEvent(state, deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_2 }))
  const deleted = applyDeviceEvent(state, eventOn(deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID }), T2))
  t.is(deleted.groups.get(GROUP_ID)?.deleted, true)
  t.is(deleted.groups.get(GROUP_ID)?.updatedAt, T2)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.collectionId, COLLECTION_ID)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.position, null)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.updatedAt, T2)
  t.is(deleted.bookmarks.get(BOOKMARK_2)?.groupId, GROUP_ID)
  t.is(applyDeviceEvent(deleted, deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID })), deleted)
})


test('device_delete_group ignores non-existent groups', (t) => {
  const empty = emptyDeviceState()
  const missingGroupId = 'g_0123456789ac'

  t.is(applyDeviceEvent(empty, deviceDeleteGroup({
    authorId: AUTHOR_ID,
    groupId: missingGroupId,
    collectionId: COLLECTION_ID
  })), empty)

  const stateWithCollection = applyDeviceEvent(emptyDeviceState(), collection())
  t.is(applyDeviceEvent(stateWithCollection, deviceDeleteGroup({
    authorId: AUTHOR_ID,
    groupId: missingGroupId,
    collectionId: COLLECTION_ID
  })), stateWithCollection)
})

test('device_delete_group handles empty groups without side effects on bookmarks', (t) => {
  const state = applyDeviceEvent(initial(), group(T1))
  const deletedEmptyGroup = applyDeviceEvent(state, eventOn(
    deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID }),
    T2
  ))

  t.is(deletedEmptyGroup.groups.get(GROUP_ID)?.deleted, true)
  t.is(deletedEmptyGroup.groups.get(GROUP_ID)?.updatedAt, T2)
  t.is(deletedEmptyGroup.bookmarks.size, 0)
})


test('foldDeviceEvents folds empty and complete logs in order', (t) => {
  t.alike(foldDeviceEvents([]), emptyDeviceState())
  const state = foldDeviceEvents([
    deviceMetadata({ authorId: AUTHOR_ID, displayName: 'Final' }),
    collection(T1),
    group(T1),
    bookmark(BOOKMARK_ID, GROUP_ID, T1),
    deviceMoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, collectionId: COLLECTION_ID, groupId: GROUP_ID }),
    deviceReorderBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID, groupId: GROUP_ID, position: 0 }),
    deviceRemoveBookmark({ authorId: AUTHOR_ID, bookmarkId: BOOKMARK_ID }),
    deviceDeleteGroup({ authorId: AUTHOR_ID, groupId: GROUP_ID, collectionId: COLLECTION_ID }),
    deviceDeleteCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID })
  ])
  t.alike(state.profile, { displayName: 'Final' })
  t.is(state.collections.get(COLLECTION_ID)?.deleted, true)
  t.is(state.groups.get(GROUP_ID)?.deleted, true)
  t.is(state.bookmarks.get(BOOKMARK_ID)?.deleted, true)
})

test('applyDeviceEvent does not mutate input Maps or objects', (t) => {
  const before = initial(true)
  const originalCollections = before.collections
  const originalGroups = before.groups
  const originalCollection = before.collections.get(COLLECTION_ID)
  const after = applyDeviceEvent(before, deviceUpdateCollection({ authorId: AUTHOR_ID, collectionId: COLLECTION_ID, changes: { name: 'Nueva' } }))
  t.is(before.collections, originalCollections)
  t.is(before.groups, originalGroups)
  t.is(before.collections.get(COLLECTION_ID), originalCollection)
  t.is(before.collections.get(COLLECTION_ID)?.name, 'Colección')
  t.is(after.collections !== before.collections, true)
  t.is(after.groups, before.groups)
  const profile = applyDeviceEvent(before, deviceMetadata({ authorId: AUTHOR_ID, displayName: 'Ana' }))
  t.alike(before.profile, {})
  t.alike(profile.profile, { displayName: 'Ana' })
})

test('reapplying an idempotent create event leaves state equivalent', (t) => {
  const event = collection()
  const once = applyDeviceEvent(emptyDeviceState(), event)
  const twice = applyDeviceEvent(once, event)
  t.is(twice, once)
})
