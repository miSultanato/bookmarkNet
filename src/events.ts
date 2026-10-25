import sodium from 'sodium-native'
import { isBookmarkId, isCollectionId, isGroupId, isResourceId, isUserId, toHex, utf8Bytes, userIdFromPublicKey } from './ids.ts'
import { serializePublicKey, serializeSignature, sign } from './identity.ts'
import { serializeCollectionPublicKey } from './keys.ts'
import { ulid } from './ulid.ts'

export interface CollectionGenesisPayload {
  collection_id: string
  collection_public_key: string
  author_public_key: string
  name: string
  description?: string
  visibility: 'public' | 'unlisted'
  forked_from: string | null
  migrated_from: string | null
  signature_by_owner: string
}
export interface AddBookmarkPayload {
  bookmark_id: string
  resource_id: string
  canonical_url: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  group_id: string | null
}
export interface EditBookmarkPayload {
  bookmark_id: string
  changes: {
    title?: string | null
    description?: string | null
    tags?: string[] | null
    notes?: string | null
  }
}
export interface RemoveBookmarkPayload { bookmark_id: string }
export interface MoveBookmarkPayload { bookmark_id: string; group_id: string | null }
export interface ReorderBookmarkPayload { bookmark_id: string; group_id: string | null; position: number }
export interface UpdateMetadataPayload {
  changes: {
    name?: string
    description?: string
    visibility?: 'public' | 'unlisted'
  }
}
export interface CreateGroupPayload { group_id: string; name: string; position: number }
export interface DeleteGroupPayload { group_id: string }
export interface CollectionUnpublishedPayload { message?: string; migrated_to: string | null }

export type CollectionEventType =
  | 'collection_genesis'
  | 'add_bookmark'
  | 'edit_bookmark'
  | 'remove_bookmark'
  | 'move_bookmark'
  | 'reorder_bookmark'
  | 'update_metadata'
  | 'create_group'
  | 'delete_group'
  | 'collection_unpublished'

export interface BaseEvent<TType extends CollectionEventType = CollectionEventType, TPayload = unknown> {
  schema_version: 1
  event_id: string
  event_type: TType
  author_id: string
  created_at: string
  payload: TPayload
}
export interface CollectionGenesisEvent extends BaseEvent<'collection_genesis', CollectionGenesisPayload> {}
export interface AddBookmarkEvent extends BaseEvent<'add_bookmark', AddBookmarkPayload> {}
export interface EditBookmarkEvent extends BaseEvent<'edit_bookmark', EditBookmarkPayload> {}
export interface RemoveBookmarkEvent extends BaseEvent<'remove_bookmark', RemoveBookmarkPayload> {}
export interface MoveBookmarkEvent extends BaseEvent<'move_bookmark', MoveBookmarkPayload> {}
export interface ReorderBookmarkEvent extends BaseEvent<'reorder_bookmark', ReorderBookmarkPayload> {}
export interface UpdateMetadataEvent extends BaseEvent<'update_metadata', UpdateMetadataPayload> {}
export interface CreateGroupEvent extends BaseEvent<'create_group', CreateGroupPayload> {}
export interface DeleteGroupEvent extends BaseEvent<'delete_group', DeleteGroupPayload> {}
export interface CollectionUnpublishedEvent extends BaseEvent<'collection_unpublished', CollectionUnpublishedPayload> {}
export type CollectionEvent =
  | CollectionGenesisEvent
  | AddBookmarkEvent
  | EditBookmarkEvent
  | RemoveBookmarkEvent
  | MoveBookmarkEvent
  | ReorderBookmarkEvent
  | UpdateMetadataEvent
  | CreateGroupEvent
  | DeleteGroupEvent
  | CollectionUnpublishedEvent

type NonGenesisEventType = Exclude<CollectionEventType, 'collection_genesis'>

