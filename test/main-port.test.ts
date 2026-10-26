import http from 'bare-http1'
import type { HTTPServer } from 'bare-http1'
import test from 'brittle'
import { listenWithPortFallback } from '../src/node/start.ts'

function createServer(): HTTPServer {
  return http.createServer(() => {})
}

async function listen(server: HTTPServer, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.once('listening', resolve)
    server.listen(port, '127.0.0.1')
  })
}

async function close(server: HTTPServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve())
  })
}

async function freePort(): Promise<number> {
  const server = createServer()
  await listen(server, 0)
  const address = server.address() as { port: number }
  const port = address.port
  await close(server)
  return port
}

test('listenWithPortFallback returns the requested free port', async (t) => {
  const port = await freePort()
  const server = createServer()
  try {
    t.is(await listenWithPortFallback(server, port, '127.0.0.1', false, 3), port)
  } finally {
    await close(server)
  }
})

test('listenWithPortFallback advances after EADDRINUSE', async (t) => {
  const firstPort = await freePort()
  const occupied = createServer()
  await listen(occupied, firstPort)
  const server = createServer()
  try {
    const actualPort = await listenWithPortFallback(server, firstPort, '127.0.0.1', false, 5)
    t.is(actualPort > firstPort, true, 'a subsequent port is selected')
  } finally {
    await close(server)
    await close(occupied)
  }
})

test('listenWithPortFallback fails after all candidates are occupied', async (t) => {
  const firstPort = await freePort()
  const occupied = [createServer(), createServer()]
  await listen(occupied[0], firstPort)
  await listen(occupied[1], firstPort + 1)
  const server = createServer()
  let message = ''
  try {
    await listenWithPortFallback(server, firstPort, '127.0.0.1', false, 2)
  } catch (error) {
    message = (error as Error).message
  } finally {
    await close(server).catch(() => {})
    await close(occupied[0])
    await close(occupied[1])
  }
  t.is(message, `No se encontró un puerto libre en el rango ${firstPort}-${firstPort + 1}. Fija un puerto en config.json o libera alguno.`)
})

test('listenWithPortFallback does not advance an explicit occupied port', async (t) => {
  const port = await freePort()
  const occupied = createServer()
  await listen(occupied, port)
  const server = createServer()
  let message = ''
  try {
    await listenWithPortFallback(server, port, '127.0.0.1', true, 5)
  } catch (error) {
    message = (error as Error).message
  } finally {
    await close(server).catch(() => {})
    await close(occupied)
  }
  t.is(message, `El puerto ${port} está ocupado. Fíjalo en config.json o libera el puerto.`)
})
