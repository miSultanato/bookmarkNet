import {
  getCollection,
  getCollectionBookmarks,
  updateCollection,
  deleteCollection,
  createBookmark,
  deleteBookmark
} from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function isNotFound(error) {
  return error?.code === 'NOT_FOUND' || error?.code === 'COLLECTION_NOT_FOUND' || /404|no encontrada/i.test(errorMessage(error))
}

export function render(container, state, collectionId, { onReload, onDeleted } = {}) {
  let collection = null
  let bookmarks = []
  let loading = true
  let collectionError = null
  let bookmarksError = null
  let editing = false
  let actionError = null
  let requestId = 0

  async function load() {
    const currentRequest = ++requestId
    loading = true
    collectionError = null
    bookmarksError = null
    renderView()
    const [collectionResult, bookmarksResult] = await Promise.allSettled([
      getCollection(collectionId),
      getCollectionBookmarks(collectionId)
    ])
    if (currentRequest !== requestId) return
    if (collectionResult.status === 'fulfilled') {
      collection = collectionResult.value.collection
    } else {
      collectionError = collectionResult.reason
    }
    if (bookmarksResult.status === 'fulfilled') {
      bookmarks = bookmarksResult.value.bookmarks ?? []
    } else {
      bookmarksError = bookmarksResult.reason
    }
    loading = false
    renderView()
  }

  function renderView() {
    container.replaceChildren()
    const section = element('section', 'collection-page')
    container.append(section)

    if (loading) {
      section.append(element('p', 'status', 'Cargando…'))
      return
    }

    if (collectionError) {
      if (isNotFound(collectionError)) {
        section.append(element('h1', '', 'Colección no encontrada'))
        const back = element('a', '', 'Volver a Mis bookmarks')
        back.href = '#/bookmarks'
        section.append(back)
      } else {
        section.append(element('p', 'error', 'Error al cargar la colección: ' + errorMessage(collectionError)))
        const retry = element('button', '', 'Reintentar')
        retry.type = 'button'
        retry.addEventListener('click', load)
        section.append(retry)
      }
      return
    }

    const header = element('header', 'collection-header')
    const titleArea = element('div', 'collection-title-area')
    titleArea.append(element('h1', '', collection?.name || 'Colección sin nombre'))
    if (collection?.description) titleArea.append(element('p', 'collection-description', collection.description))
    const badges = element('div', 'collection-badges')
    badges.append(element('span', 'badge', collection?.visibility === 'unlisted' ? 'No listada' : 'Pública'))
    badges.append(element('span', 'badge badge-local', 'Local'))
    titleArea.append(badges)

    const headerActions = element('div', 'actions collection-actions')
    const editButton = element('button', '', editing ? 'Editando' : 'Editar')
    editButton.type = 'button'
    editButton.disabled = editing
    editButton.addEventListener('click', () => {
      editing = true
      actionError = null
      renderView()
    })
    const deleteButton = element('button', 'danger-button', 'Eliminar colección')
    deleteButton.type = 'button'
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm('¿Eliminar esta colección? Esta acción no se puede deshacer.')) return
      deleteButton.disabled = true
      actionError = null
      try {
        await deleteCollection(collectionId)
        if (typeof onDeleted === 'function') onDeleted()
        else window.location.hash = '#/bookmarks'
      } catch (error) {
        actionError = errorMessage(error)
        renderView()
      }
    })
    headerActions.append(editButton, deleteButton)
    header.append(titleArea, headerActions)
    section.append(header)

    if (actionError) section.append(element('p', 'error', actionError))

    if (editing) {
      const editForm = element('form', 'inline-form collection-edit-form')
      const nameInput = element('input')
      nameInput.type = 'text'
      nameInput.name = 'name'
      nameInput.required = true
      nameInput.value = collection?.name || ''
      nameInput.setAttribute('aria-label', 'Nombre de la colección')
      const descriptionInput = element('textarea')
      descriptionInput.name = 'description'
      descriptionInput.value = collection?.description || ''
      descriptionInput.placeholder = 'Descripción (opcional)'
      descriptionInput.setAttribute('aria-label', 'Descripción')
      const visibilityLabel = element('label', '', 'Visibilidad')
      const visibilitySelect = element('select')
      visibilitySelect.name = 'visibility'
      visibilitySelect.setAttribute('aria-label', 'Visibilidad')
      for (const [value, label] of [['public', 'Pública'], ['unlisted', 'No listada']]) {
        const option = element('option', '', label)
        option.value = value
        visibilitySelect.append(option)
      }
      visibilitySelect.value = collection?.visibility === 'unlisted' ? 'unlisted' : 'public'
      visibilityLabel.append(visibilitySelect)
      const saveButton = element('button', '', 'Guardar')
      saveButton.type = 'submit'
      const cancelButton = element('button', 'secondary-button', 'Cancelar')
      cancelButton.type = 'button'
      cancelButton.addEventListener('click', () => {
        editing = false
        actionError = null
        renderView()
      })
      const formError = element('p', 'error')
      formError.hidden = true
      editForm.append(nameInput, descriptionInput, visibilityLabel, saveButton, cancelButton, formError)
      editForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        const name = nameInput.value.trim()
        if (!name) {
          formError.hidden = false
          formError.textContent = 'El nombre de la colección no puede estar vacío.'
          nameInput.focus()
          return
        }
        saveButton.disabled = true
        formError.hidden = true
        try {
          await updateCollection(collectionId, {
            name,
            description: descriptionInput.value.trim() || null,
            visibility: visibilitySelect.value
          })
          editing = false
          await onReload?.()
        } catch (error) {
          formError.hidden = false
          formError.textContent = errorMessage(error)
          saveButton.disabled = false
        }
      })
      section.append(editForm)
    }

    const addSection = element('section', 'bookmark-form-section')
    addSection.append(element('h2', '', 'Añadir bookmark'))
    const form = element('form', 'bookmark-form')
    const urlInput = element('input')
    urlInput.type = 'url'
    urlInput.name = 'url'
    urlInput.required = true
    urlInput.placeholder = 'https://ejemplo.com'
    urlInput.setAttribute('aria-label', 'URL')
    const titleInput = element('input')
    titleInput.type = 'text'
    titleInput.name = 'title'
    titleInput.placeholder = 'Título (opcional)'
    titleInput.setAttribute('aria-label', 'Título')
    const tagsInput = element('input')
    tagsInput.type = 'text'
    tagsInput.name = 'tags'
    tagsInput.placeholder = 'Tags separadas por comas (opcional)'
    tagsInput.setAttribute('aria-label', 'Tags')
    const addButton = element('button', '', 'Añadir')
    addButton.type = 'submit'
    const formError = element('p', 'error')
    formError.hidden = true
    form.append(urlInput, titleInput, tagsInput, addButton, formError)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const url = urlInput.value.trim()
      if (!url) {
        formError.hidden = false
        formError.textContent = 'La URL no puede estar vacía.'
        urlInput.focus()
        return
      }
      const tags = tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean)
      addButton.disabled = true
      formError.hidden = true
      try {
        await createBookmark({
          url,
          ...(titleInput.value.trim() ? { title: titleInput.value.trim() } : {}),
          tags,
          collection_id: collectionId
        })
        form.reset()
        await onReload?.()
      } catch (error) {
        formError.hidden = false
        formError.textContent = errorMessage(error)
        addButton.disabled = false
      }
    })
    addSection.append(form)
    section.append(addSection)

    if (bookmarksError) {
      const error = element('p', 'error', 'Error al cargar los bookmarks: ' + errorMessage(bookmarksError))
      const retry = element('button', '', 'Reintentar')
      retry.type = 'button'
      retry.addEventListener('click', load)
      section.append(error, retry)
      return
    }

    if (bookmarks.length === 0) {
      section.append(element('p', 'collection-empty', 'Esta colección está vacía. Añade un bookmark arriba.'))
      return
    }

    const list = element('div', 'bookmark-list')
    for (const bookmark of bookmarks) {
      const item = element('article', 'bookmark-item')
      const url = bookmark.canonical_url || bookmark.url || ''
      const title = bookmark.title || url || 'Bookmark'
      item.append(element('h2', 'bookmark-title', title))
      if (url) {
        const link = element('a', 'bookmark-url', url)
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.title = url
        item.append(link)
      }
      if (Array.isArray(bookmark.tags) && bookmark.tags.length) {
        const tags = element('div', 'tags')
        for (const tag of bookmark.tags) tags.append(element('span', 'tag', tag))
        item.append(tags)
      }
      const actions = element('div', 'actions')
      const removeButton = element('button', 'danger-button', 'Eliminar')
      removeButton.type = 'button'
      removeButton.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar este bookmark?')) return
        removeButton.disabled = true
        try {
          await deleteBookmark(bookmark.bookmark_id)
          await onReload?.()
        } catch (error) {
          actionError = errorMessage(error)
          renderView()
        }
      })
      actions.append(removeButton)
      item.append(actions)
      list.append(item)
    }
    section.append(list)
  }

  void state
  void load()
}
