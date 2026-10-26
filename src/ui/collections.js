import { createCollection } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function render(container, state, { onReload } = {}) {
  container.replaceChildren()
  const page = element('section', 'collections-page')
  page.append(element('h1', '', 'Mis colecciones'))

  if (state.collectionsLoading) {
    page.append(element('p', 'status', 'Cargando…'))
  } else if (state.collectionsError) {
    page.append(element('p', 'error', 'Error al cargar colecciones: ' + state.collectionsError))
    const retry = element('button', '', 'Reintentar')
    retry.type = 'button'
    retry.addEventListener('click', () => onReload?.())
    page.append(retry)
  } else {
    const collections = (state.collections ?? []).filter((collection) => !collection.deleted)
    if (collections.length === 0) {
      page.append(element('p', 'empty', 'Aún no tienes colecciones. Crea una para empezar.'))
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
    page.append(list)
  }

  const form = element('form', 'inline-form')
  const nameInput = element('input')
  nameInput.type = 'text'
  nameInput.name = 'name'
  nameInput.placeholder = 'Nombre de la colección'
  nameInput.required = true
  nameInput.setAttribute('aria-label', 'Nombre de la colección')
  const languageSelect = element('select')
  languageSelect.name = 'language'
  languageSelect.setAttribute('aria-label', 'Idioma de la colección')
  for (const [value, label] of [['es', 'Español (ES)'], ['en', 'English (EN)'], ['eu', 'Euskara (EU)']]) {
    const option = element('option', '', label)
    option.value = value
    languageSelect.append(option)
  }
  languageSelect.value = 'es'
  const createButton = element('button', '', 'Crear')
  createButton.type = 'submit'
  const feedback = element('p', 'error')
  feedback.hidden = true
  form.append(nameInput, languageSelect, createButton)
  page.append(form, feedback)
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
      await createCollection({ name, language: languageSelect.value })
      await onReload?.()
    } catch (error) {
      feedback.hidden = false
      feedback.textContent = error instanceof Error ? error.message : String(error)
      createButton.disabled = false
    }
  })
  container.append(page)
}
