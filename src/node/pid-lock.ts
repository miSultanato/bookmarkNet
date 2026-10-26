import fs from 'bare-fs'
import process from 'bare-process'

function parsePid(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const pid = Number(trimmed)
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'ESRCH') return false
    // EPERM means the process exists but this process cannot signal it.
    if (code === 'EPERM') return true
    throw error
  }
}

/**
 * Uses an application PID file to distinguish an active Lotura instance from
 * a stale RocksDB LOCK. A Hypercore worker may inherit the LOCK file descriptor
 * and keep the kernel lock alive even after the main process exits, so LOCK
 * itself cannot reliably tell us whether the owning Lotura process is alive.
 */
export async function acquirePidLock(dataDir: string): Promise<() => Promise<void>> {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const pidPath = dataDir.replace(/\/+$/, '') + '/lotura.pid'
  const lockPath = dataDir.replace(/\/+$/, '') + '/device-core/db/LOCK'

  let previousPid: number | null = null
  try {
    previousPid = parsePid(await fs.readFile(pidPath, 'utf8'))
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }

  if (previousPid !== null && isProcessAlive(previousPid)) {
    throw new RangeError(`Ya hay un proceso de Lotura usando este directorio de datos (PID ${previousPid}). Ciérralo antes de arrancar otro.`)
  }

  try {
    await fs.unlink(lockPath)
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }

  await fs.writeFile(pidPath, String(process.pid) + '\n')

  return async (): Promise<void> => {
    try {
      await fs.unlink(pidPath)
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error
    }
  }
}
