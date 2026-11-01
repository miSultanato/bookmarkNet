import fs from 'bare-fs'
import { dirname, join } from 'bare-path'
import Hypercore from 'hypercore'
import sodium from 'sodium-native'
import type { DeviceEvent } from '../device-events.ts'
import { foldDeviceEvents } from '../device-fold.ts'
import type { CollectionEvent } from '../events.ts'
import { fromHex, utf8Bytes } from '../ids.ts'
import { deriveCollectionKeypair, collectionIdFromPublicKey } from '../keys.ts'
import { loadIdentity } from '../identity/store.ts'
import { loadOrCreateNodeId } from '../node/node-id.ts'
import { appendEvent, closeDeviceCore, openDeviceCore } from '../storage/device-core.ts'

const MAGIC = utf8Bytes('LOTURABK')
const FORMAT_VERSION = 2
const HEADER_BYTES = MAGIC.length + 1 + sodium.crypto_pwhash_SALTBYTES +
  sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
const BLOCK_BYTES = 512
const END_BLOCKS = 2
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
const COLLECTION_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export interface BackupData {
  deviceEvents: DeviceEvent[]
  collectionEvents: Map<string, CollectionEvent[]>
  collections: string[]
}


export type RestoreMode = 'all' | 'collections-only'

interface TarEntry {
  path: string
  type: 'file' | 'directory'
  data: Uint8Array
}

interface BackupManifest {
  version: 2
  devices: string[]
  collections: string[]
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function encodeUtf8(value: string): Uint8Array {
  return utf8Bytes(value)
}

function decodeUtf8(value: Uint8Array): string {
  let output = ''
  for (let i = 0; i < value.length;) {
    const first = value[i++]
    let point: number
    if (first <= 0x7f) point = first
    else if ((first & 0xe0) === 0xc0 && i < value.length) {
      point = ((first & 0x1f) << 6) | (value[i++] & 0x3f)
    } else if ((first & 0xf0) === 0xe0 && i + 1 < value.length) {
      point = ((first & 0x0f) << 12) | ((value[i++] & 0x3f) << 6) | (value[i++] & 0x3f)
    } else if ((first & 0xf8) === 0xf0 && i + 2 < value.length) {
      point = ((first & 7) << 18) | ((value[i++] & 0x3f) << 12) |
        ((value[i++] & 0x3f) << 6) | (value[i++] & 0x3f)
    } else throw new RangeError('El backup contiene texto UTF-8 inválido')
    if (point <= 0xffff) output += String.fromCharCode(point)
    else {
      point -= 0x10000
      output += String.fromCharCode(0xd800 | (point >> 10), 0xdc00 | (point & 0x3ff))
    }
  }
  return output
}

function putString(header: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = encodeUtf8(value)
  if (bytes.length > length) throw new RangeError('Ruta demasiado larga para USTAR: ' + value)
  header.set(bytes, offset)
}

function putOctal(header: Uint8Array, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, '0') + '\0'
  if (text.length > length) throw new RangeError('Valor demasiado grande para USTAR')
  header.set(encodeUtf8(text), offset)
}

function readString(header: Uint8Array, offset: number, length: number): string {
  let end = offset
  while (end < offset + length && header[end] !== 0) end++
  return decodeUtf8(header.subarray(offset, end))
}

function readOctal(header: Uint8Array, offset: number, length: number): number {
  const value = readString(header, offset, length).trim()
  if (!/^[0-7]*$/.test(value)) throw new RangeError('Cabecera USTAR inválida')
  return value.length === 0 ? 0 : Number.parseInt(value, 8)
}

