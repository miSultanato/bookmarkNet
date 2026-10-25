import fs from 'bare-fs'
import {
  generateUserMasterKey,
  serializePublicKey,
  userKeypairFromMasterKey
} from '../identity.ts'
import { fromHex, toHex, userIdFromPublicKey } from '../ids.ts'

export interface StoredIdentity {
  private_key: string
  public_key: string
  profile: object
}

function identityPath(dataDir: string): string {
  return dataDir.replace(/\\/+$/, '') + '/identity.bmn'
}

function isStoredIdentity(value: unknown): value is StoredIdentity {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.private_key === 'string' &&
    /^[0-9a-f]{64}$/.test(candidate.private_key) &&
    typeof candidate.public_key === 'string' &&
    /^[0-9a-f]{64}$/.test(candidate.public_key) &&
    candidate.profile !== null &&
    typeof candidate.profile === 'object' &&
    !Array.isArray(candidate.profile)
}

export async function hasIdentity(dataDir: string): Promise<boolean> {
  try {
    await fs.stat(identityPath(dataDir))
    return true
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return false
    throw error
  }
}

export async function saveIdentity(dataDir: string, identity: StoredIdentity): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  await fs.writeFile(identityPath(dataDir), JSON.stringify(identity, null, 2) + '\n', { mode: 0o600 })
}

export async function createIdentity(dataDir: string): Promise<StoredIdentity> {
  if (await hasIdentity(dataDir)) {
    throw new RangeError('La identidad ya existe en identity.bmn')
  }

  const masterKey = generateUserMasterKey()
  const { publicKey } = userKeypairFromMasterKey(masterKey)
  const identity: StoredIdentity = {
    private_key: toHex(masterKey),
    public_key: toHex(publicKey),
    profile: {}
  }
  await saveIdentity(dataDir, identity)
  return identity
}

export async function loadIdentity(dataDir: string): Promise<StoredIdentity | null> {
  let contents: string
  try {
    contents = await fs.readFile(identityPath(dataDir), 'utf8')
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(contents) as unknown
  } catch (error) {
    throw new RangeError(`identity.bmn contiene JSON inválido: ${(error as Error).message}`)
  }

  if (!isStoredIdentity(parsed)) {
    throw new RangeError('identity.bmn tiene un formato inválido')
  }
  return parsed
}

export function identityToApi(identity: StoredIdentity): {
  user_id: string
  public_key: string
  profile: object
} {
  const publicKey = fromHex(identity.public_key)
  return {
    user_id: userIdFromPublicKey(publicKey),
    public_key: serializePublicKey(publicKey),
    profile: identity.profile
  }
}
