import fs from 'bare-fs'
import Hypercore from 'hypercore'
import type { DeviceEvent } from '../device-events.ts'

/**
 * Opens the local, single-writer event log for this device.
 * Bare exposes filesystem operations through the built-in bare-fs module,
 * so this import works without depending on Node.js fs compatibility.
 */
export async function openDeviceCore(dataDir: string): Promise<Hypercore> {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const storagePath = dataDir.replace(/\/+$/, '') + '/device-core'

  const core = new Hypercore(storagePath, { valueEncoding: 'json' })
  await core.ready()
  return core
}

/** Appends an event and returns its zero-based block index. */
export async function appendEvent(core: Hypercore, event: DeviceEvent): Promise<number> {
  await core.append(event)
  return core.length - 1
}

/** Reads every event in append order. */
export async function readAllEvents(core: Hypercore): Promise<DeviceEvent[]> {
  const events: DeviceEvent[] = []
  for (let i = 0; i < core.length; i++) {
    events.push(await core.get(i) as DeviceEvent)
  }
  return events
}

/** Closes the device event log. */
export async function closeDeviceCore(core: Hypercore): Promise<void> {
  await core.close()
}
