import process from 'bare-process'
import { createServer } from './api/server.ts'
import { loadConfig } from './node/config.ts'
import { startNode } from './node/start.ts'
import { version } from './index.ts'

const config = loadConfig()
const node = await startNode(config)
let api: Awaited<ReturnType<typeof createServer>>

try {
  api = await createServer(config, config.dataDir)
} catch (error) {
  await node.close()
  throw error
}

const collectionName = node.state.collection === null
  ? 'sin colecciones'
  : node.state.collection.name

console.log(`BookmarkNet v${version} escuchando en el puerto ${api.port}: ${collectionName}`)

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
