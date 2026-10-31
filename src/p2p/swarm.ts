import Hyperswarm from 'hyperswarm'

export interface Swarm {
  close(): Promise<void>
}

export async function startSwarm(topic: Buffer, onPeer: (socket) => void): Promise<Swarm> {
  const swarm = new Hyperswarm()
  
  await swarm.join(topic, { server: true, client: true })
  
  swarm.on('connection', (socket) => {
    onPeer(socket)
  })
  
  return {
    close: async () => {
      await swarm.destroy()
    }
  }
}
