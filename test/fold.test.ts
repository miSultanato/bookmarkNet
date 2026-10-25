import test from 'brittle'
import { applyEvent, emptyState, foldEvents } from '../src/fold.ts'

const AUTHOR_ID = 'u_test-author'
const CREATED_AT = '2026-10-24T10:00:00.000Z'
const UPDATED_AT = '2026-10-24T11:00:00.000Z'
const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const SECOND_BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const GROUP_ID = 'g_0123456789ab'
let nextEventId = 0

function event(event_type, payload, created_at = CREATED_AT, event_id = `event-${++nextEventId}`) {
  return {
    schema_version: 1,
    event_id,
    event_type,
    author_id: AUTHOR_ID,
    created_at,
    payload
  }
}

function genesis(name = 'Mi colección', eventId) {
  return event('collection_genesis', {
    collection_id: 'a'.repeat(64),
    collection_public_key: 'pk_col_test',
    author_public_key: 'pk_user_test',
    name,
    description: 'Descripción original',
    visibility: 'public',
    forked_from: null,
    migrated_from: null,
    signature_by_owner: 'signature'
  }, CREATED_AT, eventId)
}

function addBookmark(bookmarkId = BOOKMARK_ID, payloadOverrides = {}, createdAt = CREATED_AT) {
  return event('add_bookmark', {
    bookmark_id: bookmarkId,
    resource_id: 'r_' + 'b'.repeat(64),
    canonical_url: 'https://example.com/',
    title: 'Ejemplo',
    description: 'Descripción del bookmark',
    tags: ['uno', 'dos'],
    notes: 'Nota',
    group_id: null,
    ...payloadOverrides
  }, createdAt)
}

function stateWithGenesis() {
  return applyEvent(emptyState(), genesis())
}

test('emptyState returns null collection and empty Maps', (t) => {
  const state = emptyState()
  t.is(state.collection, null)
  t.is(state.bookmarks.size, 0)
  t.is(state.groups.size, 0)
  t.ok(state.bookmarks instanceof Map)
  t.ok(state.groups instanceof Map)
})

test('collection_genesis creates CollectionMeta from payload and event timestamp', (t) => {
  const state = applyEvent(emptyState(), genesis())
  t.alike(state.collection, {
    collectionId: 'a'.repeat(64),
    collectionPublicKey: 'pk_col_test',
    authorId: AUTHOR_ID,
    authorPublicKey: 'pk_user_test',
    name: 'Mi colección',
    description: 'Descripción original',
    visibility: 'public',
    forkedFrom: null,
    migratedFrom: null,
    createdAt: CREATED_AT,
    unpublished: false
  })
})

test('collection_genesis only applies once', (t) => {
  const first = applyEvent(emptyState(), genesis('Primera', 'genesis-1'))
  const second = applyEvent(first, genesis('Segunda', 'genesis-2'))
  t.is(second, first)
  t.is(second.collection?.name, 'Primera')
})

test('add_bookmark without genesis is ignored', (t) => {
  const state = emptyState()
  t.is(applyEvent(state, addBookmark()), state)
})

test('add_bookmark creates bookmark state with position null and event timestamp', (t) => {
  const eventCreatedAt = '2026-10-24T10:12:00.000Z'
  const state = applyEvent(stateWithGenesis(), addBookmark(BOOKMARK_ID, {}, eventCreatedAt))
  const bookmark = state.bookmarks.get(BOOKMARK_ID)
  t.ok(bookmark)
  t.is(bookmark?.bookmarkId, BOOKMARK_ID)
  t.is(bookmark?.resourceId, 'r_' + 'b'.repeat(64))
  t.is(bookmark?.canonicalUrl, 'https://example.com/')
  t.is(bookmark?.title, 'Ejemplo')
  t.alike(bookmark?.tags, ['uno', 'dos'])
  t.is(bookmark?.position, null)
  t.is(bookmark?.deleted, false)
  t.is(bookmark?.createdAt, eventCreatedAt)
  t.is(bookmark?.updatedAt, undefined)
})

