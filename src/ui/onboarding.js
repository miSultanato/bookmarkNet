import { createIdentity, importHtml } from './api.js'

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer el archivo HTML.'))
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo HTML.'))
    reader.onabort = () => reject(new Error('La lectura del archivo se ha cancelado.'))
    reader.readAsText(file)
  })
}

export function render(container, state, onDone, { onReload } = {}) {
  container.replaceChildren()

  const section = document.createElement('section')
  section.className = 'onboarding'

  const heading = document.createElement('h1')
  heading.textContent = 'Bienvenido a Lotura'
  section.append(heading)

  const intro = document.createElement('p')
  intro.textContent = 'Tu identidad se crea al continuar. Sin cuentas, sin email.'
  section.append(intro)

  const actions = document.createElement('div')
  actions.className = 'actions'

  const importOption = document.createElement('div')
  importOption.className = 'import-option'
  const importLabel = document.createElement('label')
  const importCheckbox = document.createElement('input')
  importCheckbox.type = 'checkbox'
  importCheckbox.name = 'import-html'
  const importText = document.createElement('span')
  importText.textContent = 'Importar bookmarks de mi navegador (HTML)'
  importLabel.append(importCheckbox, importText)
  const file = document.createElement('input')
  file.type = 'file'
  file.accept = '.html,.htm'
  file.hidden = true
  file.setAttribute('aria-label', 'Archivo HTML para importar')
  importCheckbox.addEventListener('change', () => {
    file.hidden = !importCheckbox.checked
    if (!importCheckbox.checked) file.value = ''
  })
  importOption.append(importLabel, file)
  actions.append(importOption)

  const seedButton = document.createElement('button')
  seedButton.type = 'button'
  seedButton.textContent = 'Añadir colecciones iniciales (seed pack) — Disponible próximamente'
  seedButton.disabled = true
  seedButton.title = 'Disponible próximamente (MVP4)'
  actions.append(seedButton)

  const continueButton = document.createElement('button')
  continueButton.type = 'button'
  continueButton.className = 'primary'
  continueButton.textContent = 'Continuar'

  const feedback = document.createElement('p')
  feedback.className = 'error'
  feedback.hidden = true

  continueButton.addEventListener('click', async () => {
    const selectedFile = importCheckbox.checked ? file.files?.[0] : null
    if (importCheckbox.checked && !selectedFile &&
      !window.confirm('No has seleccionado archivo. ¿Continuar sin importar?')) {
      return
    }

    continueButton.disabled = true
    file.disabled = true
    importCheckbox.disabled = true
    continueButton.textContent = 'Creando identidad…'
    feedback.hidden = true
    feedback.textContent = ''
    try {
      const identity = await createIdentity()
      state.identity = identity
      if (selectedFile) {
        continueButton.textContent = 'Importando bookmarks…'
        let importError = null
        try {
          const html = await readFile(selectedFile)
          await importHtml(html)
        } catch (error) {
          importError = error instanceof Error ? error.message : String(error)
        }
        try {
          await onReload?.()
        } catch (error) {
          if (!importError) importError = error instanceof Error ? error.message : String(error)
        }
        onDone(importError)
        return
      }
      onDone()
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error)
      feedback.hidden = false
      continueButton.disabled = false
      file.disabled = false
      importCheckbox.disabled = false
      continueButton.textContent = 'Continuar'
    }
  })

  actions.append(continueButton)
  section.append(actions, feedback)
  container.append(section)
}
