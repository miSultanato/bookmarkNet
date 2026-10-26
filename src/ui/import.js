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
  file.disabled = true
  file.setAttribute('aria-label', 'Archivo HTML para importar')
  label.append(file)

  const button = element('button', 'settings-disabled', 'Importar — Disponible próximamente')
  button.type = 'submit'
  button.disabled = true
  const status = element('p', 'placeholder', 'Disponible próximamente. El endpoint POST /api/v1/import/html existe, pero la UI todavía no lo llama.')
  form.append(label, button)
  page.append(form, status)
  container.append(page)
}
