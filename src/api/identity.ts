import { createIdentity, identityToApi, loadIdentity } from '../identity/store.ts'
import type { StoredIdentity } from '../identity/store.ts'
import { exportIdentity, importIdentity } from '../identity/export.ts'
import type { ExportedIdentity } from '../identity/export.ts'

function error(status: number, code: string, message: string): { status: number; body: unknown } {
  return { status, body: { error: { code, message } } }
}

function validPassword(body: unknown): body is { password: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  const password = (body as Record<string, unknown>).password
  return typeof password === 'string' && password.length >= 8 && password.length <= 1024
}

export async function handleGetIdentity(dataDir: string): Promise<{ status: number; body: unknown }> {
  try {
    const identity = await loadIdentity(dataDir)
    return {
      status: 200,
      body: { identity: identity === null ? null : identityToApi(identity) }
    }
  } catch (error) {
    if (error instanceof RangeError) {
      return {
        status: 500,
        body: { error: { code: 'IDENTITY_INVALID', message: error.message } }
      }
    }
    return {
      status: 500,
      body: { error: { code: 'INTERNAL', message: 'Error interno del servidor' } }
    }
  }
}

export async function handleCreateIdentity(dataDir: string): Promise<{ status: number; body: unknown }> {
  try {
    const identity = await createIdentity(dataDir)
    return { status: 201, body: identityToApi(identity) }
  } catch (error) {
    if (error instanceof RangeError) {
      return {
        status: 409,
        body: { error: { code: 'IDENTITY_EXISTS', message: error.message } }
      }
    }
    return {
      status: 500,
      body: { error: { code: 'INTERNAL', message: 'Error interno del servidor' } }
    }
  }
}

export async function handleExportIdentity(
  dataDir: string,
  body: unknown
): Promise<{ status: number; body: unknown }> {
  if (!validPassword(body)) {
    return error(400, 'INVALID_PASSWORD', 'La contraseña debe tener entre 8 y 1024 caracteres')
  }
  try {
    return { status: 200, body: await exportIdentity(dataDir, body.password) }
  } catch (cause) {
    if (cause instanceof RangeError && cause.message.includes('No existe una identidad')) {
      return error(404, 'NO_IDENTITY', cause.message)
    }
    return error(500, 'INTERNAL', 'Error interno del servidor')
  }
}

export async function handleImportIdentity(
  dataDir: string,
  body: unknown
): Promise<{ status: number; body: unknown }> {
  if (!validPassword(body)) {
    return error(400, 'INVALID_BODY', 'Se requiere una contraseña de entre 8 y 1024 caracteres')
  }
  const candidate = body as Record<string, unknown>
  if (candidate.identity_blob === null || typeof candidate.identity_blob !== 'object' ||
      Array.isArray(candidate.identity_blob)) {
    return error(400, 'INVALID_BODY', 'identity_blob debe ser un objeto de exportación válido')
  }

  try {
    const stored: StoredIdentity = await importIdentity(
      dataDir,
      body.password,
      candidate.identity_blob as ExportedIdentity
    )
    return { status: 201, body: { identity: identityToApi(stored) } }
  } catch (cause) {
    if (cause instanceof RangeError && cause.message.includes('ya existe')) {
      return error(409, 'IDENTITY_EXISTS', cause.message)
    }
    if (cause instanceof RangeError && cause.message.includes('No se pudo descifrar')) {
      return error(400, 'DECRYPT_FAILED', cause.message)
    }
    if (cause instanceof RangeError) return error(400, 'INVALID_BODY', cause.message)
    return error(500, 'INTERNAL', 'Error interno del servidor')
  }
}
