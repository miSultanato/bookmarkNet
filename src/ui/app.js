import { getIdentity, getCollections, getBookmarks, getInboxBookmarks, getProfile, getConfig } from './api.js'
import { render as renderOnboarding } from './onboarding.js'
import { render as renderWelcome } from './welcome.js'
import { render as renderInbox } from './inbox.js'
import { render as renderCollections } from './collections.js'
import { render as renderImport } from './import.js'
import { render as renderCollection } from './collection.js'
import { render as renderGroup } from './group.js'
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
function updateNavigation(routePath) {
  if (!sidebar) return
  const activeRoute = /^#\/collections\/[^/]+$/.test(routePath) || /^#\/bookmarks\/[^/]+$/.test(routePath)
    ? 'collections'
    : routePath === '#/inbox' ? 'inbox'
      : routePath === '#/collections' ? 'collections'
        : routePath === '#/import' ? 'import'
          : routePath === '#/settings' ? 'settings'
            : routePath === '#/' ? 'home' : null
  for (const link of sidebar.querySelectorAll('a[data-route]')) {
    const active = link.dataset.route === activeRoute
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}
function renderHeader(routePath) {
  updateNavigation(routePath)
  const onboarding = routePath === '#/onboarding'
  const welcome = routePath === '#/' && !state.identity
  document.body.classList.toggle('onboarding-layout', onboarding)
  document.body.classList.toggle('welcome-layout', welcome)
  if (layout) layout.hidden = false
}
function renderHome() {
  content.replaceChildren()
  const page = document.createElement('section')
  page.className = 'home-page'
  const heading = document.createElement('h1')
  heading.textContent = 'Inicio'
  page.append(heading)
  const cards = document.createElement('div')
  cards.className = 'cards'
  const collectionCard = document.createElement('a')
  collectionCard.className = 'card home-card'
  collectionCard.href = '#/collections'
  const collectionHeading = document.createElement('h2')
  collectionHeading.textContent = 'Mis colecciones'
  const collectionDescription = document.createElement('p')
  collectionDescription.textContent = 'Consulta y organiza tus colecciones de enlaces.'
  collectionCard.append(collectionHeading, collectionDescription)
  const inboxCard = document.createElement('a')
  inboxCard.className = 'card home-card'
  inboxCard.href = '#/inbox'
  const inboxHeading = document.createElement('h2')
  inboxHeading.textContent = 'Inbox'
  const inboxDescription = document.createElement('p')
  inboxDescription.textContent = 'Encuentra los bookmarks que todavía no has organizado.'
  inboxCard.append(inboxHeading, inboxDescription)
  cards.append(collectionCard, inboxCard)
  page.append(cards)
  content.append(page)
}
function renderCurrentRoute() {
  if (!initialized) return
  const requestedRoute = window.location.hash || '#/'
  if (requestedRoute === '#/settings#import') { navigate('#/import'); return }
  const routePath = requestedRoute.split('?')[0].split('#import')[0]
  const queryString = requestedRoute.includes('?') ? requestedRoute.split('?')[1].split('#')[0] : ''
  const query = new URLSearchParams(queryString)

  if (routePath === '#/bookmarks') {
    navigate(query.get('tab') === 'collections' ? '#/collections' : '#/inbox')
    return
  }
  if (!state.identity && routePath !== '#/onboarding' && routePath !== '#/') { navigate('#/'); return }
  if (state.identity && routePath === '#/onboarding') { navigate('#/'); return }

  const knownRoute = routePath === '#/' || routePath === '#/onboarding' ||
    routePath === '#/inbox' || routePath === '#/collections' ||
    routePath === '#/import' || routePath === '#/settings' ||
    /^#\/collections\/[^/]+$/.test(routePath) || /^#\/collections\/[^/]+\/groups\/[^/]+$/.test(routePath) || /^#\/bookmarks\/[^/]+$/.test(routePath)
  if (!knownRoute) { navigate(state.identity ? '#/' : '#/onboarding'); return }

  renderHeader(routePath)
  if (routePath === '#/onboarding') {
    renderOnboarding(content, state, (importError) => {
      state.errors = importError ? [`La identidad se ha creado, pero la importación ha fallado: ${importError}. Puedes reintentarlo desde Importar.`] : []
      navigate('#/inbox')
    }, { onReload: reloadData })
  } else if (routePath === '#/') {
    if (state.identity) {
      renderHome()
      loadDataIfNeeded()
    } else {
      renderWelcome(content, state, { onStart: () => navigate('#/onboarding') })
    }
  } else if (routePath === '#/inbox') {
    renderInbox(content, state, { onReload: reloadData })
    loadDataIfNeeded()
  } else if (routePath === '#/collections') {
    renderCollections(content, state, { onReload: reloadData })
    loadDataIfNeeded()
  } else if (/^#\/collections\/[^/]+$/.test(routePath)) {
    const collectionId = decodeURIComponent(routePath.slice('#/collections/'.length))
    renderCollection(content, state, collectionId, { onReload: reloadData, onDeleted: () => navigate('#/collections') })
    loadDataIfNeeded()
  } else if (/^#\/collections\/[^/]+\/groups\/[^/]+$/.test(routePath)) {
    const match = routePath.match(/^#\/collections\/([^/]+)\/groups\/([^/]+)$/)
    const collectionId = decodeURIComponent(match[1])
    const groupId = decodeURIComponent(match[2])
    renderGroup(content, state, collectionId, groupId, { onReload: reloadData })
    loadDataIfNeeded()
  } else if (/^#\/bookmarks\/[^/]+$/.test(routePath)) {
    const bookmarkId = decodeURIComponent(routePath.slice('#/bookmarks/'.length))
    renderBookmark(content, state, bookmarkId, { onReload: reloadData, onDeleted: (collectionId) => navigate(collectionId === null ? '#/inbox' : '#/collections/' + encodeURIComponent(collectionId)) })
    loadDataIfNeeded()
  } else if (routePath === '#/import') {
    renderImport(content, state, { onReload: reloadData })
  } else if (routePath === '#/settings') {
    renderSettings(content, state, { onReload: reloadData })
    loadDataIfNeeded()
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
function renderStartupMessage(text, isError = false) {
  content.replaceChildren()
  const message = document.createElement('p')
  message.className = isError ? 'error' : 'loading'
  message.textContent = text
  content.append(message)
}
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
async function start() {
  const retryInterval = 500
  const maxWait = 30000
  const startedAt = Date.now()
  renderStartupMessage('Cargando Lotura…')
  while (true) {
    try {
      const result = await getIdentity()
      state.identity = result.identity
      initialized = true
      if (!window.location.hash) window.location.hash = '#/'
      renderCurrentRoute()
      return
    } catch (error) {
      if (error?.code !== 'NOT_READY') {
        renderStartupMessage(`Error al conectar con la API: ${error instanceof Error ? error.message : String(error)}`, true)
        return
      }
      if (Date.now() - startedAt >= maxWait) {
        renderStartupMessage('El nodo está tardando en arrancar. Comprueba la terminal o reinicia Lotura.', true)
        return
      }
      renderStartupMessage('Cargando Lotura…')
      await delay(retryInterval)
    }
  }
}
start()
