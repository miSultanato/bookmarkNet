import type {
  DeviceEvent,
  DeviceMetadataEvent,
  DeviceCreateCollectionEvent,
  DeviceUpdateCollectionEvent,
  DeviceDeleteCollectionEvent,
  DeviceAddBookmarkEvent,
  DeviceEditBookmarkEvent,
  DeviceRemoveBookmarkEvent,
  DeviceMoveBookmarkEvent,
  DeviceReorderBookmarkEvent,
  DeviceCreateGroupEvent,
  DeviceDeleteGroupEvent,
  DeviceAddDeviceEvent
} from './device-events.ts'

export interface DeviceState {
  profile: { displayName?: string; bio?: string; avatar?: string }
  collections: Map<string, DeviceCollectionState>
  bookmarks: Map<string, DeviceBookmarkState>
  groups: Map<string, DeviceGroupState>
  devices: Map<string, DeviceEntryState>
}

export interface DeviceCollectionState {
  collectionId: string
  publicCollectionId?: string
  name: string
  description?: string
  visibility: 'public' | 'unlisted'
  language: 'es' | 'en' | 'eu'
  deleted: boolean
  createdAt: string
  updatedAt?: string
}

export interface DeviceBookmarkState {
  bookmarkId: string
  collectionId: string | null
  resourceId: string
  canonicalUrl: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  groupId: string | null
  position: number | null
  deleted: boolean
  createdAt: string
  updatedAt?: string
}

export interface DeviceEntryState {
  nodeId: string
  publicKey?: string
  addedAt: string
}

export interface DeviceGroupState {
  groupId: string
  collectionId: string
  name: string
  position: number
  deleted: boolean
  createdAt: string
  updatedAt?: string
}

