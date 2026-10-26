import { ulid } from '../ulid.ts'
import {
  deviceCreateCollection,
  deviceDeleteCollection,
  deviceUpdateCollection
} from '../device-events.ts'
import type { DeviceCollectionState } from '../device-fold.ts'
import type { Node } from '../node/start.ts'

export function apiCollection(collection: DeviceCollectionState): object {
  const result: {
    collection_id: string
    name: string
    description?: string
    visibility: 'public' | 'unlisted'
    language: 'es' | 'en' | 'eu'
    created_at: string
    updated_at?: string
  } = {
    collection_id: collection.collectionId,
    name: collection.name,
    visibility: collection.visibility,
    language: collection.language,
    created_at: collection.createdAt
  }
  if (collection.description !== undefined) result.description = collection.description
  if (collection.updatedAt !== undefined) result.updated_at = collection.updatedAt
  return result
}

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isVisibility(value: unknown): value is 'public' | 'unlisted' {
  return value === 'public' || value === 'unlisted'
}

function isLanguage(value: unknown): value is 'es' | 'en' | 'eu' {
  return value === 'es' || value === 'en' || value === 'eu'
}

export async function handleListCollections(
  node: Node,
  query: { visibility?: string; owner?: string }
): Promise<{ status: number; body: unknown }> {
  if (query.visibility !== undefined && !isVisibility(query.visibility)) {
    return error(400, 'INVALID_VISIBILITY', 'visibility debe ser public o unlisted')
  }

  // owner se acepta por compatibilidad con la API; MVP0 solo tiene un usuario local.
  void query.owner
  const collections = [...node.state.collections.values()]
    .filter((collection) => !collection.deleted)
    .filter((collection) => query.visibility === undefined || collection.visibility === query.visibility)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(apiCollection)

  return { status: 200, body: { collections } }
}

export async function handleCreateCollection(
  node: Node,
  body: { name: string; description?: string; visibility?: 'public' | 'unlisted'; language?: 'es' | 'en' | 'eu' }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  if (!isRecord(body) || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return error(400, 'INVALID_NAME', 'name debe ser un string no vacío')
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return error(400, 'INVALID_DESCRIPTION', 'description debe ser un string')
  }
  const visibility = body.visibility === undefined ? 'public' : body.visibility
  if (!isVisibility(visibility)) {
    return error(400, 'INVALID_VISIBILITY', 'visibility debe ser public o unlisted')
  }

  if (body.language !== undefined && !isLanguage(body.language)) {
    return error(400, 'INVALID_LANGUAGE', 'language must be one of: es, en, eu')
  }

  const collectionId = ulid()
  const event = deviceCreateCollection({
    authorId: node.identity.user_id,
    collectionId,
    name: body.name,
    description: body.description,
    visibility,
    language: body.language
  })
  await node.apply(event)
  const collection = node.state.collections.get(collectionId)
  if (!collection) return error(500, 'INTERNAL', 'No se pudo crear la colección')
  return { status: 201, body: { collection: apiCollection(collection) } }
}

export async function handleGetCollection(
  node: Node,
  id: string
): Promise<{ status: number; body: unknown }> {
  const collection = node.state.collections.get(id)
  if (!collection || collection.deleted) return error(404, 'NOT_FOUND', 'Colección no encontrada')
  return { status: 200, body: { collection: apiCollection(collection) } }
}

export async function handleUpdateCollection(
  node: Node,
  id: string,
  body: { name?: string; description?: string | null; visibility?: 'public' | 'unlisted'; language?: 'es' | 'en' | 'eu' }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  const collection = node.state.collections.get(id)
  if (!collection || collection.deleted) return error(404, 'NOT_FOUND', 'Colección no encontrada')
  if (!isRecord(body)) return error(400, 'EMPTY_CHANGES', 'Indica al menos un campo para actualizar')

  const hasName = Object.prototype.hasOwnProperty.call(body, 'name')
  const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description')
  const hasVisibility = Object.prototype.hasOwnProperty.call(body, 'visibility')
  const hasLanguage = Object.prototype.hasOwnProperty.call(body, 'language')
  if (!hasName && !hasDescription && !hasVisibility && !hasLanguage) {
    return error(400, 'EMPTY_CHANGES', 'Indica al menos un campo para actualizar')
  }
  if (hasName && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
    return error(400, 'INVALID_NAME', 'name debe ser un string no vacío')
  }
  if (hasDescription && body.description !== null && typeof body.description !== 'string') {
    return error(400, 'INVALID_DESCRIPTION', 'description debe ser un string o null')
  }
  if (hasVisibility && !isVisibility(body.visibility)) {
    return error(400, 'INVALID_VISIBILITY', 'visibility debe ser public o unlisted')
  }
  if (hasLanguage && !isLanguage(body.language)) {
    return error(400, 'INVALID_LANGUAGE', 'language must be one of: es, en, eu')
  }

  const changes: { name?: string; description?: string | null; visibility?: 'public' | 'unlisted'; language?: 'es' | 'en' | 'eu' } = {}
  if (hasName) changes.name = body.name as string
  if (hasDescription) changes.description = body.description as string | null
  if (hasVisibility) changes.visibility = body.visibility as 'public' | 'unlisted'
  if (hasLanguage) changes.language = body.language as 'es' | 'en' | 'eu'

  const event = deviceUpdateCollection({ authorId: node.identity.user_id, collectionId: id, changes })
  await node.apply(event)
  const updated = node.state.collections.get(id)
  if (!updated) return error(500, 'INTERNAL', 'No se pudo actualizar la colección')
  return { status: 200, body: { collection: apiCollection(updated) } }
}

export async function handleDeleteCollection(
  node: Node,
  id: string
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  const collection = node.state.collections.get(id)
  if (!collection || collection.deleted) return error(404, 'NOT_FOUND', 'Colección no encontrada')
  const event = deviceDeleteCollection({ authorId: node.identity.user_id, collectionId: id })
  await node.apply(event)
  return { status: 204, body: undefined }
}
