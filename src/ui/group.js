import {
  getCollection,
  getCollectionBookmarks,
  getGroups,
  deleteGroup,
  createBookmark,
  deleteBookmark
} from './api.js'

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

function appendBookmarkGrid(parent, items, { onDelete } = {}) {
  if (items.length === 0) {
    parent.append(element('p', 'group-empty', 'Este grupo está vacío.'))
    return
  }
  const grid = element('div', 'bookmarks-grid')
  for (const item of items) {
    const bookmarkId = bookmarkIdOf(item)
    const canonicalUrl = item.canonical_url ?? item.canonicalUrl ?? item.url ?? ''
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
    const details = element('div', 'bookmark-card-details')
    details.append(element('div', 'bookmark-title', item.title ?? canonicalUrl ?? 'Sin título'))
    details.append(element('div', 'bookmark-domain', domain || canonicalUrl || 'URL no disponible'))
    top.append(details)
    const actions = element('div', 'bookmark-actions')
    const editButton = element('button', 'edit-button', 'Editar')
    editButton.type = 'button'
    editButton.setAttribute('aria-label', 'Editar bookmark')
    editButton.addEventListener('click', (event) => {
      event.stopPropagation()
      openBookmark()
    })
    editButton.addEventListener('keydown', (event) => event.stopPropagation())
    const deleteButton = element('button', 'delete-button', 'Eliminar')
    deleteButton.type = 'button'
    deleteButton.setAttribute('aria-label', 'Eliminar bookmark')
    deleteButton.addEventListener('click', async (event) => {
      event.stopPropagation()
      if (!window.confirm('¿Eliminar este bookmark? Esta acción no se puede deshacer.')) return
      deleteButton.disabled = true
      try {
        await deleteBookmark(bookmarkId)
        await onDelete?.()
      } catch (error) {
        deleteButton.disabled = false
        const feedback = element('p', 'error bookmark-action-error', errorMessage(error))
        card.append(feedback)
      }
    })
    deleteButton.addEventListener('keydown', (event) => event.stopPropagation())
    actions.append(editButton, deleteButton)
    top.append(actions)
    card.append(top)
    grid.append(card)
  }
  parent.append(grid)
}

export function render(container, state, collectionId, groupId, { onReload } = {}) {
  let loading = true
  let loadError = null
  let actionError = null
  let collection = null
  let group = null
  let bookmarks = []
  let requestId = 0
  let modalOpen = false
  let submitting = false

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

    const groupActions = element('div', 'group-actions')
    const back = element('a', 'btn btn-secondary group-detail-back', 'Volver a la colección')
    back.href = '#/collections/' + encodeURIComponent(collectionId)
    const addButton = element('button', 'btn btn-primary', '+ Añadir bookmark')
    addButton.type = 'button'
    addButton.addEventListener('click', () => {
      modalOpen = true
      actionError = null
      renderView()
    })
    const removeGroupButton = element('button', 'btn btn-secondary delete-button', 'Eliminar grupo')
    removeGroupButton.type = 'button'
    removeGroupButton.addEventListener('click', async () => {
      if (!window.confirm('¿Eliminar este grupo? Esta acción no se puede deshacer.')) return
      removeGroupButton.disabled = true
      actionError = null
      try {
        await deleteGroup(groupId)
        await onReload?.()
        window.location.hash = '#/collections/' + encodeURIComponent(collectionId)
      } catch (error) {
        actionError = errorMessage(error)
        renderView()
      }
    })
    groupActions.append(back, addButton, removeGroupButton)
    header.append(groupActions)
    section.append(header)

    if (actionError) section.append(element('p', 'error', actionError))
    if (modalOpen) section.append(createBookmarkModal())

    const content = element('div', 'collection-content')
    appendBookmarkGrid(content, bookmarks, { onDelete: async () => {
      await onReload?.()
      await load()
    } })
    section.append(content)
    container.append(section)
  }

  function createBookmarkModal() {
    const overlay = element('div', 'modal-overlay')
    overlay.setAttribute('role', 'presentation')
    const panel = element('section', 'modal-content')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', 'Añadir bookmark')
    panel.append(element('h2', '', 'Añadir bookmark al grupo'))

    const formSection = element('div', 'modal-form-section')
    const form = element('form', 'inline-form group-bookmark-form')
    const urlInput = element('input')
    urlInput.type = 'url'
    urlInput.name = 'url'
    urlInput.placeholder = 'https://ejemplo.com'
    urlInput.required = true
    urlInput.setAttribute('aria-label', 'URL del bookmark')
    const titleInput = element('input')
    titleInput.type = 'text'
    titleInput.name = 'title'
    titleInput.placeholder = 'Título (opcional)'
    titleInput.maxLength = 200
    titleInput.setAttribute('aria-label', 'Título')
    const tagsInput = element('input')
    tagsInput.type = 'text'
    tagsInput.name = 'tags'
    tagsInput.placeholder = 'Tags separados por comas'
    tagsInput.setAttribute('aria-label', 'Tags separados por comas')

    const groupLabel = element('label', 'bookmark-group-select-label', 'Grupo')
    const groupSelect = element('select')
    groupSelect.name = 'group_id'
    groupSelect.setAttribute('aria-label', 'Grupo del bookmark')
    for (const item of list(state?.groups).filter((item) => isActive(item) &&
      (item?.collection_id ?? item?.collectionId) === collectionId)) {
      const option = element('option', '', item.name ?? 'Grupo')
      option.value = groupIdOf(item)
      groupSelect.append(option)
    }
    if (!groupSelect.options.length) {
      const option = element('option', '', group.name ?? 'Grupo')
      option.value = groupId
      groupSelect.append(option)
    }
    groupSelect.value = groupId
    groupLabel.append(groupSelect)

    const feedback = element('p', 'error')
    feedback.hidden = true
    const actions = element('div', 'modal-actions')
    const cancel = element('button', 'btn btn-secondary', 'Cancelar')
    cancel.type = 'button'
    cancel.addEventListener('click', () => {
      modalOpen = false
      submitting = false
      renderView()
    })
    const save = element('button', 'btn btn-primary', submitting ? 'Guardando…' : 'Guardar')
    save.type = 'submit'
    save.disabled = submitting
    actions.append(cancel, save)
    form.append(urlInput, titleInput, tagsInput, groupLabel, feedback, actions)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const url = urlInput.value.trim()
      if (!url) {
        feedback.hidden = false
        feedback.textContent = 'La URL no puede estar vacía.'
        urlInput.focus()
        return
      }
      if (titleInput.value.length > 200) {
        feedback.hidden = false
        feedback.textContent = 'El título no puede superar los 200 caracteres.'
        titleInput.focus()
        return
      }
      submitting = true
      save.disabled = true
      feedback.hidden = true
      try {
        await createBookmark({
          url,
          ...(titleInput.value.trim() ? { title: titleInput.value.trim() } : {}),
          tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
          collection_id: collectionId,
          group_id: groupSelect.value || groupId
        })
        modalOpen = false
        submitting = false
        await onReload?.()
        await load()
      } catch (error) {
        submitting = false
        feedback.hidden = false
        feedback.textContent = errorMessage(error)
        save.disabled = false
      }
    })
    formSection.append(form)
    panel.append(formSection)
    overlay.append(panel)
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        modalOpen = false
        submitting = false
        renderView()
      }
    })
    return overlay
  }

  void load()
}
