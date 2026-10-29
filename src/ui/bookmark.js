import {
  getBookmark,
  getGroups,
  updateBookmark,
  deleteBookmark,
  moveBookmark
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
  return error?.code === 'NOT_FOUND' || error?.code === 'BOOKMARK_NOT_FOUND' ||
    /404|bookmark no encontrado/i.test(errorMessage(error))
}

function addField(form, labelText, control) {
  const label = element('label', '', labelText)
  label.append(control)
  form.append(label)
}

export function render(container, state, bookmarkId, { onReload, onDeleted } = {}) {
  let bookmark = null
  let loading = true
  let loadError = null
  let groups = []
  let groupsError = null
  let editing = false
  let actionError = null
  let busy = false
  let selectedCollectionId = ''
  let selectedGroupId = ''
  let requestId = 0
  let groupsRequestId = 0

  async function load() {
    const current = ++requestId
    loading = true
    loadError = null
    renderView()
    try {
      const result = await getBookmark(bookmarkId)
      if (current !== requestId) return
      bookmark = result.bookmark
      selectedCollectionId = bookmark.collection_id ?? ''
      selectedGroupId = bookmark.group_id ?? ''
      loading = false
      await loadGroups(selectedCollectionId, false)
      if (current === requestId) renderView()
    } catch (error) {
      if (current !== requestId) return
      loading = false
      loadError = error
      renderView()
    }
  }

  async function loadGroups(collectionId, rerender = true) {
    const current = ++groupsRequestId
    groupsError = null
    if (!collectionId) {
      groups = []
      if (rerender) renderView()
      return
    }
    try {
      const result = await getGroups(collectionId)
      if (current !== groupsRequestId) return
      groups = (result.groups ?? []).filter((group) => !group.deleted)
    } catch (error) {
      if (current !== groupsRequestId) return
      groups = []
      groupsError = errorMessage(error)
    }
    if (rerender) renderView()
  }

  function renderView() {
    container.replaceChildren()
    if (loading) {
      container.append(element('p', 'status', 'Cargando…'))
      return
    }
    if (loadError) {
      const section = element('section', 'bookmark-detail')
      if (isNotFound(loadError)) {
        section.append(element('h1', '', 'Bookmark no encontrado'))
        const back = element('a', '', 'Volver a Mis bookmarks')
        back.href = '#/bookmarks'
        section.append(back)
      } else {
        section.append(element('p', 'error', 'Error al cargar el bookmark: ' + errorMessage(loadError)))
        const retry = element('button', '', 'Reintentar')
        retry.type = 'button'
        retry.addEventListener('click', load)
        section.append(retry)
      }
      container.append(section)
      return
    }

    const section = element('section', 'bookmark-detail')
    const collectionId = bookmark.collection_id ?? bookmark.collectionId ?? null
    const groupId = bookmark.group_id ?? bookmark.groupId ?? null
    const collection = collectionId === null
      ? null
      : (state.collections ?? []).find((item) =>
          (item.collection_id ?? item.collectionId ?? item.id) === collectionId && !item.deleted
        )
    const group = groupId === null
      ? null
      : groups.find((item) => (item.group_id ?? item.groupId ?? item.id) === groupId)
    const back = element('a', 'back-button', '← Volver a ' + (
      groupId !== null ? (group?.name || 'el grupo') : (collection?.name || 'la colección')
    ))
    back.href = groupId !== null
      ? '#/collections/' + encodeURIComponent(collectionId) + '/groups/' + encodeURIComponent(groupId)
      : (collectionId !== null
          ? '#/collections/' + encodeURIComponent(collectionId)
          : '#/inbox')
    section.append(back)
    const heading = element('h1', '', bookmark.title || bookmark.canonical_url || 'Bookmark')
    section.append(heading)

    const url = bookmark.canonical_url || bookmark.url
    if (url) {
      const link = element('a', 'bookmark-url', url)
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener'
      link.title = url
      section.append(link)
    }
    if (bookmark.description) section.append(element('p', 'bookmark-description', bookmark.description))
    if (Array.isArray(bookmark.tags) && bookmark.tags.length) {
      const tags = element('div', 'tags')
      for (const tag of bookmark.tags) tags.append(element('span', 'tag', tag))
      section.append(tags)
    }
    if (bookmark.notes) {
      const notes = element('blockquote', 'bookmark-notes')
      notes.textContent = bookmark.notes
      section.append(notes)
    }

    const meta = element('div', 'bookmark-meta')
    const collectionLine = element('p')
    collectionLine.append(element('strong', '', 'Colección: '))
    if (bookmark.collection_id === null || bookmark.collection_id === undefined) {
      collectionLine.append(document.createTextNode('Inbox global'))
    } else {
      const collection = (state.collections ?? []).find((item) =>
        item.collection_id === bookmark.collection_id && !item.deleted
      )
      if (collection) {
        const collectionLink = element('a', '', collection.name || collection.collection_id)
        collectionLink.href = '#/collections/' + encodeURIComponent(collection.collection_id)
        collectionLine.append(collectionLink)
      } else {
        collectionLine.append(document.createTextNode('Colección no encontrada'))
      }
    }
    meta.append(collectionLine)

    const groupLine = element('p')
    groupLine.append(element('strong', '', 'Grupo: '))
    if (bookmark.collection_id === null || bookmark.collection_id === undefined) {
      groupLine.append(document.createTextNode('—'))
    } else if (bookmark.group_id === null || bookmark.group_id === undefined) {
      groupLine.append(document.createTextNode('Sin grupo'))
    } else {
      const group = groups.find((item) => item.group_id === bookmark.group_id || item.id === bookmark.group_id)
      groupLine.append(document.createTextNode(group ? group.name : 'Grupo no encontrado'))
    }
    meta.append(groupLine)
    section.append(meta)

    const actions = element('div', 'actions bookmark-actions')
    const editButton = element('button', '', editing ? 'Cerrar edición' : 'Editar')
    editButton.type = 'button'
    editButton.addEventListener('click', () => {
      editing = !editing
      actionError = null
      renderView()
    })
    const deleteButton = element('button', 'danger-button', 'Eliminar')
    deleteButton.type = 'button'
    deleteButton.disabled = busy
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm('¿Eliminar este bookmark?')) return
      busy = true
      actionError = null
      renderView()
      try {
        await deleteBookmark(bookmarkId)
        onDeleted?.(bookmark.collection_id ?? null)
      } catch (error) {
        busy = false
        actionError = errorMessage(error)
        renderView()
      }
    })
    actions.append(editButton, deleteButton)
    section.append(actions)

    if (actionError) section.append(element('p', 'error', actionError))
    if (editing) renderEditForm(section)
    renderMoveForm(section)
    container.append(section)
  }

  function renderEditForm(section) {
    const form = element('form', 'bookmark-form')
    const titleInput = element('input')
    titleInput.type = 'text'
    titleInput.name = 'title'
    titleInput.required = true
    titleInput.value = bookmark.title ?? ''
    titleInput.setAttribute('aria-label', 'Título')
    const descriptionInput = element('textarea')
    descriptionInput.name = 'description'
    descriptionInput.value = bookmark.description ?? ''
    descriptionInput.setAttribute('aria-label', 'Descripción')
    const tagsInput = element('input')
    tagsInput.type = 'text'
    tagsInput.name = 'tags'
    tagsInput.value = Array.isArray(bookmark.tags) ? bookmark.tags.join(', ') : ''
    tagsInput.setAttribute('aria-label', 'Tags separados por comas')
    const notesInput = element('textarea')
    notesInput.name = 'notes'
    notesInput.value = bookmark.notes ?? ''
    notesInput.setAttribute('aria-label', 'Notas')
    addField(form, 'Título', titleInput)
    addField(form, 'Descripción', descriptionInput)
    addField(form, 'Tags (separados por comas)', tagsInput)
    addField(form, 'Notas', notesInput)
    const feedback = element('p', 'error')
    feedback.hidden = true
    const actions = element('div', 'actions')
    const save = element('button', '', 'Guardar')
    save.type = 'submit'
    const cancel = element('button', 'secondary-button', 'Cancelar')
    cancel.type = 'button'
    cancel.addEventListener('click', () => {
      editing = false
      actionError = null
      renderView()
    })
    actions.append(save, cancel)
    form.append(actions, feedback)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const titleValue = titleInput.value.trim()
      if (!titleValue) {
        feedback.hidden = false
        feedback.textContent = 'El título no puede estar vacío.'
        titleInput.focus()
        return
      }
      save.disabled = true
      feedback.hidden = true
      try {
        await updateBookmark(bookmarkId, {
          title: titleValue,
          description: descriptionInput.value === '' ? null : descriptionInput.value,
          tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
          notes: notesInput.value === '' ? null : notesInput.value
        })
        editing = false
        actionError = null
        await onReload?.()
      } catch (error) {
        feedback.hidden = false
        feedback.textContent = errorMessage(error)
        save.disabled = false
      }
    })
    section.append(form)
  }

  function renderMoveForm(section) {
    const form = element('form', 'move-form')
    const collectionSelect = element('select')
    collectionSelect.name = 'collection'
    collectionSelect.setAttribute('aria-label', 'Colección de destino')
    const inboxOption = element('option', '', 'Inbox global')
    inboxOption.value = ''
    inboxOption.selected = selectedCollectionId === ''
    collectionSelect.append(inboxOption)
    const collections = (state.collections ?? []).filter((collection) => !collection.deleted)
    for (const collection of collections) {
      const option = element('option', '', collection.name || collection.collection_id)
      option.value = collection.collection_id
      option.selected = selectedCollectionId === collection.collection_id
      collectionSelect.append(option)
    }

    const groupSelect = element('select')
    groupSelect.name = 'group'
    groupSelect.setAttribute('aria-label', 'Grupo de destino')
    const noGroup = element('option', '', selectedCollectionId ? 'Sin grupo' : '—')
    noGroup.value = ''
    noGroup.selected = selectedGroupId === ''
    groupSelect.append(noGroup)
    if (!selectedCollectionId) {
      groupSelect.disabled = true
    } else {
      for (const group of groups) {
        const id = group.group_id ?? group.id
        const option = element('option', '', group.name || id)
        option.value = id
        option.selected = selectedGroupId === id
        groupSelect.append(option)
      }
      groupSelect.disabled = busy
    }

    const feedback = element('p', 'error')
    feedback.hidden = !groupsError
    if (groupsError) feedback.textContent = 'Error al cargar grupos: ' + groupsError
    collectionSelect.disabled = busy
    groupSelect.addEventListener('change', () => {
      selectedGroupId = groupSelect.value
    })
    collectionSelect.addEventListener('change', async () => {
      selectedCollectionId = collectionSelect.value
      selectedGroupId = ''
      groupSelect.disabled = !selectedCollectionId || busy
      groupSelect.replaceChildren()
      const option = element('option', '', selectedCollectionId ? 'Cargando grupos…' : '—')
      option.value = ''
      groupSelect.append(option)
      if (selectedCollectionId) await loadGroups(selectedCollectionId)
      else {
        groups = []
        renderView()
      }
    })

    const moveButton = element('button', '', 'Mover')
    moveButton.type = 'submit'
    moveButton.disabled = busy
    form.append(collectionSelect, groupSelect, moveButton, feedback)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      moveButton.disabled = true
      actionError = null
      try {
        if (!selectedCollectionId) {
          await moveBookmark(bookmarkId, { collection_id: null, group_id: null })
        } else {
          await moveBookmark(bookmarkId, {
            collection_id: selectedCollectionId,
            group_id: groupSelect.value === '' ? null : groupSelect.value
          })
        }
        await onReload?.()
      } catch (error) {
        feedback.hidden = false
        feedback.textContent = errorMessage(error)
        moveButton.disabled = false
      }
    })
    section.append(form)
  }

  renderView()
  void load()
}
