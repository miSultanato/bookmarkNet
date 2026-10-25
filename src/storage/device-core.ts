import fs from 'bare-fs'
import Hypercore from 'hypercore'
import type { CollectionEvent } from '../events.ts'

/**
 * Opens the local, single-writer event log for this device.
 * Bare exposes filesystem operations through the built-in bare-fs module,
 * so this import works without depending on Node.js fs compatibility.
 */
export async function openDeviceCore(dataDir: string): Promise<Hypercore> {
  await fs.mkdir(dataDir, { recursive: true })
  const storagePath = dataDir.replace(/\/+$/, '') + '/device-core'
  const core = new Hypercore(storagePath, { valueEncoding: 'json' })
  await core.ready()
  return core
}

/** Appends an event and returns its zero-based block index. */
export async function appendEvent(core: Hypercore, event: CollectionEvent): Promise<number> {
  await core.append(event)
  return core.length - 1
}

/** Reads every event in append order. */
export async function readAllEvents(core: Hypercore): Promise<CollectionEvent[]> {
  const events: CollectionEvent[] = []
  for (let i = 0; i < core.length; i++) {
    events.push(await core.get(i) as CollectionEvent)
  }
  return events
}

/** Closes the device event log. */
export async function closeDeviceCore(core: Hypercore): Promise<void> {
  await core.close()
}