export function emptyDeviceState(): DeviceState {
  return { profile: {}, collections: new Map(), bookmarks: new Map(), groups: new Map(), devices: new Map() }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function collectionIsActive(state: DeviceState, collectionId: string): boolean {
  const collection = state.collections.get(collectionId)
  return collection !== undefined && !collection.deleted
}

function groupIsActive(state: DeviceState, groupId: string): boolean {
  const group = state.groups.get(groupId)
  return group !== undefined && !group.deleted
}

function applyMetadata(state: DeviceState, event: DeviceMetadataEvent): DeviceState {
  const profile: DeviceState['profile'] = {}
  const payload = event.payload as Record<string, unknown>
  if (typeof payload.displayName === 'string') profile.displayName = payload.displayName
  if (typeof payload.bio === 'string') profile.bio = payload.bio
  if (typeof payload.avatar === 'string') profile.avatar = payload.avatar
  return { ...state, profile }
}

function applyCreateCollection(state: DeviceState, event: DeviceCreateCollectionEvent): DeviceState {
  const p = event.payload
  if (state.collections.has(p.collectionId)) return state
  const collection: DeviceCollectionState = {
    collectionId: p.collectionId,
    name: p.name,
    visibility: p.visibility,
    language: p.language ?? 'es',
    deleted: false,
    createdAt: event.created_at
  }
  if (typeof p.publicCollectionId === 'string') collection.publicCollectionId = p.publicCollectionId
  if (hasOwn(p, 'description')) collection.description = p.description
  const collections = new Map(state.collections)
  collections.set(p.collectionId, collection)
  return { ...state, collections }
}

function applyUpdateCollection(state: DeviceState, event: DeviceUpdateCollectionEvent): DeviceState {
  const current = state.collections.get(event.payload.collectionId)
  if (!current || current.deleted) return state
  const changes = event.payload.changes
  const next: DeviceCollectionState = { ...current, updatedAt: event.created_at }
  if (hasOwn(changes, 'name') && changes.name !== undefined) next.name = changes.name
  if (hasOwn(changes, 'visibility') && changes.visibility !== undefined) next.visibility = changes.visibility
  if (hasOwn(changes, 'language') && changes.language !== undefined) next.language = changes.language
  if (hasOwn(changes, 'description')) {
    if (changes.description === null) delete next.description
    else if (changes.description !== undefined) next.description = changes.description
  }
  const collections = new Map(state.collections)
  collections.set(current.collectionId, next)
  return { ...state, collections }
}

function applyDeleteCollection(state: DeviceState, event: DeviceDeleteCollectionEvent): DeviceState {
  const current = state.collections.get(event.payload.collectionId)
  if (!current || current.deleted) return state
  const collections = new Map(state.collections)
  collections.set(current.collectionId, { ...current, deleted: true, updatedAt: event.created_at })
  let bookmarks = state.bookmarks
  let groups = state.groups
  for (const [id, bookmark] of state.bookmarks) {
    if (bookmark.collectionId !== current.collectionId) continue
    if (bookmarks === state.bookmarks) bookmarks = new Map(state.bookmarks)
    bookmarks.set(id, { ...bookmark, deleted: true, updatedAt: event.created_at })
  }
  for (const [id, group] of state.groups) {
    if (group.collectionId !== current.collectionId) continue
    if (groups === state.groups) groups = new Map(state.groups)
    groups.set(id, { ...group, deleted: true, updatedAt: event.created_at })
  }
  return { ...state, collections, bookmarks, groups }
}

function applyAddBookmark(state: DeviceState, event: DeviceAddBookmarkEvent): DeviceState {
  const p = event.payload
  if (state.bookmarks.has(p.bookmarkId)) return state
  if (p.collectionId === null) {
    if (p.groupId !== null) return state
  } else if (!collectionIsActive(state, p.collectionId)) {
    return state
  }
  if (p.groupId !== null) {
    const group = state.groups.get(p.groupId)
    if (!group || group.deleted || group.collectionId !== p.collectionId) return state
  }
  const bookmark: DeviceBookmarkState = {
    bookmarkId: p.bookmarkId,
    collectionId: p.collectionId,
    resourceId: p.resourceId,
    canonicalUrl: p.canonicalUrl,
    title: p.title,
    tags: [...p.tags],
    groupId: p.groupId,
    position: null,
    deleted: false,
    createdAt: event.created_at
  }
  if (hasOwn(p, 'description')) bookmark.description = p.description
  if (hasOwn(p, 'notes')) bookmark.notes = p.notes
  const bookmarks = new Map(state.bookmarks)
  bookmarks.set(p.bookmarkId, bookmark)
  return { ...state, bookmarks }
}

function applyEditBookmark(state: DeviceState, event: DeviceEditBookmarkEvent): DeviceState {
  const current = state.bookmarks.get(event.payload.bookmarkId)
  if (!current || current.deleted) return state
  const changes = event.payload.changes
  const next: DeviceBookmarkState = { ...current, tags: [...current.tags], updatedAt: event.created_at }
  if (hasOwn(changes, 'title') && changes.title !== undefined && changes.title !== null) next.title = changes.title
  if (hasOwn(changes, 'tags') && changes.tags !== undefined && changes.tags !== null) next.tags = [...changes.tags]
  if (hasOwn(changes, 'description')) {
    if (changes.description === null) delete next.description
    else if (changes.description !== undefined) next.description = changes.description
  }
  if (hasOwn(changes, 'notes')) {
    if (changes.notes === null) delete next.notes
    else if (changes.notes !== undefined) next.notes = changes.notes
  }
  const bookmarks = new Map(state.bookmarks)
  bookmarks.set(current.bookmarkId, next)
  return { ...state, bookmarks }
}

function applyRemoveBookmark(state: DeviceState, event: DeviceRemoveBookmarkEvent): DeviceState {
  const current = state.bookmarks.get(event.payload.bookmarkId)
  if (!current || current.deleted) return state
  const bookmarks = new Map(state.bookmarks)
  bookmarks.set(current.bookmarkId, { ...current, deleted: true, updatedAt: event.created_at })
  return { ...state, bookmarks }
}

function applyMoveBookmark(state: DeviceState, event: DeviceMoveBookmarkEvent): DeviceState {
  const current = state.bookmarks.get(event.payload.bookmarkId)
  const payload = event.payload as DeviceMoveBookmarkEvent['payload'] & { collectionId?: string | null }
  const { collectionId, groupId } = payload
  if (!current || current.deleted || collectionId === undefined) return state

  if (collectionId === null) {
    if (groupId !== null) return state
  } else if (!collectionIsActive(state, collectionId)) {
    return state
  }
  if (groupId !== null) {
    const group = state.groups.get(groupId)
    if (!group || group.deleted || group.collectionId !== collectionId) return state
  }
  const bookmarks = new Map(state.bookmarks)
  bookmarks.set(current.bookmarkId, { ...current, collectionId, groupId, position: null, updatedAt: event.created_at })
  return { ...state, bookmarks }
}

function applyReorderBookmark(state: DeviceState, event: DeviceReorderBookmarkEvent): DeviceState {
  const p = event.payload
  const target = state.bookmarks.get(p.bookmarkId)
  if (!target || target.deleted || target.groupId !== p.groupId) return state
  const allActive = [...state.bookmarks.values()].filter((bookmark) => {
    if (bookmark.deleted || bookmark.groupId !== p.groupId) return false
    if (p.groupId === null && bookmark.collectionId !== target.collectionId) return false
    return true
  })
  if (!allActive.some((bookmark) => bookmark.bookmarkId === p.bookmarkId)) return state

  const positioned = allActive.filter((b) => b.position !== null)
  const unpositioned = allActive.filter((b) => b.position === null)

  positioned.sort((a, b) => (a.position as number) - (b.position as number) || a.bookmarkId.localeCompare(b.bookmarkId))
  unpositioned.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.bookmarkId.localeCompare(b.bookmarkId))

  const active = [...positioned, ...unpositioned]

  const targetIndex = active.findIndex((bookmark) => bookmark.bookmarkId === p.bookmarkId)
  const [moving] = active.splice(targetIndex, 1)
  const destination = Math.min(p.position, active.length)
  active.splice(destination, 0, moving)

  const bookmarks = new Map(state.bookmarks)
  active.forEach((bookmark, position) => {
    const updated = bookmark.bookmarkId === p.bookmarkId
      ? { ...bookmark, position, updatedAt: event.created_at }
      : { ...bookmark, position }
    bookmarks.set(updated.bookmarkId, updated)
  })
  return { ...state, bookmarks }
}

