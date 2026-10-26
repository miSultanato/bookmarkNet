import { getProfile, updateProfile, getConfig } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function addField(form, labelText, control) {
  const label = element('label', '', labelText)
  label.append(control)
  form.append(label)
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
      const values = {
        display_name: displayName.value,
        bio: bio.value,
        avatar: avatar.value
      }
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
