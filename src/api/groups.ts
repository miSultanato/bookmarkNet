import { deviceCreateGroup, deviceDeleteGroup } from '../device-events.ts'
import type { DeviceGroupState } from '../device-fold.ts'
import { newGroupId } from '../ids.ts'
import type { Node } from '../node/start.ts'

export function apiGroup(group: DeviceGroupState): object {
  const result: {
    group_id: string
    collection_id: string
    name: string
    position: number
    created_at: string
    updated_at?: string
  } = {
    group_id: group.groupId,
    collection_id: group.collectionId,
    name: group.name,
    position: group.position,
    created_at: group.createdAt
  }
  if (group.updatedAt !== undefined) result.updated_at = group.updatedAt
  return result
}

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function handleListGroups(
  node: Node,
  query: { collection_id?: string }
): Promise<{ status: number; body: unknown }> {
  const collectionId = query.collection_id
  if (collectionId !== undefined) {
    const collection = node.state.collections.get(collectionId)
    if (!collection || collection.deleted) return { status: 200, body: { groups: [] } }
  }

  const groups = [...node.state.groups.values()]
    .filter((group) => !group.deleted)
    .filter((group) => collectionId === undefined || group.collectionId === collectionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(apiGroup)

  return { status: 200, body: { groups } }
}

export async function handleCreateGroup(
  node: Node,
  body: { name: string; collection_id: string }
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  if (!isRecord(body) || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return error(400, 'INVALID_NAME', 'name debe ser un string no vacío')
  }
  if (typeof body.collection_id !== 'string' || body.collection_id.trim().length === 0) {
    return error(400, 'COLLECTION_NOT_FOUND', 'Colección no encontrada')
  }
  const collection = node.state.collections.get(body.collection_id)
  if (!collection || collection.deleted) return error(400, 'COLLECTION_NOT_FOUND', 'Colección no encontrada')

  const groupId = newGroupId()
  const position = [...node.state.groups.values()]
    .filter((group) => !group.deleted && group.collectionId === body.collection_id)
    .length
  const event = deviceCreateGroup({
    authorId: node.identity.user_id,
    groupId,
    collectionId: body.collection_id,
    name: body.name,
    position
  })
  await node.apply(event)
  const group = node.state.groups.get(groupId)
  if (!group) return error(500, 'INTERNAL', 'No se pudo crear el grupo')
  return { status: 201, body: { group: apiGroup(group) } }
}

export async function handleDeleteGroup(
  node: Node,
  id: string
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de escribir')
  const group = node.state.groups.get(id)
  if (!group || group.deleted) return error(404, 'NOT_FOUND', 'Grupo no encontrado')
  const event = deviceDeleteGroup({
    authorId: node.identity.user_id,
    groupId: id,
    collectionId: group.collectionId
  })
  await node.apply(event)
  return { status: 204, body: undefined }
}
