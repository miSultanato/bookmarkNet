import type { SwarmLike } from '../../src/node/start.ts'

export function createFakeSwarm(): SwarmLike {
  return {
    close: async () => {}
  }
}
