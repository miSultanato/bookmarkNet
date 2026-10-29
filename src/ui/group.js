import { getCollection, getCollectionBookmarks, getGroups } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function list(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value.values === 'function') return [...value.values()]
  return []
}

function isActive(item) {
  return item && !item.deleted && !item.is_deleted && !item.deleted_at
}

function collectionIdOf(item) {
  return item?.collection_id ?? item?.collectionId ?? item?.id
}

function groupIdOf(item) {
  return item?.group_id ?? item?.groupId ?? item?.id
}

function bookmarkGroupId(bookmark) {
  return bookmark?.group_id ?? bookmark?.groupId ?? null
}

function bookmarkIdOf(bookmark) {
  return bookmark?.bookmark_id ?? bookmark?.bookmarkId ?? bookmark?.id
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function appendBookmarkGrid(parent, items) {
  if (items.length === 0) {
    parent.append(element('p', 'group-empty', 'Este grupo está vacío.'))
    return
  }
  const grid = element('div', 'bookmarks-grid')
  for (const item of items) {
    const bookmarkId = bookmarkIdOf(item)
    const canonicalUrl = item.canonical_url ?? item.canonicalUrl ?? ''
    let domain = ''
    try {
      domain = new URL(canonicalUrl).hostname
    } catch {
      domain = canonicalUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0].split('@').pop().split(':')[0]
    }
    const card = element('div', 'bookmark')
    card.tabIndex = 0
    card.setAttribute('role', 'link')
    card.setAttribute('aria-label', item.title ?? domain ?? 'Bookmark')
    const openBookmark = () => {
      window.location.hash = '#/bookmarks/' + encodeURIComponent(bookmarkId)
    }
    card.addEventListener('click', openBookmark)
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openBookmark()
      }
    })
    const top = element('div', 'bookmark-top')
    top.append(element('div', 'favicon', domain.charAt(0).toUpperCase() || '?'))
    const details = element('div')
    details.append(element('div', 'bookmark-title', item.title ?? canonicalUrl ?? 'Sin título'))
    details.append(element('div', 'bookmark-domain', domain || canonicalUrl || 'URL no disponible'))
    top.append(details)
    card.append(top)
    grid.append(card)
  }
  parent.append(grid)
}

export function render(container, state, collectionId, groupId, { onReload } = {}) {
  let loading = true
  let loadError = null
  let collection = null
  let group = null
  let bookmarks = []
  let requestId = 0

  async function load() {
    const current = ++requestId
    loading = true
    loadError = null
    renderView()
    try {
      collection = list(state?.collections).find((item) =>
        collectionIdOf(item) === collectionId && isActive(item)
      ) ?? null
      if (!collection) {
        try {
          const result = await getCollection(collectionId)
          collection = result?.collection ?? null
        } catch (error) {
          if (error?.code !== 'NOT_FOUND' && error?.status !== 404) throw error
        }
      }
      if (!collection || !isActive(collection)) {
        loading = false
        renderView()
        return
      }

      const groupsResult = await getGroups(collectionId)
      if (current !== requestId) return
      group = list(groupsResult?.groups).find((item) =>
        groupIdOf(item) === groupId &&
        (item?.collection_id ?? item?.collectionId) === collectionId &&
        isActive(item)
      ) ?? null
      if (!group) {
        loading = false
        renderView()
        return
      }

      bookmarks = list(state?.bookmarks).filter((bookmark) =>
        isActive(bookmark) &&
        (bookmark.collection_id ?? bookmark.collectionId) === collectionId &&
        bookmarkGroupId(bookmark) === groupId
      )
      if (!Array.isArray(state?.bookmarks)) {
        const result = await getCollectionBookmarks(collectionId)
        if (current !== requestId) return
        bookmarks = list(result?.bookmarks).filter((bookmark) =>
          isActive(bookmark) &&
          (bookmark.collection_id ?? bookmark.collectionId) === collectionId &&
          bookmarkGroupId(bookmark) === groupId
        )
      }
      if (current !== requestId) return
      loading = false
      renderView()
    } catch (error) {
      if (current !== requestId) return
      loading = false
      loadError = errorMessage(error)
      renderView()
    }
  }

  function renderView() {
    container.replaceChildren()
    if (loading) {
      container.append(element('p', 'status', 'Cargando…'))
      return
    }
    if (loadError) {
      const section = element('section', 'group-detail-page')
      section.append(element('p', 'error', loadError))
      const back = element('a', 'group-detail-back', 'Volver a la colección')
      back.href = '#/collections/' + encodeURIComponent(collectionId)
      section.append(back)
      container.append(section)
      return
    }
    if (!collection || !group) {
      const section = element('section', 'group-detail-page')
      section.append(element('p', 'collection-empty', 'Grupo no encontrado'))
      const back = element('a', 'group-detail-back', 'Volver a la colección')
      back.href = '#/collections/' + encodeURIComponent(collectionId)
      section.append(back)
      container.append(section)
      return
    }

    const section = element('section', 'group-detail-page')
    const header = element('header', 'group-detail-header')
    const breadcrumb = element('div', 'group-detail-breadcrumb')
    breadcrumb.append(element('span', '', 'Colección: '))
    const collectionLink = element('a', '', collection.name ?? 'Volver a la colección')
    collectionLink.href = '#/collections/' + encodeURIComponent(collectionId)
    breadcrumb.append(collectionLink)
    header.append(breadcrumb)

    const titleRow = element('div', 'group-detail-title-row')
    titleRow.append(element('h1', '', group.name ?? 'Grupo'))
    titleRow.append(element('span', 'group-count', bookmarks.length + (bookmarks.length === 1 ? ' bookmark' : ' bookmarks')))
    header.append(titleRow)

    const back = element('a', 'btn btn-secondary group-detail-back', 'Volver a la colección')
    back.href = '#/collections/' + encodeURIComponent(collectionId)
    header.append(back)
    section.append(header)

    const content = element('div', 'collection-content')
    appendBookmarkGrid(content, bookmarks)
    section.append(content)
    container.append(section)
  }

  void onReload
  void load()
}


