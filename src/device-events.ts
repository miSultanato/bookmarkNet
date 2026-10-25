import { ulid } from './ulid.ts'
import { isBookmarkId, isGroupId, isResourceId, isUserId } from './ids.ts'

export interface DeviceEventBase<TType extends string = string, TPayload = unknown> {
  schema_version: 1
  event_id: string
  event_type: TType
  author_id: string
  created_at: string
  payload: TPayload
}

export interface DeviceMetadataPayload {
  displayName?: string
  bio?: string
  avatar?: string
}
export interface DeviceCreateCollectionPayload {
  collectionId: string
  name: string
  description?: string
  visibility: 'public' | 'unlisted'
}
export interface DeviceUpdateCollectionPayload {
  collectionId: string
  changes: { name?: string; description?: string | null; visibility?: 'public' | 'unlisted' }
}
export interface DeviceDeleteCollectionPayload { collectionId: string }
export interface DeviceAddBookmarkPayload {
  bookmarkId: string
  collectionId: string
  resourceId: string
  canonicalUrl: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  groupId: string | null
}
export interface DeviceEditBookmarkPayload {
  bookmarkId: string
  changes: { title?: string | null; description?: string | null; tags?: string[]; notes?: string | null }
}
export interface DeviceRemoveBookmarkPayload { bookmarkId: string }
export interface DeviceMoveBookmarkPayload { bookmarkId: string; groupId: string | null }
export interface DeviceReorderBookmarkPayload { bookmarkId: string; groupId: string | null; position: number }
export interface DeviceCreateGroupPayload { groupId: string; collectionId: string; name: string; position: number }
export interface DeviceDeleteGroupPayload { groupId: string; collectionId: string }

export interface DeviceMetadataEvent extends DeviceEventBase<'device_metadata', DeviceMetadataPayload> {}
export interface DeviceCreateCollectionEvent extends DeviceEventBase<'device_create_collection', DeviceCreateCollectionPayload> {}
export interface DeviceUpdateCollectionEvent extends DeviceEventBase<'device_update_collection', DeviceUpdateCollectionPayload> {}
export interface DeviceDeleteCollectionEvent extends DeviceEventBase<'device_delete_collection', DeviceDeleteCollectionPayload> {}
export interface DeviceAddBookmarkEvent extends DeviceEventBase<'device_add_bookmark', DeviceAddBookmarkPayload> {}
export interface DeviceEditBookmarkEvent extends DeviceEventBase<'device_edit_bookmark', DeviceEditBookmarkPayload> {}
export interface DeviceRemoveBookmarkEvent extends DeviceEventBase<'device_remove_bookmark', DeviceRemoveBookmarkPayload> {}
export interface DeviceMoveBookmarkEvent extends DeviceEventBase<'device_move_bookmark', DeviceMoveBookmarkPayload> {}
export interface DeviceReorderBookmarkEvent extends DeviceEventBase<'device_reorder_bookmark', DeviceReorderBookmarkPayload> {}
export interface DeviceCreateGroupEvent extends DeviceEventBase<'device_create_group', DeviceCreateGroupPayload> {}
export interface DeviceDeleteGroupEvent extends DeviceEventBase<'device_delete_group', DeviceDeleteGroupPayload> {}

export type DeviceEvent =
  | DeviceMetadataEvent
  | DeviceCreateCollectionEvent
  | DeviceUpdateCollectionEvent
  | DeviceDeleteCollectionEvent
  | DeviceAddBookmarkEvent
  | DeviceEditBookmarkEvent
  | DeviceRemoveBookmarkEvent
  | DeviceMoveBookmarkEvent
  | DeviceReorderBookmarkEvent
  | DeviceCreateGroupEvent
  | DeviceDeleteGroupEvent

type DeviceEventType = DeviceEvent['event_type']
type DevicePayload<T extends DeviceEventType> = Extract<DeviceEvent, { event_type: T }>['payload']

