import test from 'brittle'
import { canonicalizeUrl, canonicalizeUrlOrNull } from '../src/canonicalize.ts'
import { resourceIdFromCanonicalUrl } from '../src/ids.ts'

function expectRangeError(t: any, fn: () => unknown): void {
  let thrown: unknown
  try {
    fn()
  } catch (error) {
    thrown = error
  }
  t.ok(thrown instanceof RangeError)
}

test('canonicalizeUrl matches all documented examples exactly', (t) => {
  const cases: Array<[string, string]> = [
    ['https://japan-guide.com', 'https://japan-guide.com/'],
    ['https://japan-guide.com/', 'https://japan-guide.com/'],
    ['https://japan-guide.com/mountains', 'https://japan-guide.com/mountains'],
    ['https://japan-guide.com/mountains/', 'https://japan-guide.com/mountains/'],
    ['https://japan-guide.com/mountains?utm_source=x', 'https://japan-guide.com/mountains'],
    ['https://japan-guide.com/mountains?a=1', 'https://japan-guide.com/mountains?a=1'],
    ['https://japan-guide.com/mountains#x', 'https://japan-guide.com/mountains']
  ]

  for (const [input, expected] of cases) {
    t.is(canonicalizeUrl(input), expected, input)
  }
})

test('step 1 lowercases scheme and host', (t) => {
  t.is(canonicalizeUrl('HTTPS://EXAMPLE.COM/'), 'https://example.com/')
})

test('step 2 removes www. only at the start of the host', (t) => {
  t.is(canonicalizeUrl('https://www.example.com/'), 'https://example.com/')
  t.is(canonicalizeUrl('https://www.example.com.www.test/path'), 'https://example.com.www.test/path')
})

test('step 3 removes fragments', (t) => {
  t.is(canonicalizeUrl('https://example.com/#x'), 'https://example.com/')
})

test('step 4 removes each known tracking parameter', (t) => {
  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'mc_cid',
    'mc_eid'
  ]
  for (const name of trackingParams) {
    t.is(canonicalizeUrl(`https://example.com/?${name}=x`), 'https://example.com/', name)
  }
  t.is(
    canonicalizeUrl('https://example.com/?utm_source=x&keep=1&fbclid=y'),
    'https://example.com/?keep=1'
  )
})

test('step 5 retains non-tracking query parameters', (t) => {
  t.is(canonicalizeUrl('https://example.com/?a=1&b=2'), 'https://example.com/?a=1&b=2')
})

test('step 6 sorts query names and preserves order among duplicate values', (t) => {
  t.is(canonicalizeUrl('https://example.com/?b=2&a=1'), 'https://example.com/?a=1&b=2')
  t.is(
    canonicalizeUrl('https://example.com/?b=1&a=2&a=3'),
    'https://example.com/?a=2&a=3&b=1'
  )
})

test('step 7 uses slash for empty path but does not force a trailing slash', (t) => {
  t.is(canonicalizeUrl('https://example.com'), 'https://example.com/')
  t.is(canonicalizeUrl('https://example.com/path'), 'https://example.com/path')
  t.is(canonicalizeUrl('https://example.com/path/'), 'https://example.com/path/')
  t.ok(canonicalizeUrl('https://example.com/path') !== canonicalizeUrl('https://example.com/path/'))
})

test('step 8 removes an empty trailing query marker', (t) => {
  t.is(canonicalizeUrl('https://example.com/?'), 'https://example.com/')
})

test('v1 strips credentials and canonicalizes credentialed URLs identically', (t) => {
  const withCredentials = canonicalizeUrl('https://user:pass@example.com/path')
  const withoutCredentials = canonicalizeUrl('https://example.com/path')
  t.is(withCredentials, 'https://example.com/path')
  t.is(withCredentials, withoutCredentials)
  t.is(resourceIdFromCanonicalUrl(withCredentials), resourceIdFromCanonicalUrl(withoutCredentials))
})

test('v1 accepts only absolute HTTP and HTTPS URLs', (t) => {
  expectRangeError(t, () => canonicalizeUrl('mailto:foo@example.com'))
  expectRangeError(t, () => canonicalizeUrl('ftp://example.com/file'))
  expectRangeError(t, () => canonicalizeUrl('file:///etc/passwd'))
  expectRangeError(t, () => canonicalizeUrl('example.com/path'))
})

test('v1 preserves non-standard ports', (t) => {
  t.is(canonicalizeUrl('https://example.com:8080/path'), 'https://example.com:8080/path')
})

test('v1 preserves path encoding and literal plus signs', (t) => {
  t.is(canonicalizeUrl('https://example.com/a%20b'), 'https://example.com/a%20b')
  t.is(canonicalizeUrl('https://example.com/a+b'), 'https://example.com/a+b')
})