function makeTarHeader(path: string, type: 'file' | 'directory', size: number): Uint8Array {
  const header = new Uint8Array(BLOCK_BYTES)
  putString(header, 0, 100, path)
  putOctal(header, 100, 8, type === 'directory' ? 0o700 : 0o600)
  putOctal(header, 108, 8, 0)
  putOctal(header, 116, 8, 0)
  putOctal(header, 124, 12, size)
  putOctal(header, 136, 12, Math.floor(Date.now() / 1000))
  for (let i = 148; i < 156; i++) header[i] = 32
  header[156] = type === 'directory' ? 53 : 48
  putString(header, 257, 6, 'ustar')
  putString(header, 263, 2, '00')
  let checksum = 0
  for (const byte of header) checksum += byte
  const checksumText = checksum.toString(8).padStart(6, '0') + '\0 '
  header.set(encodeUtf8(checksumText), 148)
  return header
}

function createTar(entries: TarEntry[]): Uint8Array {
  const parts: Uint8Array[] = []
  for (const entry of entries) {
    const path = entry.type === 'directory' && !entry.path.endsWith('/')
      ? entry.path + '/'
      : entry.path
    parts.push(makeTarHeader(path, entry.type, entry.data.length))
    if (entry.data.length > 0) {
      parts.push(entry.data)
      const padding = (BLOCK_BYTES - (entry.data.length % BLOCK_BYTES)) % BLOCK_BYTES
      if (padding > 0) parts.push(new Uint8Array(padding))
    }
  }
  parts.push(new Uint8Array(BLOCK_BYTES * END_BLOCKS))
  return concat(parts)
}

function parseTar(tar: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  let offset = 0
  while (offset + BLOCK_BYTES <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK_BYTES)
    if (header.every((byte) => byte === 0)) break
    const storedChecksum = readOctal(header, 148, 8)
    let checksum = 0
    for (let i = 0; i < BLOCK_BYTES; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]
    if (checksum !== storedChecksum) throw new RangeError('Checksum USTAR inválido')
    if (readString(header, 257, 6) !== 'ustar') throw new RangeError('Formato USTAR no compatible')
    const path = readString(header, 0, 100)
    const prefix = readString(header, 345, 155)
    const fullPath = prefix.length > 0 ? prefix + '/' + path : path
    if (!fullPath || fullPath.startsWith('/') || fullPath.split('/').some((part) => part === '..' || part === '.')) {
      throw new RangeError('Ruta no segura en el backup')
    }
    const size = readOctal(header, 124, 12)
    const typeFlag = header[156]
    if (typeFlag !== 0 && typeFlag !== 48 && typeFlag !== 53) {
      throw new RangeError('Tipo de entrada USTAR no compatible')
    }
    const type = typeFlag === 53 ? 'directory' : 'file'
    if (type === 'directory' && size !== 0) throw new RangeError('Directorio USTAR con contenido')
    offset += BLOCK_BYTES
    if (size > tar.length - offset) throw new RangeError('Entrada USTAR truncada')
    const data = tar.slice(offset, offset + size)
    entries.push({ path: type === 'directory' ? fullPath.replace(/\/$/, '') : fullPath, type, data })
    offset += Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES
  }
  if (entries.length === 0) throw new RangeError('El backup no contiene datos')
  return entries
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.stat(path)
    return true
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return false
    throw error
  }
}

async function copyTree(source: string, destination: string): Promise<void> {
  const stat = await fs.stat(source)
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true, mode: 0o700 })
    for (const name of await fs.readdir(source)) {
      // No conservamos la solicitud efímera: contiene la contraseña de restauración pendiente.
      if (name === 'restore-pending.json') continue
      await copyTree(join(source, name), join(destination, name))
    }
  } else if (stat.isFile()) {
    const data = await fs.readFile(source)
    await fs.mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    await fs.writeFile(destination, data, { mode: 0o600 })
  } else {
    throw new RangeError('No se puede crear la copia de seguridad de un archivo especial')
  }
}

