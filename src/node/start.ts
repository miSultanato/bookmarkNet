import type Hypercore from 'hypercore'
import type { Config } from './config.ts'
import { closeDeviceCore, openDeviceCore, readAllEvents } from '../storage/device-core.ts'
import { foldEvents } from '../fold.ts'
import type { CollectionState } from '../fold.ts'

export interface Node {
  config: Config
  core: Hypercore
  state: CollectionState
  close(): Promise<void>
}

export async function startNode(config: Config): Promise<Node> {
  const core = await openDeviceCore(config.dataDir)
  const events = await readAllEvents(core)
  const state = foldEvents(events)

  return {
    config,
    core,
    state,
    close: async () => closeDeviceCore(core)
  }
}
