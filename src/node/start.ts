import type Hypercore from 'hypercore'
import type { HTTPServer } from 'bare-http1'
import type { Config } from './config.ts'
import { acquirePidLock } from './pid-lock.ts'
import { appendEvent, closeDeviceCore, openDeviceCore, readAllEvents } from '../storage/device-core.ts'
import type { DeviceState } from '../device-fold.ts'
import { foldDeviceEvents, applyDeviceEvent } from '../device-fold.ts'
import type { DeviceEvent } from '../device-events.ts'
import { identityToApi, loadIdentity } from '../identity/store.ts'

export type NodeIdentity = ReturnType<typeof identityToApi>

export interface Node {
  config: Config
  core: Hypercore
  state: DeviceState
  identity: NodeIdentity | null
  apply(event: DeviceEvent): Promise<void>
  close(): Promise<void>
}

export async function startNode(config: Config): Promise<Node> {
  const releasePidLock = await acquirePidLock(config.dataDir)

  try {
    const core = await openDeviceCore(config.dataDir)
    try {
      const events = await readAllEvents(core)
      let state = foldDeviceEvents(events)
      const stored = await loadIdentity(config.dataDir)
      const identity = stored ? identityToApi(stored) : null

      return {
        config,
        core,
        get state() {
          return state
        },
        identity,
        async apply(event: DeviceEvent): Promise<void> {
          await appendEvent(core, event)
          state = applyDeviceEvent(state, event)
        },
        close: async () => {
          try {
            await closeDeviceCore(core)
          } finally {
            await releasePidLock()
          }
        }
      }
    } catch (error) {
      await closeDeviceCore(core)
      throw error
    }
  } catch (error) {
    await releasePidLock()
    throw error
  }
}


/**
 * Starts an HTTP server on the requested port. When the port is implicit,
 * EADDRINUSE advances through at most maxAttempts consecutive ports.
 * The server itself is bound here so the returned port is the one actually
 * listening; callers should create it without listening first.
 */
export async function listenWithPortFallback(
  server: HTTPServer,
  startPort: number,
  bind: string,
  portExplicit: boolean,
  maxAttempts = 100
): Promise<number> {
  const attempts = portExplicit ? 1 : maxAttempts
  for (let attempt = 0; attempt < attempts; attempt++) {
    const port = startPort + attempt
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.removeListener('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server.removeListener('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, bind)
      })
      const address = server.address() as { port?: number } | string | null
      if (address === null || typeof address === 'string' || typeof address.port !== 'number') {
        await new Promise<void>((resolve) => server.close(() => resolve()))
        throw new Error('No se pudo determinar el puerto del servidor HTTP')
      }
      return address.port
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code !== 'EADDRINUSE') throw error
      if (portExplicit) {
        throw new Error(`El puerto ${startPort} está ocupado. Fíjalo en config.json o libera el puerto.`)
      }
      if (attempt === attempts - 1) {
        throw new Error(`No se encontró un puerto libre en el rango ${startPort}-${startPort + attempts - 1}. Fija un puerto en config.json o libera alguno.`)
      }
    }
  }
  throw new Error('No se encontró un puerto libre')
}