function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError(field + ' must be an object')
  }
}
function requireAuthorId(value: unknown): asserts value is string {
  if (!isUserId(value)) throw new RangeError('authorId must be a valid user ID')
}
function requireNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new RangeError(field + ' must be a non-empty string')
}
function requireOptionalString(value: unknown, field: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') throw new RangeError(field + ' must be a string when provided')
}
function requireNullableString(value: unknown, field: string): asserts value is string | null | undefined {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new RangeError(field + ' must be a string or null')
  }
}
function requireVisibility(value: unknown, field = 'visibility'): asserts value is 'public' | 'unlisted' {
  if (value !== 'public' && value !== 'unlisted') throw new RangeError(field + ' must be public or unlisted')
}
function requireCollectionId(value: unknown): asserts value is string {
  requireNonEmptyString(value, 'collectionId')
}
function requireBookmarkId(value: unknown): asserts value is string {
  if (!isBookmarkId(value)) throw new RangeError('bookmarkId must be a valid ULID')
}
function requireGroupIdOrNull(value: unknown): asserts value is string | null {
  if (value !== null && !isGroupId(value)) throw new RangeError('groupId must be a valid group ID or null')
}
function requirePosition(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError('position must be an integer greater than or equal to zero')
  }
}
function requireTags(value: unknown, field = 'tags'): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
    throw new RangeError(field + ' must be an array of strings')
  }
}
function requireChanges(value: unknown, allowed: string[], field = 'changes'): asserts value is Record<string, unknown> {
  requireRecord(value, field)
  const keys = Object.keys(value)
  if (keys.length === 0) throw new RangeError(field + ' must contain at least one field')
  if (keys.some((key) => !allowed.includes(key))) throw new RangeError(field + ' contains an unsupported field')
}
function makeEvent<T extends DeviceEventType>(
  authorId: string,
  eventType: T,
  payload: DevicePayload<T>
): Extract<DeviceEvent, { event_type: T }> {
  return {
    schema_version: 1,
    event_id: ulid(),
    event_type: eventType,
    author_id: authorId,
    created_at: new Date().toISOString(),
    payload
  } as Extract<DeviceEvent, { event_type: T }>
}

export interface DeviceMetadataParams { authorId: string; displayName?: string; bio?: string; avatar?: string }
export function deviceMetadata(params: DeviceMetadataParams): DeviceMetadataEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireOptionalString(params.displayName, 'displayName')
  requireOptionalString(params.bio, 'bio')
  requireOptionalString(params.avatar, 'avatar')
  const payload: DeviceMetadataPayload = {}
  if (params.displayName !== undefined) payload.displayName = params.displayName
  if (params.bio !== undefined) payload.bio = params.bio
  if (params.avatar !== undefined) payload.avatar = params.avatar
  return makeEvent(params.authorId, 'device_metadata', payload)
}

export interface DeviceCreateCollectionParams {
  authorId: string; collectionId: string; name: string; description?: string; visibility: 'public' | 'unlisted'
}
export function deviceCreateCollection(params: DeviceCreateCollectionParams): DeviceCreateCollectionEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireCollectionId(params.collectionId)
  requireNonEmptyString(params.name, 'name')
  requireVisibility(params.visibility)
  requireOptionalString(params.description, 'description')
  const payload: DeviceCreateCollectionPayload = {
    collectionId: params.collectionId, name: params.name, visibility: params.visibility
  }
  if (params.description !== undefined) payload.description = params.description
  return makeEvent(params.authorId, 'device_create_collection', payload)
}

export interface DeviceUpdateCollectionParams {
  authorId: string; collectionId: string
  changes: { name?: string; description?: string | null; visibility?: 'public' | 'unlisted' }
}
export function deviceUpdateCollection(params: DeviceUpdateCollectionParams): DeviceUpdateCollectionEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireCollectionId(params.collectionId)
  requireChanges(params.changes, ['name', 'description', 'visibility'])
  if (Object.prototype.hasOwnProperty.call(params.changes, 'name')) requireNonEmptyString(params.changes.name, 'changes.name')
  if (Object.prototype.hasOwnProperty.call(params.changes, 'description')) requireNullableString(params.changes.description, 'changes.description')
  if (Object.prototype.hasOwnProperty.call(params.changes, 'visibility')) requireVisibility(params.changes.visibility, 'changes.visibility')
  return makeEvent(params.authorId, 'device_update_collection', { collectionId: params.collectionId, changes: { ...params.changes } })
}

export interface DeviceDeleteCollectionParams { authorId: string; collectionId: string }
export function deviceDeleteCollection(params: DeviceDeleteCollectionParams): DeviceDeleteCollectionEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireCollectionId(params.collectionId)
  return makeEvent(params.authorId, 'device_delete_collection', { collectionId: params.collectionId })
}

