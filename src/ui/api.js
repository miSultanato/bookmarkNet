async function request(path, options = {}) {
  const response = await fetch(path, options)
  let body
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const error = new Error(body?.error?.message || `HTTP ${response.status}`)
    if (body?.error?.code !== undefined) error.code = body.error.code
    throw error
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

export async function getCollection(id) {
  return request('/api/v1/collections/' + encodeURIComponent(id))
}

export async function updateCollection(id, { name, description, visibility, language } = {}) {
  const body = {}
  if (name !== undefined) body.name = name
  if (description !== undefined) body.description = description
  if (visibility !== undefined) body.visibility = visibility
  if (language !== undefined) body.language = language
  return request('/api/v1/collections/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function deleteCollection(id) {
  return request('/api/v1/collections/' + encodeURIComponent(id), {
    method: 'DELETE'
  })
}

export async function getBookmarks() {
  return request('/api/v1/bookmarks')
}

export async function getBookmark(id) {
  return request('/api/v1/bookmarks/' + encodeURIComponent(id))
}

export async function updateBookmark(id, { title, description, tags, notes } = {}) {
  const body = {}
  if (title !== undefined) body.title = title
  if (description !== undefined) body.description = description
  if (tags !== undefined) body.tags = tags
  if (notes !== undefined) body.notes = notes
  return request('/api/v1/bookmarks/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function getCollectionBookmarks(collectionId) {
  return request('/api/v1/bookmarks?collection_id=' + encodeURIComponent(collectionId))
}

export async function getGroups(collectionId) {
  return request('/api/v1/groups?collection_id=' + encodeURIComponent(collectionId))
}

export async function createGroup({ name, collection_id } = {}) {
  return request('/api/v1/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, collection_id })
  })
}

export async function deleteGroup(id) {
  return request('/api/v1/groups/' + encodeURIComponent(id), {
    method: 'DELETE'
  })
}

export async function getInboxBookmarks() {
  return request('/api/v1/bookmarks?inbox=true')
}

export async function createBookmark({ url, title, description, tags, collection_id, group_id } = {}) {
  const body = { url, collection_id }
  if (title !== undefined) body.title = title
  if (description !== undefined) body.description = description
  if (tags !== undefined) body.tags = tags
  if (group_id !== undefined) body.group_id = group_id
  return request('/api/v1/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function deleteBookmark(id) {
  return request('/api/v1/bookmarks/' + encodeURIComponent(id), {
    method: 'DELETE'
  })
}

export async function createCollection({ name, description, visibility, language } = {}) {
  const body = { name }
  if (description !== undefined) body.description = description
  if (visibility !== undefined) body.visibility = visibility
  if (language !== undefined) body.language = language
  return request('/api/v1/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function moveBookmark(bookmarkId, { collection_id, group_id } = {}) {
  const body = {}
  if (collection_id !== undefined) body.collection_id = collection_id
  if (group_id !== undefined) body.group_id = group_id
  return request('/api/v1/bookmarks/' + encodeURIComponent(bookmarkId) + '/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function getProfile() {
  return request('/api/v1/profile')
}

export async function updateProfile(changes) {
  return request('/api/v1/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  })
}

export async function getConfig() {
  return request('/api/v1/config')
}
