import { deviceMetadata } from '../device-events.ts'
import type { DeviceState } from '../device-fold.ts'
import type { Node } from '../node/start.ts'

type ApiProfile = { display_name?: string; bio?: string; avatar?: string }

export function apiProfile(profile: DeviceState['profile']): ApiProfile {
  const result: ApiProfile = {}
  if (profile.displayName !== undefined) result.display_name = profile.displayName
  if (profile.bio !== undefined) result.bio = profile.bio
  if (profile.avatar !== undefined) result.avatar = profile.avatar
  return result
}

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function handleGetProfile(node: Node): { status: number; body: unknown } {
  if (node.identity === null) {
    return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de consultar el perfil')
  }
  return { status: 200, body: { profile: apiProfile(node.state.profile) } }
}

export async function handleUpdateProfile(
  node: Node,
  body: unknown
): Promise<{ status: number; body: unknown }> {
  if (node.identity === null) {
    return error(401, 'NO_IDENTITY', 'Crea o importa una identidad antes de actualizar el perfil')
  }
  if (!isRecord(body)) return error(400, 'EMPTY_CHANGES', 'Indica al menos un campo para actualizar el perfil')

  const fields = ['display_name', 'bio', 'avatar'] as const
  const present = fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
  if (present.length === 0) {
    return error(400, 'EMPTY_CHANGES', 'Indica al menos un campo para actualizar el perfil')
  }
  for (const field of present) {
    if (body[field] !== null && typeof body[field] !== 'string') {
      return error(400, 'INVALID_CHANGE', field + ' debe ser un string o null')
    }
  }

  const profile = { ...node.state.profile }
  for (const field of present) {
    const value = body[field]
    const stateField = field === 'display_name' ? 'displayName' : field
    if (value === null) {
      delete profile[stateField]
    } else if (typeof value === 'string') {
      profile[stateField] = value
    }
  }

  await node.apply(deviceMetadata({
    authorId: node.identity.user_id,
    displayName: profile.displayName,
    bio: profile.bio,
    avatar: profile.avatar
  }))
  return { status: 200, body: { profile: apiProfile(node.state.profile) } }
}
