import { getIdentity, getCollections, getBookmarks } from './api.js'
import { render as renderOnboarding } from './onboarding.js'
import { render as renderBookmarks } from './bookmarks.js'

const app = document.querySelector('#app')
const state = {
  identity: null,
  collections: [],
  bookmarks: [],
  errors: []
}

let initialized = false
let dataLoadStarted = false

function showError(message) {
  state.errors.push(message)
  renderCurrentRoute()
}

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

function renderCurrentRoute() {
  if (!initialized) return

  const requestedRoute = window.location.hash
  if (!state.identity) {
    if (requestedRoute !== '#/onboarding') {
      if (requestedRoute === '') {
        navigate('#/onboarding')
      } else {
        window.location.hash = '#/onboarding'
      }
      return
    }
    renderOnboarding(app, state, () => {
      state.errors = []
      navigate('#/bookmarks')
    })
  } else {
    if (requestedRoute !== '#/bookmarks') {
      if (requestedRoute === '') {
        navigate('#/bookmarks')
      } else {
        window.location.hash = '#/bookmarks'
      }
      return
    }
    renderBookmarks(app, state)
    loadDataIfNeeded()
  }

  renderErrors()
}

function loadDataIfNeeded() {
  if (dataLoadStarted || !state.identity) return
  dataLoadStarted = true

  getCollections()
    .then((result) => {
      state.collections = result.collections
    })
    .catch((error) => {
      showError(`Error al cargar colecciones: ${error instanceof Error ? error.message : String(error)}`)
    })

  getBookmarks()
    .then((result) => {
      state.bookmarks = result.bookmarks
    })
    .catch((error) => {
      showError(`Error al cargar bookmarks: ${error instanceof Error ? error.message : String(error)}`)
    })
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
