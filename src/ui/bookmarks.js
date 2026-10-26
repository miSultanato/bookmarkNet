import { createCollection, getInboxBookmarks, moveBookmark } from './api.js'

let activeTab = 'inbox'
let inboxBookmarks = null
let inboxLoading = false
let inboxError = null
let inboxRequest = 0

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function render(container, state, { onReload, initialTab } = {}) {
  activeTab = initialTab === 'collections' ? 'collections' : 'inbox'
  container.replaceChildren()

  const section = element('section', 'bookmarks-page')
  section.append(element('h1', '', 'Mis bookmarks'))

  const tabs = element('div', 'tabs')
  tabs.setAttribute('role', 'tablist')
  const inboxTab = element('button', activeTab === 'inbox' ? 'active' : '', 'Inbox')
  inboxTab.type = 'button'
  inboxTab.setAttribute('role', 'tab')
  inboxTab.setAttribute('aria-selected', String(activeTab === 'inbox'))
  const collectionsTab = element('button', activeTab === 'collections' ? 'active' : '', 'Colecciones')
  collectionsTab.type = 'button'
  collectionsTab.setAttribute('role', 'tab')
  collectionsTab.setAttribute('aria-selected', String(activeTab === 'collections'))
  tabs.append(inboxTab, collectionsTab)

  const content = element('div', 'tab-content')
  section.append(tabs, content)
  container.append(section)

  function switchTab(tab) {
    activeTab = tab
    inboxTab.classList.toggle('active', tab === 'inbox')
    inboxTab.setAttribute('aria-selected', String(tab === 'inbox'))
    collectionsTab.classList.toggle('active', tab === 'collections')
    collectionsTab.setAttribute('aria-selected', String(tab === 'collections'))
    renderContent()
  }

  inboxTab.addEventListener('click', () => switchTab('inbox'))
  collectionsTab.addEventListener('click', () => switchTab('collections'))

  function renderInbox() {
    content.replaceChildren()
    if (inboxLoading) {
      content.append(element('p', 'status', 'Cargando…'))
      return
    }
    if (inboxError) {
      content.append(element('p', 'error', 'Error al cargar el Inbox: ' + inboxError))
      const retry = element('button', '', 'Reintentar')
      retry.type = 'button'
      retry.addEventListener('click', () => loadInbox(true))
      content.append(retry)
      return
    }

    const bookmarks = inboxBookmarks ?? state.inboxBookmarks ?? []
    if (bookmarks.length === 0) {
      content.append(element('p', 'empty', 'Tu Inbox está vacío. Los bookmarks que no organices aparecerán aquí.'))
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
          inboxBookmarks = null
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
    content.append(list)
  }

  function renderCollections() {
    content.replaceChildren()
    if (state.collectionsLoading) {
      content.append(element('p', 'status', 'Cargando…'))
    } else if (state.collectionsError) {
      content.append(element('p', 'error', 'Error al cargar colecciones: ' + state.collectionsError))
      const retry = element('button', '', 'Reintentar')
      retry.type = 'button'
      retry.addEventListener('click', () => onReload?.())
      content.append(retry)
    } else {
      const collections = (state.collections ?? []).filter((collection) => !collection.deleted)
      if (collections.length === 0) {
        content.append(element('p', 'empty', 'Aún no tienes colecciones. Crea una para empezar.'))
      }

      const list = element('div', 'collection-list')
      for (const collection of collections) {
        const item = element('a', 'collection-item')
        item.href = '#/collections/' + encodeURIComponent(collection.collection_id)
        item.append(element('h2', '', collection.name || 'Colección sin nombre'))
        if (collection.description) item.append(element('p', 'collection-description', collection.description))
        const count = (state.bookmarks ?? []).filter((bookmark) =>
          !bookmark.deleted && bookmark.collection_id === collection.collection_id
        ).length
        item.append(element('p', 'collection-count', count + (count === 1 ? ' bookmark' : ' bookmarks')))
        list.append(item)
      }
      content.append(list)
    }

    const form = element('form', 'inline-form')
    const nameInput = element('input')
    nameInput.type = 'text'
    nameInput.name = 'name'
    nameInput.placeholder = 'Nombre de la colección'
    nameInput.required = true
    nameInput.setAttribute('aria-label', 'Nombre de la colección')
    const createButton = element('button', '', 'Crear')
    createButton.type = 'submit'
    const feedback = element('p', 'error')
    feedback.hidden = true
    form.append(nameInput, createButton)
    content.append(form, feedback)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const name = nameInput.value.trim()
      if (!name) {
        feedback.hidden = false
        feedback.textContent = 'El nombre de la colección no puede estar vacío.'
        nameInput.focus()
        return
      }
      createButton.disabled = true
      feedback.hidden = true
      try {
        await createCollection({ name })
        await onReload?.()
      } catch (error) {
        feedback.hidden = false
        feedback.textContent = error instanceof Error ? error.message : String(error)
        createButton.disabled = false
      }
    })
  }

  function renderContent() {
    if (activeTab === 'collections') renderCollections()
    else renderInbox()
  }

  async function loadInbox(force = false) {
    if (inboxLoading || (!force && inboxBookmarks !== null && inboxError === null)) return
    const requestId = ++inboxRequest
    inboxLoading = true
    inboxError = null
    renderContent()
    try {
      const result = await getInboxBookmarks()
      if (requestId !== inboxRequest) return
      inboxBookmarks = result.bookmarks
    } catch (error) {
      if (requestId !== inboxRequest) return
      inboxError = error instanceof Error ? error.message : String(error)
    } finally {
      if (requestId === inboxRequest) {
        inboxLoading = false
        renderContent()
      }
    }
  }

  renderContent()
  if (activeTab === 'inbox') loadInbox()
}