function encryptArchive(archive: Uint8Array, password: string): Uint8Array {
  if (typeof password !== 'string' || password.length === 0) {
    throw new RangeError('La contraseña del backup no puede estar vacía')
  }
  const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES)
  sodium.randombytes_buf(salt)
  const nonce = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
  sodium.randombytes_buf(nonce)
  const key = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES)
  sodium.crypto_pwhash(
    key,
    utf8Bytes(password),
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
  const header = new Uint8Array(HEADER_BYTES)
  header.set(MAGIC, 0)
  header[MAGIC.length] = FORMAT_VERSION
  header.set(salt, MAGIC.length + 1)
  header.set(nonce, MAGIC.length + 1 + salt.length)
  const ciphertext = new Uint8Array(archive.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(ciphertext, archive, header, null, nonce, key)
  return concat([header, ciphertext])
}

function decryptArchive(file: Uint8Array, password: string): Uint8Array {
  if (file.length < HEADER_BYTES + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES ||
      file.length > MAX_ARCHIVE_BYTES) {
    throw new RangeError('El archivo de backup tiene un tamaño inválido')
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (file[i] !== MAGIC[i]) throw new RangeError('El archivo no es un backup de Lotura')
  }
  if (file[MAGIC.length] !== FORMAT_VERSION) throw new RangeError('Versión de backup no compatible')
  const saltStart = MAGIC.length + 1
  const nonceStart = saltStart + sodium.crypto_pwhash_SALTBYTES
  const salt = file.subarray(saltStart, nonceStart)
  const nonce = file.subarray(nonceStart, HEADER_BYTES)
  const header = file.subarray(0, HEADER_BYTES)
  const ciphertext = file.subarray(HEADER_BYTES)
  const key = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES)
  sodium.crypto_pwhash(
    key,
    utf8Bytes(password),
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
  const plaintext = new Uint8Array(ciphertext.length - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  try {
    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(plaintext, null, ciphertext, header, nonce, key)
  } catch {
    throw new RangeError('No se pudo descifrar el backup: contraseña incorrecta o archivo corrupto')
  }
  return plaintext
}

function validateManifest(value: unknown): asserts value is BackupManifest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError('Manifiesto del backup inválido')
  }
  const manifest = value as Record<string, unknown>
  if (manifest.version !== 2 ||
      !Array.isArray(manifest.devices) ||
      !manifest.devices.every((device) => typeof device === 'string' && /^n_[0-9a-f]{16}$/.test(device)) ||
      new Set(manifest.devices).size !== manifest.devices.length ||
      !Array.isArray(manifest.collections) ||
      !manifest.collections.every((id) => typeof id === 'string' && COLLECTION_ID_PATTERN.test(id)) ||
      new Set(manifest.collections).size !== manifest.collections.length) {
    throw new RangeError('Manifiesto del backup inválido')
  }
}

function validateEntries(entries: TarEntry[]): BackupManifest {
  const files = new Map<string, Uint8Array>()
  for (const entry of entries) {
    if (entry.type !== 'file') {
      throw new RangeError('El backup de eventos no admite directorios')
    }
    if (files.has(entry.path)) throw new RangeError('Entrada duplicada en el backup: ' + entry.path)
    files.set(entry.path, entry.data)
  }
  const manifestData = files.get('manifest.json')
  if (manifestData === undefined) throw new RangeError('Falta manifest.json en el backup')
  let manifest: unknown
  try {
    manifest = JSON.parse(decodeUtf8(manifestData)) as unknown
  } catch {
    throw new RangeError('manifest.json contiene JSON inválido')
  }
  validateManifest(manifest)

  const allowed = new Set(['manifest.json', 'identity.bmn', 'device-events.json'])
  for (const id of manifest.collections) {
    allowed.add('collection-events-' + id + '.json')
  }
  for (const path of files.keys()) {
    if (!allowed.has(path)) throw new RangeError('Contenido no reconocido en el backup: ' + path)
  }
  if (!files.has('device-events.json')) throw new RangeError('Falta device-events.json en el backup')
  for (const id of manifest.collections) {
    if (!files.has('collection-events-' + id + '.json')) {
      throw new RangeError('Faltan eventos de la colección ' + id + ' en el backup')
    }
  }
  return manifest
}

