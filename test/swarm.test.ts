import { test } from 'brittle'
import Hyperswarm from 'hyperswarm'
import { startSwarm } from '../src/p2p/swarm'

const topic = Buffer.from('test-topic')

test('startSwarm', async (t) => {
  let onPeerCalled = false

  const swarm = await startSwarm(topic, () => {
    onPeerCalled = true
  })

  t.ok(typeof swarm.close === 'function')

  try {
    // Ejecutar alguna operación para probar que el swarm está activo sin esperar conexiones reales
    // El test solo verifica que se pueda crear y cerrar correctamente.
  } finally {
    await swarm.close()
  }

  t.ok(onPeerCalled === false) // No esperamos conexiones en este test simple
})

test('startSwarm close no lanza', async (t) => {
  const swarm = await startSwarm(topic, () => {})

  await swarm.close()

  t.pass('close() no lanzó')
})
