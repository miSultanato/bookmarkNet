import fs from 'bare-fs'
import { dirname, join } from 'bare-path'
import sodium from 'sodium-native'
import { utf8Bytes } from '../ids.ts'
import { loadOrCreateNodeId } from '../node/node-id.ts'

const MAGIC = utf8Bytes('LOTURABK')
const FORMAT_VERSION = 1
const HEADER_BYTES = MAGIC.length + 1 + sodium.crypto_pwhash_SALTBYTES +
  sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
const BLOCK_BYTES = 512
const END_BLOCKS = 2
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
const COLLECTION_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export interface CreateBackupOptions {
  dataDir: string
  password: string
}

export type RestoreMode = 'all' | 'collections-only'

interface TarEntry {
  path: string
  type: 'file' | 'directory'
  data: Uint8Array
}

interface BackupManifest {
  version: 1
  devices: string[]
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

async function addPath(entries: TarEntry[], root: string, relative: string): Promise<void> {
  const fullPath = join(root, relative)
  const stat = await fs.stat(fullPath)
  if (stat.isDirectory()) {
    entries.push({ path: relative, type: 'directory', data: new Uint8Array(0) })
    const names = await fs.readdir(fullPath)
    for (const name of names) await addPath(entries, root, relative + '/' + name)
  } else if (stat.isFile()) {
    const contents = await fs.readFile(fullPath)
    entries.push({ path: relative, type: 'file', data: new Uint8Array(contents) })
  } else {
    throw new RangeError('El backup no admite enlaces ni tipos de archivo especiales: ' + relative)
  }
}

async function copyTree(source: string, destination: string): Promise<void> {
  const stat = await fs.stat(source)
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true, mode: 0o700 })
    for (const name of await fs.readdir(source)) {
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
  if (manifest.version !== 1 || !Array.isArray(manifest.devices) ||
      !manifest.devices.every((device) => typeof device === 'string')) {
    throw new RangeError('Manifiesto del backup inválido')
  }
}

function validateEntries(entries: TarEntry[]): BackupManifest {
  const files = new Map(entries.filter((entry) => entry.type === 'file').map((entry) => [entry.path, entry.data]))
  const manifestData = files.get('manifest.json')
  if (manifestData === undefined) throw new RangeError('Falta manifest.json en el backup')
  let manifest: unknown
  try {
    manifest = JSON.parse(decodeUtf8(manifestData)) as unknown
  } catch {
    throw new RangeError('manifest.json contiene JSON inválido')
  }
  validateManifest(manifest)
  for (const path of files.keys()) {
    if (path !== 'manifest.json' && path !== 'identity.bmn' &&
        !path.startsWith('device-core/') && !path.startsWith('collections/')) {
      throw new RangeError('Contenido no reconocido en el backup: ' + path)
    }
  }
  for (const entry of entries) {
    if (entry.path.startsWith('collections/')) {
      const id = entry.path.split('/')[1]
      if (!id || !COLLECTION_ID_PATTERN.test(id)) throw new RangeError('Identificador de colección inválido en backup')
    }
  }
  return manifest
}

async function writeEntries(dataDir: string, entries: TarEntry[], allowed: (path: string) => boolean): Promise<void> {
  for (const entry of entries) {
    if (!allowed(entry.path) || entry.path === 'manifest.json') continue
    const destination = join(dataDir, entry.path)
    if (entry.type === 'directory') {
      await fs.mkdir(destination, { recursive: true, mode: 0o700 })
    } else {
      const parent = destination.slice(0, destination.lastIndexOf('/')) || dataDir
      await fs.mkdir(parent, { recursive: true, mode: 0o700 })
      await fs.writeFile(destination, entry.data, { mode: 0o600 })
      await fs.chmod(destination, 0o600)
    }
  }
}

async function removeIfExists(path: string): Promise<void> {
  if (await exists(path)) await fs.rm(path, { recursive: true, force: true })
}

/**
 * Crea un backup cifrado de la identidad (si existe), device_core y
 * collection_core. El formato combina una cabecera versionada y un TAR USTAR.
 */
export async function createBackup(options: CreateBackupOptions): Promise<string> {
  if (options === null || typeof options !== 'object' ||
      typeof options.dataDir !== 'string' || options.dataDir.length === 0) {
    throw new RangeError('dataDir debe ser una ruta no vacía')
  }
  if (typeof options.password !== 'string' || options.password.length === 0) {
    throw new RangeError('La contraseña del backup no puede estar vacía')
  }

  const dataDir = options.dataDir
  const entries: TarEntry[] = []
  if (await exists(join(dataDir, 'identity.bmn'))) {
    entries.push({ path: 'identity.bmn', type: 'file', data: new Uint8Array(await fs.readFile(join(dataDir, 'identity.bmn'))) })
  }
  if (await exists(join(dataDir, 'device-core'))) {
    await addPath(entries, dataDir, 'device-core')
  }
  if (await exists(join(dataDir, 'collections'))) {
    await addPath(entries, dataDir, 'collections')
  }
  // La lista de dispositivos se extraerá de device_add_device cuando se implemente; por ahora, vacía.
  const manifest: BackupManifest = { version: 1, devices: [] }
  entries.unshift({
    path: 'manifest.json',
    type: 'file',
    data: encodeUtf8(JSON.stringify(manifest))
  })
  const encrypted = encryptArchive(createTar(entries), options.password)
  const backupsDir = join(dataDir, 'backups')
  await fs.mkdir(backupsDir, { recursive: true, mode: 0o700 })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupsDir, 'backup-' + timestamp + '.bmn')
  await fs.writeFile(backupPath, encrypted, { mode: 0o600 })
  await fs.chmod(backupPath, 0o600)
  return backupPath
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
  const hasDeviceCore = entries.some((entry) => entry.path === 'device-core' || entry.path.startsWith('device-core/'))
  if (!hasDeviceCore) throw new RangeError('El backup no contiene device_core')
  if (mode === 'all' && manifest.devices.length !== 0) {
    throw new RangeError('Esta versión solo admite backups con la lista de dispositivos vacía')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safetyCopy = dataDir.replace(/\/+$/, '') + '.backup-' + timestamp
  if (await exists(dataDir)) await copyTree(dataDir, safetyCopy)

  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  await removeIfExists(join(dataDir, 'device-core'))
  await removeIfExists(join(dataDir, 'collections'))
  await removeIfExists(join(dataDir, 'materialized-view'))
  if (mode === 'all') {
    await removeIfExists(join(dataDir, 'identity.bmn'))
    await removeIfExists(join(dataDir, 'node_id'))
  }

  await writeEntries(dataDir, entries, (path) =>
    path === 'identity.bmn' ? mode === 'all' :
      path === 'device-core' || path.startsWith('device-core/') ||
      path === 'collections' || path.startsWith('collections/'))

  if (mode === 'all') {
    // En esta fase, la lista de dispositivos se restaura vacía; device_add_device llegará después.
    await fs.writeFile(join(dataDir, 'devices.json'), '[]\n', { mode: 0o600 })
    await fs.chmod(join(dataDir, 'devices.json'), 0o600)
    await loadOrCreateNodeId(dataDir)
  }
}