function parseEventArray<T>(data: Uint8Array, description: string): T[] {
  let value: unknown
  try {
    value = JSON.parse(decodeUtf8(data)) as unknown
  } catch {
    throw new RangeError(description + ' contiene JSON inválido')
  }
  if (!Array.isArray(value)) throw new RangeError(description + ' debe contener un array de eventos')
  return value as T[]
}

async function removeIfExists(path: string): Promise<void> {
  if (await exists(path)) await fs.rm(path, { recursive: true, force: true })
}

/**
 * Crea un backup cifrado de la identidad (si existe), device_core y
 * collection_core. El formato combina una cabecera versionada y un TAR USTAR.
 */
async function createArchive(dataDir: string, data: BackupData): Promise<Uint8Array> {
  if (!Array.isArray(data.deviceEvents) ||
      !(data.collectionEvents instanceof Map) ||
      !Array.isArray(data.collections) ||
      !data.collections.every((id) => typeof id === 'string' && COLLECTION_ID_PATTERN.test(id)) ||
      new Set(data.collections).size !== data.collections.length) {
    throw new RangeError('Los datos del backup no son válidos')
  }

  const entries: TarEntry[] = []
  if (await exists(join(dataDir, 'identity.bmn'))) {
    entries.push({
      path: 'identity.bmn',
      type: 'file',
      data: new Uint8Array(await fs.readFile(join(dataDir, 'identity.bmn')))
    })
  }

  entries.push({
    path: 'device-events.json',
    type: 'file',
    data: encodeUtf8(JSON.stringify(data.deviceEvents))
  })

  const collectionIds = [...data.collections].sort()
  for (const collectionId of collectionIds) {
    const collectionEvents = data.collectionEvents.get(collectionId)
    if (!Array.isArray(collectionEvents)) {
      throw new RangeError('Faltan eventos de la colección ' + collectionId)
    }
    entries.push({
      path: 'collection-events-' + collectionId + '.json',
      type: 'file',
      data: encodeUtf8(JSON.stringify(collectionEvents))
    })
  }

  const deviceState = foldDeviceEvents(data.deviceEvents)
  const manifest: BackupManifest = {
    version: 2,
    devices: [...deviceState.devices.keys()].sort(),
    collections: collectionIds
  }
  entries.unshift({
    path: 'manifest.json',
    type: 'file',
    data: encodeUtf8(JSON.stringify(manifest))
  })
  return createTar(entries)
}

async function writeBackupFile(dataDir: string, encrypted: Uint8Array): Promise<string> {
  const backupsDir = join(dataDir, 'backups')
  await fs.mkdir(backupsDir, { recursive: true, mode: 0o700 })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupsDir, 'backup-' + timestamp + '.bmn')
  await fs.writeFile(backupPath, encrypted, { mode: 0o600 })
  await fs.chmod(backupPath, 0o600)
  return backupPath
}

/** Crea un backup cifrado con contraseña mediante Argon2id y XChaCha20-Poly1305. */
export async function createBackup(options: { dataDir: string; password: string } & BackupData): Promise<string> {
  if (options === null || typeof options !== 'object' ||
      typeof options.dataDir !== 'string' || options.dataDir.length === 0) {
    throw new RangeError('dataDir debe ser una ruta no vacía')
  }
  if (typeof options.password !== 'string' || options.password.length === 0) {
    throw new RangeError('La contraseña del backup no puede estar vacía')
  }
  const archive = await createArchive(options.dataDir, options)
  return writeBackupFile(options.dataDir, encryptArchive(archive, options.password))
}

/**
 * Crea un backup automático cifrado con una clave de 32 bytes derivada del
 * user_master_key mediante HKDF-SHA256 (dominio bookmarknet:backup:).
 */
