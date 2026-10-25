import { getIdentity, getCollections, getBookmarks, getInboxBookmarks } from './api.js'
import { render as renderOnboarding } from './onboarding.js'
import { render as renderBookmarks } from './bookmarks.js'

const app = document.querySelector('#app')
const state = {
  identity: null,
  collections: [],
  bookmarks: [],
  inboxBookmarks: [],
  collectionsLoading: false,
  collectionsError: null,
  inboxError: null,
  errors: []
}

let initialized = false
let dataLoadStarted = false
let dataReloadPromise = null

function renderErrors() {
  for (const message of state.errors) {
    const error = document.createElement('p')
    error.className = 'error'
    error.textContent = message
    app.append(error)
  }
}

function navigate(path) {
  if (window.location.hash === path) {
    renderCurrentRoute()
    return
  }
  window.location.hash = path
}

function renderPlaceholder(title, message) {
  app.replaceChildren()
  const section = document.createElement('section')
  section.className = 'placeholder'
  const heading = document.createElement('h1')
  heading.textContent = title
  const description = document.createElement('p')
  description.textContent = message
  section.append(heading, description)
  app.append(section)
}

function renderCurrentRoute() {
  if (!initialized) return

  const requestedRoute = window.location.hash || ''
  const routePath = requestedRoute.split('?')[0]

  if (!state.identity) {
    if (routePath !== '#/onboarding') {
      navigate('#/onboarding')
      return
    }
    renderOnboarding(app, state, () => {
      state.errors = []
      navigate('#/bookmarks')
    })
  } else if (routePath === '' || routePath === '#/bookmarks') {
    renderBookmarks(app, state, { onReload: reloadData })
    loadDataIfNeeded()
  } else if (/^#\/collections\/[^/]+$/.test(routePath)) {
    renderPlaceholder('Colección próximamente', 'La vista de colección estará disponible próximamente.')
    loadDataIfNeeded()
  } else if (/^#\/bookmarks\/[^/]+$/.test(routePath)) {
    renderPlaceholder('Bookmark próximamente', 'La vista de bookmark estará disponible próximamente.')
    loadDataIfNeeded()
  } else if (routePath === '#/onboarding') {
    navigate('#/bookmarks')
  } else {
    navigate('#/bookmarks')
  }

  renderErrors()
}

function loadDataIfNeeded() {
  if (dataLoadStarted || !state.identity) return
  dataLoadStarted = true
  void reloadData()
}

async function reloadData() {
  if (dataReloadPromise) return dataReloadPromise
  if (!state.identity) return

  state.collectionsLoading = true
  state.collectionsError = null
  state.inboxError = null
  state.errors = []
  renderCurrentRoute()

  dataReloadPromise = (async () => {
    const [collectionsResult, bookmarksResult, inboxResult] = await Promise.allSettled([
      getCollections(),
      getBookmarks(),
      getInboxBookmarks()
    ])

    if (collectionsResult.status === 'fulfilled') {
      state.collections = collectionsResult.value.collections ?? []
    } else {
      state.collections = []
      state.collectionsError = collectionsResult.reason instanceof Error
        ? collectionsResult.reason.message
        : String(collectionsResult.reason)
      state.errors.push('Error al cargar colecciones: ' + state.collectionsError)
    }

    if (bookmarksResult.status === 'fulfilled') {
      state.bookmarks = bookmarksResult.value.bookmarks ?? []
    } else {
      state.bookmarks = []
      state.errors.push('Error al cargar bookmarks: ' + (bookmarksResult.reason instanceof Error
        ? bookmarksResult.reason.message
        : String(bookmarksResult.reason)))
    }

    if (inboxResult.status === 'fulfilled') {
      state.inboxBookmarks = inboxResult.value.bookmarks ?? []
    } else {
      state.inboxBookmarks = []
      state.inboxError = inboxResult.reason instanceof Error
        ? inboxResult.reason.message
        : String(inboxResult.reason)
      state.errors.push('Error al cargar Inbox: ' + state.inboxError)
    }

    state.collectionsLoading = false
    dataReloadPromise = null
    renderCurrentRoute()
  })()

  return dataReloadPromise
}

window.addEventListener('hashchange', renderCurrentRoute)

async function start() {
  try {
    const result = await getIdentity()
    state.identity = result.identity
    initialized = true
    if (!window.location.hash) {
      window.location.hash = state.identity ? '#/bookmarks' : '#/onboarding'
    }
    renderCurrentRoute()
  } catch (error) {
    app.replaceChildren()
    const message = document.createElement('p')
    message.className = 'error'
    message.textContent = `Error al conectar con la API: ${error instanceof Error ? error.message : String(error)}`
    app.append(message)
  }
}

start()
