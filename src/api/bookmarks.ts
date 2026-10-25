import { deviceAddBookmark, deviceEditBookmark, deviceRemoveBookmark } from '../device-events.ts'
import type { DeviceBookmarkState } from '../device-fold.ts'
import { canonicalizeUrl } from '../canonicalize.ts'
import { newBookmarkId, resourceIdFromCanonicalUrl } from '../ids.ts'
import type { Node } from '../node/start.ts'

export function apiBookmark(bookmark: DeviceBookmarkState): object {
  const result: {
    bookmark_id: string
    collection_id: string
    resource_id: string
    canonical_url: string
    title: string
    description?: string
    tags: string[]
    notes?: string
    group_id: string | null
    position: number | null
    created_at: string
    updated_at?: string
  } = {
    bookmark_id: bookmark.bookmarkId,
    collection_id: bookmark.collectionId,
    resource_id: bookmark.resourceId,
    canonical_url: bookmark.canonicalUrl,
    title: bookmark.title,
    tags: [...bookmark.tags],
    group_id: bookmark.groupId,
    position: bookmark.position,
    created_at: bookmark.createdAt
  }
  if (bookmark.description !== undefined) result.description = bookmark.description
  if (bookmark.notes !== undefined) result.notes = bookmark.notes
  if (bookmark.updatedAt !== undefined) result.updated_at = bookmark.updatedAt
  return result
}

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function handleListBookmarks(
  node: Node,
  query: { collection_id?: string; group_id?: string; tag?: string; q?: string }
): Promise<{ status: number; body: unknown }> {
  let bookmarks = [...node.state.bookmarks.values()].filter((bookmark) => !bookmark.deleted)

  if (query.collection_id !== undefined) {
    const collection = node.state.collections.get(query.collection_id)
    if (!collection || collection.deleted) bookmarks = []
    else bookmarks = bookmarks.filter((bookmark) => bookmark.collectionId === query.collection_id)
  }
  if (query.group_id !== undefined) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.groupId === query.group_id)
  }
  if (query.tag !== undefined) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.tags.includes(query.tag as string))
  }
  if (query.q !== undefined && query.q.length > 0) {
    const needle = query.q.toLocaleLowerCase()
    bookmarks = bookmarks.filter((bookmark) =>
      bookmark.title.toLocaleLowerCase().includes(needle) ||
      (bookmark.description ?? '').toLocaleLowerCase().includes(needle) ||
      bookmark.tags.join(' ').toLocaleLowerCase().includes(needle) ||
      bookmark.canonicalUrl.toLocaleLowerCase().includes(needle)
    )
  }

  bookmarks.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { status: 200, body: { bookmarks: bookmarks.map(apiBookmark) } }
}

export async function handleCreateBookmark(
  node: Node,
  body: {
    url: string
    collection_id: string
    title?: string
    description?: string
    tags?: string[]
    notes?: string
    group_id?: string | null
  }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  if (!isRecord(body) || typeof body.url !== 'string' || body.url.trim().length === 0) {
    return error(400, 'INVALID_URL', 'url debe ser un string no vacío')
  }
  if (typeof body.collection_id !== 'string' || body.collection_id.trim().length === 0) {
    return error(400, 'COLLECTION_NOT_FOUND', 'collection_id debe identificar una colección existente')
  }
  const collection = node.state.collections.get(body.collection_id)
  if (!collection || collection.deleted) {
    return error(400, 'COLLECTION_NOT_FOUND', 'Colección no encontrada')
  }

  let canonicalUrl: string
  try {
    canonicalUrl = canonicalizeUrl(body.url)
  } catch (cause) {
    if (cause instanceof RangeError) return error(400, 'INVALID_URL', 'url debe ser una URL HTTP(S) válida')
    throw cause
  }

  if (body.group_id !== undefined && body.group_id !== null) {
    const group = node.state.groups.get(body.group_id)
    if (!group || group.deleted || group.collectionId !== body.collection_id) {
      return error(400, 'GROUP_NOT_FOUND', 'Grupo no encontrado en la colección indicada')
    }
  }
  if (body.title !== undefined && typeof body.title !== 'string') {
    return error(400, 'INVALID_TITLE', 'title debe ser un string')
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return error(400, 'INVALID_DESCRIPTION', 'description debe ser un string')
  }
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    return error(400, 'INVALID_NOTES', 'notes debe ser un string')
  }
  if (body.tags !== undefined && (!Array.isArray(body.tags) || !body.tags.every((tag) => typeof tag === 'string'))) {
    return error(400, 'INVALID_TAGS', 'tags debe ser un array de strings')
  }

  const bookmarkId = newBookmarkId()
  const resourceId = resourceIdFromCanonicalUrl(canonicalUrl)
  const event = deviceAddBookmark({
    authorId: node.identity.user_id,
    bookmarkId,
    collectionId: body.collection_id,
    resourceId,
    canonicalUrl,
    title: body.title ?? canonicalUrl,
    description: body.description,
    tags: body.tags ?? [],
    notes: body.notes,
    groupId: body.group_id ?? null
  })
  await node.apply(event)
  const bookmark = node.state.bookmarks.get(bookmarkId)
  if (!bookmark) return error(500, 'INTERNAL', 'No se pudo crear el bookmark')
  return { status: 201, body: { bookmark: apiBookmark(bookmark) } }
}

