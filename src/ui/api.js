async function request(path, options = {}) {
  const response = await fetch(path, options)
  let body
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message = body?.error?.message || `HTTP ${response.status}`
    throw new Error(message)
  }

  return body
}

export async function getIdentity() {
  return request('/api/v1/identity')
}

export async function createIdentity() {
  return request('/api/v1/identity/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
}

export async function getCollections() {
  return request('/api/v1/collections')
}

export async function getBookmarks() {
  return request('/api/v1/bookmarks')
}

export async function getInboxBookmarks() {
  return request('/api/v1/bookmarks?inbox=true')
}

export async function createCollection({ name, description, visibility } = {}) {
  const body = { name }
  if (description !== undefined) body.description = description
  if (visibility !== undefined) body.visibility = visibility
  return request('/api/v1/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function moveBookmark(bookmarkId, { collection_id }) {
  return request('/api/v1/bookmarks/' + encodeURIComponent(bookmarkId) + '/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection_id })
  })
}
