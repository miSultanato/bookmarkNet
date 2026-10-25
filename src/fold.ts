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