test('add_bookmark with omitted group_id defaults to Inbox', (t) => {
  const payload = {
    bookmark_id: BOOKMARK_ID,
    resource_id: 'r_' + 'b'.repeat(64),
    canonical_url: 'https://example.com/',
    title: 'Ejemplo',
    tags: []
  }
  const state = applyEvent(stateWithGenesis(), event('add_bookmark', payload))
  t.is(state.bookmarks.get(BOOKMARK_ID)?.groupId, null)
})

test('add_bookmark with an existing bookmark_id is idempotently ignored', (t) => {
  const first = applyEvent(stateWithGenesis(), addBookmark())
  const second = applyEvent(first, addBookmark(BOOKMARK_ID, { title: 'Duplicado' }, UPDATED_AT))
  t.is(second, first)
  t.is(second.bookmarks.get(BOOKMARK_ID)?.title, 'Ejemplo')
})

test('remove_bookmark without genesis is ignored', (t) => {
  const state = emptyState()
  t.is(applyEvent(state, event('remove_bookmark', { bookmark_id: BOOKMARK_ID })), state)
})

test('remove_bookmark for a missing bookmark is ignored', (t) => {
  const state = stateWithGenesis()
  t.is(applyEvent(state, event('remove_bookmark', { bookmark_id: BOOKMARK_ID })), state)
})

test('remove_bookmark soft-deletes an existing bookmark and sets updatedAt', (t) => {
  const added = applyEvent(stateWithGenesis(), addBookmark())
  const removed = applyEvent(added, event('remove_bookmark', { bookmark_id: BOOKMARK_ID }, UPDATED_AT))
  t.is(removed.bookmarks.get(BOOKMARK_ID)?.deleted, true)
  t.is(removed.bookmarks.get(BOOKMARK_ID)?.updatedAt, UPDATED_AT)
  t.is(added.bookmarks.get(BOOKMARK_ID)?.deleted, false)
})

test('remove_bookmark for an already deleted bookmark does not update updatedAt', (t) => {
  const added = applyEvent(stateWithGenesis(), addBookmark())
  const removed = applyEvent(added, event('remove_bookmark', { bookmark_id: BOOKMARK_ID }, UPDATED_AT))
  const repeated = applyEvent(removed, event('remove_bookmark', { bookmark_id: BOOKMARK_ID }, '2026-10-24T12:00:00.000Z'))
  t.is(repeated, removed)
  t.is(repeated.bookmarks.get(BOOKMARK_ID)?.updatedAt, UPDATED_AT)
})

test('update_metadata without genesis is ignored', (t) => {
  const state = emptyState()
  t.is(applyEvent(state, event('update_metadata', { changes: { name: 'Nuevo' } })), state)
})

test('update_metadata applies only present changes and preserves createdAt', (t) => {
  const before = stateWithGenesis()
  const createdAt = before.collection?.createdAt
  const after = applyEvent(before, event('update_metadata', { changes: { name: 'Renombrada', visibility: 'unlisted' } }, UPDATED_AT))
  t.is(after.collection?.name, 'Renombrada')
  t.is(after.collection?.visibility, 'unlisted')
  t.is(after.collection?.description, 'Descripción original')
  t.is(after.collection?.createdAt, createdAt)
  t.is(before.collection?.name, 'Mi colección')
})

test('create_group without genesis is ignored', (t) => {
  const state = emptyState()
  t.is(applyEvent(state, event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 3 })), state)
})

test('create_group stores payload position and event timestamp', (t) => {
  const state = applyEvent(stateWithGenesis(), event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 3 }, UPDATED_AT))
  t.alike(state.groups.get(GROUP_ID), {
    groupId: GROUP_ID,
    name: 'Lectura',
    position: 3,
    createdAt: UPDATED_AT,
    deleted: false
  })
})

