import fs from 'bare-fs'
import test from 'brittle'
import { loadOrCreateNodeId, newId, validateId, writeNodeId } from '../src/node/node-id.ts'

const DATA_DIR = './tmp-test-node-id'

test('newId generates an identifier with the required format', (t) => {
  const id = newId()
  t.is(validateId(id), true, 'generated identifier is valid')
  t.is(id.length, 18, 'identifier has 18 characters')
  t.is(id.startsWith('n_'), true, 'identifier has the n_ prefix')
})

test('validateId accepts valid identifiers and rejects invalid ones', (t) => {
  t.is(validateId('n_0123456789abcdef'), true, 'lowercase hexadecimal identifier is valid')
  t.is(validateId('n_abcdef0123456789'), true, 'another valid identifier is accepted')
  t.is(validateId('n_0123456789abcde'), false, 'short identifier is rejected')
  t.is(validateId('n_0123456789abcdef0'), false, 'long identifier is rejected')
  t.is(validateId('N_0123456789abcdef'), false, 'uppercase prefix is rejected')
  t.is(validateId('n_0123456789abcdeG'), false, 'non-hexadecimal character is rejected')
  t.is(validateId('n_0123456789ABCDEF'), false, 'uppercase hexadecimal is rejected')
  t.is(validateId('n_0123456789abcdef\n'), false, 'newline is not part of the identifier')
})

test('loadOrCreateNodeId creates and persists a missing identifier', async (t) => {
  const dataDir = DATA_DIR + '-missing'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    const id = await loadOrCreateNodeId(dataDir)
    t.is(validateId(id), true, 'new identifier is valid')
    t.is(await fs.readFile(dataDir + '/node_id', 'utf8'), id + '\n', 'file contains the identifier and final newline')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('loadOrCreateNodeId reuses an existing valid identifier', async (t) => {
  const dataDir = DATA_DIR + '-existing'
  const expected = 'n_0123456789abcdef'
  await fs.rm(dataDir, { recursive: true, force: true })
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(dataDir + '/node_id', expected + '\n')

  try {
    t.is(await loadOrCreateNodeId(dataDir), expected, 'existing identifier is returned unchanged')
    t.is(await fs.readFile(dataDir + '/node_id', 'utf8'), expected + '\n', 'existing file is not rewritten')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('loadOrCreateNodeId replaces a corrupt identifier', async (t) => {
  const dataDir = DATA_DIR + '-corrupt'
  await fs.rm(dataDir, { recursive: true, force: true })
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(dataDir + '/node_id', 'not-a-node-id\n')

  try {
    const id = await loadOrCreateNodeId(dataDir)
    t.is(validateId(id), true, 'replacement identifier is valid')
    t.is(id === 'not-a-node-id', false, 'corrupt value is not returned')
    t.is(await fs.readFile(dataDir + '/node_id', 'utf8'), id + '\n', 'corrupt file is replaced')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('writeNodeId stores a valid identifier with mode 0600', async (t) => {
  const dataDir = DATA_DIR + '-permissions'
  const id = 'n_fedcba9876543210'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    await writeNodeId(dataDir, id)
    const stat = await fs.stat(dataDir + '/node_id')
    t.is(await fs.readFile(dataDir + '/node_id', 'utf8'), id + '\n', 'file contains the identifier')
    t.is(stat.mode & 0o777, 0o600, 'file permissions are restricted to the owner')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('writeNodeId rejects an invalid identifier', async (t) => {
  const dataDir = DATA_DIR + '-invalid'
  await fs.rm(dataDir, { recursive: true, force: true })

  try {
    let error: unknown = null
    try {
      await writeNodeId(dataDir, 'invalid')
    } catch (caught) {
      error = caught
    }
    t.is(error instanceof RangeError, true, 'invalid identifier raises RangeError')
    t.is((error as Error).message, 'El node_id tiene un formato inválido')
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
