import sodium from 'sodium-native'
import { fromHex, toHex, utf8Bytes } from './ids.ts'

const COLLECTION_UUID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/
const COLLECTION_PUBLIC_KEY_PREFIX = 'pk_col_'
const COLLECTION_PUBLIC_KEY_RE = /^pk_col_[0-9a-f]{64}$/

function hkdfSha256(ikm: Uint8Array, info: Uint8Array): Uint8Array {
  // RFC 5869: an all-zero HashLen salt is equivalent to the specified empty salt
  // for HMAC-SHA256 (HashLen = 32). sodium-native exposes HMAC-SHA256, not HKDF.
  const salt = new Uint8Array(32)
  const prk = new Uint8Array(32)
  sodium.crypto_auth_hmacsha256(prk, ikm, salt)

  // HKDF-Expand for L=32 needs only T(1) = HMAC(PRK, info || 0x01).
  const expandInput = new Uint8Array(info.length + 1)
  expandInput.set(info)
  expandInput[info.length] = 1
  const output = new Uint8Array(32)
  sodium.crypto_auth_hmacsha256(output, expandInput, prk)
  return output
}

/**
 * Derives a collection-specific Ed25519 keypair using HKDF-SHA256 and the
 * domain-separated info string "bookmarknet:collection:" + collectionUuid.
 */
export function deriveCollectionKeypair(
  masterKey: Uint8Array,
  collectionUuid: string
): { publicKey: Uint8Array; secretKey: Uint8Array } {
  if (!(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    throw new RangeError('User master key must contain exactly 32 bytes')
  }
  // Require a canonical ULID: collection_uuid is an immutable generated identifier,
  // not a display name. This avoids deriving keys from ambiguous inputs.
  if (typeof collectionUuid !== 'string' || !COLLECTION_UUID_RE.test(collectionUuid)) {
    throw new RangeError('Collection UUID must be a 26-character uppercase ULID')
  }

  const info = utf8Bytes('bookmarknet:collection:' + collectionUuid)
  const seed = hkdfSha256(masterKey, info)
  const publicKey = new Uint8Array(32)
  const secretKey = new Uint8Array(64)
  sodium.crypto_sign_seed_keypair(publicKey, secretKey, seed)
  return { publicKey, secretKey }
}

/** Serializes a 32-byte collection public key with its domain prefix. */
export function serializeCollectionPublicKey(publicKey: Uint8Array): string {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new RangeError('Collection public key must contain exactly 32 bytes')
  }
  return COLLECTION_PUBLIC_KEY_PREFIX + toHex(publicKey)
}

/** Parses the canonical lowercase hexadecimal representation of a collection key. */
export function deserializeCollectionPublicKey(serialized: string): Uint8Array {
  if (typeof serialized !== 'string' || !COLLECTION_PUBLIC_KEY_RE.test(serialized)) {
    throw new RangeError('Serialized collection public key must be pk_col_ followed by 64 lowercase hexadecimal characters')
  }
  return fromHex(serialized.slice(COLLECTION_PUBLIC_KEY_PREFIX.length))
}

/** Returns collection_id, defined as the collection public key in lowercase hex without a prefix. */
export function collectionIdFromPublicKey(publicKey: Uint8Array): string {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new RangeError('Collection public key must contain exactly 32 bytes')
  }
  return toHex(publicKey)
}