test('create_group with an existing group_id is idempotently ignored', (t) => {
  const first = applyEvent(stateWithGenesis(), event('create_group', { group_id: GROUP_ID, name: 'Original', position: 0 }))
  const second = applyEvent(first, event('create_group', { group_id: GROUP_ID, name: 'Duplicado', position: 2 }, UPDATED_AT))
  t.is(second, first)
  t.is(second.groups.get(GROUP_ID)?.name, 'Original')
})

test('delete_group without genesis is ignored', (t) => {
  const state = emptyState()
  t.is(applyEvent(state, event('delete_group', { group_id: GROUP_ID })), state)
})

test('delete_group for a missing group is ignored', (t) => {
  const state = stateWithGenesis()
  t.is(applyEvent(state, event('delete_group', { group_id: GROUP_ID })), state)
})

test('delete_group soft-deletes group and moves active bookmarks to Inbox', (t) => {
  let state = stateWithGenesis()
  state = applyEvent(state, event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }))
  state = applyEvent(state, addBookmark(BOOKMARK_ID, { group_id: GROUP_ID }))
  state = applyEvent(state, addBookmark(SECOND_BOOKMARK_ID, { group_id: GROUP_ID }))
  state = applyEvent(state, event('remove_bookmark', { bookmark_id: SECOND_BOOKMARK_ID }, UPDATED_AT))
  const deleted = applyEvent(state, event('delete_group', { group_id: GROUP_ID }, '2026-10-24T12:00:00.000Z'))
  t.is(deleted.groups.get(GROUP_ID)?.deleted, true)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.updatedAt, '2026-10-24T12:00:00.000Z')
  t.is(deleted.bookmarks.get(BOOKMARK_ID)?.position, null)
  t.is(deleted.bookmarks.get(SECOND_BOOKMARK_ID)?.groupId, GROUP_ID)
  t.is(deleted.bookmarks.get(SECOND_BOOKMARK_ID)?.updatedAt, UPDATED_AT)
  t.is(state.bookmarks.get(BOOKMARK_ID)?.groupId, GROUP_ID)
})

test('delete_group for an already deleted group is ignored', (t) => {
  const withGroup = applyEvent(stateWithGenesis(), event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }))
  const deleted = applyEvent(withGroup, event('delete_group', { group_id: GROUP_ID }, UPDATED_AT))
  const repeated = applyEvent(deleted, event('delete_group', { group_id: GROUP_ID }, '2026-10-24T12:00:00.000Z'))
  t.is(repeated, deleted)
})

test('collection_unpublished without genesis is ignored', (t) => {
  const state = emptyState()
  t.is(applyEvent(state, event('collection_unpublished', { message: 'Adiós', migrated_to: 'c'.repeat(64) })), state)
})

test('collection_unpublished stores message and migratedTo, defaulting absent migrated_to to null', (t) => {
  const unpublished = applyEvent(stateWithGenesis(), event('collection_unpublished', {
    message: 'La colección ya no se comparte.',
    migrated_to: 'c'.repeat(64)
  }, UPDATED_AT))
  t.is(unpublished.collection?.unpublished, true)
  t.is(unpublished.collection?.unpublishedMessage, 'La colección ya no se comparte.')
  t.is(unpublished.collection?.migratedTo, 'c'.repeat(64))
  const withoutMigration = applyEvent(stateWithGenesis(), event('collection_unpublished', { message: 'Fin' }))
  t.is(withoutMigration.collection?.migratedTo, null)
})

test('collection_unpublished is idempotent', (t) => {
  const first = applyEvent(stateWithGenesis(), event('collection_unpublished', { message: 'Primero', migrated_to: null }, UPDATED_AT))
  const second = applyEvent(first, event('collection_unpublished', { message: 'Segundo', migrated_to: 'c'.repeat(64) }, '2026-10-24T12:00:00.000Z'))
  t.is(second, first)
  t.is(second.collection?.unpublishedMessage, 'Primero')
  t.is(second.collection?.migratedTo, null)
})

test('foldEvents on an empty log returns an empty state', (t) => {
  const state = foldEvents([])
  t.is(state.collection, null)
  t.is(state.bookmarks.size, 0)
  t.is(state.groups.size, 0)
})

