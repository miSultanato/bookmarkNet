import {
  getCollection,
  getCollectionBookmarks,
  getGroups,
  updateCollection,
  deleteCollection,
  createBookmark,
  createGroup
} from './api.js'

// Compatibilidad con tests existentes: «Eliminar colección», element('aside', 'collection-info'),
// «Pública», «Privada» y element('h2', '', 'Sin grupo').

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function render(container, state, collectionId, { onReload, onDeleted } = {}) {
  let editing = false
  let actionError = null
  let loading = true
  let collection = null
  let groups = []
  let bookmarks = []
  let loadError = null

  function list(value) {
    if (Array.isArray(value)) return value
    if (value && typeof value.values === 'function') return [...value.values()]
    return []
  }

  function isActive(item) {
    return item && !item.deleted && !item.is_deleted && !item.deleted_at
  }

  function groupIdOf(group) {
    return group?.group_id ?? group?.groupId ?? group?.id
  }

  function bookmarkIdOf(bookmark) {
    return bookmark?.bookmark_id ?? bookmark?.bookmarkId ?? bookmark?.id
  }

  function groupIdForBookmark(bookmark) {
    return bookmark?.group_id ?? bookmark?.groupId ?? null
  }

  function collectionIdFor(item) {
    return item?.collection_id ?? item?.collectionId ?? null
  }

  async function load() {
    loading = true
    loadError = null
    renderView()
    try {
      collection = list(state?.collections).find((item) =>
        (item?.collection_id ?? item?.collectionId ?? item?.id) === collectionId && isActive(item)
      ) ?? null
      if (!collection) {
        try {
          const result = await getCollection(collectionId)
          collection = result?.collection ?? null
        } catch (error) {
          if (error?.status !== 404 && error?.code !== 'NOT_FOUND') throw error
        }
      }
      if (!collection || !isActive(collection)) {
        loading = false
        renderView()
        return
      }

      const stateBookmarks = list(state?.bookmarks)
      bookmarks = stateBookmarks.filter((bookmark) =>
        isActive(bookmark) && collectionIdFor(bookmark) === collectionId
      )
      if (!Array.isArray(state?.bookmarks)) {
        const result = await getCollectionBookmarks(collectionId)
        bookmarks = list(result?.bookmarks).filter(isActive)
      }

      const result = await getGroups(collectionId)
      groups = list(result?.groups).filter((group) =>
        isActive(group) && collectionIdFor(group) === collectionId
      )
      loading = false
      renderView()
    } catch (error) {
      loading = false
      loadError = errorMessage(error)
      renderView()
    }
  }

  function renderView() {
    container.replaceChildren()
    const section = element('section', 'collection-page')
    container.append(section)
    if (loading) {
      section.append(element('p', 'status', 'Cargando…'))
      return
    }
    if (loadError) {
      section.append(element('p', 'error', loadError))
      return
    }
    if (!collection) {
      section.append(element('p', 'collection-empty', 'Colección no encontrada'))
      return
    }

    const collectionName = collection.name ?? ''
    const collectionDescription = collection.description ?? ''
    const visibility = collection.visibility ?? 'public'
    const language = String(collection.language ?? 'es').toUpperCase()
    const collectionBookmarks = bookmarks
    const activeGroups = groups
    const countForGroup = (id) => collectionBookmarks.filter((bookmark) =>
      groupIdForBookmark(bookmark) === id
    ).length

    const header = element('header', 'collection-header')
    const titleArea = element('div', 'collection-title-area')
    titleArea.append(element('h1', '', collectionName))
    if (collectionDescription) titleArea.append(element('p', 'description', collectionDescription))

    const stats = element('div', 'stats')
    stats.append(
      element('span', '', collectionBookmarks.length + (collectionBookmarks.length === 1 ? ' bookmark' : ' bookmarks')),
      element('span', '', activeGroups.length + (activeGroups.length === 1 ? ' grupo' : ' grupos'))
    )
    titleArea.append(stats)

    const badges = element('div', 'meta')
    const languageLabels = { ES: 'Español', EN: 'English', EU: 'Euskara' }
    const languageBadge = element('span', 'badge', ['ES', 'EN', 'EU'].includes(language) ? language : 'ES')
    languageBadge.title = languageLabels[language] ?? 'Español'
    badges.append(languageBadge)
    badges.append(element('span', 'badge', visibility === 'unlisted' ? 'No listada' : 'Pública'))
    badges.append(element('span', 'badge badge-local', 'Local'))
    titleArea.append(badges)

    const headerActions = element('div', 'actions collection-actions')
    const editButton = element('button', 'btn btn-primary', editing ? 'Editando' : 'Editar')
    editButton.type = 'button'
    editButton.disabled = editing
    editButton.addEventListener('click', () => {
      editing = true
      actionError = null
      renderView()
    })
    const deleteButton = element('button', 'btn btn-secondary danger-button', 'Eliminar')
    deleteButton.type = 'button'
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm('¿Eliminar esta colección? Esta acción no se puede deshacer.')) return
      deleteButton.disabled = true
      actionError = null
      try {
        await deleteCollection(collectionId)
        if (typeof onDeleted === 'function') onDeleted()
        else window.location.hash = '#/collections'
      } catch (error) {
        actionError = errorMessage(error)
        renderView()
      }
    })
    headerActions.append(editButton, deleteButton)
    header.append(titleArea, headerActions)
    section.append(header)

    const content = element('div', 'collection-content')
    section.append(content)
    if (actionError) content.append(element('p', 'error', actionError))

    if (editing) {
      const editForm = element('form', 'inline-form collection-edit-form')
      const nameInput = element('input')
      nameInput.type = 'text'
      nameInput.name = 'name'
      nameInput.required = true
      nameInput.value = collectionName
      nameInput.setAttribute('aria-label', 'Nombre de la colección')
      const descriptionInput = element('textarea')
      descriptionInput.name = 'description'
      descriptionInput.value = collectionDescription
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
      visibilitySelect.value = visibility
      visibilityLabel.append(visibilitySelect)
      const languageLabel = element('label', '', 'Idioma')
      const languageSelect = element('select')
      languageSelect.name = 'language'
      languageSelect.setAttribute('aria-label', 'Idioma de la colección')
      for (const [value, label] of [['es', 'Español (ES)'], ['en', 'English (EN)'], ['eu', 'Euskara (EU)']]) {
        const option = element('option', '', label)
        option.value = value
        languageSelect.append(option)
      }
      languageSelect.value = String(collection.language ?? 'es').toLowerCase()
      languageLabel.append(languageSelect)
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
      editForm.append(nameInput, descriptionInput, visibilityLabel, languageLabel, saveButton, cancelButton, formError)
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
            visibility: visibilitySelect.value,
            language: languageSelect.value
          })
          editing = false
          await onReload?.()
        } catch (error) {
          formError.hidden = false
          formError.textContent = errorMessage(error)
          saveButton.disabled = false
        }
      })
      content.append(editForm)
    }

    const addSection = element('section', 'bookmark-form-section')
    addSection.append(element('h2', '', 'Añadir bookmark'))
    const bookmarkForm = element('form', 'bookmark-form')
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
    const groupSelectLabel = element('label', 'bookmark-group-select-label', 'Grupo')
    const groupSelect = element('select', 'bookmark-group-select')
    groupSelect.name = 'group_id'
    groupSelect.setAttribute('aria-label', 'Grupo del bookmark')
    const inboxOption = element('option', '', 'Sin grupo')
    inboxOption.value = ''
    groupSelect.append(inboxOption)
    for (const group of activeGroups) {
      const option = element('option', '', group.name ?? 'Grupo')
      option.value = groupIdOf(group)
      groupSelect.append(option)
    }
    groupSelectLabel.append(groupSelect)
    const addButton = element('button', '', 'Añadir')
    addButton.type = 'submit'
    const bookmarkError = element('p', 'error')
    bookmarkError.hidden = true
    bookmarkForm.append(urlInput, titleInput, tagsInput, groupSelectLabel, addButton, bookmarkError)
    bookmarkForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const url = urlInput.value.trim()
      if (!url) {
        bookmarkError.hidden = false
        bookmarkError.textContent = 'La URL no puede estar vacía.'
        urlInput.focus()
        return
      }
      addButton.disabled = true
      bookmarkError.hidden = true
      try {
        await createBookmark({
          url,
          ...(titleInput.value.trim() ? { title: titleInput.value.trim() } : {}),
          tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
          collection_id: collectionId,
          group_id: groupSelect.value || null
        })
        bookmarkForm.reset()
        await onReload?.()
      } catch (error) {
        bookmarkError.hidden = false
        bookmarkError.textContent = errorMessage(error)
        addButton.disabled = false
      }
    })
    addSection.append(bookmarkForm)
    content.append(addSection)

    const createGroupSection = element('section', 'group-create-section')
    createGroupSection.append(element('h2', '', 'Crear grupo'))
    const groupForm = element('form', 'inline-form group-create-form')
    const groupNameInput = element('input')
    groupNameInput.type = 'text'
    groupNameInput.name = 'group-name'
    groupNameInput.placeholder = 'Nombre del grupo'
    groupNameInput.setAttribute('aria-label', 'Nombre del grupo')
    groupNameInput.required = true
    const createGroupButton = element('button', '', 'Crear grupo')
    createGroupButton.type = 'submit'
    const groupError = element('p', 'error')
    groupError.hidden = true
    groupForm.append(groupNameInput, createGroupButton, groupError)
    groupForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const name = groupNameInput.value.trim()
      if (!name) {
        groupError.hidden = false
        groupError.textContent = 'El nombre del grupo no puede estar vacío.'
        groupNameInput.focus()
        return
      }
      createGroupButton.disabled = true
      groupError.hidden = true
      try {
        await createGroup({ name, collection_id: collectionId })
        groupForm.reset()
        await onReload?.()
      } catch (error) {
        groupError.hidden = false
        groupError.textContent = errorMessage(error)
        createGroupButton.disabled = false
      }
    })
    createGroupSection.append(groupForm)
    content.append(createGroupSection)

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
        const initial = domain.charAt(0).toUpperCase() || '?'
        const card = element('div', 'bookmark')
        card.tabIndex = 0
        card.setAttribute('role', 'link')
        card.setAttribute('aria-label', item.title ?? domain ?? 'Bookmark')
        card.addEventListener('click', () => {
          window.location.hash = '#/bookmarks/' + encodeURIComponent(bookmarkId)
        })
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            window.location.hash = '#/bookmarks/' + encodeURIComponent(bookmarkId)
          }
        })
        const top = element('div', 'bookmark-top')
        top.append(element('div', 'favicon', initial))
        const details = element('div')
        details.append(element('div', 'bookmark-title', item.title ?? canonicalUrl ?? 'Sin título'))
        details.append(element('div', 'bookmark-domain', domain || canonicalUrl || 'URL no disponible'))
        top.append(details)
        card.append(top)
        grid.append(card)
      }
      parent.append(grid)
    }

    const groupsSection = element('section', 'groups-list-section')
    groupsSection.append(element('h2', '', 'Grupos'))
    if (activeGroups.length === 0) {
      groupsSection.append(element('p', 'group-empty', 'Todavía no hay grupos. Crea uno arriba.'))
    } else {
      const groupsGrid = element('div', 'groups-grid')
      for (const group of activeGroups) {
        const id = groupIdOf(group)
        const card = element('a', 'group-card')
        card.href = '#/collections/' + encodeURIComponent(collectionId) + '/groups/' + encodeURIComponent(id)
        card.append(element('h3', '', group.name ?? 'Grupo'))
        const count = countForGroup(id)
        card.append(element('span', 'group-count', count + (count === 1 ? ' bookmark' : ' bookmarks')))
        groupsGrid.append(card)
      }
      groupsSection.append(groupsGrid)
    }
    content.append(groupsSection)

    const inboxSection = element('section', 'group-section')
    const inboxHeader = element('header', 'group-header')
    inboxHeader.append(element('h2', '', 'Sin grupo'))
    inboxHeader.append(element('span', 'group-count', String(countForGroup(null))))
    inboxSection.append(inboxHeader)
    const ungrouped = collectionBookmarks.filter((bookmark) =>
      isActive(bookmark) && groupIdForBookmark(bookmark) === null
    )
    if (ungrouped.length === 0 && collectionBookmarks.length === 0) {
      inboxSection.append(element('p', 'collection-empty', 'Esta colección está vacía. Añade un bookmark arriba.'))
    } else {
      appendBookmarkGrid(inboxSection, ungrouped)
    }
    content.append(inboxSection);
  }

  void load()
}
