import process from 'bare-process'
import open from 'bare-open'
import { createServer } from './api/server.ts'
import { loadConfig } from './node/config.ts'
import { listenWithPortFallback, startNode } from './node/start.ts'
import { version } from './index.ts'

const config = loadConfig()
const node = await startNode(config)
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

await new Promise<void>((resolve) => {
  let closing = false

  const shutdown = async () => {
    if (closing) return
    closing = true
    try {
      await api.close()
      await node.close()
      process.exit(0)
    } catch (error) {
      console.error('Error al cerrar BookmarkNet:', error)
      process.exit(1)
    } finally {
      resolve()
    }
  }

  process.on('SIGINT', () => { void shutdown() })
  process.on('SIGTERM', () => { void shutdown() })
})