test('v1 always retains ref and source parameters', (t) => {
  t.is(
    canonicalizeUrl('https://example.com/?ref=foo&source=bar'),
    'https://example.com/?ref=foo&source=bar'
  )
})

test('canonicalization is idempotent for representative URLs', (t) => {
  const inputs = [
    'HTTPS://WWW.EXAMPLE.COM/',
    'https://example.com/path#fragment',
    'https://example.com/?utm_source=x&b=1&a=2',
    'https://example.com/?b=1&a=2&a=3',
    'https://user:pass@example.com:8080/a%20b?source=bar&ref=foo',
    'https://example.com/a+b'
  ]
  for (const input of inputs) {
    const once = canonicalizeUrl(input)
    t.is(canonicalizeUrl(once), once, input)
  }
})

test('canonicalizeUrl throws RangeError for unparseable inputs', (t) => {
  expectRangeError(t, () => canonicalizeUrl('no es una url'))
  expectRangeError(t, () => canonicalizeUrl(''))
  expectRangeError(t, () => canonicalizeUrl('://'))
})

test('malformed percent escapes always produce RangeError and null fallback', (t) => {
  const input = 'https://example.com/path?q=%ZZ'
  let thrown: unknown
  try {
    canonicalizeUrl(input)
  } catch (error) {
    thrown = error
  }
  t.ok(thrown instanceof RangeError, 'malformed percent escape throws RangeError')
  t.is(canonicalizeUrlOrNull(input), null, 'non-throwing helper returns null for malformed percent escape')
})

test('canonicalizeUrlOrNull returns null for invalid inputs', (t) => {
  t.is(canonicalizeUrlOrNull('no es una url'), null)
  t.is(canonicalizeUrlOrNull(''), null)
  t.is(canonicalizeUrlOrNull('://'), null)
  t.is(canonicalizeUrlOrNull('mailto:foo@example.com'), null)
})

test('canonicalizeUrlOrNull matches canonicalizeUrl for valid inputs', (t) => {
  const inputs = [
    'https://japan-guide.com',
    'HTTPS://WWW.EXAMPLE.COM/path?b=2&a=1#part',
    'https://user:pass@example.com:8080/a%20b?source=bar'
  ]
  for (const input of inputs) {
    t.is(canonicalizeUrlOrNull(input), canonicalizeUrl(input), input)
  }
})

// --- Nuevos tests basados en el análisis de Cherry para segmentos "." y ".." ---

test('1. Normalización de segmentos "."', (t) => {
  t.is(canonicalizeUrl('https://example.com/a/./b'), 'https://example.com/a/b')
  t.is(canonicalizeUrl('https://example.com/./a/b'), 'https://example.com/a/b')
  t.is(canonicalizeUrl('https://example.com/a/b/.'), 'https://example.com/a/b/')
})

test('2. Normalización de segmentos ".."', (t) => {
  t.is(canonicalizeUrl('https://example.com/a/b/../c'), 'https://example.com/a/c')
  t.is(canonicalizeUrl('https://example.com/a/b/../../c'), 'https://example.com/c')
  t.is(canonicalizeUrl('https://example.com/a/../'), 'https://example.com/')
})

test('3. Igualdad de canonical_url entre rutas equivalentes con "." y ".."', (t) => {
  const url1 = canonicalizeUrl('https://example.com/a/b/../c')
  const url2 = canonicalizeUrl('https://example.com/a/./c')
  t.is(url1, url2)
})

test('4. Igualdad de resource_id entre rutas equivalentes con "." y ".."', (t) => {
  const urlWithDotDot = canonicalizeUrl('https://example.com/a/b/../c')
  const urlWithDot = canonicalizeUrl('https://example.com/a/./c')
  const canonicalUrl = 'https://example.com/a/c'

  const expectedResourceId = resourceIdFromCanonicalUrl(canonicalUrl)

  t.is(urlWithDotDot, canonicalUrl)
  t.is(urlWithDot, canonicalUrl)
  t.is(resourceIdFromCanonicalUrl(urlWithDotDot), expectedResourceId)
  t.is(resourceIdFromCanonicalUrl(urlWithDot), expectedResourceId)
})

test('5. Idempotencia con segmentos dot-path', (t) => {
  const inputs = [
    'https://example.com/a/./b/../c',
    'https://example.com/a/b/../../c',
    'https://example.com/foo/bar/./baz/../'
  ]
  for (const input of inputs) {
    const once = canonicalizeUrl(input)
    t.is(canonicalizeUrl(once), once, input)
  }
})
