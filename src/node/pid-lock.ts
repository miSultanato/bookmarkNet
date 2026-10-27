import fs from 'bare-fs'
import process from 'bare-process'
import { spawn } from 'bare-subprocess'

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

async function killLockHoldersOnLinux(lockPath: string): Promise<void> {
  if (process.platform !== 'linux') return

  try {
    await fs.stat(lockPath)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return
    console.warn('No se pudo comprobar el LOCK de RocksDB antes del arranque:', error)
    return
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let subprocess: ReturnType<typeof spawn>
      try {
        subprocess = spawn('fuser', ['-k', lockPath], { stdio: 'ignore' })
      } catch (error) {
        reject(error)
        return
      }

      let settled = false
      const finish = (error?: Error): void => {
        if (settled) return
        settled = true
        if (error) reject(error)
        else resolve()
      }

      subprocess.once('error', (error: Error) => finish(error))
      subprocess.once('exit', (code: number | null, signal: string | null) => {
        if (code === 0) {
          finish()
        } else {
          finish(new Error('fuser -k terminó con código ' + String(code) + ' y señal ' + String(signal)))
        }
      })
    })
  } catch (error) {
    // fuser es una mitigación opcional: el PID lock y la limpieza del LOCK
    // huérfano existentes siguen siendo el fallback si no está disponible.
    console.warn('No se pudo ejecutar fuser -k sobre el LOCK de RocksDB; se continúa con la limpieza habitual:', error)
  }

  // Deja tiempo al kernel para liberar los descriptores tras terminar el worker.
  await new Promise<void>((resolve) => setTimeout(resolve, 100))
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

  // Linux-only workaround for orphaned Hypercore workers holding RocksDB LOCK.
  // Run before checking lotura.pid or unlinking LOCK.
  await killLockHoldersOnLinux(lockPath)

  let previousPid: number | null = null
  try {
    previousPid = parsePid(await fs.readFile(pidPath, 'utf8'))
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }

  const currentPid = process.pid
  if (previousPid !== null && previousPid === currentPid) {
    // El PID del proceso actual puede haberse reutilizado tras un cierre anterior.
    try {
      await fs.unlink(pidPath)
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error
    }
    previousPid = null
  }

  if (previousPid !== null && isProcessAlive(previousPid)) {
    throw new RangeError('Ya hay un proceso de Lotura usando este directorio de datos (PID ' + String(previousPid) + '). Ciérralo antes de arrancar otro.')
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
