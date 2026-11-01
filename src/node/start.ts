import type Hypercore from 'hypercore'
import sodium from 'sodium-native'
import type { HTTPServer } from 'bare-http1'
import type { Config } from './config.ts'
import { acquirePidLock } from './pid-lock.ts'
import { loadOrCreateNodeId } from './node-id.ts'
import { appendEvent, closeDeviceCore, openDeviceCore, readAllEvents } from '../storage/device-core.ts'
import {
  closeMaterializedView,
  getLastProcessedEvent,
  openMaterializedView,
  setCollectionState,
  setDeviceState,
  setLastProcessedEvent
} from '../storage/materialized-view.ts'
import type { MaterializedViewHandle } from '../storage/materialized-view.ts'
import type { DeviceState } from '../device-fold.ts'
import { foldDeviceEvents, applyDeviceEvent } from '../device-fold.ts'
import { foldEvents } from '../fold.ts'
import type { DeviceEvent } from '../device-events.ts'
import { identityToApi, loadIdentity } from '../identity/store.ts'
import { createBackupWithKey } from '../backup/backup.ts'
import { fromHex, utf8Bytes } from '../ids.ts'
import { userKeypairFromMasterKey } from '../identity.ts'
import { closeCollectionCore, createCollectionCore, openExistingCollectionCore, readCollectionEvents } from '../storage/collection-core.ts'
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

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64
  const normalizedKey = new Uint8Array(blockSize)
  normalizedKey.set(key)
  const innerPad = new Uint8Array(blockSize)
  const outerPad = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    innerPad[i] = normalizedKey[i] ^ 0x36
    outerPad[i] = normalizedKey[i] ^ 0x5c
  }
  const innerInput = new Uint8Array(innerPad.length + message.length)
  innerInput.set(innerPad)
  innerInput.set(message, innerPad.length)
  const innerDigest = new Uint8Array(32)
  sodium.crypto_hash_sha256(innerDigest, innerInput)
  const outerInput = new Uint8Array(outerPad.length + innerDigest.length)
  outerInput.set(outerPad)
  outerInput.set(innerDigest, outerPad.length)
  const output = new Uint8Array(32)
  sodium.crypto_hash_sha256(output, outerInput)
  return output
}

