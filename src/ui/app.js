import { getIdentity, getCollections, getBookmarks, getInboxBookmarks, getProfile, getConfig } from './api.js'
import { render as renderOnboarding } from './onboarding.js'
import { render as renderBookmarks } from './bookmarks.js'
import { render as renderCollection } from './collection.js'
import { render as renderBookmark } from './bookmark.js'
import { render as renderSettings } from './settings.js'

const app = document.querySelector('#app')
const layout = document.querySelector('.layout')
const sidebar = document.querySelector('#sidebar')
const content = document.createElement('div')
content.className = 'app-content'
app.replaceChildren(content)
const state = {
  identity: null, collections: [], bookmarks: [], inboxBookmarks: [], profile: {}, config: null,
  settingsNotice: null, collectionsLoading: false, collectionsError: null, inboxError: null, errors: []
}
let initialized = false
let dataLoadStarted = false
let dataReloadPromise = null

function renderErrors() {
  for (const message of state.errors) {
    const error = document.createElement('p')
    error.className = 'error'
    error.textContent = message
    content.append(error)
  }
}
function navigate(path) {
  if (window.location.hash === path) renderCurrentRoute()
  else window.location.hash = path
}
function renderPlaceholder(title, message) {
  content.replaceChildren()
  const section = document.createElement('section')
  section.className = 'placeholder'
  const heading = document.createElement('h1')
  heading.textContent = title
  const description = document.createElement('p')
  description.textContent = message
  section.append(heading, description)
  content.append(section)
}
function updateNavigation(routePath, query) {
  if (!sidebar) return
  for (const link of sidebar.querySelectorAll('a[data-route]')) {
    const route = link.dataset.route
    const active = route === 'settings' ? routePath === '#/settings' && !window.location.hash.includes('#import')
      : route === 'import' ? routePath === '#/settings' && window.location.hash.includes('#import')
        : route === 'inbox' ? routePath === '#/bookmarks' && query.get('tab') === 'inbox'
          : route === 'collections' ? routePath === '#/bookmarks' && query.get('tab') === 'collections'
            : route === 'home' ? routePath === '#/bookmarks' && !query.has('tab') : false
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}
function renderHeader() {
  const hash = window.location.hash || ''
  const routePath = hash.split('?')[0].split('#import')[0]
  const queryString = hash.includes('?') ? hash.split('?')[1].split('#')[0] : ''
  updateNavigation(routePath, new URLSearchParams(queryString))
  const onboarding = !state.identity || routePath === '#/onboarding'
  document.body.classList.toggle('onboarding-layout', onboarding)
  if (layout) layout.hidden = false
}
function renderCurrentRoute() {
  if (!initialized) return
  renderHeader()
  const requestedRoute = window.location.hash || ''
  const routePath = requestedRoute.split('?')[0].split('#import')[0]
  const queryString = requestedRoute.includes('?') ? requestedRoute.split('?')[1].split('#')[0] : ''
  const query = new URLSearchParams(queryString)
  if (!state.identity) {
    if (routePath !== '#/onboarding') { navigate('#/onboarding'); return }
    renderOnboarding(content, state, () => { state.errors = []; navigate('#/bookmarks') })
  } else if (routePath === '' || routePath === '#/bookmarks') {
    renderBookmarks(content, state, { onReload: reloadData, initialTab: query.get('tab') })
    loadDataIfNeeded()
  } else if (/^#\/collections\/[^/]+$/.test(routePath)) {
    const collectionId = decodeURIComponent(routePath.slice('#/collections/'.length))
    renderCollection(content, state, collectionId, { onReload: reloadData, onDeleted: () => navigate('#/bookmarks') })
    loadDataIfNeeded()
  } else if (/^#\/bookmarks\/[^/]+$/.test(routePath)) {
    const bookmarkId = decodeURIComponent(routePath.slice('#/bookmarks/'.length))
    renderBookmark(content, state, bookmarkId, { onReload: reloadData, onDeleted: (collectionId) => navigate(collectionId === null ? '#/bookmarks' : '#/collections/' + encodeURIComponent(collectionId)) })
    loadDataIfNeeded()
  } else if (routePath === '#/settings') {
    renderSettings(content, state, { onReload: reloadData })
    loadDataIfNeeded()
    if (window.location.hash.includes('#import')) queueMicrotask(() => document.querySelector('#import')?.scrollIntoView())
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
    const [identityResult, collectionsResult, bookmarksResult, inboxResult, profileResult, configResult] = await Promise.allSettled([
      getIdentity(), getCollections(), getBookmarks(), getInboxBookmarks(), getProfile(), getConfig()
    ])
    if (identityResult.status === 'fulfilled') state.identity = identityResult.value.identity
    if (profileResult.status === 'fulfilled') state.profile = profileResult.value.profile ?? {}
    if (configResult.status === 'fulfilled') state.config = configResult.value.config ?? null
    if (collectionsResult.status === 'fulfilled') state.collections = collectionsResult.value.collections ?? []
    else {
      state.collections = []
      state.collectionsError = collectionsResult.reason instanceof Error ? collectionsResult.reason.message : String(collectionsResult.reason)
      state.errors.push('Error al cargar colecciones: ' + state.collectionsError)
    }
    if (bookmarksResult.status === 'fulfilled') state.bookmarks = bookmarksResult.value.bookmarks ?? []
    else {
      state.bookmarks = []
      state.errors.push('Error al cargar bookmarks: ' + (bookmarksResult.reason instanceof Error ? bookmarksResult.reason.message : String(bookmarksResult.reason)))
    }
    if (inboxResult.status === 'fulfilled') state.inboxBookmarks = inboxResult.value.bookmarks ?? []
    else {
      state.inboxBookmarks = []
      state.inboxError = inboxResult.reason instanceof Error ? inboxResult.reason.message : String(inboxResult.reason)
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
    if (!window.location.hash) window.location.hash = state.identity ? '#/bookmarks' : '#/onboarding'
    renderCurrentRoute()
  } catch (error) {
    content.replaceChildren()
    const message = document.createElement('p')
    message.className = 'error'
    message.textContent = `Error al conectar con la API: ${error instanceof Error ? error.message : String(error)}`
    content.append(message)
  }
}
start()
