import http from 'bare-http1'
import fs from 'bare-fs'
import { assets } from '../ui/assets.generated.js'
import type { HTTPServer } from 'bare-http1'
import { utf8Bytes } from '../ids.ts'
import type { Config } from '../node/config.ts'
import type { Node } from '../node/start.ts'
import { handleCreateIdentity, handleExportIdentity, handleGetIdentity, handleImportIdentity } from './identity.ts'
import { handleGetProfile, handleUpdateProfile } from './profile.ts'
import { handleGetConfig } from './config.ts'
import { handleImportHtml } from './import.ts'
import { handleCreateGroup, handleDeleteGroup, handleListGroups, handleMoveBookmarkToGroup } from './groups.ts'
import { handleCreateBookmark, handleDeleteBookmark, handleGetBookmark, handleListBookmarks, handleMoveBookmark, handleReorderBookmark, handleUpdateBookmark } from './bookmarks.ts'
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
  const bookmarkReorderMatch = /^\/api\/v1\/bookmarks\/([^/]+)\/reorder$/.exec(path)
  const bookmarkMoveMatch = /^\/api\/v1\/bookmarks\/([^/]+)\/move$/.exec(path)
  const bookmarkMatch = /^\/api\/v1\/bookmarks\/([^/]+)$/.exec(path)
  const groupMoveMatch = /^\/api\/v1\/groups\/([^/]+)\/move$/.exec(path)
  const groupMatch = /^\/api\/v1\/groups\/([^/]+)$/.exec(path)
  const params: Record<string, string> = {}
  const idMatch = collectionMatch ?? bookmarkReorderMatch ?? bookmarkMoveMatch ?? bookmarkMatch ?? groupMoveMatch ?? groupMatch
  if (idMatch) {
    try {
      params.id = decodeURIComponent(idMatch[1])
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

const STATIC_CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

function sendStaticFile(filePath: string, contentType: string, res: any): void {
  fs.readFile(filePath, (error: any, data: any) => {
    if (error) {
      const status = error.code === 'ENOENT' ? 404 : 500
      sendEmpty(res, status)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(data.length))
    res.end(data)
  })
}

function dispatchStaticRequest(method: string, route: MatchedRoute, res: any): boolean {
  if (method !== 'GET') return false
  const staticAssets = assets as Record<string, string>
  if (route.path === '/') {
    const indexAsset = staticAssets['index.html']
    if (indexAsset === undefined) {
      sendEmpty(res, 404)
      return true
    }
    sendStaticFile(indexAsset, 'text/html; charset=utf-8', res)
    return true
  }
  if (!route.path.startsWith('/assets/')) return false

  const rawAssetPath = route.path.slice('/assets/'.length)
  let assetPath: string
  try {
    assetPath = decodeURIComponent(rawAssetPath)
  } catch {
    sendEmpty(res, 400)
    return true
  }

  if (assetPath.length === 0 || assetPath.includes('..') ||
      assetPath.includes('/') || assetPath.includes('\\') ||
      !/^[A-Za-z0-9._-]+$/.test(assetPath)) {
    sendEmpty(res, 400)
    return true
  }

  const assetFile = staticAssets['assets/' + assetPath] ?? staticAssets[assetPath]
  if (assetFile === undefined) {
    sendEmpty(res, 404)
    return true
  }

  const dot = assetPath.lastIndexOf('.')
  const extension = dot === -1 ? '' : assetPath.slice(dot).toLowerCase()
  const contentType = STATIC_CONTENT_TYPES[extension] ?? 'application/octet-stream'
  sendStaticFile(assetFile, contentType, res)
  return true
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

const MAX_BODY_SIZE = 5 * 1024 * 1024
const PAYLOAD_TOO_LARGE_MESSAGE = 'El body supera el límite de 5 MB'

function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: unknown[] = []
    let totalSize = 0
    let settled = false

    req.on('data', (chunk: unknown) => {
      if (settled) return
      const size = typeof chunk === 'string'
        ? utf8Bytes(chunk).length
        : (chunk as { length?: number; toString(): string }).length ?? utf8Bytes((chunk as { toString(): string }).toString()).length
      totalSize += size
      if (totalSize > MAX_BODY_SIZE) {
        settled = true
        req.destroy()
        reject(new RangeError(PAYLOAD_TOO_LARGE_MESSAGE))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      const payload = chunks.map((chunk) => typeof chunk === 'string' ? chunk : (chunk as { toString(): string }).toString()).join('')
      try {
        resolve(JSON.parse(payload))
      } catch {
        reject(new RangeError('El body debe contener JSON válido'))
      }
    })
    req.on('error', (err: unknown) => {
      if (!settled) reject(err)
    })
  })
}

function sendBodyReadError(res: any, err: unknown): void {
  if (err instanceof RangeError && err.message === PAYLOAD_TOO_LARGE_MESSAGE) {
    sendJson(res, 413, errorBody('PAYLOAD_TOO_LARGE', PAYLOAD_TOO_LARGE_MESSAGE))
    return
  }
  sendJson(res, 400, errorBody('INVALID_JSON', 'El body debe contener JSON válido'))
}

async function dispatchGroupRequest(
  node: Node,
  method: string,
  route: MatchedRoute,
  req: any,
  res: any
): Promise<boolean> {
  const base = '/api/v1/groups'
  if (route.path === base && method === 'GET') {
    const result = await handleListGroups(node, { collection_id: route.query.collection_id })
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
    const result = await handleCreateGroup(node, body as { name: string; collection_id: string })
    sendJson(res, result.status, result.body)
    return true
  }

  if (route.path.startsWith(base + '/') && route.path.endsWith('/move') && method === 'POST' && route.params.id !== undefined) {
    let body: unknown
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, errorBody('INVALID_JSON', 'El body debe contener JSON válido'))
      return true
    }
    const result = await handleMoveBookmarkToGroup(node, route.params.id, body as { bookmark_id: string })
    sendJson(res, result.status, result.body)
    return true
  }

  if (!route.path.startsWith(base + '/') || route.params.id === undefined) return false
  const id = route.params.id
  if (id.length === 0) {
    sendJson(res, 404, errorBody('NOT_FOUND', 'Grupo no encontrado'))
    return true
  }
  if (method === 'DELETE') {
    const result = await handleDeleteGroup(node, id)
    if (result.status === 204) sendEmpty(res, 204)
    else sendJson(res, result.status, result.body)
    return true
  }
  return false
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