function deriveBackupKey(masterKey: Uint8Array): Uint8Array {
  if (!(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    throw new RangeError('user_master_key debe contener exactamente 32 bytes')
  }
  const salt = new Uint8Array(32)
  const prk = hmacSha256(salt, masterKey)
  const info = utf8Bytes('bookmarknet:backup:')
  const expandInput = new Uint8Array(info.length + 1)
  expandInput.set(info)
  expandInput[info.length] = 1
  return hmacSha256(prk, expandInput)
}

export interface SwarmLike {
  close(): Promise<void>
}

export interface Node {
  config: Config
  core: Hypercore
  view: MaterializedViewHandle
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
  let view: MaterializedViewHandle | null = null
  let swarm: SwarmLike | null = null
  let state: DeviceState | null = null
  let identity: NodeIdentity | null = null
  let timerId: ReturnType<typeof setInterval> | null = null
  let backupInProgress: Promise<void> | null = null
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

    const viewStart = now()
    view = await openMaterializedView(config.dataDir)
    const lastProcessed = await getLastProcessedEvent(view, 'device')
    const lastEventIndex = core.length - 1
    if (lastProcessed !== lastEventIndex) {
      await setDeviceState(view, state)
      await setLastProcessedEvent(view, 'device', lastEventIndex)
    }
    logTiming('node:view', viewStart)

    const swarmStart = now()
    swarm = options?.swarm ?? await startSwarm(TEST_TOPIC, (socket) => {
      console.log('peer connected')
    })
    logTiming('node:swarm', swarmStart)

    const identityStart = now()
    const stored = await loadIdentity(config.dataDir)
    identity = stored ? identityToApi(stored) : null
    logTiming('node:identity', identityStart)

    if (stored !== null) {
      const backupKey = deriveBackupKey(fromHex(stored.private_key))
      const backupIntervalMs = config.backupIntervalMs ?? 24 * 60 * 60 * 1000
      timerId = setInterval(() => {
        if (backupInProgress !== null) return
        backupInProgress = (async () => {
          try {
            const backupPath = await createBackupWithKey(config.dataDir, backupKey)
            console.log('Backup automático creado:', backupPath)
          } catch (error) {
            console.error('No se pudo crear el backup automático:', error)
          } finally {
            backupInProgress = null
          }
        })()
      }, backupIntervalMs)
    }

    // Comprobamos que todas las inicializaciones hayan tenido éxito.
    if (nodeId === null || core === null || view === null || swarm === null || state === null) {
      throw new Error('Inicialización fallida: recursos no disponibles')
    }

    // Inicializamos los collection_core locales sin anunciar ni publicar sus topics.
    if (stored !== null) {
      const masterKey = fromHex(stored.private_key)
      const authorKeypair = userKeypairFromMasterKey(masterKey)
      const authorId = identity?.user_id
      if (authorId !== undefined) {
        for (const collection of state.collections.values()) {
          if (collection.deleted) continue
          let collectionCore: Hypercore | null = null
          try {
            try {
              collectionCore = await openExistingCollectionCore(
                config.dataDir,
                collection.collectionId,
                masterKey
              )
            } catch {
              collectionCore = await createCollectionCore(
                config.dataDir,
                collection.collectionId,
                masterKey,
                authorId,
                authorKeypair.publicKey,
                authorKeypair.secretKey,
                state
              )
            }
            const collectionEvents = await readCollectionEvents(collectionCore)
            const collectionState = foldEvents(collectionEvents)
            const collectionCoreId = 'collection:' + collection.collectionId
            const lastProcessedCollectionEvent = await getLastProcessedEvent(view, collectionCoreId)
            const lastCollectionEventIndex = collectionCore.length - 1
            if (lastProcessedCollectionEvent !== lastCollectionEventIndex) {
              await setCollectionState(view, collection.collectionId, collectionState)
              await setLastProcessedEvent(view, collectionCoreId, lastCollectionEventIndex)
            }
            await closeCollectionCore(collectionCore)
            collectionCore = null
          } catch (error) {
            if (collectionCore !== null) {
              try {
                await closeCollectionCore(collectionCore)
              } catch (closeError) {
                console.error('No se pudo cerrar el collection_core de ' + collection.collectionId + ':', closeError)
              }
            }
            console.error('No se pudo inicializar el collection_core de ' + collection.collectionId + '; el arranque continuará:', error)
          }
        }
      }
    } else if (state !== null && [...state.collections.values()].some((collection) => !collection.deleted)) {
      console.error('No se pueden inicializar los collection_core: no hay una identidad local disponible')
    }

    // Capturamos referencias no-null para usarlas en el objeto devuelto.
    const openedCore = core
    const openedView = view
    const openedSwarm = swarm
    const openedNodeId = nodeId
    let currentState = state

    // No iniciamos la limpieza aquí; se inicia en la primera llamada a close().
    return {
      config,
      core: openedCore,
      view: openedView,
      swarm: openedSwarm,
      nodeId: openedNodeId,
      get state() {
        return currentState
      },
      identity,
      async apply(event: DeviceEvent): Promise<void> {
        const eventIndex = await appendEvent(openedCore, event)
        currentState = applyDeviceEvent(currentState, event)
        await setDeviceState(openedView, currentState)
        await setLastProcessedEvent(openedView, 'device', eventIndex)
      },
      close: (): Promise<void> => {
        if (closePromise === null) {
          closePromise = (async () => {
            if (timerId !== null) {
              clearInterval(timerId)
              timerId = null
            }
            const pendingBackup = backupInProgress
            if (pendingBackup !== null) await pendingBackup
            try {
              await openedSwarm.close()
            } finally {
              try {
                await closeMaterializedView(openedView)
              } finally {
                try {
                  await closeDeviceCore(openedCore)
                } finally {
                  await releasePidLock()
                }
              }
            }
          })()
        }
        return closePromise
      },
    }
  } catch (error) {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
    const pendingBackup = backupInProgress
    if (pendingBackup !== null) await pendingBackup
    // Si falló la inicialización, limpiamos los recursos en este orden: swarm, vista, core y lock.
    try {
      if (swarm !== null) {
        await swarm.close()
      }
    } finally {
      try {
        if (view !== null) {
          await closeMaterializedView(view)
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