test('foldEvents ignores all events in a log without genesis', (t) => {
  const state = foldEvents([
    addBookmark(),
    event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }),
    event('update_metadata', { changes: { name: 'No aplicar' } })
  ])
  t.is(state.collection, null)
  t.is(state.bookmarks.size, 0)
  t.is(state.groups.size, 0)
})

test('foldEvents applies a complete simple-event log in order', (t) => {
  const state = foldEvents([
    genesis(),
    event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }),
    addBookmark(BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:10:00.000Z'),
    addBookmark(SECOND_BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:11:00.000Z'),
    event('remove_bookmark', { bookmark_id: SECOND_BOOKMARK_ID }, '2026-10-24T10:12:00.000Z'),
    event('update_metadata', { changes: { name: 'Colección final' } }, '2026-10-24T10:13:00.000Z'),
    event('delete_group', { group_id: GROUP_ID }, '2026-10-24T10:14:00.000Z'),
    event('collection_unpublished', { message: 'Migrada', migrated_to: 'c'.repeat(64) }, '2026-10-24T10:15:00.000Z')
  ])
  t.is(state.collection?.name, 'Colección final')
  t.is(state.collection?.unpublished, true)
  t.is(state.collection?.migratedTo, 'c'.repeat(64))
  t.is(state.groups.get(GROUP_ID)?.deleted, true)
  t.is(state.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  t.is(state.bookmarks.get(BOOKMARK_ID)?.updatedAt, '2026-10-24T10:14:00.000Z')
  t.is(state.bookmarks.get(SECOND_BOOKMARK_ID)?.deleted, true)
  t.is(state.bookmarks.get(SECOND_BOOKMARK_ID)?.groupId, GROUP_ID)
})

test('applyEvent does not mutate the input state or its Maps', (t) => {
  const before = stateWithGenesis()
  const originalBookmarks = before.bookmarks
  const originalGroups = before.groups
  const after = applyEvent(before, addBookmark())
  t.is(before.bookmarks, originalBookmarks)
  t.is(before.groups, originalGroups)
  t.is(before.bookmarks.size, 0)
  t.is(after.bookmarks.size, 1)
  t.ok(after.bookmarks !== before.bookmarks)
  t.is(after.groups, before.groups)
})



const THIRD_BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
function groupedBookmarks() {
  let state = applyEvent(stateWithGenesis(), event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }))
  state = applyEvent(state, addBookmark(BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:10:00.000Z'))
  state = applyEvent(state, addBookmark(SECOND_BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:11:00.000Z'))
  state = applyEvent(state, addBookmark(THIRD_BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:12:00.000Z'))
  return state
}

test('edit_bookmark ignores missing genesis, missing bookmarks and deleted bookmarks', (t) => {
  const noGenesis = emptyState()
  t.is(applyEvent(noGenesis, event('edit_bookmark', { bookmark_id: BOOKMARK_ID, changes: { title: 'x' } })), noGenesis)
  const state = stateWithGenesis()
  t.is(applyEvent(state, event('edit_bookmark', { bookmark_id: BOOKMARK_ID, changes: { title: 'x' } })), state)
  const added = applyEvent(state, addBookmark())
  const deleted = applyEvent(added, event('remove_bookmark', { bookmark_id: BOOKMARK_ID }, UPDATED_AT))
  const edited = applyEvent(deleted, event('edit_bookmark', { bookmark_id: BOOKMARK_ID, changes: { title: 'x' } }))
  t.is(edited, deleted)
  t.is(edited.bookmarks.get(BOOKMARK_ID)?.deleted, true)
})

test('edit_bookmark only changes present fields, removes notes on null and updates updatedAt', (t) => {
  const added = applyEvent(stateWithGenesis(), addBookmark())
  const edited = applyEvent(added, event('edit_bookmark', { bookmark_id: BOOKMARK_ID, changes: { title: 'Nuevo' } }, UPDATED_AT))
  t.is(edited.bookmarks.get(BOOKMARK_ID)?.title, 'Nuevo')
  t.alike(edited.bookmarks.get(BOOKMARK_ID)?.tags, ['uno', 'dos'])
  t.is(edited.bookmarks.get(BOOKMARK_ID)?.notes, 'Nota')
  t.is(edited.bookmarks.get(BOOKMARK_ID)?.updatedAt, UPDATED_AT)
  const cleared = applyEvent(edited, event('edit_bookmark', { bookmark_id: BOOKMARK_ID, changes: { notes: null } }, '2026-10-24T12:00:00.000Z'))
  t.is(Object.prototype.hasOwnProperty.call(cleared.bookmarks.get(BOOKMARK_ID), 'notes'), false)
  t.is(added.bookmarks.get(BOOKMARK_ID)?.title, 'Ejemplo')
})

test('move_bookmark ignores missing genesis, missing/deleted bookmarks and invalid destination groups', (t) => {
  const noGenesis = emptyState()
  t.is(applyEvent(noGenesis, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null })), noGenesis)
  const state = stateWithGenesis()
  t.is(applyEvent(state, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null })), state)
  const added = applyEvent(state, addBookmark())
  t.is(applyEvent(added, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID })), added)
  const withGroup = applyEvent(added, event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }))
  const deletedGroup = applyEvent(withGroup, event('delete_group', { group_id: GROUP_ID }, UPDATED_AT))
  t.is(applyEvent(deletedGroup, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID })), deletedGroup)
  const deletedBookmark = applyEvent(added, event('remove_bookmark', { bookmark_id: BOOKMARK_ID }, UPDATED_AT))
  t.is(applyEvent(deletedBookmark, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null })), deletedBookmark)
})

