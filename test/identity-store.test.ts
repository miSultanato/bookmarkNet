import fs from 'bare-fs'
import test from 'brittle'
import { identityToApi, hasIdentity, createIdentity, loadIdentity } from '../src/identity/store.ts'
import { fromHex, userIdFromPublicKey } from '../src/ids.ts'

const DATA_DIR = './tmp-test-identity-store'

test('identity store persists a private identity and exposes only its public form', async (t) => {
  await fs.rm(DATA_DIR, { recursive: true, force: true })

  try {
    t.is(await hasIdentity(DATA_DIR), false, 'empty directory has no identity')
    t.is(await loadIdentity(DATA_DIR), null, 'missing identity loads as null')

    const stored = await createIdentity(DATA_DIR)
    t.is(await hasIdentity(DATA_DIR), true, 'identity file exists after creation')
    t.is(/^[0-9a-f]{64}$/.test(stored.private_key), true, 'private key is 32-byte lowercase hex without prefix')
    t.is(/^[0-9a-f]{64}$/.test(stored.public_key), true, 'public key is 32-byte lowercase hex without prefix')
    t.alike(stored.profile, {}, 'new profile is empty')

    const raw = JSON.parse(await fs.readFile(DATA_DIR + '/identity.bmn', 'utf8')) as Record<string, unknown>
    t.is(raw.private_key, stored.private_key, 'file stores private key')
    t.is(raw.public_key, stored.public_key, 'file stores public key')
    t.alike(raw.profile, {}, 'file stores empty profile')

    const loaded = await loadIdentity(DATA_DIR)
    t.alike(loaded, stored, 'stored identity can be loaded')

    let duplicateError: unknown = null
    try {
      await createIdentity(DATA_DIR)
    } catch (error) {
      duplicateError = error
    }
    t.is(duplicateError instanceof RangeError, true, 'creating a second identity throws RangeError')

    const apiIdentity = identityToApi(stored)
    t.is(apiIdentity.user_id, userIdFromPublicKey(fromHex(stored.public_key)), 'API user id is derived from public key')
    t.is(apiIdentity.public_key.startsWith('pk_user_'), true, 'API public key has pk_user_ prefix')
    t.alike(apiIdentity.profile, {}, 'API includes profile')
    t.is(Object.prototype.hasOwnProperty.call(apiIdentity, 'private_key'), false, 'API never includes private key')
  } finally {
    await fs.rm(DATA_DIR, { recursive: true, force: true })
  }
})
