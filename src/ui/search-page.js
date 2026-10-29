import { search } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function idOf(item, ...keys) {
  for (const key of keys) if (item?.[key] !== undefined && item[key] !== null) return item[key]
  return ''
}

function domainOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return String(url ?? '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0].split('@').pop().split(':')[0]
  }
}

export function render(container, state, query) {
  let requestId = 0
  const currentRequest = ++requestId
  container.replaceChildren()
  const page = element('section', 'search-page')
  const header = element('header', 'search-page-header')
  const back = element('button', 'search-page-back', '← Volver')
  back.type = 'button'
  back.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/'
  })
  const heading = element('h1', '', 'Resultados para "' + query + '"')
  header.append(back, heading)
  page.append(header)
  const body = element('div', 'search-page-content')
  body.append(element('p', 'status', 'Buscando…'))
  page.append(body)
  container.append(page)

  if (!String(query ?? '').trim()) {
    body.replaceChildren(element('p', 'search-empty', 'No se encontraron resultados para tu búsqueda.'))
    return
  }

  function appendSection(title, items, renderItem) {
    const section = element('section', 'search-page-section search-section')
    section.append(element('h2', 'search-section-title', title))
    if (!items.length) {
      section.append(element('p', 'search-empty', 'No hay resultados.'))
    } else {
      const listNode = element('div', 'search-result-list')
      for (const item of items) listNode.append(renderItem(item))
      section.append(listNode)
    }
    body.append(section)
  }

  function renderResults(data) {
    body.replaceChildren()
    const collections = list(data?.collections)
    const groups = list(data?.groups)
    const bookmarks = list(data?.bookmarks)
    const knownCollections = list(state?.collections)
    const collectionName = (id) => knownCollections.find((item) =>
      idOf(item, 'collection_id', 'collectionId', 'id') === id
    )?.name ?? id ?? 'Colección'

    appendSection('Colecciones', collections, (item) => {
      const id = idOf(item, 'collection_id', 'collectionId', 'id')
      const card = element('a', 'search-result-card collection-item')
      card.href = '#/collections/' + encodeURIComponent(id)
      card.append(element('h3', '', item.name ?? 'Colección'))
      if (item.description) card.append(element('p', 'collection-description', item.description))
      const count = Number(item.bookmarks_count ?? 0)
      card.append(element('p', 'collection-count', count + (count === 1 ? ' bookmark' : ' bookmarks')))
      return card
    })

    appendSection('Grupos', groups, (item) => {
      const groupId = idOf(item, 'group_id', 'groupId', 'id')
      const collectionId = idOf(item, 'collection_id', 'collectionId')
      const row = element('div', 'search-group-row group-row')
      const groupLink = element('a', 'search-group-link group-row-name', item.name ?? 'Grupo')
      groupLink.href = '#/collections/' + encodeURIComponent(collectionId) + '/groups/' + encodeURIComponent(groupId)
      const collectionLink = element('a', 'search-group-collection', collectionName(collectionId))
      collectionLink.href = '#/collections/' + encodeURIComponent(collectionId)
      collectionLink.addEventListener('click', (event) => event.stopPropagation())
      const count = Number(item.bookmarks_count ?? 0)
      row.append(groupLink, collectionLink, element('span', 'group-count', count + (count === 1 ? ' bookmark' : ' bookmarks')))
      row.tabIndex = 0
      row.setAttribute('role', 'link')
      const openGroup = () => { window.location.hash = groupLink.getAttribute('href') }
      row.addEventListener('click', (event) => {
        if (event.target !== collectionLink) openGroup()
      })
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openGroup()
        }
      })
      return row
    })

    appendSection('Bookmarks', bookmarks, (item) => {
      const id = idOf(item, 'bookmark_id', 'bookmarkId', 'id')
      const url = item.url ?? item.canonical_url ?? item.canonicalUrl ?? ''
      const domain = domainOf(url)
      const card = element('a', 'search-result-card search-bookmark-card bookmark')
      card.href = '#/bookmarks/' + encodeURIComponent(id)
      const top = element('div', 'bookmark-top')
      top.append(element('div', 'favicon', domain.charAt(0).toUpperCase() || '?'))
      const details = element('div', 'bookmark-card-details')
      details.append(element('div', 'bookmark-title', item.title ?? url ?? 'Sin título'))
      details.append(element('div', 'bookmark-domain', domain || url || 'URL no disponible'))
      top.append(details)
      card.append(top)
      return card
    })

    if (collections.length + groups.length + bookmarks.length === 0) {
      body.replaceChildren(element('p', 'search-empty', 'No se encontraron resultados para tu búsqueda.'))
    }
  }

  search(query).then((data) => {
    if (currentRequest !== requestId) return
    renderResults(data)
  }).catch((error) => {
    if (currentRequest !== requestId) return
    body.replaceChildren(element('p', 'error', error instanceof Error ? error.message : 'Error al buscar'))
  })
}
