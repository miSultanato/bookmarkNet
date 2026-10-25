import { loadConfig } from './node/config.ts'
import { startNode } from './node/start.ts'
import { version } from './index.ts'

const config = loadConfig()
const node = await startNode(config)
const collectionName = node.state.collection === null
  ? 'sin colecciones'
  : node.state.collection.name

console.log(`BookmarkNet v${version}: ${collectionName}`)

await new Promise<void>((resolve) => {
  let closing = false

  const shutdown = async () => {
    if (closing) return
    closing = true
    try {
      await node.close()
      process.exitCode = 0
    } catch (error) {
      console.error('Error al cerrar BookmarkNet:', error)
      process.exitCode = 1
    }
    resolve()
  }

  process.on('SIGINT', () => { void shutdown() })
  process.on('SIGTERM', () => { void shutdown() })
})
