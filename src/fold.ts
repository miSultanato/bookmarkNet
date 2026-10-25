import type { CollectionEvent } from './events.ts'

export interface CollectionMeta {
  collectionId: string
  collectionPublicKey: string
  authorId: string
  authorPublicKey: string
  name: string
  description?: string
  visibility: 'public' | 'unlisted'
  forkedFrom: string | null
  migratedFrom: string | null
  createdAt: string
  unpublished: boolean
  unpublishedMessage?: string
  migratedTo?: string | null
}

export interface BookmarkState {
  bookmarkId: string
  resourceId: string
  canonicalUrl: string
  title: string
  description?: string
  tags: string[]
  notes?: string
  groupId: string | null
  position: number | null
  createdAt: string
  updatedAt?: string
  deleted: boolean
}

export interface GroupState {
  groupId: string
  name: string
  position: number
  createdAt: string
  deleted: boolean
}

export interface CollectionState {
  collection: CollectionMeta | null
  bookmarks: Map<string, BookmarkState>
  groups: Map<string, GroupState>
}

export function emptyState(): CollectionState {
  return {
    collection: null,
    bookmarks: new Map(),
    groups: new Map()
  }
}

export function applyEvent(state: CollectionState, event: CollectionEvent): CollectionState {
  switch (event.event_type) {
    case 'collection_genesis': {
      if (state.collection !== null) return state
      const payload = event.payload
      const collection = {
        collectionId: payload.collection_id,
        collectionPublicKey: payload.collection_public_key,
        authorId: event.author_id,
        authorPublicKey: payload.author_public_key,
        name: payload.name,
        visibility: payload.visibility,
        forkedFrom: payload.forked_from,
        migratedFrom: payload.migrated_from,
        createdAt: event.created_at,
        unpublished: false
      }
      if (payload.description !== undefined) collection.description = payload.description
      return { ...state, collection }
    }

    case 'add_bookmark': {
      if (state.collection === null) return state
      const payload = event.payload
      if (state.bookmarks.has(payload.bookmark_id)) return state
      const bookmark = {
        bookmarkId: payload.bookmark_id,
        resourceId: payload.resource_id,
        canonicalUrl: payload.canonical_url,
        title: payload.title,
        tags: [...payload.tags],
        groupId: payload.group_id ?? null,
        position: null,
        createdAt: event.created_at,
        deleted: false
      }
      if (payload.description !== undefined) bookmark.description = payload.description
      if (payload.notes !== undefined) bookmark.notes = payload.notes
      const bookmarks = new Map(state.bookmarks)
      bookmarks.set(bookmark.bookmarkId, bookmark)
      return { ...state, bookmarks }
    }

    case 'remove_bookmark': {
      if (state.collection === null) return state
      const existing = state.bookmarks.get(event.payload.bookmark_id)
      if (existing === undefined || existing.deleted) return state
      const bookmarks = new Map(state.bookmarks)
      bookmarks.set(existing.bookmarkId, { ...existing, deleted: true, updatedAt: event.created_at })
      return { ...state, bookmarks }
    }

    case 'update_metadata': {
      if (state.collection === null) return state
      return {
        ...state,
        collection: { ...state.collection, ...event.payload.changes }
      }
    }

    case 'create_group': {
      if (state.collection === null) return state
      const payload = event.payload
      if (state.groups.has(payload.group_id)) return state
      const group = {
        groupId: payload.group_id,
        name: payload.name,
        position: payload.position,
        createdAt: event.created_at,
        deleted: false
      }
      const groups = new Map(state.groups)
      groups.set(group.groupId, group)
      return { ...state, groups }
    }

    case 'delete_group': {
      if (state.collection === null) return state
      const existing = state.groups.get(event.payload.group_id)
      if (existing === undefined || existing.deleted) return state
      const groups = new Map(state.groups)
      groups.set(existing.groupId, { ...existing, deleted: true })
      const bookmarks = new Map(state.bookmarks)
      for (const [bookmarkId, bookmark] of bookmarks) {
        if (bookmark.groupId === existing.groupId && !bookmark.deleted) {
          bookmarks.set(bookmarkId, { ...bookmark, groupId: null, updatedAt: event.created_at })
        }
      }
      return { ...state, groups, bookmarks }
    }

    case 'collection_unpublished': {
      if (state.collection === null || state.collection.unpublished) return state
      const collection = {
        ...state.collection,
        unpublished: true,
        migratedTo: event.payload.migrated_to ?? null
      }
      if (event.payload.message !== undefined) collection.unpublishedMessage = event.payload.message
      return { ...state, collection }
    }

    case 'edit_bookmark': {
      if (state.collection === null) return state
      const payload = event.payload
      const existing = state.bookmarks.get(payload.bookmark_id)
      if (existing === undefined || existing.deleted) return state

      const bookmark = { ...existing, updatedAt: event.created_at }
      const changes = payload.changes
      if (Object.prototype.hasOwnProperty.call(changes, 'title')) {
        if (changes.title === null) Reflect.deleteProperty(bookmark, 'title')
        else bookmark.title = changes.title
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'description')) {
        if (changes.description === null) delete bookmark.description
        else bookmark.description = changes.description
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'tags')) {
        if (changes.tags === null) Reflect.deleteProperty(bookmark, 'tags')
        else bookmark.tags = [...changes.tags]
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'notes')) {
        if (changes.notes === null) delete bookmark.notes
        else bookmark.notes = changes.notes
      }

      const bookmarks = new Map(state.bookmarks)
      bookmarks.set(bookmark.bookmarkId, bookmark)
      return { ...state, bookmarks }
    }

    case 'move_bookmark':
    case 'reorder_bookmark':
      return state
  }
}

export function foldEvents(events: CollectionEvent[]): CollectionState {
  return events.reduce((state, event) => applyEvent(state, event), emptyState())
}
