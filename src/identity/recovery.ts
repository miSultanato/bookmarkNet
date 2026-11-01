import sodium from 'sodium-native'
import { BIP39_WORDLIST } from './bip39-wordlist.ts'

const ENTROPY_BYTES = 32
const CHECKSUM_BYTES = 1
const MNEMONIC_WORDS = 24
const BITS_PER_WORD = 11
const WORD_INDEX = new Map<string, number>(
  BIP39_WORDLIST.map((word, index) => [word, index] as const)
)

function bytesToPhrase(entropy: Uint8Array): { phrase: string; words: string[] } {
  if (!(entropy instanceof Uint8Array) || entropy.length !== ENTROPY_BYTES) {
    throw new RangeError('La clave maestra debe contener exactamente 32 bytes')
  }

  const checksum = new Uint8Array(32)
  sodium.crypto_hash_sha256(checksum, entropy)

  const bits = new Uint8Array(ENTROPY_BYTES + CHECKSUM_BYTES)
  bits.set(entropy)
  bits[ENTROPY_BYTES] = checksum[0]

  const words: string[] = []
  for (let wordNumber = 0; wordNumber < MNEMONIC_WORDS; wordNumber++) {
    let index = 0
    for (let offset = 0; offset < BITS_PER_WORD; offset++) {
      const bitIndex = wordNumber * BITS_PER_WORD + offset
      const byte = bits[Math.floor(bitIndex / 8)] ?? 0
      const bit = (byte >> (7 - (bitIndex % 8))) & 1
      index = (index << 1) | bit
    }
    const word = BIP39_WORDLIST[index]
    if (word === undefined) throw new RangeError('Índice fuera de la lista BIP39')
    words.push(word)
  }

  return { phrase: words.join(' '), words }
}

/** Genera una frase BIP39 aleatoria de 24 palabras (256 bits de entropía). */
export function generateRecoveryPhrase(): { phrase: string; words: string[] } {
  const entropy = new Uint8Array(ENTROPY_BYTES)
  sodium.randombytes_buf(entropy)
  return bytesToPhrase(entropy)
}

/** Codifica el user_master_key existente como una frase BIP39 de 24 palabras. */
export function masterKeyToRecoveryPhrase(masterKey: Uint8Array): { phrase: string; words: string[] } {
  return bytesToPhrase(masterKey)
}

/** Recupera los 32 bytes originales a partir de una frase BIP39 de 24 palabras. */
export function phraseToMasterKey(phrase: string): Uint8Array {
  if (typeof phrase !== 'string') {
    throw new RangeError('La frase de recuperación debe ser un string')
  }

  const words = phrase.trim().split(/\s+/)
  if (words.length !== MNEMONIC_WORDS) {
    throw new RangeError('La frase de recuperación debe contener exactamente 24 palabras')
  }

  const bits = new Uint8Array(ENTROPY_BYTES + CHECKSUM_BYTES)
  for (let wordNumber = 0; wordNumber < MNEMONIC_WORDS; wordNumber++) {
    const index = WORD_INDEX.get(words[wordNumber])
    if (index === undefined) {
      throw new RangeError(`Palabra BIP39 no válida: ${words[wordNumber]}`)
    }

    for (let offset = 0; offset < BITS_PER_WORD; offset++) {
      const bit = (index >> (BITS_PER_WORD - offset - 1)) & 1
      if (bit === 1) {
        const bitIndex = wordNumber * BITS_PER_WORD + offset
        bits[Math.floor(bitIndex / 8)] |= 1 << (7 - (bitIndex % 8))
      }
    }
  }

  const masterKey = bits.slice(0, ENTROPY_BYTES)
  const checksum = new Uint8Array(32)
  sodium.crypto_hash_sha256(checksum, masterKey)
  if (bits[ENTROPY_BYTES] !== checksum[0]) {
    throw new RangeError('El checksum de la frase BIP39 no es válido')
  }

  return masterKey
}

/** Comprueba longitud, pertenencia a la lista y checksum de una frase BIP39. */
export function validateRecoveryPhrase(phrase: string): boolean {
  try {
    phraseToMasterKey(phrase)
    return true
  } catch {
    return false
  }
}