async function dispatchBookmarkRequest(
  node: Node,
  method: string,
  route: MatchedRoute,
  req: any,
  res: any
): Promise<boolean> {
  const base = '/api/v1/bookmarks'
  if (route.path === base && method === 'GET') {
    const result = await handleListBookmarks(node, {
      collection_id: route.query.collection_id,
      inbox: route.query.inbox,
      group_id: route.query.group_id,
      tag: route.query.tag,
      q: route.query.q
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
    const result = await handleCreateBookmark(node, body as {
      url: string
      collection_id?: string | null
      title?: string
      description?: string
      tags?: string[]
      notes?: string
      group_id?: string | null
    })
    sendJson(res, result.status, result.body)
    return true
  }

  if (route.path.startsWith(base + '/') && route.path.endsWith('/move') && method === 'POST' && route.params.id !== undefined) {
    let body: unknown
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, errorBody('INVALID_JSON', 'El body debe contener JSON válido'))
      return true
    }
    const result = await handleMoveBookmark(node, route.params.id, body as { collection_id?: string | null; group_id?: string | null })
    sendJson(res, result.status, result.body)
    return true
  }

  if (route.path.endsWith('/reorder') && method === 'POST' && route.params.id !== undefined) {
    let body: unknown
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, errorBody('INVALID_JSON', 'El body debe contener JSON válido'))
      return true
    }
    const result = await handleReorderBookmark(node, route.params.id, body as { group_id: string | null; position: number })
    sendJson(res, result.status, result.body)
    return true
  }

  if (!route.path.startsWith(base + '/') || route.params.id === undefined) return false
  const id = route.params.id
  if (id.length === 0) {
    sendJson(res, 404, errorBody('NOT_FOUND', 'Bookmark no encontrado'))
    return true
  }
  if (method === 'GET') {
    const result = await handleGetBookmark(node, id)
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
    const result = await handleUpdateBookmark(node, id, body as {
      title?: string
      description?: string | null
      tags?: string[]
      notes?: string | null
    })
    sendJson(res, result.status, result.body)
    return true
  }
  if (method === 'DELETE') {
    const result = await handleDeleteBookmark(node, id)
    if (result.status === 204) sendEmpty(res, 204)
    else sendJson(res, result.status, result.body)
    return true
  }
  return false
}