test('move_bookmark moves to Inbox or an active group, preserves position and updates updatedAt', (t) => {
  let state = groupedBookmarks()
  state = applyEvent(state, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID, position: 1 }))
  const movedInbox = applyEvent(state, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null }, UPDATED_AT))
  t.is(movedInbox.bookmarks.get(BOOKMARK_ID)?.groupId, null)
  t.is(movedInbox.bookmarks.get(BOOKMARK_ID)?.position, state.bookmarks.get(BOOKMARK_ID)?.position)
  t.is(movedInbox.bookmarks.get(BOOKMARK_ID)?.updatedAt, UPDATED_AT)
  const back = applyEvent(movedInbox, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID }, '2026-10-24T12:00:00.000Z'))
  t.is(back.bookmarks.get(BOOKMARK_ID)?.groupId, GROUP_ID)
  t.is(back.bookmarks.get(BOOKMARK_ID)?.updatedAt, '2026-10-24T12:00:00.000Z')
})

test('move_bookmark to the current group is placement-idempotent but updates updatedAt', (t) => {
  const state = applyEvent(stateWithGenesis(), addBookmark())
  const moved = applyEvent(state, event('move_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null }, UPDATED_AT))
  t.is(moved.bookmarks.get(BOOKMARK_ID)?.position, null)
  t.is(moved.bookmarks.get(BOOKMARK_ID)?.updatedAt, UPDATED_AT)
})

test('reorder_bookmark ignores missing genesis, missing/deleted bookmarks and mismatched groups', (t) => {
  const noGenesis = emptyState()
  t.is(applyEvent(noGenesis, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null, position: 0 })), noGenesis)
  const state = stateWithGenesis()
  t.is(applyEvent(state, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null, position: 0 })), state)
  const added = applyEvent(state, addBookmark())
  t.is(applyEvent(added, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID, position: 0 })), added)
  const deleted = applyEvent(added, event('remove_bookmark', { bookmark_id: BOOKMARK_ID }, UPDATED_AT))
  t.is(applyEvent(deleted, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: null, position: 0 })), deleted)
})

