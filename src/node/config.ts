import fs from 'bare-fs'
import os from 'bare-os'

export interface Config {
  port: number
  dataDir: string
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  openBrowserOnStart: boolean
  allowedHosts: string[]
  bind: string
}

type JsonConfig = {
  port?: unknown
  data_dir?: unknown
  log_level?: unknown
  open_browser_on_start?: unknown
  allowed_hosts?: unknown
  bind?: unknown
}

function expandHome(path: string): string {
  if (path === '~') return os.homedir()
  if (path.startsWith('~/')) return os.homedir().replace(/\/+$/, '') + path.slice(1)
  return path
}

function defaultDataDir(): string {
  return expandHome('~/.bookmarknet/')
}

export function defaultConfig(): Config {
  return {
    port: 7575,
    dataDir: defaultDataDir(),
    logLevel: 'info',
    openBrowserOnStart: true,
    allowedHosts: ['localhost', '127.0.0.1', '[::1]'],
    bind: '127.0.0.1'
  }
}

function readJson(path: string): JsonConfig | null {
  try {
    const contents = fs.readFileSync(path)
    const parsed = JSON.parse(new TextDecoder().decode(contents)) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new RangeError(`Invalid config JSON at ${path}: expected an object`)
    }
    return parsed as JsonConfig
  } catch (error) {
    if (error instanceof RangeError) throw error
    if (error instanceof SyntaxError) {
      throw new RangeError(`Invalid config JSON at ${path}: ${error.message}`)
    }
    const code = (error as { code?: string }).code
    if (code === 'ENOENT') return null
    throw error
  }
}

function configFilePath(path: string): string {
  return path.replace(/\/+$/, '') + '/config.json'
}

function validPort(value: unknown, source: string): number {
  const port = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new RangeError(`${source} must be a positive integer port`)
  }
  return port
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function hostsValue(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as string[]
  }
  return fallback
}

/**
 * Loads configuration synchronously without creating the data directory.
 * An explicit config path takes precedence; otherwise config.json is read from
 * the environment-selected data directory or the default home directory.
 */
export function loadConfig(configPath?: string): Config {
  const defaults = defaultConfig()
  const env = process.env
  const envDataDir = env.BOOKMARKNET_DATA_DIR
  const initialDataDir = envDataDir ? expandHome(envDataDir) : defaults.dataDir
  const selectedPath = configPath ?? configFilePath(initialDataDir)
  const json = readJson(selectedPath) ?? {}

  const dataDirFromJson = stringValue(json.data_dir, initialDataDir)
  const dataDir = expandHome(envDataDir ?? dataDirFromJson)

  // If data_dir in the first config points elsewhere, consult that directory's
  // config only when no explicit path or data-dir environment override was given.
  let effectiveJson = json
  if (configPath === undefined && !envDataDir && json.data_dir !== undefined) {
    const relocated = readJson(configFilePath(dataDir))
    if (relocated !== null) effectiveJson = { ...json, ...relocated }
  }

  const portFromEnv = env.BOOKMARKNET_PORT
  const port = portFromEnv !== undefined
    ? validPort(portFromEnv, 'BOOKMARKNET_PORT')
    : effectiveJson.port === undefined
      ? defaults.port
      : validPort(effectiveJson.port, 'port')

  const rawLogLevel = env.BOOKMARKNET_LOG_LEVEL ?? effectiveJson.log_level
  const logLevel = rawLogLevel === 'error' || rawLogLevel === 'warn' ||
    rawLogLevel === 'info' || rawLogLevel === 'debug'
    ? rawLogLevel
    : defaults.logLevel

  const rawHosts = env.BOOKMARKNET_ALLOWED_HOSTS
  const allowedHosts = rawHosts !== undefined
    ? rawHosts.split(',').map((host) => host.trim()).filter((host) => host.length > 0)
    : hostsValue(effectiveJson.allowed_hosts, defaults.allowedHosts)

  const openBrowserOnStart = typeof effectiveJson.open_browser_on_start === 'boolean'
    ? effectiveJson.open_browser_on_start
    : defaults.openBrowserOnStart

  return {
    port,
    dataDir,
    logLevel,
    openBrowserOnStart,
    allowedHosts,
    bind: env.BOOKMARKNET_BIND ?? stringValue(effectiveJson.bind, defaults.bind)
  }
}
