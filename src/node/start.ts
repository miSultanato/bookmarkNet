import type Hypercore from 'hypercore'
import type { HTTPServer } from 'bare-http1'
import type { Config } from './config.ts'
import { acquirePidLock } from './pid-lock.ts'
import { loadOrCreateNodeId } from './node-id.ts'
import { appendEvent, closeDeviceCore, openDeviceCore, readAllEvents } from '../storage/device-core.ts'
import type { DeviceState } from '../device-fold.ts'
import { foldDeviceEvents, applyDeviceEvent } from '../device-fold.ts'
import type { DeviceEvent } from '../device-events.ts'
import { identityToApi, loadIdentity } from '../identity/store.ts'
import { startSwarm } from '../p2p/swarm.ts'

export type NodeIdentity = ReturnType<typeof identityToApi>

const TEST_TOPIC = Buffer.from('lotura-test-topic')

// Usa performance.now() monotónico cuando Bare lo ofrece; Date.now() es el fallback.
const now = (): number => typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now()
const logTiming = (phase: string, start: number): void => {
  console.log(`[timing] ${phase}: ${Math.round(now() - start)}ms`)
}

export interface SwarmLike {
  close(): Promise<void>
}

export interface Node {
  config: Config
  core: Hypercore
  state: DeviceState
  identity: NodeIdentity | null
  nodeId: string
  swarm: SwarmLike
  apply(event: DeviceEvent): Promise<void>
  close(): Promise<void>
}

export async function startNode(config: Config, options?: { swarm?: SwarmLike }): Promise<Node> {
  const releasePidLock = await acquirePidLock(config.dataDir)

  let nodeId: string | null = null
  let core: Hypercore | null = null
  let swarm: SwarmLike | null = null
  let state: DeviceState | null = null
  let identity: NodeIdentity | null = null
  let closePromise: Promise<void> | null = null

  try {
    nodeId = await loadOrCreateNodeId(config.dataDir)

    const openStart = now()
    core = await openDeviceCore(config.dataDir)
    logTiming('node:open', openStart)

    const readStart = now()
    const events = await readAllEvents(core)
    logTiming('node:read', readStart)

    const foldStart = now()
    state = foldDeviceEvents(events)
    logTiming('node:fold', foldStart)

    const swarmStart = now()
    swarm = options?.swarm ?? await startSwarm(TEST_TOPIC, (socket) => {
      console.log('peer connected')
    })
    logTiming('node:swarm', swarmStart)

    const identityStart = now()
    const stored = await loadIdentity(config.dataDir)
    identity = stored ? identityToApi(stored) : null
    logTiming('node:identity', identityStart)

    // Comprobamos que todas las inicializaciones hayan tenido éxito.
    if (core === null || swarm === null || state === null) {
      throw new Error('Inicialización fallida: recursos no disponibles')
    }

    // Capturamos referencias no-null para usarlas en el objeto devuelto.
    const openedCore = core
    const openedSwarm = swarm
    const openedNodeId = nodeId
    let currentState = state

    // No iniciamos la limpieza aquí; se inicia en la primera llamada a close().
    return {
      config,
      core: openedCore,
      swarm: openedSwarm,
      nodeId: openedNodeId,
      get state() {
        return currentState
      },
      identity,
      async apply(event: DeviceEvent): Promise<void> {
        await appendEvent(openedCore, event)
        currentState = applyDeviceEvent(currentState, event)
      },
      close: (): Promise<void> => {
        if (closePromise === null) {
          closePromise = (async () => {
            try {
              await openedSwarm.close()
            } finally {
              try {
                await closeDeviceCore(openedCore)
              } finally {
                await releasePidLock()
              }
            }
          })()
        }
        return closePromise
      },
    }
  } catch (error) {
    // Si falló la inicialización, limpiamos los recursos en este orden: swarm, core, lock.
    try {
      if (swarm !== null) {
        await swarm.close()
      }
    } finally {
      try {
        if (core !== null) {
          await closeDeviceCore(core)
        }
      } finally {
        await releasePidLock()
      }
    }
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
