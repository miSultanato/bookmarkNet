import fs from 'bare-fs'
import sodium from 'sodium-native'

const NODE_ID_PATTERN = /^n_[0-9a-f]{16}$/

function nodeIdPath(dataDir: string): string {
  return dataDir.replace(/\/+$/, '') + '/node_id'
}

/** Genera un identificador nuevo para este dispositivo. */
export function newId(): string {
  const bytes = new Uint8Array(8)
  sodium.randombytes_buf(bytes)
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return 'n_' + hex
}

/** Comprueba el formato del identificador, sin el salto de línea del archivo. */
export function validateId(id: string): boolean {
  return NODE_ID_PATTERN.test(id)
}

/** Escribe el identificador con permisos privados para el usuario. */
export async function writeNodeId(dataDir: string, id: string): Promise<void> {
  if (!validateId(id)) {
    throw new RangeError('El node_id tiene un formato inválido')
  }

  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const path = nodeIdPath(dataDir)
  await fs.writeFile(path, id + '\n', { mode: 0o600 })
  await fs.chmod(path, 0o600)
}

/** Carga el node_id persistido o genera uno nuevo si falta o está corrupto. */
export async function loadOrCreateNodeId(dataDir: string): Promise<string> {
  const path = nodeIdPath(dataDir)
  try {
    const contents = await fs.readFile(path, 'utf8')
    if (contents.endsWith('\n')) {
      const id = contents.slice(0, -1)
      if (validateId(id)) return id
    }
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }

  const id = newId()
  await writeNodeId(dataDir, id)
  return id
}
