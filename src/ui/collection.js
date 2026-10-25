import {
  getCollection,
  getCollectionBookmarks,
  getGroups,
  updateCollection,
  deleteCollection,
  createBookmark,
  deleteBookmark,
  createGroup,
  deleteGroup,
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
  return error?.code === 'NOT_FOUND' || error?.code === 'COLLECTION_NOT_FOUND' || /404|no encontrada/i.test(errorMessage(error))
}

export function render(container, state, collectionId, { onReload, onDeleted } = {}) {
  let collection = null
  let bookmarks = []
  let groups = []
  let loading = true
  let collectionError = null
  let bookmarksError = null
  let groupsError = null
  let editing = false
  let actionError = null
  let requestId = 0

  async function load() {
    const currentRequest = ++requestId
    loading = true
    collectionError = null
    bookmarksError = null
    groupsError = null
    renderView()
    const [collectionResult, bookmarksResult, groupsResult] = await Promise.allSettled([
      getCollection(collectionId),
      getCollectionBookmarks(collectionId),
      getGroups(collectionId)
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
    if (groupsResult.status === 'fulfilled') {
      groups = (groupsResult.value.groups ?? []).filter((group) => !group.deleted)
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || (a.created_at || '').localeCompare(b.created_at || ''))
    } else {
      groupsError = groupsResult.reason
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
    const deleteCollectionButton = element('button', 'danger-button', 'Eliminar colección')
    deleteCollectionButton.type = 'button'
    deleteCollectionButton.addEventListener('click', async () => {
      if (!window.confirm('¿Eliminar esta colección? Esta acción no se puede deshacer.')) return
      deleteCollectionButton.disabled = true
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
    headerActions.append(editButton, deleteCollectionButton)
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
    const addGroupSelect = element('select')
    addGroupSelect.name = 'group_id'
    addGroupSelect.setAttribute('aria-label', 'Grupo')
    const noGroupOption = element('option', '', 'Sin grupo')
    noGroupOption.value = ''
    addGroupSelect.append(noGroupOption)
    for (const group of groups) {
      const option = element('option', '', group.name)
      option.value = group.group_id
      addGroupSelect.append(option)
    }
    const addButton = element('button', '', 'Añadir')
    addButton.type = 'submit'
    const formError = element('p', 'error')
    formError.hidden = true
    form.append(urlInput, titleInput, tagsInput, addGroupSelect, addButton, formError)
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
      const groupId = addGroupSelect.value
      addButton.disabled = true
      formError.hidden = true
      try {
        await createBookmark({
          url,
          ...(titleInput.value.trim() ? { title: titleInput.value.trim() } : {}),
          tags,
          collection_id: collectionId,
          ...(groupId ? { group_id: groupId } : {})
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
    const groupFormError = element('p', 'error')
    groupFormError.hidden = true
    groupForm.append(groupNameInput, createGroupButton, groupFormError)
    groupForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const name = groupNameInput.value.trim()
      if (!name) {
        groupFormError.hidden = false
        groupFormError.textContent = 'El nombre del grupo no puede estar vacío.'
        groupNameInput.focus()
        return
      }
      createGroupButton.disabled = true
      groupFormError.hidden = true
      try {
        await createGroup({ name, collection_id: collectionId })
        groupForm.reset()
        await onReload?.()
      } catch (error) {
        groupFormError.hidden = false
        groupFormError.textContent = errorMessage(error)
        createGroupButton.disabled = false
      }
    })
    createGroupSection.append(groupForm)
    section.append(createGroupSection)

    if (bookmarksError || groupsError) {
      if (bookmarksError) section.append(element('p', 'error', 'Error al cargar los bookmarks: ' + errorMessage(bookmarksError)))
      if (groupsError) section.append(element('p', 'error', 'Error al cargar los grupos: ' + errorMessage(groupsError)))
      const retry = element('button', '', 'Reintentar')
      retry.type = 'button'
      retry.addEventListener('click', load)
      section.append(retry)
      return
    }

    function renderBookmarkList(bookmarksForSection, groupId) {
      const list = element('div', 'bookmark-list')
      const ordered = [...bookmarksForSection].sort((a, b) =>
        (a.position ?? Infinity) - (b.position ?? Infinity) ||
        (a.created_at || '').localeCompare(b.created_at || '')
      )
      if (ordered.length === 0) {
        list.append(element('p', 'group-empty', groupId === null ? 'No hay bookmarks sin grupo.' : 'Este grupo está vacío.'))
        return list
      }

      for (const bookmark of ordered) {
        const item = element('article', 'bookmark-item')
        const url = bookmark.canonical_url || bookmark.url || ''
        const title = bookmark.title || url || 'Bookmark'
        item.append(element('h3', 'bookmark-title', title))
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
        const moveSelect = element('select')
        moveSelect.className = 'bookmark-group-select'
        moveSelect.setAttribute('aria-label', 'Mover a grupo')
        const rootOption = element('option', '', 'Sin grupo')
        rootOption.value = ''
        moveSelect.append(rootOption)
        for (const group of groups) {
          const option = element('option', '', group.name)
          option.value = group.group_id
          moveSelect.append(option)
        }
        moveSelect.value = bookmark.group_id ?? ''
        const moveButton = element('button', '', 'Mover')
        moveButton.type = 'button'
        moveButton.addEventListener('click', async () => {
          moveButton.disabled = true
          try {
            await moveBookmark(bookmark.bookmark_id, {
              group_id: moveSelect.value === '' ? null : moveSelect.value
            })
            await onReload?.()
          } catch (error) {
            actionError = errorMessage(error)
            renderView()
          }
        })

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
        actions.append(moveSelect, moveButton, removeButton)
        item.append(actions)
        list.append(item)
      }
      return list
    }

    const ungroupedSection = element('section', 'group-section')
    const ungroupedHeader = element('header', 'group-header')
    ungroupedHeader.append(element('h2', '', 'Sin grupo'))
    ungroupedSection.append(ungroupedHeader, renderBookmarkList(
      bookmarks.filter((bookmark) => bookmark.group_id == null),
      null
    ))
    section.append(ungroupedSection)

    for (const group of groups) {
      const groupSection = element('section', 'group-section')
      const groupHeader = element('header', 'group-header')
      groupHeader.append(element('h2', '', group.name))
      const deleteGroupButton = element('button', 'danger-button', 'Eliminar grupo')
      deleteGroupButton.type = 'button'
      deleteGroupButton.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar este grupo? Sus bookmarks volverán a «Sin grupo».')) return
        deleteGroupButton.disabled = true
        try {
          await deleteGroup(group.group_id)
          await onReload?.()
        } catch (error) {
          actionError = errorMessage(error)
          renderView()
        }
      })
      groupHeader.append(deleteGroupButton)
      groupSection.append(groupHeader, renderBookmarkList(
        bookmarks.filter((bookmark) => bookmark.group_id === group.group_id),
        group.group_id
      ))
      section.append(groupSection)
    }
  }

  void state
  void load()
}