export interface DeviceAddBookmarkParams {
  authorId: string; bookmarkId: string; collectionId: string; resourceId: string; canonicalUrl: string
  title: string; description?: string; tags: string[]; notes?: string; groupId?: string | null
}
export function deviceAddBookmark(params: DeviceAddBookmarkParams): DeviceAddBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireBookmarkId(params.bookmarkId)
  requireCollectionId(params.collectionId)
  if (!isResourceId(params.resourceId)) throw new RangeError('resourceId must be a valid resource ID')
  requireNonEmptyString(params.canonicalUrl, 'canonicalUrl')
  requireNonEmptyString(params.title, 'title')
  requireTags(params.tags)
  requireOptionalString(params.description, 'description')
  requireOptionalString(params.notes, 'notes')
  if (params.groupId !== undefined && params.groupId !== null && !isGroupId(params.groupId)) {
    throw new RangeError('groupId must be a valid group ID or null')
  }
  const payload: DeviceAddBookmarkPayload = {
    bookmarkId: params.bookmarkId, collectionId: params.collectionId, resourceId: params.resourceId,
    canonicalUrl: params.canonicalUrl, title: params.title, tags: [...params.tags], groupId: params.groupId ?? null
  }
  if (params.description !== undefined) payload.description = params.description
  if (params.notes !== undefined) payload.notes = params.notes
  return makeEvent(params.authorId, 'device_add_bookmark', payload)
}

export interface DeviceEditBookmarkParams {
  authorId: string; bookmarkId: string
  changes: { title?: string; description?: string | null; tags?: string[]; notes?: string | null }
}
export function deviceEditBookmark(params: DeviceEditBookmarkParams): DeviceEditBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireBookmarkId(params.bookmarkId)
  requireChanges(params.changes, ['title', 'description', 'tags', 'notes'])
  if (Object.prototype.hasOwnProperty.call(params.changes, 'title')) {
    const title = params.changes.title
    if (typeof title !== 'string') throw new RangeError('changes.title must be a string')
  }
  if (Object.prototype.hasOwnProperty.call(params.changes, 'description')) requireNullableString(params.changes.description, 'changes.description')
  if (Object.prototype.hasOwnProperty.call(params.changes, 'notes')) requireNullableString(params.changes.notes, 'changes.notes')
  if (Object.prototype.hasOwnProperty.call(params.changes, 'tags')) requireTags(params.changes.tags, 'changes.tags')
  const changes = { ...params.changes, ...(params.changes.tags !== undefined ? { tags: [...params.changes.tags] } : {}) }
  return makeEvent(params.authorId, 'device_edit_bookmark', { bookmarkId: params.bookmarkId, changes })
}

export interface DeviceRemoveBookmarkParams { authorId: string; bookmarkId: string }
export function deviceRemoveBookmark(params: DeviceRemoveBookmarkParams): DeviceRemoveBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireBookmarkId(params.bookmarkId)
  return makeEvent(params.authorId, 'device_remove_bookmark', { bookmarkId: params.bookmarkId })
}

export interface DeviceMoveBookmarkParams { authorId: string; bookmarkId: string; groupId: string | null }
export function deviceMoveBookmark(params: DeviceMoveBookmarkParams): DeviceMoveBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireBookmarkId(params.bookmarkId)
  requireGroupIdOrNull(params.groupId)
  return makeEvent(params.authorId, 'device_move_bookmark', { bookmarkId: params.bookmarkId, groupId: params.groupId })
}

export interface DeviceReorderBookmarkParams { authorId: string; bookmarkId: string; groupId: string | null; position: number }
export function deviceReorderBookmark(params: DeviceReorderBookmarkParams): DeviceReorderBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireBookmarkId(params.bookmarkId)
  requireGroupIdOrNull(params.groupId)
  requirePosition(params.position)
  return makeEvent(params.authorId, 'device_reorder_bookmark', {
    bookmarkId: params.bookmarkId, groupId: params.groupId, position: params.position
  })
}

export interface DeviceCreateGroupParams {
  authorId: string; groupId: string; collectionId: string; name: string; position: number
}
export function deviceCreateGroup(params: DeviceCreateGroupParams): DeviceCreateGroupEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isGroupId(params.groupId)) throw new RangeError('groupId must be a valid group ID')
  requireCollectionId(params.collectionId)
  requireNonEmptyString(params.name, 'name')
  requirePosition(params.position)
  return makeEvent(params.authorId, 'device_create_group', {
    groupId: params.groupId, collectionId: params.collectionId, name: params.name, position: params.position
  })
}

export interface DeviceDeleteGroupParams { authorId: string; groupId: string; collectionId: string }
export function deviceDeleteGroup(params: DeviceDeleteGroupParams): DeviceDeleteGroupEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isGroupId(params.groupId)) throw new RangeError('groupId must be a valid group ID')
  requireCollectionId(params.collectionId)
  return makeEvent(params.authorId, 'device_delete_group', { groupId: params.groupId, collectionId: params.collectionId })
}
