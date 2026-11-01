import fs from 'bare-fs'
import test from 'brittle'
import { createBackup, restoreBackup } from '../src/backup/backup.ts'
import { createIdentity } from '../src/identity/store.ts'
import { loadOrCreateNodeId, validateId } from '../src/node/node-id.ts'

const ROOT = './tmp-test-backup'
const PASSWORD = 'backup test password'
const MAGIC = 'LOTURABK'

async function prepareDataDir(dataDir: string, identityMarker: string): Promise<{ identity: string; nodeId: string }> {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const identity = await createIdentity(dataDir)
  await fs.writeFile(dataDir + '/identity-marker', identityMarker)
  await fs.mkdir(dataDir + '/device-core', { recursive: true, mode: 0o700 })
  await fs.writeFile(dataDir + '/device-core/000001.data', 'device events ' + identityMarker)
  await fs.mkdir(dataDir + '/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV', { recursive: true, mode: 0o700 })
  await fs.writeFile(dataDir + '/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV/000001.data', 'collection events ' + identityMarker)
  return {
    identity: await fs.readFile(dataDir + '/identity.bmn', 'utf8'),
    nodeId: await loadOrCreateNodeId(dataDir)
  }
}

test('createBackup encrypts identity, device_core and collection_core with private permissions', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const dataDir = ROOT + '/source'
  try {
    await prepareDataDir(dataDir, 'source')
    const backupPath = await createBackup({ dataDir, password: PASSWORD })
    const bytes = await fs.readFile(backupPath)
    const stat = await fs.stat(backupPath)
    t.is(String.fromCharCode(...bytes.subarray(0, MAGIC.length)), MAGIC, 'backup starts with the format magic')
    t.is(bytes[MAGIC.length], 1, 'backup format version is 1')
    t.is(stat.mode & 0o777, 0o600, 'backup permissions are 0600')
    t.is(bytes.length > 100, true, 'encrypted archive has content')
    t.is(backupPath.includes('/backups/backup-'), true, 'backup is written under backups')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup all restores identity and cores and regenerates node_id', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = ROOT + '/source'
  const target = ROOT + '/target'
  try {
    const sourceState = await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const targetState = await prepareDataDir(target, 'target')

    await restoreBackup(target, backupPath, PASSWORD, 'all')

    t.is(await fs.readFile(target + '/identity.bmn', 'utf8'), sourceState.identity, 'identity is restored')
    t.is(await fs.readFile(target + '/device-core/000001.data', 'utf8'), 'device events source', 'device_core is restored')
    t.is(await fs.readFile(target + '/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV/000001.data', 'utf8'), 'collection events source', 'collection_core is restored')
    const restoredNodeId = await fs.readFile(target + '/node_id', 'utf8')
    t.is(validateId(restoredNodeId.trim()), true, 'restored node_id is valid')
    t.is(restoredNodeId.trim() === targetState.nodeId, false, 'previous node_id is not reused')
    t.is(restoredNodeId.trim() === sourceState.nodeId, false, 'source node_id is not copied')
    t.is(await fs.readFile(target + '/devices.json', 'utf8'), '[]\n', 'device list is restored empty until device_add_device exists')
    const backupDirs = (await fs.readdir(ROOT)).filter((name) =>
      name.startsWith('target.backup-'))
    t.is(backupDirs.length, 1, 'current data is preserved in a safety copy')
    const safetyCopy = ROOT + '/' + backupDirs[0]
    t.is(await fs.readFile(safetyCopy + '/device-core/000001.data', 'utf8'), 'device events target', 'safety copy preserves the previous device_core')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup collections-only restores cores and preserves identity and node_id', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = ROOT + '/source'
  const target = ROOT + '/target'
  try {
    await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const targetState = await prepareDataDir(target, 'target')

    await restoreBackup(target, backupPath, PASSWORD, 'collections-only')

    t.is(await fs.readFile(target + '/identity.bmn', 'utf8'), targetState.identity, 'identity remains unchanged')
    t.is(await fs.readFile(target + '/node_id', 'utf8'), targetState.nodeId + '\n', 'node_id remains unchanged')
    t.is(await fs.readFile(target + '/device-core/000001.data', 'utf8'), 'device events source', 'device_core is restored')
    t.is(await fs.readFile(target + '/collections/01ARZ3NDEKTSV4RRFFQ69G5FAV/000001.data', 'utf8'), 'collection events source', 'collection_core is restored')
    t.is(await fs.stat(target + '/devices.json').then(() => true, () => false), false, 'collections-only does not restore device list')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup rejects an incorrect password without changing current data', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = ROOT + '/source'
  const target = ROOT + '/target'
  try {
    await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    await prepareDataDir(target, 'target')
    let error: unknown = null
    try {
      await restoreBackup(target, backupPath, 'incorrect password', 'all')
    } catch (caught) {
      error = caught
    }
    t.is(error instanceof RangeError, true, 'incorrect password is rejected')
    t.is(await fs.readFile(target + '/device-core/000001.data', 'utf8'), 'device events target', 'current device_core remains untouched')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})

test('restoreBackup rejects a corrupt backup without changing current data', async (t) => {
  await fs.rm(ROOT, { recursive: true, force: true })
  const source = ROOT + '/source'
  const target = ROOT + '/target'
  const corruptPath = ROOT + '/corrupt.bmn'
  try {
    await prepareDataDir(source, 'source')
    const backupPath = await createBackup({ dataDir: source, password: PASSWORD })
    const bytes = new Uint8Array(await fs.readFile(backupPath))
    bytes[bytes.length - 1] ^= 0xff
    await fs.writeFile(corruptPath, bytes)
    await prepareDataDir(target, 'target')
    let error: unknown = null
    try {
      await restoreBackup(target, corruptPath, PASSWORD, 'all')
    } catch (caught) {
      error = caught
    }
    t.is(error instanceof RangeError, true, 'corrupt backup is rejected')
    t.is(await fs.readFile(target + '/device-core/000001.data', 'utf8'), 'device events target', 'current device_core remains untouched')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
