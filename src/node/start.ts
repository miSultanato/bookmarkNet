import type Hypercore from 'hypercore'
import type { Config } from './config.ts'
import { closeDeviceCore, openDeviceCore, readAllEvents } from '../storage/device-core.ts'
import type { DeviceState } from '../device-fold.ts'
import { foldDeviceEvents, applyDeviceEvent } from '../device-fold.ts'
import type { DeviceEvent } from '../device-events.ts'

export interface Node {
  config: Config
  core: Hypercore
  state: DeviceState
  apply(event: DeviceEvent): void
  close(): Promise<void>
}

export async function startNode(config: Config): Promise<Node> {
  const core = await openDeviceCore(config.dataDir)
  const events = await readAllEvents(core) as unknown as DeviceEvent[]
  let state = foldDeviceEvents(events)

  return {
    config,
    core,
    get state() {
      return state
    },
    apply(event: DeviceEvent) {
      state = applyDeviceEvent(state, event)
    },
    close: async () => closeDeviceCore(core)
  }
}
