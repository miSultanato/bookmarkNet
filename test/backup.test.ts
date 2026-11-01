import fs from 'bare-fs'
import { join } from 'bare-path'
import sodium from 'sodium-native'
import test from 'brittle'
import { createBackup, createBackupWithKey, restoreBackup } from '../src/backup/backup.ts'
import { deviceCreateCollection, deviceMetadata } from '../src/device-events.ts'
import { foldDeviceEvents } from '../src/device-fold.ts'
import { addBookmark } from '../src/events.ts'
import { fromHex, utf8Bytes } from '../src/ids.ts'
import { deriveCollectionKeypair, collectionIdFromPublicKey } from '../src/keys.ts'
import { createIdentity, identityToApi } from '../src/identity/store.ts'
import { userKeypairFromMasterKey } from '../src/identity.ts'
import { loadOrCreateNodeId, validateId } from '../src/node/node-id.ts'
import { appendEvent, closeDeviceCore, openDeviceCore, readAllEvents } from '../src/storage/device-core.ts'
import { closeCollectionCore, createCollectionCore, openExistingCollectionCore, readCollectionEvents } from '../src/storage/collection-core.ts'

const ROOT = './tmp-test-backup'
const PASSWORD = 'backup test password'
const MAGIC = 'LOTURABK'
const COLLECTION_UUID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const BOOKMARK_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const HEADER_BYTES = 8 + 1 + sodium.crypto_pwhash_SALTBYTES +
  sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES

interface PreparedData {
  identity: string
  nodeId: string
  masterKey: Uint8Array
  deviceEventCount: number
  collectionEventCount: number
}

function ascii(bytes: Uint8Array): string {
  let value = ''
  for (const byte of bytes) {
    if (byte === 0) break
    value += String.fromCharCode(byte)
  }
  return value
}

function parseArchive(tar: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>()
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const path = ascii(header.subarray(0, 100))
    const sizeText = ascii(header.subarray(124, 136)).trim()
    const size = Number.parseInt(sizeText, 8)
    if (!path || !Number.isSafeInteger(size) || size < 0) throw new Error('Cabecera TAR inválida en test')
    const dataStart = offset + 512
    entries.set(path, tar.slice(dataStart, dataStart + size))
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return entries
}

function decryptTestBackup(file: Uint8Array, password: string): Map<string, Uint8Array> {
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
  sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(plaintext, null, ciphertext, header, nonce, key)
  return parseArchive(plaintext)
}

async function readDeviceEvents(dataDir: string) {
  const core = await openDeviceCore(dataDir)
  try {
    return await readAllEvents(core)
  } finally {
    await closeDeviceCore(core)
  }
}

async function readCollectionEventsFromDisk(dataDir: string, masterKey: Uint8Array) {
  const core = await openExistingCollectionCore(dataDir, COLLECTION_UUID, masterKey)
  try {
    return await readCollectionEvents(core)
  } finally {
    await closeCollectionCore(core)
  }
}