function requireAuthorId(authorId: unknown): asserts authorId is string {
  if (!isUserId(authorId)) throw new RangeError('authorId must be a valid user ID')
}
function requireNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new RangeError(field + ' must be a non-empty string')
}
function requireOptionalString(value: unknown, field: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') throw new RangeError(field + ' must be a string when provided')
}
function requireGroupIdOrNull(value: unknown, field = 'groupId'): asserts value is string | null {
  if (value !== null && !isGroupId(value)) throw new RangeError(field + ' must be a valid group ID or null')
}
function requirePosition(position: unknown): asserts position is number {
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) {
    throw new RangeError('position must be an integer greater than or equal to zero')
  }
}
function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError(field + ' must be an object')
  }
}
function baseEvent<TType extends NonGenesisEventType, TPayload>(
  authorId: string,
  eventType: TType,
  payload: TPayload
): BaseEvent<TType, TPayload> {
  return {
    schema_version: 1,
    event_id: ulid(),
    event_type: eventType,
    author_id: authorId,
    created_at: new Date().toISOString(),
    payload
  }
}

export interface AddBookmarkParams {
  authorId: string
  bookmarkId: string
  resourceId: string
  canonicalUrl: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  groupId?: string | null
}
export function addBookmark(params: AddBookmarkParams): AddBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isBookmarkId(params.bookmarkId)) throw new RangeError('bookmarkId must be a valid ULID')
  if (!isResourceId(params.resourceId)) throw new RangeError('resourceId must be a valid resource ID')
  requireNonEmptyString(params.canonicalUrl, 'canonicalUrl')
  requireNonEmptyString(params.title, 'title')
  if (!Array.isArray(params.tags) || !params.tags.every((tag) => typeof tag === 'string')) {
    throw new RangeError('tags must be an array of strings')
  }
  requireOptionalString(params.description, 'description')
  requireOptionalString(params.notes, 'notes')
  if (params.groupId !== undefined && params.groupId !== null && !isGroupId(params.groupId)) {
    throw new RangeError('groupId must be a valid group ID or null')
  }
  const payload: AddBookmarkPayload = {
    bookmark_id: params.bookmarkId,
    resource_id: params.resourceId,
    canonical_url: params.canonicalUrl,
    title: params.title,
    tags: [...params.tags],
    group_id: params.groupId ?? null
  }
  if (params.description !== undefined) payload.description = params.description
  if (params.notes !== undefined) payload.notes = params.notes
  return baseEvent(params.authorId, 'add_bookmark', payload)
}

export interface EditBookmarkParams {
  authorId: string
  bookmarkId: string
  changes: {
    title?: string | null
    description?: string | null
    tags?: string[] | null
    notes?: string | null
  }
}
export function editBookmark(params: EditBookmarkParams): EditBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isBookmarkId(params.bookmarkId)) throw new RangeError('bookmarkId must be a valid ULID')
  requireRecord(params.changes, 'changes')
  const keys = Object.keys(params.changes)
  const allowed = ['title', 'description', 'tags', 'notes']
  if (keys.length === 0) throw new RangeError('changes must contain at least one field')
  if (keys.some((key) => !allowed.includes(key))) throw new RangeError('changes contains an unsupported field')
  for (const key of keys) {
    const value = (params.changes as Record<string, unknown>)[key]
    if (key === 'tags') {
      if (value !== null && (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string'))) {
        throw new RangeError('changes.tags must be an array of strings or null')
      }
    } else if (value !== null && typeof value !== 'string') {
      throw new RangeError('changes.' + key + ' must be a string or null')
    }
  }
  const changes = { ...params.changes, ...(params.changes.tags && { tags: [...params.changes.tags] }) }
  return baseEvent(params.authorId, 'edit_bookmark', { bookmark_id: params.bookmarkId, changes })
}

export interface RemoveBookmarkParams { authorId: string; bookmarkId: string }
export function removeBookmark(params: RemoveBookmarkParams): RemoveBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isBookmarkId(params.bookmarkId)) throw new RangeError('bookmarkId must be a valid ULID')
  return baseEvent(params.authorId, 'remove_bookmark', { bookmark_id: params.bookmarkId })
}

