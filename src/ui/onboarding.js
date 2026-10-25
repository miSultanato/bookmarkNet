import { createIdentity } from './api.js'

export function render(container, state, onDone) {
  container.replaceChildren()

  const section = document.createElement('section')
  section.className = 'onboarding'

  const heading = document.createElement('h1')
  heading.textContent = 'Bienvenido a BookmarkNet'
  section.append(heading)

  const intro = document.createElement('p')
  intro.textContent = 'Tu identidad se crea al continuar. Sin cuentas, sin email.'
  section.append(intro)

  const actions = document.createElement('div')
  actions.className = 'actions'

  const importButton = document.createElement('button')
  importButton.type = 'button'
  importButton.textContent = 'Importar bookmarks de mi navegador (HTML)'
  importButton.addEventListener('click', () => showComingSoon(section))
  actions.append(importButton)

  const seedButton = document.createElement('button')
  seedButton.type = 'button'
  seedButton.textContent = 'Añadir colecciones iniciales (seed pack)'
  seedButton.addEventListener('click', () => showComingSoon(section))
  actions.append(seedButton)

  const continueButton = document.createElement('button')
  continueButton.type = 'button'
  continueButton.className = 'primary'
  continueButton.textContent = 'Continuar'

  const feedback = document.createElement('p')
  feedback.className = 'error'
  feedback.hidden = true

  continueButton.addEventListener('click', async () => {
    continueButton.disabled = true
    continueButton.textContent = 'Creando identidad…'
    feedback.hidden = true
    feedback.textContent = ''
    try {
      const identity = await createIdentity()
      state.identity = identity
      onDone()
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error)
      feedback.hidden = false
      continueButton.disabled = false
      continueButton.textContent = 'Continuar'
    }
  })

  actions.append(continueButton)
  section.append(actions, feedback)
  container.append(section)
}

function showComingSoon(section) {
  let notice = section.querySelector('.coming-soon')
  if (!notice) {
    notice = document.createElement('p')
    notice.className = 'placeholder coming-soon'
    section.append(notice)
  }
  notice.textContent = 'Disponible próximamente'
}
