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
      if (changes === undefined || changes === null) return state
      if (Object.prototype.hasOwnProperty.call(changes, 'title')) {
        // title is required in BookmarkState, so null is ignored; use "" to clear it.
        if (changes.title !== null) bookmark.title = changes.title
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'description')) {
        if (changes.description === null) delete bookmark.description
        else bookmark.description = changes.description
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'tags')) {
        // tags is required in BookmarkState, so null is ignored; use [] to clear it.
        if (changes.tags !== null) bookmark.tags = [...changes.tags]
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'notes')) {
        if (changes.notes === null) delete bookmark.notes
        else bookmark.notes = changes.notes
      }

      const bookmarks = new Map(state.bookmarks)
      bookmarks.set(bookmark.bookmarkId, bookmark)
      return { ...state, bookmarks }
    }

    case 'move_bookmark': {
      if (state.collection === null) return state
      const payload = event.payload
      const existing = state.bookmarks.get(payload.bookmark_id)
      if (existing === undefined || existing.deleted) return state
      if (payload.group_id !== null) {
        const group = state.groups.get(payload.group_id)
        if (group === undefined || group.deleted) return state
      }

      // Repeating a move to the current group is idempotent for placement,
      // but the explicit event still records its timestamp in updatedAt.
      const bookmarks = new Map(state.bookmarks)
      bookmarks.set(existing.bookmarkId, {
        ...existing,
        groupId: payload.group_id,
        updatedAt: event.created_at
      })
      return { ...state, bookmarks }
    }

    case 'reorder_bookmark': {
      if (state.collection === null) return state
      const payload = event.payload
      const existing = state.bookmarks.get(payload.bookmark_id)
      if (existing === undefined || existing.deleted) return state
      if (existing.groupId !== payload.group_id) return state

      const active = []
      for (const bookmark of state.bookmarks.values()) {
        if (!bookmark.deleted && bookmark.groupId === payload.group_id) active.push(bookmark)
      }

      const bookmarks = new Map(state.bookmarks)
      if (active.some((bookmark) => bookmark.position === null)) {
        active.sort((a, b) => {
          if (a.createdAt < b.createdAt) return -1
          if (a.createdAt > b.createdAt) return 1
          if (a.bookmarkId < b.bookmarkId) return -1
          if (a.bookmarkId > b.bookmarkId) return 1
          return 0
        })
        for (let i = 0; i < active.length; i++) {
          const bookmark = { ...active[i], position: i }
          active[i] = bookmark
          bookmarks.set(bookmark.bookmarkId, bookmark)
        }
      }

      active.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        if (a.createdAt < b.createdAt) return -1
        if (a.createdAt > b.createdAt) return 1
        if (a.bookmarkId < b.bookmarkId) return -1
        if (a.bookmarkId > b.bookmarkId) return 1
        return 0
      })

      const currentIndex = active.findIndex((bookmark) => bookmark.bookmarkId === existing.bookmarkId)
      if (currentIndex === -1) return state
      const targetIndex = Math.min(payload.position, active.length - 1)
      const reordered = active.splice(currentIndex, 1)[0]
      active.splice(targetIndex, 0, reordered)

      for (let i = 0; i < active.length; i++) {
        const bookmark = active[i]
        const updated = {
          ...bookmark,
          position: i,
          ...(bookmark.bookmarkId === existing.bookmarkId ? { updatedAt: event.created_at } : {})
        }
        bookmarks.set(updated.bookmarkId, updated)
      }
      return { ...state, bookmarks }
    }
  }
}

export function foldEvents(events: CollectionEvent[]): CollectionState {
  return events.reduce((state, event) => applyEvent(state, event), emptyState())
}