export interface MoveBookmarkParams { authorId: string; bookmarkId: string; groupId: string | null }
export function moveBookmark(params: MoveBookmarkParams): MoveBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isBookmarkId(params.bookmarkId)) throw new RangeError('bookmarkId must be a valid ULID')
  requireGroupIdOrNull(params.groupId)
  return baseEvent(params.authorId, 'move_bookmark', { bookmark_id: params.bookmarkId, group_id: params.groupId })
}

export interface ReorderBookmarkParams { authorId: string; bookmarkId: string; groupId: string | null; position: number }
export function reorderBookmark(params: ReorderBookmarkParams): ReorderBookmarkEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isBookmarkId(params.bookmarkId)) throw new RangeError('bookmarkId must be a valid ULID')
  requireGroupIdOrNull(params.groupId)
  requirePosition(params.position)
  return baseEvent(params.authorId, 'reorder_bookmark', {
    bookmark_id: params.bookmarkId, group_id: params.groupId, position: params.position
  })
}

export interface UpdateMetadataParams {
  authorId: string
  changes: { name?: string; description?: string; visibility?: 'public' | 'unlisted' }
}
export function updateMetadata(params: UpdateMetadataParams): UpdateMetadataEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireRecord(params.changes, 'changes')
  const keys = Object.keys(params.changes)
  const allowed = ['name', 'description', 'visibility']
  if (keys.length === 0) throw new RangeError('changes must contain at least one field')
  if (keys.some((key) => !allowed.includes(key))) throw new RangeError('changes contains an unsupported field')
  if (Object.prototype.hasOwnProperty.call(params.changes, 'name')) requireNonEmptyString(params.changes.name, 'changes.name')
  if (Object.prototype.hasOwnProperty.call(params.changes, 'description')) {
    if (typeof params.changes.description !== 'string') throw new RangeError('changes.description must be a string')
  }
  if (Object.prototype.hasOwnProperty.call(params.changes, 'visibility') &&
      params.changes.visibility !== 'public' && params.changes.visibility !== 'unlisted') {
    throw new RangeError('changes.visibility must be public or unlisted')
  }
  return baseEvent(params.authorId, 'update_metadata', { changes: { ...params.changes } })
}

export interface CreateGroupParams { authorId: string; groupId: string; name: string; position: number }
export function createGroup(params: CreateGroupParams): CreateGroupEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isGroupId(params.groupId)) throw new RangeError('groupId must be a valid group ID')
  requireNonEmptyString(params.name, 'name')
  requirePosition(params.position)
  return baseEvent(params.authorId, 'create_group', {
    group_id: params.groupId, name: params.name, position: params.position
  })
}

export interface DeleteGroupParams { authorId: string; groupId: string }
export function deleteGroup(params: DeleteGroupParams): DeleteGroupEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  if (!isGroupId(params.groupId)) throw new RangeError('groupId must be a valid group ID')
  return baseEvent(params.authorId, 'delete_group', { group_id: params.groupId })
}

export interface CollectionUnpublishedParams { authorId: string; message?: string; migratedTo?: string }
export function collectionUnpublished(params: CollectionUnpublishedParams): CollectionUnpublishedEvent {
  requireRecord(params, 'params')
  requireAuthorId(params.authorId)
  requireOptionalString(params.message, 'message')
  if (params.migratedTo !== undefined && !isCollectionId(params.migratedTo)) {
    throw new RangeError('migratedTo must be a valid collection ID')
  }
  const payload: CollectionUnpublishedPayload = { migrated_to: params.migratedTo ?? null }
  if (params.message !== undefined) payload.message = params.message
  return baseEvent(params.authorId, 'collection_unpublished', payload)
}


export interface GenesisSigningParams {
  collectionId: string
  collectionPublicKey: Uint8Array
  authorId: string
  authorPublicKey: Uint8Array
  name: string
  visibility: 'public' | 'unlisted'
  forkedFrom?: string | null
  migratedFrom?: string | null
}

