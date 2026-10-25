import test from 'brittle'
import {
  collectionIdFromPublicKey,
  deriveCollectionKeypair,
  deserializeCollectionPublicKey,
  serializeCollectionPublicKey
} from '../src/keys.ts'
import { sign, verify } from '../src/identity.ts'

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

function fixedMasterKey(start = 0): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (start + i) & 0xff)
}

const COLLECTION_UUID = '00000000000000000000000000'

test('collection key derivation is deterministic for the same master key and ULID', (t) => {
  const first = deriveCollectionKeypair(fixedMasterKey(), COLLECTION_UUID)
  const second = deriveCollectionKeypair(fixedMasterKey(), COLLECTION_UUID)
  t.is(first.publicKey.length, 32)
  t.is(first.secretKey.length, 64)
  t.is(toHex(first.publicKey), toHex(second.publicKey))
  t.is(toHex(first.secretKey), toHex(second.secretKey))
})

test('different collection ULIDs derive different keypairs', (t) => {
  const first = deriveCollectionKeypair(fixedMasterKey(), COLLECTION_UUID)
  const second = deriveCollectionKeypair(fixedMasterKey(), '00000000000000000000000001')
  t.ok(toHex(first.publicKey) !== toHex(second.publicKey))
  t.ok(toHex(first.secretKey) !== toHex(second.secretKey))
})

test('different master keys derive different collection keypairs', (t) => {
  const first = deriveCollectionKeypair(fixedMasterKey(), COLLECTION_UUID)
  const second = deriveCollectionKeypair(fixedMasterKey(1), COLLECTION_UUID)
  t.ok(toHex(first.publicKey) !== toHex(second.publicKey))
  t.ok(toHex(first.secretKey) !== toHex(second.secretKey))
})

test('deriveCollectionKeypair rejects master keys that are not 32 bytes', (t) => {
  expectRangeError(t, () => deriveCollectionKeypair(new Uint8Array(31), COLLECTION_UUID))
  expectRangeError(t, () => deriveCollectionKeypair(new Uint8Array(33), COLLECTION_UUID))
})

test('deriveCollectionKeypair requires a canonical uppercase ULID', (t) => {
  expectRangeError(t, () => deriveCollectionKeypair(fixedMasterKey(), ''))
  expectRangeError(t, () => deriveCollectionKeypair(fixedMasterKey(), '0000000000000000000000000'))
  expectRangeError(t, () => deriveCollectionKeypair(fixedMasterKey(), '0000000000000000000000000i'))
  expectRangeError(t, () => deriveCollectionKeypair(fixedMasterKey(), '0000000000000000000000000a'))
  expectRangeError(t, () => deriveCollectionKeypair(fixedMasterKey(), null as unknown as string))
})

test('collection public key serialization is canonical and round-trips', (t) => {
  const publicKey = Uint8Array.from({ length: 32 }, (_, i) => 255 - i)
  const serialized = serializeCollectionPublicKey(publicKey)
  t.is(serialized, 'pk_col_' + toHex(publicKey))
  t.is(serialized.length, 71)
  t.ok(/^pk_col_[0-9a-f]{64}$/.test(serialized))
  t.is(toHex(deserializeCollectionPublicKey(serialized)), toHex(publicKey))
})

test('collection public key serialization rejects invalid lengths', (t) => {
  expectRangeError(t, () => serializeCollectionPublicKey(new Uint8Array(31)))
  expectRangeError(t, () => serializeCollectionPublicKey(new Uint8Array(33)))
})

test('deserializeCollectionPublicKey rejects malformed representations', (t) => {
  expectRangeError(t, () => deserializeCollectionPublicKey('a'.repeat(64)))
  expectRangeError(t, () => deserializeCollectionPublicKey('pk_col_' + 'a'.repeat(63)))
  expectRangeError(t, () => deserializeCollectionPublicKey('pk_col_' + 'A'.repeat(64)))
  expectRangeError(t, () => deserializeCollectionPublicKey('pk_col_' + 'a'.repeat(63) + 'g'))
  expectRangeError(t, () => deserializeCollectionPublicKey(null as unknown as string))
})

test('collectionIdFromPublicKey is the lowercase public-key hex without prefix', (t) => {
  const { publicKey } = deriveCollectionKeypair(fixedMasterKey(), COLLECTION_UUID)
  const collectionId = collectionIdFromPublicKey(publicKey)
  t.is(collectionId, toHex(publicKey))
  t.is(collectionId.length, 64)
  t.ok(/^[0-9a-f]{64}$/.test(collectionId))
})

test('derived collection keypair can sign and verify messages', (t) => {
  const { publicKey, secretKey } = deriveCollectionKeypair(fixedMasterKey(), COLLECTION_UUID)
  const message = Uint8Array.from([0, 1, 2, 3, 42, 128, 255])
  const signature = sign(message, secretKey)
  t.ok(verify(signature, message, publicKey))
})
