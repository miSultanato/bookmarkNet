import { URL, URLSearchParams } from 'bare-url'

const TRACKING_PARAMS = [
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

/**
 * Canonicalize an absolute HTTP(S) URL according to docs/04-canonicalizacion-url.md.
 *
 * bare-url's WHATWG URL parser already lowercases scheme/host, resolves dot
 * segments in paths, percent-encodes some special characters, and serializes an
 * empty path as "/". Those behaviors cover scheme/host normalization and the
 * empty-path part of steps 1 and 7. Query parameters are handled explicitly
 * below to preserve duplicate-value order. We do not decode/re-encode pathname
 * ourselves, so existing escapes such as "%20" and literal "+" are retained.
 * The parser retains username/password fields, so v1 explicitly clears them.
 */
export function canonicalizeUrl(input: string): string {
  if (typeof input !== 'string') {
    throw new RangeError('URL input must be an absolute http(s) URL')
  }

  try {
  // Use bare-url's non-throwing parser so malformed input is reported
  // consistently as RangeError rather than a parser-specific exception.
  if (!URL.canParse(input)) {
    throw new RangeError('Input is not a parseable absolute URL')
  }
  const url = URL.parse(input)
  if (url === null) {
    throw new RangeError('Input is not a parseable absolute URL')
  }

  // Policy validation precedes the eight canonicalization steps.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RangeError('Only absolute http: and https: URLs are supported')
  }

  // V1 decision: credentials must not contribute to canonical URL identity.
  url.username = ''
  url.password = ''

  // 1. Scheme and host are lowercased by bare-url's WHATWG parser.
  // 2. Remove www. only at the beginning of the hostname.
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4)
  }

  // 3. Drop the fragment.
  url.hash = ''

  // 4. Remove the explicitly listed tracking parameters. V1 always preserves
  // ref and source because the specification does not define tracking values.
  for (const name of TRACKING_PARAMS) {
    url.searchParams.delete(name)
  }

  // 5. All remaining query parameters are retained.
  // 6. Sort by parameter name, preserving original order for duplicate names.
  const entries: Array<{ name: string; value: string; index: number }> = []
  let index = 0
  for (const [name, value] of url.searchParams) {
    entries.push({ name, value, index })
    index++
  }
  entries.sort((a, b) => {
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return a.index - b.index
  })

  const sortedParams = new URLSearchParams()
  for (const entry of entries) {
    sortedParams.append(entry.name, entry.value)
  }
  const query = sortedParams.toString()
  url.search = query === '' ? '' : query

  // 7. WHATWG URL supplies "/" for an empty path. Do not add a slash to
  // non-empty paths; paths with and without a trailing slash remain distinct.
  if (url.pathname === '') {
    url.pathname = '/'
  }

  // 8. Assigning an empty search removes a trailing empty "?" as well.
  // Non-default ports survive URL serialization.
  return url.href
  } catch (cause) {
    if (cause instanceof RangeError) throw cause
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new RangeError('URL inválida: ' + message)
  }
}

/** Return null for malformed or unsupported URLs instead of throwing RangeError. */
export function canonicalizeUrlOrNull(input: string): string | null {
  try {
    return canonicalizeUrl(input)
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}