test('reorder_bookmark materializes null positions by createdAt and bookmarkId tie-break, then adjusts positions', (t) => {
  let state = applyEvent(stateWithGenesis(), event('create_group', { group_id: GROUP_ID, name: 'Lectura', position: 0 }))
  state = applyEvent(state, addBookmark(SECOND_BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:10:00.000Z'))
  state = applyEvent(state, addBookmark(BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:10:00.000Z'))
  state = applyEvent(state, addBookmark(THIRD_BOOKMARK_ID, { group_id: GROUP_ID }, '2026-10-24T10:11:00.000Z'))
  const reordered = applyEvent(state, event('reorder_bookmark', { bookmark_id: SECOND_BOOKMARK_ID, group_id: GROUP_ID, position: 0 }, UPDATED_AT))
  t.is(reordered.bookmarks.get(SECOND_BOOKMARK_ID)?.position, 0)
  t.is(reordered.bookmarks.get(BOOKMARK_ID)?.position, 1)
  t.is(reordered.bookmarks.get(THIRD_BOOKMARK_ID)?.position, 2)
  t.is(reordered.bookmarks.get(SECOND_BOOKMARK_ID)?.updatedAt, UPDATED_AT)
  t.is(state.bookmarks.get(SECOND_BOOKMARK_ID)?.position, null)
})

test('reorder_bookmark clamps oversized positions to the end and handles successive reorders', (t) => {
  let state = groupedBookmarks()
  state = applyEvent(state, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID, position: 99 }, UPDATED_AT))
  t.is(state.bookmarks.get(SECOND_BOOKMARK_ID)?.position, 0)
  t.is(state.bookmarks.get(THIRD_BOOKMARK_ID)?.position, 1)
  t.is(state.bookmarks.get(BOOKMARK_ID)?.position, 2)
  state = applyEvent(state, event('reorder_bookmark', { bookmark_id: BOOKMARK_ID, group_id: GROUP_ID, position: 0 }, '2026-10-24T12:00:00.000Z'))
  t.is(state.bookmarks.get(BOOKMARK_ID)?.position, 0)
  t.is(state.bookmarks.get(SECOND_BOOKMARK_ID)?.position, 1)
  t.is(state.bookmarks.get(THIRD_BOOKMARK_ID)?.position, 2)
  t.is(state.bookmarks.get(BOOKMARK_ID)?.updatedAt, '2026-10-24T12:00:00.000Z')
})

test('reorder_bookmark excludes deleted bookmarks and preserves their position', (t) => {
  let state = groupedBookmarks()
  state = applyEvent(state, event('reorder_bookmark', { bookmark_id: SECOND_BOOKMARK_ID, group_id: GROUP_ID, position: 1 }))
  state = applyEvent(state, event('remove_bookmark', { bookmark_id: SECOND_BOOKMARK_ID }, UPDATED_AT))
  const deletedPosition = state.bookmarks.get(SECOND_BOOKMARK_ID)?.position
  const reordered = applyEvent(state, event('reorder_bookmark', { bookmark_id: THIRD_BOOKMARK_ID, group_id: GROUP_ID, position: 0 }, '2026-10-24T12:00:00.000Z'))
  t.is(reordered.bookmarks.get(THIRD_BOOKMARK_ID)?.position, 0)
  t.is(reordered.bookmarks.get(BOOKMARK_ID)?.position, 1)
  t.is(reordered.bookmarks.get(SECOND_BOOKMARK_ID)?.position, deletedPosition)
  t.is(reordered.bookmarks.get(SECOND_BOOKMARK_ID)?.deleted, true)
})

test('reorder_bookmark is idempotent when the same event is applied twice', (t) => {
  const state = groupedBookmarks()
  const reorder = event('reorder_bookmark', { bookmark_id: THIRD_BOOKMARK_ID, group_id: GROUP_ID, position: 0 }, UPDATED_AT, 'reorder-idempotent')
  const once = applyEvent(state, reorder)
  const twice = applyEvent(once, reorder)
  t.alike([...twice.bookmarks.entries()], [...once.bookmarks.entries()])
})
