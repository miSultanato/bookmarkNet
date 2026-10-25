import { createIdentity, identityToApi, loadIdentity } from '../identity/store.ts'

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
