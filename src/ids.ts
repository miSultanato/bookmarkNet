import sodium from 'sodium-native'
import { ulid } from './ulid.ts'

const USER_ID_RE = /^u_[0-9a-f]{16}$/
const NODE_ID_RE = /^n_[0-9a-f]{16}$/
const GROUP_ID_RE = /^g_[0-9a-f]{12}$/
const RESOURCE_ID_RE = /^r_[0-9a-f]{64}$/
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/
const COLLECTION_ID_RE = /^[0-9a-f]{64}$/

function sha256(input: Uint8Array): Uint8Array {
  // sodium-native is already a runtime dependency and its native hash API works
  // in Bare, avoiding reliance on the optional bare-node crypto shim.
  const digest = new Uint8Array(32)
  sodium.crypto_hash_sha256(digest, input)
  return digest
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < value.length; i++) {
    let codePoint = value.charCodeAt(i)
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = value.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00)
        i++
      } else {
        codePoint = 0xfffd
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    } else {
      bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    }
  }
  return Uint8Array.from(bytes)
}

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

function isStringMatching(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value)
}

export function userIdFromPublicKey(publicKey: Uint8Array): string {
  return `u_${toHex(sha256(publicKey)).slice(0, 16)}`
}

export function isUserId(value: unknown): value is string {
  return isStringMatching(value, USER_ID_RE)
}

export function newNodeId(): string {
  const bytes = new Uint8Array(8)
  sodium.randombytes_buf(bytes)
  return `n_${toHex(bytes)}`
}

export function isNodeId(value: unknown): value is string {
  return isStringMatching(value, NODE_ID_RE)
}

export function newGroupId(): string {
  const bytes = new Uint8Array(6)
  sodium.randombytes_buf(bytes)
  return `g_${toHex(bytes)}`
}

export function isGroupId(value: unknown): value is string {
  return isStringMatching(value, GROUP_ID_RE)
}

export function resourceIdFromCanonicalUrl(canonicalUrl: string): string {
  const input = utf8Bytes(`v1:${canonicalUrl}`)
  return `r_${toHex(sha256(input))}`
}

export function isResourceId(value: unknown): value is string {
  return isStringMatching(value, RESOURCE_ID_RE)
}

export function newBookmarkId(): string {
  return ulid()
}

export function isBookmarkId(value: unknown): value is string {
  return isStringMatching(value, ULID_RE)
}

export function newEventId(): string {
  return ulid()
}

export function isEventId(value: unknown): value is string {
  return isStringMatching(value, ULID_RE)
}

export function isCollectionId(value: unknown): value is string {
  return isStringMatching(value, COLLECTION_ID_RE)
}
