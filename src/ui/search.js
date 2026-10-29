import { search } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function initSearch({ getCollections = () => [] } = {}) {
  const input = document.querySelector('.search')
  const results = document.querySelector('#search-results')
  const container = document.querySelector('.search-container')
  if (!input || !results || !container) return

  let debounceTimer = null
  let requestNumber = 0

  function hide() {
    results.hidden = true
  }

  function showMessage(message) {
    results.replaceChildren(element('p', 'search-message', message))
    results.hidden = false
  }

  function appendSection(title, items, renderItem) {
    if (!items.length) return
    const section = element('section', 'search-section')
    section.append(element('h2', 'search-section-title', title))
    for (const item of items) section.append(renderItem(item))
    results.append(section)
  }

  function resultLink(title, detail, href) {
    const link = element('a', 'search-item')
    link.href = href
    link.setAttribute('role', 'option')
    link.append(element('span', 'search-item-title', title || 'Sin título'))
    if (detail) link.append(element('span', 'search-item-detail', detail))
    link.addEventListener('click', hide)
    return link
  }

  function renderResults(data) {
    results.replaceChildren()
    const collections = Array.isArray(data?.collections) ? data.collections : []
    const groups = Array.isArray(data?.groups) ? data.groups : []
    const bookmarks = Array.isArray(data?.bookmarks) ? data.bookmarks : []
    const collectionList = getCollections()
    const collectionName = (id) => {
      const collection = collectionList.find((item) =>
        (item.collection_id ?? item.collectionId ?? item.id) === id
      )
      return collection?.name || id || 'Colección'
    }

    appendSection('Colecciones', collections, (item) => resultLink(
      item.name,
      String(item.bookmarks_count ?? 0) + (item.bookmarks_count === 1 ? ' bookmark' : ' bookmarks'),
      '#/collections/' + encodeURIComponent(item.collection_id)
    ))
    appendSection('Grupos', groups, (item) => resultLink(
      item.name,
      collectionName(item.collection_id),
      '#/collections/' + encodeURIComponent(item.collection_id) + '/groups/' + encodeURIComponent(item.group_id)
    ))
    appendSection('Bookmarks', bookmarks, (item) => resultLink(
      item.title,
      item.url,
      '#/bookmarks/' + encodeURIComponent(item.bookmark_id)
    ))

    if (!results.childElementCount) showMessage('No se encontraron resultados')
    else results.hidden = false
  }

  input.addEventListener('input', () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    const query = input.value.trim()
    const currentRequest = ++requestNumber
    if (!query) {
      hide()
      results.replaceChildren()
      return
    }

    debounceTimer = setTimeout(async () => {
      showMessage('Buscando…')
      try {
        const data = await search(query)
        if (currentRequest !== requestNumber || input.value.trim() !== query) return
        renderResults(data)
      } catch {
        if (currentRequest !== requestNumber || input.value.trim() !== query) return
        showMessage('Error al buscar')
      }
    }, 300)
  })

  document.body.addEventListener('click', (event) => {
    if (!container.contains(event.target)) hide()
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      requestNumber += 1
      hide()
      const query = input.value.trim()
      if (query) window.location.hash = '#/search?q=' + encodeURIComponent(query)
      return
    }
    if (event.key !== 'Escape') return
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    requestNumber += 1
    input.value = ''
    results.replaceChildren()
    hide()
  })
}
