import { importHtml } from './api.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function render(container) {
  container.replaceChildren()
  const page = element('section', 'import-page')
  page.append(element('h1', '', 'Importar'))
  page.append(element('p', '', 'Importa bookmarks desde un archivo HTML de tu navegador (Chrome, Firefox, Edge).'))

  const form = element('form', 'import-form')
  const label = element('label', '', 'Archivo HTML')
  const file = element('input')
  file.type = 'file'
  file.accept = '.html,.htm'
  file.setAttribute('aria-label', 'Archivo HTML para importar')
  label.append(file)

  const button = element('button', 'primary', 'Importar')
  button.type = 'submit'
  const status = element('p', 'import-result')
  status.hidden = true
  const another = element('button', 'secondary-button', 'Importar otro archivo')
  another.type = 'button'
  another.hidden = true

  const errorsList = element('ul', 'import-errors')
  errorsList.hidden = true

  form.append(label, button)
  page.append(form, status, errorsList, another)
  container.append(page)

  function reset() {
    file.value = ''
    file.disabled = false
    button.disabled = false
    button.textContent = 'Importar'
    status.textContent = ''
    status.className = 'import-result'
    status.hidden = true
    errorsList.replaceChildren()
    errorsList.hidden = true
    another.hidden = true
    form.hidden = false
  }

  another.addEventListener('click', reset)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const selectedFile = file.files?.[0]
    if (!selectedFile) {
      status.className = 'import-result error'
      status.textContent = 'Selecciona un archivo HTML.'
      status.hidden = false
      return
    }

    button.disabled = true
    file.disabled = true
    button.textContent = 'Importando…'
    status.className = 'import-result'
    status.textContent = 'Importando…'
    status.hidden = false
    errorsList.replaceChildren()
    errorsList.hidden = true

    try {
      const html = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('No se pudo leer el archivo HTML.'))
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo HTML.'))
        reader.onabort = () => reject(new Error('La lectura del archivo se ha cancelado.'))
        reader.readAsText(selectedFile)
      })
      const result = await importHtml(html)
      const imported = result.imported || {}
      status.textContent = `Importados: ${imported.collections ?? 0} colecciones, ${imported.groups ?? 0} grupos, ${imported.bookmarks ?? 0} bookmarks. Omitidos: ${result.skipped ?? 0}.`
      status.className = 'import-result'
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        for (const item of result.errors) {
          errorsList.append(element('li', '', `${item.url || '(sin URL)'}: ${item.reason || 'Error de importación'}`))
        }
        errorsList.hidden = false
      }
      form.hidden = true
      another.hidden = false
    } catch (error) {
      status.className = 'import-result error'
      status.textContent = error instanceof Error ? error.message : String(error)
      status.hidden = false
      file.disabled = false
      button.disabled = false
      button.textContent = 'Reintentar'
    }
  })
}
