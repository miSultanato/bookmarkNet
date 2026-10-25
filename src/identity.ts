import sodium from 'sodium-native'
import { userIdFromPublicKey } from './ids.ts'

const PUBLIC_KEY_PREFIX = 'pk_user_'
const SIGNATURE_PREFIX = 'sig_'
const PUBLIC_KEY_RE = /^pk_user_[0-9a-f]{64}$/
const SIGNATURE_RE = /^sig_[0-9a-f]{128}$/

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Generates the user's 32-byte master seed, which is also their private key seed. */
export function generateUserMasterKey(): Uint8Array {
  const masterKey = new Uint8Array(32)
  sodium.randombytes_buf(masterKey)
  return masterKey
}

/** Derives the user's Ed25519 keypair directly from the master-key seed. */
export function userKeypairFromMasterKey(masterKey: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } {
  if (!(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    throw new RangeError('User master key must contain exactly 32 bytes')
  }

  const publicKey = new Uint8Array(32)
  const secretKey = new Uint8Array(64)
  sodium.crypto_sign_seed_keypair(publicKey, secretKey, masterKey)
  return { publicKey, secretKey }
}

/** Derives the stable user ID from the public key corresponding to the master key. */
export function userIdFromMasterKey(masterKey: Uint8Array): string {
  const { publicKey } = userKeypairFromMasterKey(masterKey)
  return userIdFromPublicKey(publicKey)
}

/** Serializes a user public key as a lowercase hexadecimal string with its domain prefix. */
export function serializePublicKey(publicKey: Uint8Array): string {
  return PUBLIC_KEY_PREFIX + toHex(publicKey)
}

/** Parses a serialized user public key, rejecting non-canonical representations. */
export function deserializePublicKey(serialized: string): Uint8Array {
  if (typeof serialized !== 'string' || !PUBLIC_KEY_RE.test(serialized)) {
    throw new RangeError('Serialized user public key must be pk_user_ followed by 64 lowercase hexadecimal characters')
  }
  return fromHex(serialized.slice(PUBLIC_KEY_PREFIX.length))
}

/** Signs a message with an Ed25519 secret key. */
export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 64) {
    throw new RangeError('Ed25519 secret key must contain exactly 64 bytes')
  }

  const signature = new Uint8Array(64)
  sodium.crypto_sign_detached(signature, message, secretKey)
  return signature
}

/** Verifies an Ed25519 detached signature. */
export function verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  if (!(signature instanceof Uint8Array) || signature.length !== 64) {
    throw new RangeError('Ed25519 signature must contain exactly 64 bytes')
  }
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new RangeError('Ed25519 public key must contain exactly 32 bytes')
  }

  return sodium.crypto_sign_verify_detached(signature, message, publicKey)
}

/** Serializes a detached signature as lowercase hexadecimal with its prefix. */
export function serializeSignature(signature: Uint8Array): string {
  return SIGNATURE_PREFIX + toHex(signature)
}

/** Parses a serialized signature, rejecting non-canonical representations. */
export function deserializeSignature(serialized: string): Uint8Array {
  if (typeof serialized !== 'string' || !SIGNATURE_RE.test(serialized)) {
    throw new RangeError('Serialized signature must be sig_ followed by 128 lowercase hexadecimal characters')
  }
  return fromHex(serialized.slice(SIGNATURE_PREFIX.length))
}
