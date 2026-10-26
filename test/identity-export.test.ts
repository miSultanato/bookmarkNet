import fs from 'bare-fs'
import sodium from 'sodium-native'
import test from 'brittle'
import { exportIdentity, importIdentity } from '../src/identity/export.ts'
import { createIdentity } from '../src/identity/store.ts'

const ROOT = './tmp-test-identity-export'
const PASSWORD = 'correct horse battery staple'

test('identity export encrypts identity and import restores it using JSON Argon2id parameters', async (t) => {
  const source = ROOT + '/source'
  const restored = ROOT + '/restored'
  const wrongPassword = ROOT + '/wrong-password'
  const corrupted = ROOT + '/corrupted'
  const unsupported = ROOT + '/unsupported'
  const existing = ROOT + '/existing'
  await fs.rm(ROOT, { recursive: true, force: true })

  try {
    const original = await createIdentity(source)
    const exported = await exportIdentity(source, PASSWORD)

    t.is(exported.version, 1, 'export format version is 1')
    t.is(/^[A-Za-z0-9+/]+={0,2}$/.test(exported.salt), true, 'salt is base64')
    t.is(/^[A-Za-z0-9+/]+={0,2}$/.test(exported.nonce), true, 'nonce is base64')
    t.is(/^[A-Za-z0-9+/]+={0,2}$/.test(exported.ciphertext), true, 'ciphertext is base64')
    t.is((exported.salt.length / 4) * 3 - (exported.salt.endsWith('==') ? 2 : exported.salt.endsWith('=') ? 1 : 0), sodium.crypto_pwhash_SALTBYTES, 'salt has the sodium-defined length')
    t.is((exported.nonce.length / 4) * 3 - (exported.nonce.endsWith('==') ? 2 : exported.nonce.endsWith('=') ? 1 : 0), sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES, 'nonce has the sodium-defined length')
    t.is(Number.isInteger(exported.opslimit) && exported.opslimit > 0, true, 'opslimit is present')
    t.is(Number.isInteger(exported.memlimit) && exported.memlimit > 0, true, 'memlimit is present')
    t.is(exported.alg, sodium.crypto_pwhash_ALG_ARGON2ID13, 'algorithm is Argon2id13')

    const restoredIdentity = await importIdentity(restored, PASSWORD, exported)
    t.is(restoredIdentity.private_key, original.private_key, 'private key is restored')
    t.is(restoredIdentity.public_key, original.public_key, 'public key is restored')
    t.alike(restoredIdentity.profile, original.profile, 'profile is restored')

    let wrongError: unknown = null
    try {
      await importIdentity(wrongPassword, 'wrong password', exported)
    } catch (error) {
      wrongError = error
    }
    t.is(wrongError instanceof RangeError, true, 'wrong password is rejected')

    const changedCiphertext = exported.ciphertext[0] === 'A'
      ? 'B' + exported.ciphertext.slice(1)
      : 'A' + exported.ciphertext.slice(1)
    let corruptError: unknown = null
    try {
      await importIdentity(corrupted, PASSWORD, { ...exported, ciphertext: changedCiphertext })
    } catch (error) {
      corruptError = error
    }
    t.is(corruptError instanceof RangeError, true, 'corrupted ciphertext is rejected')

    let versionError: unknown = null
    try {
      await importIdentity(unsupported, PASSWORD, { ...exported, version: 2 } as any)
    } catch (error) {
      versionError = error
    }
    t.is(versionError instanceof RangeError, true, 'unknown format version is rejected')

    await createIdentity(existing)
    let existsError: unknown = null
    try {
      await importIdentity(existing, PASSWORD, exported)
    } catch (error) {
      existsError = error
    }
    t.is(existsError instanceof RangeError, true, 'import does not overwrite an existing identity')
  } finally {
    await fs.rm(ROOT, { recursive: true, force: true })
  }
})