async function prepareDataDir(
  dataDir: string,
  marker: string,
  identityContents?: string
): Promise<PreparedData> {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  if (identityContents === undefined) {
    await createIdentity(dataDir)
  } else {
    await fs.writeFile(join(dataDir, 'identity.bmn'), identityContents, { mode: 0o600 })
  }
  const identity = await fs.readFile(join(dataDir, 'identity.bmn'), 'utf8')
  const storedIdentity = JSON.parse(identity) as { private_key: string }
  const masterKey = fromHex(storedIdentity.private_key)
  const apiIdentity = identityToApi(JSON.parse(identity))
  const userKeypair = userKeypairFromMasterKey(masterKey)
  const collectionKeypair = deriveCollectionKeypair(masterKey, COLLECTION_UUID)
  const collectionPublicId = collectionIdFromPublicKey(collectionKeypair.publicKey)

  const deviceEvents = [
    deviceMetadata({ authorId: apiIdentity.user_id, displayName: marker }),
    deviceCreateCollection({
      authorId: apiIdentity.user_id,
      collectionId: COLLECTION_UUID,
      publicCollectionId: collectionPublicId,
      name: 'Colección ' + marker,
      visibility: 'unlisted',
      language: 'es'
    })
  ]
  const deviceCore = await openDeviceCore(dataDir)
  try {
    for (const event of deviceEvents) await appendEvent(deviceCore, event)
  } finally {
    await closeDeviceCore(deviceCore)
  }

  const state = foldDeviceEvents(deviceEvents)
  const collectionCore = await createCollectionCore(
    dataDir,
    COLLECTION_UUID,
    masterKey,
    apiIdentity.user_id,
    userKeypair.publicKey,
    userKeypair.secretKey,
    state
  )
  try {
    await collectionCore.append(addBookmark({
      authorId: apiIdentity.user_id,
      bookmarkId: BOOKMARK_ID,
      resourceId: 'r_' + 'a'.repeat(64),
      canonicalUrl: 'https://example.com/' + marker,
      title: 'Bookmark ' + marker,
      tags: ['test']
    }))
  } finally {
    await closeCollectionCore(collectionCore)
  }

  return {
    identity,
    nodeId: await loadOrCreateNodeId(dataDir),
    masterKey,
    deviceEventCount: deviceEvents.length,
    collectionEventCount: 2
  }
}

