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

  const details = element('details', 'import-details')
  const detailsSummary = element('summary')
  const errorsList = element('ul', 'import-errors')
  details.append(detailsSummary, errorsList)
  details.hidden = true

  form.append(label, button)
  page.append(form, status, details, another)
  container.append(page)

  function reset() {
    file.value = ''
    file.disabled = false
    button.disabled = false
    button.textContent = 'Importar'
    status.textContent = ''
    status.className = 'import-result'
    status.hidden = true
    details.open = false
    details.hidden = true
    detailsSummary.textContent = ''
    errorsList.replaceChildren()
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
    details.open = false
    details.hidden = true
    detailsSummary.textContent = ''
    errorsList.replaceChildren()

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
      status.textContent = `Importados: ${imported.collections ?? 0} colecciones, ${imported.groups ?? 0} grupos, ${imported.bookmarks ?? 0} bookmarks.`
      status.className = 'import-result'
      const errors = Array.isArray(result.errors) ? result.errors : []
      if ((result.skipped ?? 0) > 0) {
        detailsSummary.append(
          element('span', '', `Omitidos: ${result.skipped} bookmarks. `),
          element('span', 'import-details-action', 'Ver detalle')
        )
        for (const item of errors) {
          const url = typeof item.url === 'string' ? item.url : ''
          const shortenedUrl = url.length > 60 ? `${url.slice(0, 60)}…` : (url || '(sin URL)')
          let reason = 'URL no válida'
          if (/^javascript:/i.test(url)) {
            reason = 'Enlace de JavaScript (no es una URL web)'
          } else if (/^about:/i.test(url)) {
            reason = 'Enlace interno del navegador'
          } else if (/%(?![0-9a-f]{2})/i.test(url)) {
            reason = 'URL con caracteres inválidos'
          }
          const itemRow = element('li')
          itemRow.append(
            element('span', 'import-details-url', shortenedUrl),
            element('span', 'import-details-reason', reason)
          )
          errorsList.append(itemRow)
        }
        details.hidden = false
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
