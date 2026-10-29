import process from 'bare-process'
import gracedown from 'pear-gracedown'
import open from 'bare-open'
import { createServer } from './api/server.ts'
import { loadConfig } from './node/config.ts'
import { listenWithPortFallback, startNode } from './node/start.ts'
import { version } from './index.ts'

// Primera instrucción ejecutable: reloj monotónico si está disponible, con fallback a Date.now().
const t0 = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now()

// Usa el mismo reloj para todas las fases; no depende de console.time en Bare.
const now = (): number => typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now()
const logTiming = (phase: string, start: number): void => {
  console.log(`[timing] ${phase}: ${Math.round(now() - start)}ms`)
}
let phaseStart = now()
const config = loadConfig()
logTiming('config', phaseStart)

let node: Awaited<ReturnType<typeof startNode>> | null = null
let api: Awaited<ReturnType<typeof createServer>>

phaseStart = now()
try {
  api = await createServer(config, null, false)
  api.port = await listenWithPortFallback(api.server, config.port, config.bind, config.portExplicit, 100)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
  throw error
}
logTiming('http', phaseStart)


if (config.openBrowserOnStart === true) {
  phaseStart = now()
  try {
    await open(`http://localhost:${api.port}`)
  } catch (error) {
    console.warn('No se pudo abrir el navegador:', (error as Error).message)
  }
  logTiming('browser', phaseStart)
}

phaseStart = now()
try {
  node = await startNode(config)
  api.setNode(node)
  const collectionSummary = node.state.collections.size === 0
    ? 'sin colecciones'
    : String(node.state.collections.size) + (node.state.collections.size === 1 ? ' colección' : ' colecciones')
  console.log(`BookmarkNet v${version}: ${collectionSummary}`)
  console.log(`Lotura está lista. Puerto interno: ${api.port}`)
  console.log(`Abre http://localhost:${api.port} en tu navegador.`)
  console.log(`Si usas Docker, usa el puerto mapeado con -p <puerto-host>:${api.port}.`)
} catch (error) {
  console.error('No se pudo iniciar el nodo; la API seguirá en NOT_READY:', (error as Error).message)
}
logTiming('node', phaseStart)
logTiming('total', t0)

gracedown(async () => {
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('El cierre tardó demasiado; forzando la salida.')
      resolve()
    }, 3000)
  })
  const close = (async () => {
    await api.close()
    if (node !== null) await node.close()
  })()
  await Promise.race([close, timeout])
})

await new Promise<void>(() => {})