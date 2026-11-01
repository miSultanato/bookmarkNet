import test from 'brittle'
import {
  generateRecoveryPhrase,
  masterKeyToRecoveryPhrase,
  phraseToMasterKey,
  validateRecoveryPhrase
} from '../src/identity/recovery.ts'
import { BIP39_WORDLIST } from '../src/identity/bip39-wordlist.ts'

const ZERO_ENTROPY_PHRASE = Array(23).fill('abandon').concat('art').join(' ')

test('BIP39 recovery phrase generation and validation use 24 words', (t) => {
  const generated = generateRecoveryPhrase()
  t.is(generated.words.length, 24, 'generation returns 24 words')
  t.is(generated.phrase.split(' ').length, 24, 'phrase contains 24 words')
  t.is(generated.phrase, generated.words.join(' '), 'phrase and word array match')
  t.is(generated.words.every((word) => BIP39_WORDLIST.includes(word as never)), true, 'all words belong to the BIP39 list')
  t.is(validateRecoveryPhrase(generated.phrase), true, 'generated phrase has a valid checksum')

  t.is(validateRecoveryPhrase(ZERO_ENTROPY_PHRASE), true, 'known BIP39 zero-entropy vector is valid')
  t.is(validateRecoveryPhrase(ZERO_ENTROPY_PHRASE.replace('abandon', 'notaword')), false, 'word outside the list is rejected')
  t.is(validateRecoveryPhrase(ZERO_ENTROPY_PHRASE.replace(/ art$/, 'ability')), false, 'invalid checksum is rejected')
  t.is(validateRecoveryPhrase(ZERO_ENTROPY_PHRASE.split(' ').slice(1).join(' ')), false, '23-word phrase is rejected')
  t.is(validateRecoveryPhrase(ZERO_ENTROPY_PHRASE + ' abandon'), false, '25-word phrase is rejected')
})

test('BIP39 phrase converts deterministically to the original 32-byte master key', (t) => {
  const masterKey = phraseToMasterKey(ZERO_ENTROPY_PHRASE)
  t.is(masterKey.length, 32, 'recovered master key has 32 bytes')
  t.is(masterKey.every((byte) => byte === 0), true, 'known zero-entropy vector recovers 32 zero bytes')
  t.is(phraseToMasterKey(ZERO_ENTROPY_PHRASE).toString(), masterKey.toString(), 'same phrase always returns the same master key')

  let invalidError: unknown = null
  try {
    phraseToMasterKey(ZERO_ENTROPY_PHRASE.replace(/ art$/, 'ability'))
  } catch (error) {
    invalidError = error
  }
  t.is(invalidError instanceof RangeError, true, 'invalid checksum throws RangeError')
})

test('BIP39 phrase round-trip preserves an existing user master key exactly', (t) => {
  const masterKey = Uint8Array.from({ length: 32 }, (_, index) => index)
  const generated = masterKeyToRecoveryPhrase(masterKey)
  const restored = phraseToMasterKey(generated.phrase)
  t.is(generated.words.length, 24, 'existing master key is encoded as 24 words')
  t.is(restored.length, 32, 'round-trip returns 32 bytes')
  t.is(restored.every((byte, index) => byte === masterKey[index]), true, 'round-trip preserves every master-key byte')
  t.is(validateRecoveryPhrase(generated.phrase), true, 'round-trip phrase has a valid checksum')
})
