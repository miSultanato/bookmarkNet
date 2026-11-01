import {
  getProfile,
  updateProfile,
  getConfig,
  createBackup,
  restoreBackup
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

function language() {
  const locale = (navigator.language || 'es').toLowerCase()
  return locale.startsWith('eu') ? 'eu' : locale.startsWith('en') ? 'en' : 'es'
}

const backupTranslations = {
  es: {
    title: 'Backup y restauración', backupTitle: 'Hacer backup', password: 'Contraseña',
    backup: 'Hacer backup', backupWorking: 'Creando backup…', backupCreated: 'Backup creado',
    restoreTitle: 'Restaurar backup', path: 'Ruta del archivo de backup', mode: 'Qué restaurar',
    all: 'Todo', collections: 'Solo colecciones', restore: 'Restaurar backup',
    restoreWorking: 'Preparando restauración…', restart: 'Reinicia el nodo para completar la restauración'
  },
  en: {
    title: 'Backup and restore', backupTitle: 'Create backup', password: 'Password',
    backup: 'Create backup', backupWorking: 'Creating backup…', backupCreated: 'Backup created',
    restoreTitle: 'Restore backup', path: 'Backup file path', mode: 'What to restore',
    all: 'Everything', collections: 'Collections only', restore: 'Restore backup',
    restoreWorking: 'Preparing restore…', restart: 'Restart the node to complete the restoration'
  },
  eu: {
    title: 'Babeskopia eta leheneratzea', backupTitle: 'Egin babeskopia', password: 'Pasahitza',
    backup: 'Egin babeskopia', backupWorking: 'Babeskopia sortzen…', backupCreated: 'Babeskopia sortuta',
    restoreTitle: 'Leheneratu babeskopia', path: 'Babeskopia-fitxategiaren bidea', mode: 'Zer leheneratu',
    all: 'Dena', collections: 'Bildumak bakarrik', restore: 'Leheneratu babeskopia',
    restoreWorking: 'Leheneratzea prestatzen…', restart: 'Berrabiarazi nodoa leheneratzea osatzeko'
  }
}

function addField(form, labelText, control) {
  const label = element('label', '', labelText)
  label.append(control)
  form.append(label)
}

function renderBackupSection(page) {
  const text = backupTranslations[language()]
  const section = element('section', 'settings-section backup-section')
  section.append(element('h2', '', text.title))

  const backupForm = element('form', 'settings-form backup-form')
  backupForm.append(element('h3', '', text.backupTitle))
  const backupPassword = element('input')
  backupPassword.type = 'password'
  backupPassword.name = 'backup-password'
  backupPassword.required = true
  backupPassword.autocomplete = 'new-password'
  backupPassword.setAttribute('aria-label', text.password)
  addField(backupForm, text.password, backupPassword)
  const backupButton = element('button', '', text.backup)
  backupButton.type = 'submit'
  backupForm.append(backupButton)
  const backupFeedback = element('p', 'status')
  backupFeedback.hidden = true
  backupForm.append(backupFeedback)
  backupForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!backupForm.reportValidity()) return
    backupButton.disabled = true
    backupButton.textContent = text.backupWorking
    backupFeedback.hidden = true
    try {
      const result = await createBackup(backupPassword.value)
      backupFeedback.className = 'status'
      backupFeedback.textContent = text.backupCreated + ': ' + result.path
      backupFeedback.hidden = false
      backupPassword.value = ''
    } catch (error) {
      backupFeedback.className = 'error'
      backupFeedback.textContent = errorMessage(error)
      backupFeedback.hidden = false
    } finally {
      backupButton.disabled = false
      backupButton.textContent = text.backup
    }
  })
  section.append(backupForm)

  const restoreForm = element('form', 'settings-form restore-form')
  restoreForm.append(element('h3', '', text.restoreTitle))
  const backupPath = element('input')
  backupPath.type = 'text'
  backupPath.name = 'backup-path'
  backupPath.required = true
  backupPath.autocomplete = 'off'
  backupPath.setAttribute('aria-label', text.path)
  addField(restoreForm, text.path, backupPath)
  const restorePassword = element('input')
  restorePassword.type = 'password'
  restorePassword.name = 'restore-password'
  restorePassword.required = true
  restorePassword.autocomplete = 'new-password'
  restorePassword.setAttribute('aria-label', text.password)
  addField(restoreForm, text.password, restorePassword)
  const mode = element('select')
  mode.name = 'restore-mode'
  mode.setAttribute('aria-label', text.mode)
  const allOption = element('option', '', text.all)
  allOption.value = 'all'
  const collectionsOption = element('option', '', text.collections)
  collectionsOption.value = 'collections-only'
  mode.append(allOption, collectionsOption)
  addField(restoreForm, text.mode, mode)
  const restoreButton = element('button', '', text.restore)
  restoreButton.type = 'submit'
  restoreForm.append(restoreButton)
  const restoreFeedback = element('p', 'status')
  restoreFeedback.hidden = true
  restoreForm.append(restoreFeedback)
  restoreForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!restoreForm.reportValidity()) return
    restoreButton.disabled = true
    restoreButton.textContent = text.restoreWorking
    restoreFeedback.hidden = true
    try {
      const result = await restoreBackup({
        backupPath: backupPath.value.trim(),
        password: restorePassword.value,
        mode: mode.value
      })
      restoreFeedback.className = 'status'
      restoreFeedback.textContent = result.message || text.restart
      restoreFeedback.hidden = false
      restorePassword.value = ''
    } catch (error) {
      restoreFeedback.className = 'error'
      restoreFeedback.textContent = errorMessage(error)
      restoreFeedback.hidden = false
    } finally {
      restoreButton.disabled = false
      restoreButton.textContent = text.restore
    }
  })
  section.append(restoreForm)
  page.append(section)
}

