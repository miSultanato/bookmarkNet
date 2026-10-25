const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const MAX_TIMESTAMP = 0xffffffffffff
const RANDOMNESS_BYTES = 10

function randomBytes(): Uint8Array {
  const crypto = globalThis.crypto
  if (!crypto?.getRandomValues) {
    throw new Error('ULID generation requires crypto.getRandomValues')
  }

  return crypto.getRandomValues(new Uint8Array(RANDOMNESS_BYTES))
}

/**
 * Builds a ULID at a specified millisecond timestamp.
 * The optional randomness makes deterministic ULIDs possible in tests;
 * when omitted, cryptographically secure random bytes are generated.
 */
export function ulidAt(timestampMs: number, randomness?: Uint8Array): string {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs > MAX_TIMESTAMP) {
    throw new RangeError('ULID timestamp must be an integer between 0 and 2^48 - 1')
  }

  const random = randomness ?? randomBytes()
  if (random.length !== RANDOMNESS_BYTES) {
    throw new RangeError('ULID randomness must contain exactly 10 bytes')
  }

  let value = BigInt(timestampMs)
  for (const byte of random) {
    value = (value << 8n) | BigInt(byte)
  }

  let encoded = ''
  for (let i = 0; i < 26; i++) {
    encoded = CROCKFORD_BASE32[Number(value & 31n)] + encoded
    value >>= 5n
  }

  return encoded
}

/** Generates a ULID using the current Unix timestamp in milliseconds. */
export function ulid(): string {
  return ulidAt(Date.now())
}