test('createBackup serializes device and collection events with private permissions', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const dataDir = join(ROOT, 'source')
  try {
    const prepared = await prepareDataDir(dataDir, 'source')
    const backupPath = await createBackup({ dataDir, password: PASSWORD })
    const bytes = new Uint8Array(await fs.readFile(backupPath))
    const stat = await fs.stat(backupPath)
    t.is(ascii(bytes.subarray(0, MAGIC.length)), MAGIC, 'backup starts with the format magic')
    t.is(bytes[MAGIC.length], 2, 'backup format version is 2')
    t.is(stat.mode & 0o777, 0o600, 'backup permissions are 0600')
    t.is(bytes.length > 100, true, 'encrypted archive has content')
    t.is(backupPath.includes(join('backups', 'backup-')), true, 'backup is written under backups')

    const entries = decryptTestBackup(bytes, PASSWORD)
    const manifest = JSON.parse(ascii(entries.get('manifest.json') ?? new Uint8Array(0))) as {
      version: number
      devices: string[]
      collections: string[]
    }
    const deviceEvents = JSON.parse(ascii(entries.get('device-events.json') ?? new Uint8Array(0)))
    const collectionEvents = JSON.parse(ascii(entries.get('collection-events-' + COLLECTION_UUID + '.json') ?? new Uint8Array(0)))
    t.is(manifest.version, 2, 'manifest declares format version 2')
    t.alike(manifest.devices, [], 'device list remains empty until device_add_device exists')
    t.alike(manifest.collections, [COLLECTION_UUID], 'manifest lists local collection identifiers')
    t.is(deviceEvents.length, prepared.deviceEventCount, 'device-events.json contains every device event')
    t.is(collectionEvents.length, prepared.collectionEventCount, 'collection-events file contains every collection event')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('createBackupWithKey uses the event archive format', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const dataDir = join(ROOT, 'source-key')
  try {
    await prepareDataDir(dataDir, 'key')
    const key = new Uint8Array(32)
    sodium.randombytes_buf(key)
    const backupPath = await createBackupWithKey(dataDir, key)
    const bytes = new Uint8Array(await fs.readFile(backupPath))
    t.is(bytes[ MAGIC.length ], 2, 'automatic backup uses format version 2')
    t.is(bytes.length > HEADER_BYTES, true, 'automatic backup contains encrypted data')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup all rebuilds cores from events and regenerates node_id', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = join(ROOT, 'source')
  const target = join(ROOT, 'target')
  try {
    const sourceState = await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const targetState = await prepareDataDir(target, 'target')

    await restoreBackup(target, backupPath, PASSWORD, 'all')

    t.is(await fs.readFile(join(target, 'identity.bmn'), 'utf8'), sourceState.identity, 'identity is restored')
    const restoredDeviceEvents = await readDeviceEvents(target)
    const restoredCollectionEvents = await readCollectionEventsFromDisk(target, sourceState.masterKey)
    t.is(restoredDeviceEvents.length, sourceState.deviceEventCount, 'device_core is rebuilt with all events')
    t.is(restoredCollectionEvents.length, sourceState.collectionEventCount, 'collection_core is rebuilt with all events')
    const restoredNodeId = await fs.readFile(join(target, 'node_id'), 'utf8')
    t.is(validateId(restoredNodeId.trim()), true, 'restored node_id is valid')
    t.is(restoredNodeId.trim() === targetState.nodeId, false, 'previous node_id is not reused')
    t.is(restoredNodeId.trim() === sourceState.nodeId, false, 'source node_id is not copied')
    t.is(await fs.readFile(join(target, 'devices.json'), 'utf8'), '[]\n', 'device list is restored empty until device_add_device exists')
    const backupDirs = (await fs.readdir(ROOT)).filter((name) => name.startsWith('target.backup-'))
    t.is(backupDirs.length, 1, 'current data is preserved in a safety copy')
    t.is(await fs.stat(join(ROOT, backupDirs[0], 'device-core')).then(() => true, () => false), true, 'safety copy preserves the previous device_core')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup collections-only rebuilds cores and preserves identity and node_id', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = join(ROOT, 'source')
  const target = join(ROOT, 'target')
  try {
    const sourceState = await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const targetState = await prepareDataDir(target, 'target', sourceState.identity)

    await restoreBackup(target, backupPath, PASSWORD, 'collections-only')

    t.is(await fs.readFile(join(target, 'identity.bmn'), 'utf8'), targetState.identity, 'identity remains unchanged')
    t.is(await fs.readFile(join(target, 'node_id'), 'utf8'), targetState.nodeId + '\n', 'node_id remains unchanged')
    t.is((await readDeviceEvents(target)).length, sourceState.deviceEventCount, 'device_core is rebuilt with all events')
    t.is((await readCollectionEventsFromDisk(target, targetState.masterKey)).length, sourceState.collectionEventCount, 'collection_core is rebuilt with all events')
    t.is(await fs.stat(join(target, 'devices.json')).then(() => true, () => false), false, 'collections-only does not restore device list')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup rejects an incorrect password without changing current data', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = join(ROOT, 'source')
  const target = join(ROOT, 'target')
  try {
    await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const targetState = await prepareDataDir(target, 'target')
    let error: unknown = null
    try {
      await restoreBackup(target, backupPath, 'incorrect password', 'all')
    } catch (caught) {
      error = caught
    }
    t.is(error instanceof RangeError, true, 'incorrect password is rejected')
    t.is((await readDeviceEvents(target)).length, targetState.deviceEventCount, 'current device_core remains untouched')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup rejects a corrupt backup without changing current data', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = join(ROOT, 'source')
  const target = join(ROOT, 'target')
  const corruptPath = join(ROOT, 'corrupt.bmn')
  try {
    await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const bytes = new Uint8Array(await fs.readFile(backupPath))
    bytes[bytes.length - 1] ^= 0xff
    await fs.writeFile(corruptPath, bytes)
    const targetState = await prepareDataDir(target, 'target')
    let error: unknown = null
    try {
      await restoreBackup(target, corruptPath, PASSWORD, 'all')
    } catch (caught) {
      error = caught
    }
    t.is(error instanceof RangeError, true, 'corrupt backup is rejected')
    t.is((await readDeviceEvents(target)).length, targetState.deviceEventCount, 'current device_core remains untouched')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup collections-only rejects an identity that does not own the archived collections', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = join(ROOT, 'source')
  const target = join(ROOT, 'target')
  try {
    await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const targetState = await prepareDataDir(target, 'target')
    let error: unknown = null
    try {
      await restoreBackup(target, backupPath, PASSWORD, 'collections-only')
    } catch (caught) {
      error = caught
    }
    t.is(error instanceof RangeError, true, 'a different identity is rejected')
    t.is((await readDeviceEvents(target)).length, targetState.deviceEventCount, 'current device_core remains untouched')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
