import type { DeviceBookmarkState, DeviceCollectionState, DeviceGroupState } from '../device-fold.ts'
import type { Node } from '../node/start.ts'

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

function contains(value: string | undefined, query: string): boolean {
  return (value ?? '').toLowerCase().includes(query)
}

export async function handleSearch(
  node: Node,
  query: { q?: string }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de buscar')
  if (typeof query.q !== 'string' || query.q.trim().length === 0) {
    return error(400, 'INVALID_QUERY', 'q debe ser un string no vacío')
  }

  const needle = query.q.toLowerCase()
  const bookmarks = [...node.state.bookmarks.values()].filter((bookmark) => !bookmark.deleted)
  const collections = [...node.state.collections.values()]
    .filter((collection) => !collection.deleted)
    .filter((collection) => contains(collection.name, needle) || contains(collection.description, needle))
    .map((collection: DeviceCollectionState) => ({
      collection_id: collection.collectionId,
      name: collection.name,
      description: collection.description ?? '',
      bookmarks_count: bookmarks.filter((bookmark) => bookmark.collectionId === collection.collectionId).length
    }))
    .sort((a, b) => b.bookmarks_count - a.bookmarks_count)
    .slice(0, 50)

  const groups = [...node.state.groups.values()]
    .filter((group) => !group.deleted)
    .filter((group) => contains(group.name, needle))
    .map((group: DeviceGroupState) => ({
      group_id: group.groupId,
      collection_id: group.collectionId,
      name: group.name,
      bookmarks_count: bookmarks.filter((bookmark) => bookmark.groupId === group.groupId).length
    }))
    .sort((a, b) => b.bookmarks_count - a.bookmarks_count)
    .slice(0, 50)

  const matchingBookmarks = bookmarks
    .filter((bookmark: DeviceBookmarkState) =>
      contains(bookmark.title, needle) ||
      contains(bookmark.description, needle) ||
      contains(bookmark.tags.join(' '), needle) ||
      contains(bookmark.canonicalUrl, needle)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50)
    .map((bookmark) => ({
      bookmark_id: bookmark.bookmarkId,
      title: bookmark.title,
      url: bookmark.canonicalUrl,
      collection_id: bookmark.collectionId,
      group_id: bookmark.groupId
    }))

  return { status: 200, body: { collections, groups, bookmarks: matchingBookmarks } }
}
