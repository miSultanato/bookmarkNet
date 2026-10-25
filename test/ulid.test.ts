import test from 'brittle'
import { ulid, ulidAt } from '../src/ulid.ts'

test('ULID has a fixed length of 26 characters', (t) => {
  t.is(ulid().length, 26)
  t.is(ulidAt(0, new Uint8Array(10)).length, 26)
})

test('ULID uses only the Crockford base32 alphabet', (t) => {
  const id = ulid()
  t.ok(/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))
  t.ok(!/[ILOU]/.test(id))
})

test('ULIDs sort lexicographically by timestamp', (t) => {
  const randomness = new Uint8Array(10)
  const earlier = ulidAt(1_700_000_000_000, randomness)
  const later = ulidAt(1_700_000_000_001, randomness)

  t.ok(earlier < later)
})

test('ulidAt is deterministic for the same timestamp and randomness', (t) => {
  const randomness = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 255])

  t.is(ulidAt(1_700_000_000_000, randomness), ulidAt(1_700_000_000_000, randomness))
})

test('generates 1000 unique ULIDs at the same timestamp', (t) => {
  const ids = new Set<string>()

  for (let i = 0; i < 1000; i++) {
    ids.add(ulidAt(1_700_000_000_000))
  }

  t.is(ids.size, 1000)
})