export interface CollectionGenesisParams extends GenesisSigningParams {
  secretKey: Uint8Array
  description?: string
}

function validateGenesisSigningParams(params: GenesisSigningParams): void {
  requireRecord(params, 'params')
  if (!isCollectionId(params.collectionId)) throw new RangeError('collectionId must be 64 lowercase hexadecimal characters')
  if (!(params.collectionPublicKey instanceof Uint8Array) || params.collectionPublicKey.length !== 32) {
    throw new RangeError('collectionPublicKey must contain exactly 32 bytes')
  }
  requireAuthorId(params.authorId)
  if (!(params.authorPublicKey instanceof Uint8Array) || params.authorPublicKey.length !== 32) {
    throw new RangeError('authorPublicKey must contain exactly 32 bytes')
  }
  requireNonEmptyString(params.name, 'name')
  if (params.visibility !== 'public' && params.visibility !== 'unlisted') {
    throw new RangeError('visibility must be public or unlisted')
  }
  if (params.forkedFrom !== undefined && params.forkedFrom !== null && !isCollectionId(params.forkedFrom)) {
    throw new RangeError('forkedFrom must be a valid collection ID, null, or undefined')
  }
  if (params.migratedFrom !== undefined && params.migratedFrom !== null && !isCollectionId(params.migratedFrom)) {
    throw new RangeError('migratedFrom must be a valid collection ID, null, or undefined')
  }
  if (params.forkedFrom != null && params.migratedFrom != null) {
    throw new RangeError('forkedFrom and migratedFrom are mutually exclusive')
  }
  if (params.collectionId !== toHex(params.collectionPublicKey)) {
    throw new RangeError('collectionId must equal the collection public key in lowercase hexadecimal')
  }
  if (params.authorId !== userIdFromPublicKey(params.authorPublicKey)) {
    throw new RangeError('authorId does not match authorPublicKey')
  }
}

/**
 * Hashes the exact genesis signing preimage specified in docs/15.
 * Fields are concatenated without separators; null and undefined provenance
 * fields both serialize as the empty string. Description is deliberately excluded.
 */
export function genesisSigningHash(params: GenesisSigningParams): Uint8Array {
  validateGenesisSigningParams(params)
  const message = [
    params.collectionId,
    toHex(params.collectionPublicKey),
    params.authorId,
    toHex(params.authorPublicKey),
    params.name,
    params.visibility,
    params.forkedFrom ?? '',
    params.migratedFrom ?? ''
  ].join('')
  const hash = new Uint8Array(32)
  sodium.crypto_hash_sha256(hash, utf8Bytes(message))
  return hash
}

export function collectionGenesis(params: CollectionGenesisParams): CollectionGenesisEvent {
  validateGenesisSigningParams(params)
  if (!(params.secretKey instanceof Uint8Array) || params.secretKey.length !== 64) {
    throw new RangeError('secretKey must contain exactly 64 bytes')
  }
  requireOptionalString(params.description, 'description')

  const forkedFrom = params.forkedFrom ?? null
  const migratedFrom = params.migratedFrom ?? null
  const hash = genesisSigningHash(params)
  const signature = serializeSignature(sign(hash, params.secretKey))
  const payload: CollectionGenesisPayload = {
    collection_id: params.collectionId,
    collection_public_key: serializeCollectionPublicKey(params.collectionPublicKey),
    author_public_key: serializePublicKey(params.authorPublicKey),
    name: params.name,
    visibility: params.visibility,
    forked_from: forkedFrom,
    migrated_from: migratedFrom,
    signature_by_owner: signature
  }
  if (params.description !== undefined) payload.description = params.description

  return {
    schema_version: 1,
    event_id: ulid(),
    event_type: 'collection_genesis',
    author_id: params.authorId,
    created_at: new Date().toISOString(),
    payload
  }
}
