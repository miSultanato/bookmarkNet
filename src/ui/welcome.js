export function render(container, state, { onStart } = {}) {
  container.replaceChildren()
  const page = document.createElement('section')
  page.className = 'welcome'

  const heading = document.createElement('h1')
  heading.textContent = 'LOTURA'
  page.append(heading)

  const tagline = document.createElement('p')
  tagline.className = 'tagline'
  tagline.textContent = 'Guarda enlaces. Comparte colecciones.'
  page.append(tagline)

  const subtitle = document.createElement('p')
  subtitle.className = 'subtitle'
  subtitle.textContent = 'Crea, comparte y descubre colecciones de enlaces.'
  page.append(subtitle)

  const actions = document.createElement('div')
  actions.className = 'actions'
  const startButton = document.createElement('button')
  startButton.type = 'button'
  startButton.className = 'primary'
  startButton.textContent = 'Empezar'
  startButton.addEventListener('click', () => onStart?.())
  const exploreButton = document.createElement('button')
  exploreButton.type = 'button'
  exploreButton.className = 'secondary'
  exploreButton.textContent = 'Explorar'
  exploreButton.disabled = true
  exploreButton.title = 'Disponible en MVP4'
  actions.append(startButton, exploreButton)
  page.append(actions)

  const columns = document.createElement('div')
  columns.className = 'columns'
  const translations = [
    ['ES', 'Guarda enlaces. Comparte colecciones.', 'Crea, comparte y descubre colecciones de enlaces.'],
    ['EN', 'Save links. Share collections.', 'Create, share and discover link collections.'],
    ['EU', 'Gorde estekak. Partekatu bildumak.', 'Sortu, partekatu eta aurkitu esteka-bildumak.']
  ]
  for (const [code, title, description] of translations) {
    const column = document.createElement('article')
    column.className = 'column'
    const language = document.createElement('span')
    language.className = 'badge'
    language.textContent = code
    const translatedTagline = document.createElement('h2')
    translatedTagline.textContent = title
    const translatedSubtitle = document.createElement('p')
    translatedSubtitle.textContent = description
    column.append(language, translatedTagline, translatedSubtitle)
    columns.append(column)
  }
  page.append(columns)
  container.append(page)
  void state
}
