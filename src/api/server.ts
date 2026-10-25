import http from 'bare-http1'
import type { HTTPServer } from 'bare-http1'
import type { Config } from '../node/config.ts'
import { handleCreateIdentity, handleGetIdentity } from './identity.ts'

export interface ApiServer {
  server: HTTPServer
  port: number
  close(): Promise<void>
}

function hostname(host: string): string {
  const value = host.trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? value : value.slice(0, end + 1)
  }
  const firstColon = value.indexOf(':')
  const lastColon = value.lastIndexOf(':')
  return firstColon !== -1 && firstColon === lastColon ? value.slice(0, firstColon) : value
}

function isAllowedHost(host: string | undefined, allowedHosts: string[]): boolean {
  if (!host) return false
  const requested = hostname(host)
  return allowedHosts.some((allowed) => hostname(allowed) === requested)
}

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' ||
    address === '::ffff:127.0.0.1' || address === '[::1]'
}

function sendJson(res: any, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', String(new TextEncoder().encode(payload).length))
  res.end(payload)
}

function errorBody(code: string, message: string): unknown {
  return { error: { code, message } }
}

export async function createServer(config: Config, dataDir: string): Promise<ApiServer> {
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host
    const method = (req.method ?? 'GET').toUpperCase()
    const path = (req.url ?? '/').split('?')[0]

    if (!isAllowedHost(host, config.allowedHosts)) {
      sendJson(res, 421, errorBody('MISDIRECTED_REQUEST', 'Host no permitido'))
      return
    }

    const mutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
    if (mutating) {
      const origin = req.headers.origin
      if (typeof origin === 'string') {
        const match = /^https?:\/\/([^/]+)$/i.exec(origin)
        if (!match || match[1].toLowerCase() !== (host ?? '').toLowerCase()) {
          sendJson(res, 403, errorBody('FORBIDDEN_ORIGIN', 'Origin no coincide con Host'))
          return
        }
      } else if (!isLoopback((req as any).socket?.remoteAddress)) {
        sendJson(res, 403, errorBody('FORBIDDEN_ORIGIN', 'Las mutaciones sin Origin solo se permiten desde loopback'))
        return
      }
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const contentType = req.headers['content-type']
      if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
        sendJson(res, 415, errorBody('UNSUPPORTED_MEDIA_TYPE', 'Content-Type debe ser application/json'))
        return
      }
    }

    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok' })
      return
    }
    if (method === 'GET' && path === '/api/v1/identity') {
      const result = await handleGetIdentity(dataDir)
      sendJson(res, result.status, result.body)
      return
    }
    if (method === 'POST' && path === '/api/v1/identity/create') {
      const result = await handleCreateIdentity(dataDir)
      sendJson(res, result.status, result.body)
      return
    }

    sendJson(res, 404, errorBody('NOT_FOUND', 'Ruta no encontrada'))
  })

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
    server.listen(config.port, config.bind)
  })

  const address = server.address() as { port?: number } | string | null
  if (address === null || typeof address === 'string' || typeof address.port !== 'number') {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    throw new Error('No se pudo determinar el puerto del servidor HTTP')
  }

  return {
    server,
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => error ? reject(error) : resolve())
    })
  }
}
