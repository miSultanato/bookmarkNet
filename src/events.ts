/**
 * TypeScript schema for the ten immutable collection-core event types.
 * Constructors and runtime validation are defined alongside these types.
 */

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

export interface RemoveBookmarkPayload {
  bookmark_id: string
}

export interface MoveBookmarkPayload {
  bookmark_id: string
  group_id: string | null
}

export interface ReorderBookmarkPayload {
  bookmark_id: string
  group_id: string | null
  position: number
}

export interface UpdateMetadataPayload {
  changes: {
    name?: string | null
    description?: string | null
    visibility?: 'public' | 'unlisted' | null
  }
}

export interface CreateGroupPayload {
  group_id: string
  name: string
  position: number
}

export interface DeleteGroupPayload {
  group_id: string
}

export interface CollectionUnpublishedPayload {
  message?: string
  migrated_to?: string
}

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
