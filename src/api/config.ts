import type { Config } from '../node/config.ts'
import type { Node } from '../node/start.ts'

export function apiConfig(config: Config): object {
  return {
    port: config.port,
    logLevel: config.logLevel,
    openBrowserOnStart: config.openBrowserOnStart,
    allowedHosts: [...config.allowedHosts],
    bind: config.bind
  }
}

export function handleGetConfig(node: Node): { status: number; body: unknown } {
  if (node.identity === null) {
    return {
      status: 401,
      body: { error: { code: 'NO_IDENTITY', message: 'Crea o importa una identidad antes de consultar la configuración' } }
    }
  }
  return { status: 200, body: { config: apiConfig(node.config) } }
}