export async function createServer(config: Config, node: Node, listen = true): Promise<ApiServer> {
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host
    const method = (req.method ?? 'GET').toUpperCase()
    const route = matchRoute(req.url)

    if (dispatchStaticRequest(method, route, res)) return

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
      const result = await handleGetIdentity(config.dataDir)
      sendJson(res, result.status, result.body)
      return
    }
    if (method === 'POST' && (route.path === '/api/v1/identity/export' || route.path === '/api/v1/identity/import')) {
      let body: unknown
      try {
        body = await readJsonBody(req)
      } catch (err) {
        sendBodyReadError(res, err)
        return
      }
      const result = route.path === '/api/v1/identity/export'
        ? await handleExportIdentity(config.dataDir, body)
        : await handleImportIdentity(config.dataDir, body)
      if (route.path === '/api/v1/identity/import' && result.status === 201) {
        const identity = (result.body as { identity: NonNullable<Node['identity']> }).identity
        node.identity = identity
      }
      sendJson(res, result.status, result.body)
      return
    }
    if (method === 'POST' && route.path === '/api/v1/identity/create') {
      const result = await handleCreateIdentity(config.dataDir)
      if (result.status === 201) {
        node.identity = result.body as NonNullable<Node['identity']>
      }
      sendJson(res, result.status, result.body)
      return
    }

    try {
      if (method === 'GET' && route.path === '/api/v1/profile') {
        const result = handleGetProfile(node)
        sendJson(res, result.status, result.body)
        return
      }
      if (method === 'PATCH' && route.path === '/api/v1/profile') {
        let body: unknown
        try {
          body = await readJsonBody(req)
        } catch (err) {
          sendBodyReadError(res, err)
          return
      }
        const result = await handleUpdateProfile(node, body)
        sendJson(res, result.status, result.body)
        return
      }
      if (method === 'POST' && route.path === '/api/v1/import/html') {
        let body: unknown
        try {
          body = await readJsonBody(req)
        } catch (err) {
          sendBodyReadError(res, err)
          return
      }
        const result = await handleImportHtml(node, body as { html: string })
        sendJson(res, result.status, result.body)
        return
      }
      if (method === 'GET' && route.path === '/api/v1/config') {
        const result = handleGetConfig(node)
        sendJson(res, result.status, result.body)
        return
      }
      if (await dispatchBookmarkRequest(node, method, route, req, res)) return
      if (await dispatchGroupRequest(node, method, route, req, res)) return
      if (await dispatchCollectionRequest(node, method, route, req, res)) return
    } catch (err) {
      console.error('Error no capturado:', err)
      sendJson(res, 500, errorBody('INTERNAL', 'Error interno del servidor'))
      return
    }

    sendJson(res, 404, errorBody('NOT_FOUND', 'Ruta no encontrada'))
  })

  let port = config.port
  if (listen) {
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
    port = address.port
  }

  return {
    server,
    port,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => error ? reject(error) : resolve())
      })
    }
  }
}
