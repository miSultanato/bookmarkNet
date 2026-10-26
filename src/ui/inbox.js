import { moveBookmark } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function render(container, state, { onReload } = {}) {
  container.replaceChildren()
  const section = element('section', 'inbox-page')
  section.append(element('h1', '', 'Inbox'))

  if (state.collectionsLoading) {
    section.append(element('p', 'status', 'Cargando…'))
    container.append(section)
    return
  }
  if (state.inboxError) {
    section.append(element('p', 'error', 'Error al cargar el Inbox: ' + state.inboxError))
    const retry = element('button', '', 'Reintentar')
    retry.type = 'button'
    retry.addEventListener('click', () => onReload?.())
    section.append(retry)
    container.append(section)
    return
  }

  const bookmarks = state.inboxBookmarks ?? []
  if (bookmarks.length === 0) {
    section.append(element('p', 'empty', 'Tu Inbox está vacío. Los bookmarks que no organices aparecerán aquí.'))
    container.append(section)
    return
  }

  const list = element('div', 'bookmark-list')
  for (const bookmark of bookmarks) {
    const item = element('article', 'bookmark-item')
    const title = bookmark.title || bookmark.canonical_url || 'Bookmark'
    const titleLink = element('a', 'bookmark-title', title)
    titleLink.href = '#/bookmarks/' + encodeURIComponent(bookmark.bookmark_id)
    item.append(titleLink)

    const url = bookmark.canonical_url || bookmark.url
    if (url) {
      const link = element('a', 'bookmark-url', url)
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.title = url
      item.append(link)
    }

    if (Array.isArray(bookmark.tags) && bookmark.tags.length > 0) {
      const tags = element('div', 'tags')
      for (const tagName of bookmark.tags) tags.append(element('span', 'tag', tagName))
      item.append(tags)
    }

    const moveForm = element('div', 'bookmark-move')
    const select = element('select')
    select.setAttribute('aria-label', 'Colección de destino para ' + title)
    const collections = (state.collections ?? []).filter((collection) => !collection.deleted)
    const placeholder = element('option', '', collections.length ? 'Elige una colección' : 'Crea una colección primero')
    placeholder.value = ''
    placeholder.selected = true
    placeholder.disabled = true
    select.append(placeholder)
    for (const collection of collections) {
      const option = element('option', '', collection.name || collection.collection_id)
      option.value = collection.collection_id
      select.append(option)
    }
    select.disabled = collections.length === 0

    const moveButton = element('button', '', 'Mover')
    moveButton.type = 'button'
    moveButton.disabled = collections.length === 0
    const feedback = element('p', 'error')
    feedback.hidden = true
    moveButton.addEventListener('click', async () => {
      if (!select.value) {
        feedback.hidden = false
        feedback.textContent = 'Selecciona una colección.'
        return
      }
      moveButton.disabled = true
      feedback.hidden = true
      try {
        await moveBookmark(bookmark.bookmark_id, { collection_id: select.value })
        await onReload?.()
      } catch (error) {
        feedback.hidden = false
        feedback.textContent = error instanceof Error ? error.message : String(error)
        moveButton.disabled = false
      }
    })
    moveForm.append(select, moveButton)
    item.append(moveForm, feedback)
    list.append(item)
  }
  section.append(list)
  container.append(section)
}
