import test from 'brittle'
import sodium from 'sodium-native'
import {
  deserializePublicKey,
  deserializeSignature,
  generateUserMasterKey,
  serializePublicKey,
  serializeSignature,
  sign,
  userIdFromMasterKey,
  userKeypairFromMasterKey,
  verify
} from '../src/identity.ts'
import { userIdFromPublicKey } from '../src/ids.ts'

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

function expectRangeError(t: any, fn: () => unknown): void {
  let thrown: unknown
  try {
    fn()
  } catch (error) {
    thrown = error
  }
  t.ok(thrown instanceof RangeError)
}

function fixedSeed(start = 0): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (start + i) & 0xff)
}

test('generateUserMasterKey returns distinct random 32-byte seeds', (t) => {
  const seen = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const masterKey = generateUserMasterKey()
    t.ok(masterKey instanceof Uint8Array)
    t.is(masterKey.length, 32)
    seen.add(toHex(masterKey))
  }
  t.is(seen.size, 100)
})

test('userKeypairFromMasterKey deterministically derives Ed25519 keys', (t) => {
  const seed = fixedSeed()
  const first = userKeypairFromMasterKey(seed)
  const second = userKeypairFromMasterKey(seed)
  t.is(first.publicKey.length, 32)
  t.is(first.secretKey.length, 64)
  t.is(toHex(first.publicKey), toHex(second.publicKey))
  t.is(toHex(first.secretKey), toHex(second.secretKey))
})

test('userKeypairFromMasterKey rejects seeds that are not 32 bytes', (t) => {
  expectRangeError(t, () => userKeypairFromMasterKey(new Uint8Array(31)))
  expectRangeError(t, () => userKeypairFromMasterKey(new Uint8Array(33)))
})

test('userIdFromMasterKey matches the ID derived from its public key', (t) => {
  const seed = fixedSeed()
  const { publicKey } = userKeypairFromMasterKey(seed)
  const digest = new Uint8Array(32)
  sodium.crypto_hash_sha256(digest, publicKey)
  const expected = 'u_' + toHex(digest).slice(0, 16)
  t.is(userIdFromMasterKey(seed), expected)
  t.is(userIdFromMasterKey(seed), userIdFromPublicKey(publicKey))
  t.is(userIdFromMasterKey(seed), userIdFromMasterKey(seed))
})

test('public key serialization round-trips in canonical lowercase format', (t) => {
  const publicKey = Uint8Array.from({ length: 32 }, (_, i) => 255 - i)
  const serialized = serializePublicKey(publicKey)
  t.is(serialized, 'pk_user_' + toHex(publicKey))
  t.is(serialized.length, 72)
  t.ok(/^pk_user_[0-9a-f]{64}$/.test(serialized))
  t.is(toHex(deserializePublicKey(serialized)), toHex(publicKey))
})

test('deserializePublicKey rejects malformed serialized keys', (t) => {
  const validHex = 'a'.repeat(64)
  expectRangeError(t, () => deserializePublicKey(validHex))
  expectRangeError(t, () => deserializePublicKey('pk_user_' + 'a'.repeat(63)))
  expectRangeError(t, () => deserializePublicKey('pk_user_' + 'A'.repeat(64)))
  expectRangeError(t, () => deserializePublicKey('pk_user_' + 'a'.repeat(63) + 'g'))
  expectRangeError(t, () => deserializePublicKey(null as unknown as string))
})

test('signature serialization round-trips in canonical lowercase format', (t) => {
  const signature = Uint8Array.from({ length: 64 }, (_, i) => i)
  const serialized = serializeSignature(signature)
  t.is(serialized, 'sig_' + toHex(signature))
  t.is(serialized.length, 132)
  t.ok(/^sig_[0-9a-f]{128}$/.test(serialized))
  t.is(toHex(deserializeSignature(serialized)), toHex(signature))
})

test('deserializeSignature rejects malformed serialized signatures', (t) => {
  expectRangeError(t, () => deserializeSignature('a'.repeat(128)))
  expectRangeError(t, () => deserializeSignature('sig_' + 'a'.repeat(127)))
  expectRangeError(t, () => deserializeSignature('sig_' + 'A'.repeat(128)))
  expectRangeError(t, () => deserializeSignature('sig_' + 'a'.repeat(127) + 'g'))
  expectRangeError(t, () => deserializeSignature(null as unknown as string))
})

test('sign and verify accept valid Ed25519 signatures', (t) => {
  const { publicKey, secretKey } = userKeypairFromMasterKey(fixedSeed())
  const message = Uint8Array.from([0, 1, 2, 3, 250, 255])
  const signature = sign(message, secretKey)
  t.is(signature.length, 64)
  t.ok(verify(signature, message, publicKey))
})

test('verify returns false for altered signature, message, or public key', (t) => {
  const first = userKeypairFromMasterKey(fixedSeed())
  const second = userKeypairFromMasterKey(fixedSeed(1))
  const message = Uint8Array.from([10, 20, 30, 40])
  const signature = sign(message, first.secretKey)

  const alteredSignature = new Uint8Array(signature)
  alteredSignature[0] ^= 0xff
  t.ok(!verify(alteredSignature, message, first.publicKey))
  t.ok(!verify(signature, Uint8Array.from([10, 20, 30, 41]), first.publicKey))
  t.ok(!verify(signature, message, second.publicKey))
})

test('sign rejects secret keys that are not 64 bytes', (t) => {
  expectRangeError(t, () => sign(new Uint8Array(0), new Uint8Array(63)))
  expectRangeError(t, () => sign(new Uint8Array(0), new Uint8Array(65)))
})

test('verify rejects signatures and public keys with invalid lengths', (t) => {
  const message = new Uint8Array(0)
  expectRangeError(t, () => verify(new Uint8Array(63), message, new Uint8Array(32)))
  expectRangeError(t, () => verify(new Uint8Array(65), message, new Uint8Array(32)))
  expectRangeError(t, () => verify(new Uint8Array(64), message, new Uint8Array(31)))
  expectRangeError(t, () => verify(new Uint8Array(64), message, new Uint8Array(33)))
})
