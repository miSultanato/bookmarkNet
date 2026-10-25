import fs from 'bare-fs'
import env from 'bare-env'
import os from 'bare-os'
import test from 'brittle'
import { defaultConfig, loadConfig } from '../src/node/config.ts'

const TMP_DIR = './tmp-test-config'
const CONFIG_PATH = TMP_DIR + '/config.json'

const ENV_KEYS = [
  'BOOKMARKNET_PORT',
  'BOOKMARKNET_DATA_DIR',
  'BOOKMARKNET_LOG_LEVEL',
  'BOOKMARKNET_ALLOWED_HOSTS',
  'BOOKMARKNET_BIND'
]

async function resetTemp(): Promise<void> {
  await fs.rm(TMP_DIR, { recursive: true, force: true })
  await fs.mkdir(TMP_DIR, { recursive: true })
}

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {}
  for (const key of ENV_KEYS) saved[key] = env[key]
  return saved
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = saved[key]
    if (value === undefined) delete env[key]
    else env[key] = value
  }
}

test('loadConfig returns documented defaults when config.json is absent', async (t) => {
  const saved = saveEnv()
  await resetTemp()
  try {
    for (const key of ENV_KEYS) delete env[key]
    const config = loadConfig(CONFIG_PATH)
    const defaults = defaultConfig()
    t.is(config.port, 7575)
    t.is(config.dataDir, defaults.dataDir)
    t.is(config.logLevel, 'info')
    t.is(config.openBrowserOnStart, true)
    t.alike(config.allowedHosts, ['localhost', '127.0.0.1', '[::1]'])
    t.is(config.bind, '127.0.0.1')
    t.is(defaults.port, 7575)
  } finally {
    restoreEnv(saved)
    await fs.rm(TMP_DIR, { recursive: true, force: true })
  }
})

test('loadConfig reads values from an explicit JSON config file', async (t) => {
  const saved = saveEnv()
  await resetTemp()
  try {
    for (const key of ENV_KEYS) delete env[key]
    await fs.writeFile(CONFIG_PATH, JSON.stringify({
      port: 8123,
      data_dir: TMP_DIR + '/data',
      log_level: 'debug',
      open_browser_on_start: false,
      allowed_hosts: ['example.test', 'localhost'],
      bind: '0.0.0.0'
    }))
    const config = loadConfig(CONFIG_PATH)
    t.is(config.port, 8123)
    t.is(config.dataDir, TMP_DIR + '/data')
    t.is(config.logLevel, 'debug')
    t.is(config.openBrowserOnStart, false)
    t.alike(config.allowedHosts, ['example.test', 'localhost'])
    t.is(config.bind, '0.0.0.0')
  } finally {
    restoreEnv(saved)
    await fs.rm(TMP_DIR, { recursive: true, force: true })
  }
})

test('environment variables override JSON values and parse allowed hosts', async (t) => {
  const saved = saveEnv()
  await resetTemp()
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify({
      port: 8123,
      data_dir: TMP_DIR + '/from-json',
      allowed_hosts: ['json.test']
    }))
    env.BOOKMARKNET_PORT = '9001'
    env.BOOKMARKNET_DATA_DIR = TMP_DIR + '/from-env'
    env.BOOKMARKNET_ALLOWED_HOSTS = ' localhost, 127.0.0.1 , example.test '
    const config = loadConfig(CONFIG_PATH)
    t.is(config.port, 9001)
    t.is(config.dataDir, TMP_DIR + '/from-env')
    t.alike(config.allowedHosts, ['localhost', '127.0.0.1', 'example.test'])
  } finally {
    restoreEnv(saved)
    await fs.rm(TMP_DIR, { recursive: true, force: true })
  }
})

test('loadConfig expands a leading tilde to the home directory', async (t) => {
  const saved = saveEnv()
  await resetTemp()
  try {
    for (const key of ENV_KEYS) delete env[key]
    env.BOOKMARKNET_DATA_DIR = '~/.bookmarknet-test/'
    const config = loadConfig()
    t.is(config.dataDir, os.homedir().replace(/\/+$/, '') + '/.bookmarknet-test/')
  } finally {
    restoreEnv(saved)
    await fs.rm(TMP_DIR, { recursive: true, force: true })
  }
})

test('invalid BOOKMARKNET_PORT throws RangeError', async (t) => {
  const saved = saveEnv()
  await resetTemp()
  try {
    env.BOOKMARKNET_DATA_DIR = TMP_DIR
    env.BOOKMARKNET_PORT = 'not-a-port'
    t.exception(() => loadConfig(), RangeError)
  } finally {
    restoreEnv(saved)
    await fs.rm(TMP_DIR, { recursive: true, force: true })
  }
})

test('invalid JSON throws a clear RangeError', async (t) => {
  const saved = saveEnv()
  await resetTemp()
  try {
    await fs.writeFile(CONFIG_PATH, '{ invalid json')
    t.exception(() => loadConfig(CONFIG_PATH), RangeError)
  } finally {
    restoreEnv(saved)
    await fs.rm(TMP_DIR, { recursive: true, force: true })
  }
})
