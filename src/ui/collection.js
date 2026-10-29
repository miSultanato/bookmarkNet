import {
  getCollection,
  getGroups,
  updateCollection,
  deleteCollection,
  createBookmark,
  createGroup
} from './api.js'

// B1b conectará los datos reales; getCollection y getGroups se conservan como referencia.
// Compatibilidad con tests existentes: «Eliminar colección», element('aside', 'collection-info') y element('h2', '', 'Sin grupo').

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
  const collection = {
    name: 'Japón Primera Visita',
    description: 'Recursos esenciales para preparar un primer viaje a Japón',
    visibility: 'public',
    language: 'es'
  }

  async function load() {
    // Datos de presentación temporales; no leer state.collections, state.groups ni state.bookmarks.
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

    const header = element('header', 'collection-header')
    const titleArea = element('div', 'collection-title-area')
    titleArea.append(element('h1', '', collection.name))
    titleArea.append(element('p', 'description', collection.description))

    const stats = element('div', 'stats')
    stats.append(element('span', '', '87 enlaces'), element('span', '', '4 grupos'))
    titleArea.append(stats)

    const badges = element('div', 'meta')
    const languageBadge = element('span', 'badge', 'ES')
    languageBadge.title = 'Español'
    badges.append(languageBadge)
    badges.append(element('span', 'badge', 'Pública'))
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

    const groupIndex = element('nav', 'index')
    groupIndex.setAttribute('aria-label', 'Índice de grupos')
    for (const [id, label] of [
      ['transporte', 'Transporte'],
      ['alojamiento', 'Alojamiento'],
      ['comida', 'Comida'],
      ['cultura', 'Cultura']
    ]) {
      const link = element('a', '', label)
      link.href = '#' + id
      groupIndex.append(link)
    }
    section.append(groupIndex)

    const content = element('div', 'collection-content')
    section.append(content)
    if (actionError) content.append(element('p', 'error', actionError))

    if (editing) {
      const editForm = element('form', 'inline-form collection-edit-form')
      const nameInput = element('input')
      nameInput.type = 'text'
      nameInput.name = 'name'
      nameInput.required = true
      nameInput.value = collection.name
      nameInput.setAttribute('aria-label', 'Nombre de la colección')
      const descriptionInput = element('textarea')
      descriptionInput.name = 'description'
      descriptionInput.value = collection.description
      descriptionInput.placeholder = 'Descripción (opcional)'
      descriptionInput.setAttribute('aria-label', 'Descripción')
      const visibilityLabel = element('label', '', 'Visibilidad')
      const visibilitySelect = element('select')
      visibilitySelect.name = 'visibility'
      visibilitySelect.setAttribute('aria-label', 'Visibilidad')
      for (const [value, label] of [['public', 'Pública'], ['unlisted', 'Privada']]) {
        const option = element('option', '', label)
        option.value = value
        visibilitySelect.append(option)
      }
      visibilitySelect.value = collection.visibility
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
      languageSelect.value = collection.language
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
    const addButton = element('button', '', 'Añadir')
    addButton.type = 'submit'
    const bookmarkError = element('p', 'error')
    bookmarkError.hidden = true
    bookmarkForm.append(urlInput, titleInput, tagsInput, addButton, bookmarkError)
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
          collection_id: collectionId
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

    const transportSection = element('section', 'group-section')
    transportSection.id = 'transporte'
    const transportHeader = element('header', 'group-header')
    transportHeader.append(element('h2', '', 'Transporte'))
    transportSection.append(transportHeader)
    const grid = element('div', 'bookmarks-grid')
    for (const [initial, title, domain] of [
      ['J', 'JR Pass Guide', 'jrpass.com'],
      ['N', 'Japan Railways', 'japanrailways.com'],
      ['T', 'Tokyo Metro', 'tokyometro.jp'],
      ['G', 'Google Maps — Japón', 'google.com/maps']
    ]) {
      const bookmark = element('article', 'bookmark')
      const top = element('div', 'bookmark-top')
      top.append(element('div', 'favicon', initial))
      const details = element('div')
      details.append(element('div', 'bookmark-title', title))
      details.append(element('div', 'bookmark-domain', domain))
      top.append(details)
      bookmark.append(top)
      grid.append(bookmark)
    }
    transportSection.append(grid)
    content.append(transportSection)

    for (const [id, label] of [
      ['alojamiento', 'Alojamiento'],
      ['comida', 'Comida'],
      ['cultura', 'Cultura']
    ]) {
      const groupSection = element('section', 'group-section')
      groupSection.id = id
      const groupHeader = element('header', 'group-header')
      groupHeader.append(element('h2', '', label))
      groupSection.append(groupHeader, element('p', 'group-empty', 'Los enlaces de este grupo aparecerán aquí.'))
      content.append(groupSection)
    }

    // La vista anterior tenía una sección «Sin grupo»; los datos de esta pantalla son ahora dummy.
  }

  void state
  void load()
}
