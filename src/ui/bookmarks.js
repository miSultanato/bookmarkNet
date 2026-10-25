export function render(container, state) {
  container.replaceChildren()

  const section = document.createElement('section')
  section.className = 'placeholder'

  const heading = document.createElement('h1')
  heading.textContent = 'Mis bookmarks'
  section.append(heading)

  const message = document.createElement('p')
  message.textContent = 'Próximamente: lista de colecciones, bookmarks y grupos.'
  section.append(message)

  container.append(section)
}
