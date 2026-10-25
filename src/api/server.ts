import http from 'bare-http1'
import type { HTTPServer } from 'bare-http1'
import { utf8Bytes } from '../ids.ts'
import type { Config } from '../node/config.ts'
import type { Node } from '../node/start.ts'
import { handleCreateIdentity, handleGetIdentity } from './identity.ts'
import {
  handleCreateCollection,
  handleDeleteCollection,
  handleGetCollection,
  handleListCollections,
  handleUpdateCollection
} from './collections.ts'

export interface ApiServer {
  server: HTTPServer
  port: number
  close(): Promise<void>
}

interface MatchedRoute {
  path: string
  query: Record<string, string>
  params: Record<string, string>
}

function matchRoute(url: string | undefined): MatchedRoute {
  const rawUrl = url ?? '/'
  const question = rawUrl.indexOf('?')
  const path = question === -1 ? rawUrl : rawUrl.slice(0, question)
  const query: Record<string, string> = {}
  if (question !== -1) {
    for (const part of rawUrl.slice(question + 1).split('&')) {
      if (part.length === 0) continue
      const equal = part.indexOf('=')
      const key = decodeURIComponent((equal === -1 ? part : part.slice(0, equal)).replace(/\+/g, ' '))
      const value = decodeURIComponent((equal === -1 ? '' : part.slice(equal + 1)).replace(/\+/g, ' '))
      query[key] = value
    }
  }
  const collectionMatch = /^\/api\/v1\/collections\/([^/]+)$/.exec(path)
  const params: Record<string, string> = {}
  if (collectionMatch) {
    try {
      params.id = decodeURIComponent(collectionMatch[1])
    } catch {
      params.id = ''
    }
  }
  return { path, query, params }
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
  res.setHeader('Content-Length', String(utf8Bytes(payload).length))
  res.end(payload)
}

function sendEmpty(res: any, status: number): void {
  res.statusCode = status
  res.end()
}

function errorBody(code: string, message: string): unknown {
  return { error: { code, message } }
}

function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let payload = ''
    req.on('data', (chunk: unknown) => {
      payload += typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(payload))
      } catch {
        reject(new RangeError('El body debe contener JSON válido'))
      }
    })
    req.on('error', reject)
  })
}

async function dispatchCollectionRequest(
  node: Node,
  method: string,
  route: MatchedRoute,
  req: any,
  res: any
): Promise<boolean> {
  const base = '/api/v1/collections'
  if (route.path === base && method === 'GET') {
    const result = await handleListCollections(node, {
      visibility: route.query.visibility,
      owner: route.query.owner
    })
    sendJson(res, result.status, result.body)
    return true
  }

  if (route.path === base && method === 'POST') {
    let body: unknown
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, errorBody('INVALID_JSON', 'El body debe contener JSON válido'))
      return true
    }
    const result = await handleCreateCollection(node, body as { name: string; description?: string; visibility?: 'public' | 'unlisted' })
    sendJson(res, result.status, result.body)
    return true
  }

  if (!route.path.startsWith(base + '/') || route.params.id === undefined) return false
  const id = route.params.id
  if (id.length === 0) {
    sendJson(res, 404, errorBody('NOT_FOUND', 'Colección no encontrada'))
    return true
  }

  if (method === 'GET') {
    const result = await handleGetCollection(node, id)
    sendJson(res, result.status, result.body)
    return true
  }
  if (method === 'PATCH') {
    let body: unknown
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, errorBody('INVALID_JSON', 'El body debe contener JSON válido'))
      return true
    }
    const result = await handleUpdateCollection(node, id, body as { name?: string; description?: string | null; visibility?: 'public' | 'unlisted' })
    sendJson(res, result.status, result.body)
    return true
  }
  if (method === 'DELETE') {
    const result = await handleDeleteCollection(node, id)
    if (result.status === 204) sendEmpty(res, 204)
    else sendJson(res, result.status, result.body)
    return true
  }
  return false
}

export async function createServer(config: Config, node: Node): Promise<ApiServer> {
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host
    const method = (req.method ?? 'GET').toUpperCase()
    const route = matchRoute(req.url)

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

    if (method === 'GET' && route.path === '/health') {
      sendJson(res, 200, { status: 'ok' })
      return
    }
    if (method === 'GET' && route.path === '/api/v1/identity') {
      const result = await handleGetIdentity(dataDir)
      sendJson(res, result.status, result.body)
      return
    }
    if (method === 'POST' && route.path === '/api/v1/identity/create') {
      const result = await handleCreateIdentity(dataDir)
      if (result.status === 201 && result.body !== null && typeof result.body === 'object' &&
        typeof (result.body as { user_id?: unknown }).user_id === 'string') {
        node.identity = result.body as NonNullable<Node['identity']>
      }
      sendJson(res, result.status, result.body)
      return
    }

    try {
      if (await dispatchCollectionRequest(node, method, route, req, res)) return
    } catch {
      sendJson(res, 500, errorBody('INTERNAL', 'Error interno del servidor'))
      return
    }

    sendJson(res, 404, errorBody('NOT_FOUND', 'Ruta no encontrada'))
  })

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
      server.listen(config.port, config.bind)
    })
  } catch (error) {
    throw error
  }

  const address = server.address() as { port?: number } | string | null
  if (address === null || typeof address === 'string' || typeof address.port !== 'number') {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    throw new Error('No se pudo determinar el puerto del servidor HTTP')
  }

  return {
    server,
    port: address.port,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => error ? reject(error) : resolve())
      })
    }
  }
}