export async function createBackupWithKey(dataDir: string, key: Uint8Array, data: BackupData): Promise<string> {
  if (typeof dataDir !== 'string' || dataDir.length === 0) {
    throw new RangeError('dataDir debe ser una ruta no vacía')
  }
  if (!(key instanceof Uint8Array) || key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new RangeError('La clave del backup debe contener exactamente 32 bytes')
  }
  const archive = await createArchive(dataDir, data)
  const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES)
  sodium.randombytes_buf(salt)
  const nonce = new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
  sodium.randombytes_buf(nonce)
  const header = new Uint8Array(HEADER_BYTES)
  header.set(MAGIC, 0)
  header[MAGIC.length] = FORMAT_VERSION
  header.set(salt, MAGIC.length + 1)
  header.set(nonce, MAGIC.length + 1 + salt.length)
  const ciphertext = new Uint8Array(archive.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(ciphertext, archive, header, null, nonce, key)
  return writeBackupFile(dataDir, concat([header, ciphertext]))
}

/**
 * Restaura un backup tras descifrarlo y validarlo por completo. Antes de tocar
 * los datos actuales conserva una copia íntegra en un directorio hermano.
 */
export async function restoreBackup(
  dataDir: string,
  backupPath: string,
  password: string,
  mode: RestoreMode
): Promise<void> {
  if (typeof dataDir !== 'string' || dataDir.length === 0 ||
      typeof backupPath !== 'string' || backupPath.length === 0) {
    throw new RangeError('dataDir y backupPath deben ser rutas no vacías')
  }
  if (mode !== 'all' && mode !== 'collections-only') throw new RangeError('Modo de restauración inválido')
  if (typeof password !== 'string' || password.length === 0) throw new RangeError('La contraseña del backup no puede estar vacía')

  const file = new Uint8Array(await fs.readFile(backupPath))
  const archive = decryptArchive(file, password)
  const entries = parseTar(archive)
  const manifest = validateEntries(entries)
  const files = new Map(entries.filter((entry) => entry.type === 'file').map((entry) => [entry.path, entry.data]))
  const deviceData = files.get('device-events.json')
  if (deviceData === undefined) throw new RangeError('Falta device-events.json en el backup')
  const deviceEvents = parseEventArray<DeviceEvent>(deviceData, 'device-events.json')
  const deviceState = foldDeviceEvents(deviceEvents)
  const eventDevices = [...deviceState.devices.keys()].sort()
  const manifestDevices = [...manifest.devices].sort()
  if (eventDevices.length !== manifestDevices.length ||
      eventDevices.some((nodeId, index) => nodeId !== manifestDevices[index])) {
    throw new RangeError('La lista de dispositivos del manifiesto no coincide con device-events.json')
  }
  const collectionEvents = new Map<string, CollectionEvent[]>()
  for (const collectionId of manifest.collections) {
    const data = files.get('collection-events-' + collectionId + '.json')
    if (data === undefined) throw new RangeError('Faltan eventos de la colección ' + collectionId)
    const events = parseEventArray<CollectionEvent>(data, 'collection-events-' + collectionId + '.json')
    if (events.length === 0 || events[0].event_type !== 'collection_genesis') {
      throw new RangeError('Los eventos de la colección ' + collectionId + ' no contienen un génesis válido')
    }
    collectionEvents.set(collectionId, events)
  }

  let masterKey: Uint8Array | null = null
  if (mode === 'all') {
    const identityData = files.get('identity.bmn')
    if (manifest.collections.length > 0 && identityData === undefined) {
      throw new RangeError('El backup no contiene identity.bmn para restaurar sus collection_core')
    }
    if (identityData !== undefined) {
      let stored: unknown
      try {
        stored = JSON.parse(decodeUtf8(identityData)) as unknown
      } catch {
        throw new RangeError('identity.bmn contiene JSON inválido en el backup')
      }
      const candidate = stored as Record<string, unknown> | null
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate) ||
          typeof candidate.private_key !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.private_key) ||
          typeof candidate.public_key !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.public_key) ||
          candidate.profile === null || typeof candidate.profile !== 'object' || Array.isArray(candidate.profile)) {
        throw new RangeError('identity.bmn tiene un formato inválido en el backup')
      }
      masterKey = fromHex(candidate.private_key)
    }
  } else {
    const identity = await loadIdentity(dataDir)
    if (manifest.collections.length > 0 && identity === null) {
      throw new RangeError('Se necesita la identidad local para restaurar los collection_core')
    }
    if (identity !== null) masterKey = fromHex(identity.private_key)
  }

  // Comprueba antes de modificar datos que la identidad puede abrir cada colección.
  if (manifest.collections.length > 0 && masterKey !== null) {
    for (const collectionId of manifest.collections) {
      const keypair = deriveCollectionKeypair(masterKey, collectionId)
      const expectedId = collectionIdFromPublicKey(keypair.publicKey)
      const genesis = collectionEvents.get(collectionId)?.[0]
      if (genesis?.event_type !== 'collection_genesis' ||
          genesis.payload.collection_id !== expectedId) {
        throw new RangeError('La identidad disponible no corresponde a la colección ' + collectionId)
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safetyCopy = dataDir.replace(/[\\/]+$/, '') + '.backup-' + timestamp
  if (await exists(dataDir)) await copyTree(dataDir, safetyCopy)

  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  await removeIfExists(join(dataDir, 'device-core'))
  await removeIfExists(join(dataDir, 'collections'))
  await removeIfExists(join(dataDir, 'materialized-view'))
  if (mode === 'all') {
    await removeIfExists(join(dataDir, 'identity.bmn'))
    await removeIfExists(join(dataDir, 'node_id'))
  }

  if (mode === 'all') {
    const identityData = files.get('identity.bmn')
    if (identityData !== undefined) {
      await fs.writeFile(join(dataDir, 'identity.bmn'), identityData, { mode: 0o600 })
      await fs.chmod(join(dataDir, 'identity.bmn'), 0o600)
    }
  }

  const deviceCore = await openDeviceCore(dataDir)
  try {
    for (const event of deviceEvents) await appendEvent(deviceCore, event)
  } finally {
    await closeDeviceCore(deviceCore)
  }

  if (manifest.collections.length > 0) {
    if (masterKey === null) throw new RangeError('No se pudo obtener la clave maestra para restaurar las colecciones')
    const storedIdentity = await loadIdentity(dataDir)
    if (storedIdentity === null) throw new RangeError('No existe identity.bmn para restaurar las colecciones')
    await fs.mkdir(join(dataDir, 'collections'), { recursive: true, mode: 0o700 })

    for (const collectionId of manifest.collections) {
      const collectionKeypair = deriveCollectionKeypair(masterKey, collectionId)
      const storagePath = join(dataDir, 'collections', collectionId)
      await fs.mkdir(storagePath, { recursive: true, mode: 0o700 })
      // createCollectionCore genera el génesis desde deviceState; aquí se reproduce
      // el log archivado exactamente, usando la misma clave y compatibilidad Hypercore.
      const core = new Hypercore(storagePath, {
        keyPair: {
          publicKey: collectionKeypair.publicKey,
          secretKey: collectionKeypair.secretKey
        },
        valueEncoding: 'json',
        compat: true
      })
      try {
        await core.ready()
        for (const event of collectionEvents.get(collectionId) ?? []) await core.append(event)
      } finally {
        await core.close()
      }
    }
  }

  if (mode === 'all') {
    await fs.writeFile(join(dataDir, 'devices.json'), JSON.stringify(manifest.devices) + '\n', { mode: 0o600 })
    await fs.chmod(join(dataDir, 'devices.json'), 0o600)
    await loadOrCreateNodeId(dataDir)
  }
}
