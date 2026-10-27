import fs from 'bare-fs'
import process from 'bare-process'
import test from 'brittle'
import { acquirePidLock } from '../src/node/pid-lock.ts'

const DATA_DIR = './tmp-test-pid-lock'

async function removeIfPresent(path: string): Promise<void> {
  try {
    await fs.unlink(path)
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }
}

test('acquirePidLock writes the current PID and release removes the file', async (t) => {
  const dataDir = DATA_DIR + '/empty'
  const pidPath = dataDir + '/lotura.pid'
  let release: (() => Promise<void>) | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    release = await acquirePidLock(dataDir)
    t.is(await fs.readFile(pidPath, 'utf8'), String(process.pid) + '\n')
    await release()
    release = null
    let exists = true
    try {
      await fs.readFile(pidPath, 'utf8')
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') exists = false
      else throw error
    }
    t.is(exists, false, 'release removes lotura.pid')
  } finally {
    if (release !== null) await release()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('acquirePidLock ignores its own PID in a stale PID file', async (t) => {
  const dataDir = DATA_DIR + '/own-pid'
  const pidPath = dataDir + '/lotura.pid'
  let release: (() => Promise<void>) | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(pidPath, String(process.pid))
    release = await acquirePidLock(dataDir)
    t.is(typeof release, 'function', 'returns release when PID file contains the current PID')
    t.is(await fs.readFile(pidPath, 'utf8'), String(process.pid) + '\n')
    await release()
    release = null

    let exists = true
    try {
      await fs.readFile(pidPath, 'utf8')
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') exists = false
      else throw error
    }
    t.is(exists, false, 'release removes lotura.pid')
  } finally {
    if (release !== null) await release()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('acquirePidLock rejects a PID that is still alive', async (t) => {
  const dataDir = DATA_DIR + '/live-pid'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(dataDir + '/lotura.pid', '1')
    let thrown: unknown = null
    try {
      await acquirePidLock(dataDir)
    } catch (error) {
      thrown = error
    }
    t.is(thrown instanceof RangeError, true)
    t.is(
      (thrown as Error | null)?.message,
      'Ya hay un proceso de Lotura usando este directorio de datos (PID 1). Ciérralo antes de arrancar otro.'
    )
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('acquirePidLock replaces a dead PID and removes the orphaned RocksDB LOCK', async (t) => {
  const dataDir = DATA_DIR + '/dead-pid'
  const lockDir = dataDir + '/device-core/db'
  const lockPath = lockDir + '/LOCK'
  const pidPath = dataDir + '/lotura.pid'
  let release: (() => Promise<void>) | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    await fs.mkdir(lockDir, { recursive: true })
    await fs.writeFile(pidPath, '999999\n')
    await fs.writeFile(lockPath, '')

    release = await acquirePidLock(dataDir)
    t.is(await fs.readFile(pidPath, 'utf8'), String(process.pid) + '\n')
    let lockExists = true
    try {
      await fs.readFile(lockPath)
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') lockExists = false
      else throw error
    }
    t.is(lockExists, false, 'orphaned LOCK is removed')
  } finally {
    if (release !== null) await release()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('acquirePidLock overwrites a corrupt PID file', async (t) => {
  const dataDir = DATA_DIR + '/corrupt-pid'
  const pidPath = dataDir + '/lotura.pid'
  let release: (() => Promise<void>) | null = null
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(pidPath, 'not-a-pid')
    release = await acquirePidLock(dataDir)
    t.is(await fs.readFile(pidPath, 'utf8'), String(process.pid) + '\n')
  } finally {
    if (release !== null) await release()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
