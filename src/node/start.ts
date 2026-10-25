import type Hypercore from 'hypercore'
import type { Config } from './config.ts'
import { closeDeviceCore, openDeviceCore, readAllEvents } from '../storage/device-core.ts'
import type { DeviceState } from '../device-fold.ts'
import { foldDeviceEvents, applyDeviceEvent } from '../device-fold.ts'
import type { DeviceEvent } from '../device-events.ts'
import { identityToApi, loadIdentity } from '../identity/store.ts'

export type NodeIdentity = ReturnType<typeof identityToApi>

export interface Node {
  config: Config
  core: Hypercore
  state: DeviceState
  identity: NodeIdentity | null
  apply(event: DeviceEvent): void
  close(): Promise<void>
}

export async function startNode(config: Config): Promise<Node> {
  const core = await openDeviceCore(config.dataDir)
  const events = await readAllEvents(core)
  let state = foldDeviceEvents(events)
  const stored = await loadIdentity(config.dataDir)
  const identity = stored ? identityToApi(stored) : null

  return {
    config,
    core,
    get state() {
      return state
    },
    identity,
    apply(event: DeviceEvent) {
      state = applyDeviceEvent(state, event)
    },
    close: async () => closeDeviceCore(core)
  }
}