function applyCreateGroup(state: DeviceState, event: DeviceCreateGroupEvent): DeviceState {
  const p = event.payload
  if (!collectionIsActive(state, p.collectionId) || state.groups.has(p.groupId)) return state
  const group: DeviceGroupState = {
    groupId: p.groupId, collectionId: p.collectionId, name: p.name,
    position: p.position, deleted: false, createdAt: event.created_at
  }
  const groups = new Map(state.groups)
  groups.set(p.groupId, group)
  return { ...state, groups }
}

function applyDeleteGroup(state: DeviceState, event: DeviceDeleteGroupEvent): DeviceState {
  const current = state.groups.get(event.payload.groupId)
  if (!current || current.deleted) return state
  if (current.collectionId !== event.payload.collectionId) return state
  const groups = new Map(state.groups)
  groups.set(current.groupId, { ...current, deleted: true, updatedAt: event.created_at })
  let bookmarks = state.bookmarks
  for (const [id, bookmark] of state.bookmarks) {
    if (bookmark.groupId !== current.groupId || bookmark.deleted) continue
    if (bookmarks === state.bookmarks) bookmarks = new Map(state.bookmarks)
    bookmarks.set(id, { ...bookmark, groupId: null, position: null, updatedAt: event.created_at })
  }
  return { ...state, groups, bookmarks }
}

function applyAddDevice(state: DeviceState, event: DeviceAddDeviceEvent): DeviceState {
  const payload = event.payload
  if (state.devices.has(payload.nodeId) ||
      typeof payload.nodeId !== 'string' || !/^n_[0-9a-f]{16}$/.test(payload.nodeId) ||
      typeof payload.addedAt !== 'string' || !Number.isFinite(Date.parse(payload.addedAt)) ||
      (payload.publicKey !== undefined && typeof payload.publicKey !== 'string')) {
    return state
  }
  const device: DeviceEntryState = { nodeId: payload.nodeId, addedAt: payload.addedAt }
  if (payload.publicKey !== undefined) device.publicKey = payload.publicKey
  const devices = new Map(state.devices)
  devices.set(payload.nodeId, device)
  return { ...state, devices }
}

export function applyDeviceEvent(state: DeviceState, event: DeviceEvent): DeviceState {
  try {
    switch (event.event_type) {
      case 'device_metadata': return applyMetadata(state, event)
      case 'device_create_collection': return applyCreateCollection(state, event)
      case 'device_update_collection': return applyUpdateCollection(state, event)
      case 'device_delete_collection': return applyDeleteCollection(state, event)
      case 'device_add_bookmark': return applyAddBookmark(state, event)
      case 'device_edit_bookmark': return applyEditBookmark(state, event)
      case 'device_remove_bookmark': return applyRemoveBookmark(state, event)
      case 'device_move_bookmark': return applyMoveBookmark(state, event)
      case 'device_reorder_bookmark': return applyReorderBookmark(state, event)
      case 'device_create_group': return applyCreateGroup(state, event)
      case 'device_delete_group': return applyDeleteGroup(state, event)
      case 'device_add_device': return applyAddDevice(state, event)
      default: return state
    }
  } catch {
    return state
  }
}

export function foldDeviceEvents(events: DeviceEvent[]): DeviceState {
  return events.reduce(applyDeviceEvent, emptyDeviceState())
}