export async function handleGetBookmark(
  node: Node,
  id: string
): Promise<{ status: number; body: unknown }> {
  const bookmark = node.state.bookmarks.get(id)
  if (!bookmark || bookmark.deleted) return error(404, 'NOT_FOUND', 'Bookmark no encontrado')
  return { status: 200, body: { bookmark: apiBookmark(bookmark) } }
}

export async function handleUpdateBookmark(
  node: Node,
  id: string,
  body: { title?: string; description?: string | null; tags?: string[]; notes?: string | null }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  const bookmark = node.state.bookmarks.get(id)
  if (!bookmark || bookmark.deleted) return error(404, 'NOT_FOUND', 'Bookmark no encontrado')
  if (!isRecord(body)) return error(400, 'EMPTY_CHANGES', 'Debe indicarse al menos un campo para modificar')

  const fields = ['title', 'description', 'tags', 'notes']
  const present = fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
  if (present.length === 0) return error(400, 'EMPTY_CHANGES', 'Debe indicarse al menos un campo para modificar')

  const changes: { title?: string; description?: string | null; tags?: string[]; notes?: string | null } = {}
  for (const field of present) {
    const value = body[field]
    if (field === 'title') {
      if (value === null) return error(400, 'INVALID_CHANGE', 'title cannot be null')
      if (typeof value !== 'string') return error(400, 'INVALID_CHANGE', 'title must be a string')
      changes.title = value
    } else if (field === 'tags') {
      if (value === null) return error(400, 'INVALID_CHANGE', 'tags cannot be null')
      if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
        return error(400, 'INVALID_CHANGE', 'tags must be an array of strings')
      }
      changes.tags = value
    } else if (field === 'description') {
      if (value !== null && typeof value !== 'string') {
        return error(400, 'INVALID_CHANGE', 'description must be a string or null')
      }
      changes.description = value
    } else if (field === 'notes') {
      if (value !== null && typeof value !== 'string') {
        return error(400, 'INVALID_CHANGE', 'notes must be a string or null')
      }
      changes.notes = value
    }
  }

  const event = deviceEditBookmark({
    authorId: node.identity.user_id,
    bookmarkId: id,
    changes
  })
  await node.apply(event)
  const updated = node.state.bookmarks.get(id)
  if (!updated || updated.deleted) return error(404, 'NOT_FOUND', 'Bookmark no encontrado')
  return { status: 200, body: { bookmark: apiBookmark(updated) } }
}

export async function handleDeleteBookmark(
  node: Node,
  id: string
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  const bookmark = node.state.bookmarks.get(id)
  if (!bookmark || bookmark.deleted) return error(404, 'NOT_FOUND', 'Bookmark no encontrado')
  const event = deviceRemoveBookmark({ authorId: node.identity.user_id, bookmarkId: id })
  await node.apply(event)
  return { status: 204, body: undefined }
}
