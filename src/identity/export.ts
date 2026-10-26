import sodium from 'sodium-native'
import { utf8Bytes } from '../ids.ts'
import { hasIdentity, loadIdentity, saveIdentity } from './store.ts'
import type { StoredIdentity } from './store.ts'

export interface ExportedIdentity {
  version: 1
  salt: string
  nonce: string
  opslimit: number
  memlimit: number
  alg: number
  ciphertext: string
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let output = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const hasB = i + 1 < bytes.length
    const hasC = i + 2 < bytes.length
    const b = hasB ? bytes[i + 1] : 0
    const c = hasC ? bytes[i + 2] : 0
    output += BASE64_ALPHABET[a >> 2]
    output += BASE64_ALPHABET[((a & 3) << 4) | (b >> 4)]
    output += hasB ? BASE64_ALPHABET[((b & 15) << 2) | (c >> 6)] : '='
    output += hasC ? BASE64_ALPHABET[c & 63] : '='
  }
  return output
}

function fromBase64(value: unknown, field: string): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new RangeError(`identity_blob.${field} debe ser una cadena base64 válida`)
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  const output = new Uint8Array((value.length / 4) * 3 - padding)
  let offset = 0
  for (let i = 0; i < value.length; i += 4) {
    const a = BASE64_ALPHABET.indexOf(value[i])
    const b = BASE64_ALPHABET.indexOf(value[i + 1])
    const c = value[i + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[i + 2])
    const d = value[i + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[i + 3])
    if (offset < output.length) output[offset++] = (a << 2) | (b >> 4)
    if (offset < output.length) output[offset++] = ((b & 15) << 4) | (c >> 2)
    if (offset < output.length) output[offset++] = ((c & 3) << 6) | d
  }
  if (toBase64(output) !== value) throw new RangeError(`identity_blob.${field} no tiene una codificación base64 canónica`)
  return output
}

function validateExportedIdentity(value: unknown): asserts value is ExportedIdentity {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError('identity_blob debe ser un objeto')
  }
  const candidate = value as Record<string, unknown>
  if (candidate.version !== 1) throw new RangeError('Versión de identity_blob no compatible')
  const salt = fromBase64(candidate.salt, 'salt')
  const nonce = fromBase64(candidate.nonce, 'nonce')
  const ciphertext = fromBase64(candidate.ciphertext, 'ciphertext')
  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new RangeError('identity_blob.salt tiene una longitud inválida')
  }
  if (nonce.length !== sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) {
    throw new RangeError('identity_blob.nonce tiene una longitud inválida')
  }
  if (ciphertext.length < sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES) {
    throw new RangeError('identity_blob.ciphertext es demasiado corto')
  }
  for (const field of ['opslimit', 'memlimit', 'alg'] as const) {
    if (typeof candidate[field] !== 'number' || !Number.isSafeInteger(candidate[field]) || candidate[field] <= 0) {
      throw new RangeError(`identity_blob.${field} debe ser un entero positivo`)
    }
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  let output = ''
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++]
    let codePoint: number
    if (first <= 0x7f) {
      codePoint = first
    } else if ((first & 0xe0) === 0xc0 && i < bytes.length) {
      codePoint = ((first & 0x1f) << 6) | (bytes[i++] & 0x3f)
    } else if ((first & 0xf0) === 0xe0 && i + 1 < bytes.length) {
      codePoint = ((first & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
    } else if ((first & 0xf8) === 0xf0 && i + 2 < bytes.length) {
      codePoint = ((first & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
    } else {
      throw new RangeError('identity_blob descifrado no contiene UTF-8 válido')
    }
    if (codePoint <= 0xffff) {
      output += String.fromCharCode(codePoint)
    } else {
      codePoint -= 0x10000
      output += String.fromCharCode(0xd800 | (codePoint >> 10), 0xdc00 | (codePoint & 0x3ff))
    }
  }
  return output
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

export async function exportIdentity(dataDir: string, password: string): Promise<ExportedIdentity> {
  const stored = await loadIdentity(dataDir)
  if (stored === null) throw new RangeError('No existe una identidad para exportar')

  const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES)
  sodium.randombytes_buf(salt)
  const nonce = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
  sodium.randombytes_buf(nonce)
  const opslimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE
  const memlimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
  const alg = sodium.crypto_pwhash_ALG_ARGON2ID13
  const key = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES)
  sodium.crypto_pwhash(key, utf8Bytes(password), salt, opslimit, memlimit, alg)

  const plaintext = utf8Bytes(JSON.stringify(stored))
  const ciphertext = new Uint8Array(plaintext.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(ciphertext, plaintext, null, null, nonce, key)

  return {
    version: 1,
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    opslimit,
    memlimit,
    alg,
    ciphertext: toBase64(ciphertext)
  }
}

export async function importIdentity(
  dataDir: string,
  password: string,
  exported: ExportedIdentity
): Promise<StoredIdentity> {
  validateExportedIdentity(exported)
  if (await hasIdentity(dataDir)) throw new RangeError('La identidad ya existe en identity.bmn')

  const salt = fromBase64(exported.salt, 'salt')
  const nonce = fromBase64(exported.nonce, 'nonce')
  const ciphertext = fromBase64(exported.ciphertext, 'ciphertext')
  const key = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES)
  sodium.crypto_pwhash(key, utf8Bytes(password), salt, exported.opslimit, exported.memlimit, exported.alg)

  const plaintext = new Uint8Array(ciphertext.length - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    plaintext, null, ciphertext, null, nonce, key
  )
  if (decrypted !== true) {
    throw new RangeError('No se pudo descifrar identity_blob: contraseña incorrecta o datos corruptos')
  }

  let parsed: unknown
  try {
    // Bare has no guaranteed TextDecoder; JSON is ASCII-compatible for these stored fields.
    let text = ''
    for (const byte of plaintext) text += String.fromCharCode(byte)
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new RangeError('identity_blob descifrado contiene JSON inválido')
  }
  if (!isStoredIdentity(parsed)) {
    throw new RangeError('identity_blob descifrado no contiene una identidad válida')
  }

  await saveIdentity(dataDir, parsed)
  return parsed
}