export function render(container, state, { onReload } = {}) {
  let loading = true
  let loadError = null
  let profile = {}
  let config = null
  let saving = false
  let feedback = null

  async function load() {
    loading = true
    loadError = null
    renderView()
    try {
      const [profileResult, configResult] = await Promise.all([getProfile(), getConfig()])
      profile = profileResult.profile ?? {}
      config = configResult.config
      loading = false
    } catch (error) {
      loadError = errorMessage(error)
      loading = false
    }
    renderView()
  }

  function renderView() {
    container.replaceChildren()
    const page = element('section', 'settings-page')
    page.append(element('h1', '', 'Ajustes'))

    if (loading) {
      page.append(element('p', 'status', 'Cargando…'))
      container.append(page)
      return
    }

    if (loadError) {
      page.append(element('p', 'error', 'Error al cargar Ajustes: ' + loadError))
      const retry = element('button', '', 'Reintentar')
      retry.type = 'button'
      retry.addEventListener('click', load)
      page.append(retry)
      container.append(page)
      return
    }

    const profileSection = element('section', 'settings-section')
    profileSection.append(element('h2', '', 'Perfil'))
    const form = element('form', 'settings-form')
    const displayName = element('input')
    displayName.type = 'text'
    displayName.name = 'display_name'
    displayName.value = profile.display_name ?? ''
    displayName.setAttribute('aria-label', 'Nombre')
    const bio = element('textarea')
    bio.name = 'bio'
    bio.value = profile.bio ?? ''
    bio.setAttribute('aria-label', 'Bio')
    const avatar = element('input')
    avatar.type = 'url'
    avatar.name = 'avatar'
    avatar.value = profile.avatar ?? ''
    avatar.setAttribute('aria-label', 'URL del avatar')
    addField(form, 'Nombre (opcional)', displayName)
    addField(form, 'Bio (opcional)', bio)
    addField(form, 'Avatar (URL, opcional)', avatar)

    const save = element('button', '', saving ? 'Guardando…' : 'Guardar')
    save.type = 'submit'
    save.disabled = saving
    form.append(save)
    const profileFeedback = element('p', feedback?.type === 'error' ? 'error' : 'status')
    profileFeedback.hidden = !feedback
    if (feedback) profileFeedback.textContent = feedback.message
    form.append(profileFeedback)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (saving) return
      const values = { display_name: displayName.value, bio: bio.value, avatar: avatar.value }
      const changes = {}
      for (const key of ['display_name', 'bio', 'avatar']) {
        const original = profile[key] ?? ''
        if (values[key] !== original) changes[key] = values[key] === '' ? null : values[key]
      }
      if (Object.keys(changes).length === 0) {
        feedback = { type: 'status', message: 'No hay cambios' }
        renderView()
        return
      }
      saving = true
      feedback = null
      save.disabled = true
      save.textContent = 'Guardando…'
      profileFeedback.hidden = true
      try {
        await updateProfile(changes)
        state.settingsNotice = 'Perfil guardado'
        await onReload?.()
      } catch (error) {
        saving = false
        feedback = { type: 'error', message: errorMessage(error) }
        renderView()
      }
    })
    profileSection.append(form)
    page.append(profileSection)

    const importLinkSection = element('section', 'settings-section')
    importLinkSection.append(element('h2', '', 'Importar bookmarks'))
    importLinkSection.append(element('p', '', 'La importación HTML está disponible en su pantalla propia.'))
    const importLink = element('a', '', 'Ir a Importar bookmarks')
    importLink.href = '#/import'
    importLinkSection.append(importLink)
    page.append(importLinkSection)

    const seedSection = element('section', 'settings-section')
    seedSection.append(element('h2', '', 'Seed pack'))
    seedSection.append(element('p', '', 'Añade colecciones iniciales curadas (Viajes, Fotografía, Finanzas, etc.).'))
    const seedButton = element('button', 'settings-disabled', 'Añadir seed pack — Disponible próximamente')
    seedButton.type = 'button'
    seedButton.disabled = true
    seedSection.append(seedButton)
    page.append(seedSection)

    renderBackupSection(page)

    const configSection = element('section', 'settings-section')
    configSection.append(element('h2', '', 'Configuración'))
    const configList = element('dl', 'settings-config')
    const configFields = [
      ['port', 'Puerto'],
      ['logLevel', 'Nivel de log'],
      ['openBrowserOnStart', 'Abrir navegador al iniciar'],
      ['allowedHosts', 'Hosts permitidos'],
      ['bind', 'Bind']
    ]
    for (const [key, label] of configFields) {
      configList.append(element('dt', '', label))
      let value = config?.[key]
      if (Array.isArray(value)) value = value.join(', ')
      else if (typeof value === 'boolean') value = value ? 'Sí' : 'No'
      configList.append(element('dd', '', value === undefined || value === null ? '—' : String(value)))
    }
    configSection.append(configList)
    configSection.append(element('p', '', 'La configuración se edita en el archivo config.json del directorio de datos. Consulta la documentación (docs/22-configuracion.md) para más información.'))
    page.append(configSection)

    if (state.settingsNotice) {
      page.prepend(element('p', 'status', state.settingsNotice))
      state.settingsNotice = null
    }
    container.append(page)
  }

  void state
  void load()
}
