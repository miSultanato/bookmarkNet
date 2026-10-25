import test from 'brittle'
import {
  isBookmarkId,
  isCollectionId,
  isEventId,
  isGroupId,
  isNodeId,
  isResourceId,
  isUserId,
  newBookmarkId,
  newEventId,
  newGroupId,
  newNodeId,
  resourceIdFromCanonicalUrl,
  userIdFromPublicKey
} from '../src/ids.ts'

function assertInvalidValues(t: any, validator: (value: unknown) => boolean, valid: string, prefix: string, wrongLength: string, invalidCharacters: string, uppercase: string) {
  t.ok(validator(valid))
  t.ok(!validator(prefix))
  t.ok(!validator(wrongLength))
  t.ok(!validator(invalidCharacters))
  t.ok(!validator(uppercase))
  t.ok(!validator(null))
  t.ok(!validator(undefined))
  t.ok(!validator(42))
  t.ok(!validator({}))
}

function assertInvalidUlidValues(t: any, validator: (value: unknown) => boolean) {
  t.ok(!validator('I1J8XK3M00000000000000000'))
  t.ok(!validator('0000000000000000000000000'))
  t.ok(!validator('0000000000000000000000000U'))
  t.ok(!validator('0000000000000000000000000a'))
  t.ok(!validator(null))
  t.ok(!validator(undefined))
  t.ok(!validator(42))
  t.ok(!validator({}))
}

test('user IDs hash public keys deterministically', (t) => {
  const publicKey = Uint8Array.from({ length: 32 }, (_, i) => i)
  t.is(userIdFromPublicKey(publicKey), 'u_630dcd2966c43366')
  t.is(userIdFromPublicKey(publicKey), userIdFromPublicKey(publicKey))
})

test('user ID validator enforces lowercase hex and exact format', (t) => {
  assertInvalidValues(t, isUserId, 'u_0123456789abcdef', 'x_0123456789abcdef', 'u_0123456789abcde', 'u_0123456789abcdeg', 'u_0123456789ABCDEF')
})

test('node ID generation and validation', (t) => {
  const id = newNodeId()
  t.is(id.length, 18)
  t.ok(/^n_[0-9a-f]{16}$/.test(id))
  assertInvalidValues(t, isNodeId, 'n_0123456789abcdef', 'x_0123456789abcdef', 'n_0123456789abcde', 'n_0123456789abcdeg', 'n_0123456789ABCDEF')
})

test('group ID generation and validation', (t) => {
  const id = newGroupId()
  t.is(id.length, 14)
  t.ok(/^g_[0-9a-f]{12}$/.test(id))
  assertInvalidValues(t, isGroupId, 'g_0123456789ab', 'x_0123456789ab', 'g_0123456789a', 'g_0123456789ag', 'g_0123456789AB')
})

test('resource IDs hash the versioned canonical URL deterministically', (t) => {
  const canonicalUrl = 'https://example.com/path'
  const expected = 'r_c0c608ecf36167ed70f714605488977d6e595bf475ce2d00da429c24604cbd60'
  t.is(resourceIdFromCanonicalUrl(canonicalUrl), expected)
  t.is(resourceIdFromCanonicalUrl(canonicalUrl), resourceIdFromCanonicalUrl(canonicalUrl))
})

test('resource ID validator enforces lowercase hex and exact format', (t) => {
  assertInvalidValues(t, isResourceId, `r_${'a'.repeat(64)}`, `x_${'a'.repeat(64)}`, `r_${'a'.repeat(63)}`, `r_${'a'.repeat(63)}g`, `r_${'A'.repeat(64)}`)
})

test('node and group IDs are unique across 100 generated values', (t) => {
  const nodeIds = new Set<string>()
  const groupIds = new Set<string>()
  for (let i = 0; i < 100; i++) {
    nodeIds.add(newNodeId())
    groupIds.add(newGroupId())
  }
  t.is(nodeIds.size, 100)
  t.is(groupIds.size, 100)
})

test('bookmark and event ID generators return valid ULIDs', (t) => {
  t.ok(isBookmarkId(newBookmarkId()))
  t.ok(isEventId(newEventId()))
})

test('bookmark ID validator accepts only ULID alphabet and length', (t) => {
  t.ok(isBookmarkId('00000000000000000000000000'))
  assertInvalidUlidValues(t, isBookmarkId)
})

test('event ID validator accepts only ULID alphabet and length', (t) => {
  t.ok(isEventId('00000000000000000000000000'))
  assertInvalidUlidValues(t, isEventId)
})

test('collection ID validator accepts 64 lowercase hex characters without a prefix', (t) => {
  assertInvalidValues(t, isCollectionId, 'a'.repeat(64), 'g_' + 'a'.repeat(62), 'a'.repeat(63), 'g'.repeat(64), 'A'.repeat(64))
})
