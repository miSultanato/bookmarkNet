import process from 'bare-process'
import gracedown from 'pear-gracedown'
import open from 'bare-open'
import { createServer } from './api/server.ts'
import { loadConfig } from './node/config.ts'
import { listenWithPortFallback, startNode } from './node/start.ts'
import { version } from './index.ts'

const config = loadConfig()
let node: Awaited<ReturnType<typeof startNode>>

try {
  node = await startNode(config)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
  throw error
}

let api: Awaited<ReturnType<typeof createServer>>

try {
  api = await createServer(config, node, false)
  api.port = await listenWithPortFallback(api.server, config.port, config.bind, config.portExplicit, 100)
} catch (error) {
  await node.close()
  console.error((error as Error).message)
  process.exit(1)
  throw error
}

const collectionSummary = node.state.collections.size === 0
  ? 'sin colecciones'
  : String(node.state.collections.size) + (node.state.collections.size === 1 ? ' colección' : ' colecciones')

console.log(`Lotura escuchando en http://localhost:${api.port}`)
console.log(`BookmarkNet v${version}: ${collectionSummary}`)

if (config.openBrowserOnStart === true) {
  try {
    await open(`http://localhost:${api.port}`)
  } catch (error) {
    console.warn('No se pudo abrir el navegador:', (error as Error).message)
  }
}

gracedown(async () => {
  // Timeout de seguridad: si el cierre se cuelga, resolver para que pear-gracedown reenvíe la señal
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('El cierre tardó demasiado; forzando la salida.')
      resolve()
    }, 3000)
  })
  const close = (async () => {
    await api.close()
    await node.close()
  })()
  await Promise.race([close, timeout])
})

await new Promise<void>(() => {})
