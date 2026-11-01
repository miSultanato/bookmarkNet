import {
  createIdentity,
  getRecoveryPhrase,
  importHtml,
  importRecoveryPhrase
} from './api.js'

const translations = {
  es: {
    welcome: 'Bienvenido a Lotura',
    intro: 'Tu identidad se crea al continuar. Sin cuentas, sin email.',
    importHtml: 'Importar bookmarks de mi navegador (HTML)',
    seed: 'Añadir colecciones iniciales (seed pack) — Disponible próximamente',
    continue: 'Continuar',
    creating: 'Creando identidad…',
    importing: 'Importando bookmarks…',
    recoveryTitle: 'Guarda tu frase de recuperación',
    recoveryHelp: 'Guarda esta frase en un lugar seguro. Es la única forma de recuperar tu identidad si pierdes el dispositivo.',
    copy: 'Copiar frase',
    copied: 'Frase copiada',
    copyError: 'No se pudo copiar la frase. Cópiala manualmente.',
    saved: 'He guardado la frase',
    recoveryContinue: 'Continuar',
    recoveryOption: 'Ya tengo una frase de recuperación',
    phraseLabel: 'Frase de recuperación (24 palabras)',
    import: 'Importar',
    importingIdentity: 'Importando identidad…',
    fileMissing: 'No has seleccionado archivo. ¿Continuar sin importar?',
    fileRead: 'No se pudo leer el archivo HTML.',
    fileCancel: 'La lectura del archivo se ha cancelado.'
  },
  en: {
    welcome: 'Welcome to Lotura',
    intro: 'Your identity is created when you continue. No accounts, no email.',
    importHtml: 'Import bookmarks from my browser (HTML)',
    seed: 'Add starter collections (seed pack) — Coming soon',
    continue: 'Continue',
    creating: 'Creating identity…',
    importing: 'Importing bookmarks…',
    recoveryTitle: 'Save your recovery phrase',
    recoveryHelp: 'Store this phrase somewhere safe. It is the only way to recover your identity if you lose your device.',
    copy: 'Copy phrase',
    copied: 'Phrase copied',
    copyError: 'Could not copy the phrase. Please copy it manually.',
    saved: 'I have saved the phrase',
    recoveryContinue: 'Continue',
    recoveryOption: 'I already have a recovery phrase',
    phraseLabel: 'Recovery phrase (24 words)',
    import: 'Import',
    importingIdentity: 'Importing identity…',
    fileMissing: 'No file selected. Continue without importing?',
    fileRead: 'Could not read the HTML file.',
    fileCancel: 'File reading was cancelled.'
  },
  eu: {
    welcome: 'Ongi etorri Loturara',
    intro: 'Jarraitzean sortuko da zure nortasuna. Konturik eta emailik gabe.',
    importHtml: 'Inportatu nabigatzaileko laster-markak (HTML)',
    seed: 'Gehitu hasierako bildumak (seed pack) — Laster',
    continue: 'Jarraitu',
    creating: 'Nortasuna sortzen…',
    importing: 'Laster-markak inportatzen…',
    recoveryTitle: 'Gorde berreskuratze-esaldia',
    recoveryHelp: 'Gorde esaldi hau leku seguru batean. Gailua galtzen baduzu zure nortasuna berreskuratzeko modu bakarra da.',
    copy: 'Kopiatu esaldia',
    copied: 'Esaldia kopiatuta',
    copyError: 'Ezin izan da esaldia kopiatu. Kopiatu eskuz.',
    saved: 'Esaldia gorde dut',
    recoveryContinue: 'Jarraitu',
    recoveryOption: 'Berreskuratze-esaldi bat daukat',
    phraseLabel: 'Berreskuratze-esaldia (24 hitz)',
    import: 'Inportatu',
    importingIdentity: 'Nortasuna inportatzen…',
    fileMissing: 'Ez duzu fitxategirik hautatu. Jarraitu inportatu gabe?',
    fileRead: 'Ezin izan da HTML fitxategia irakurri.',
    fileCancel: 'Fitxategiaren irakurketa bertan behera utzi da.'
  }
}

function language() {
  const locale = (navigator.language || 'es').toLowerCase()
  return locale.startsWith('eu') ? 'eu' : locale.startsWith('en') ? 'en' : 'es'
}

function readFile(file, text) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error(text.fileRead))
    reader.onerror = () => reject(reader.error || new Error(text.fileRead))
    reader.onabort = () => reject(new Error(text.fileCancel))
    reader.readAsText(file)
  })
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function showRecoveryPhrase(container, state, recovery, onDone, text) {
  container.replaceChildren()
  const section = element('section', 'onboarding recovery-screen')
  section.append(element('h1', '', text.recoveryTitle))
  section.append(element('p', 'recovery-help', text.recoveryHelp))

  const words = Array.isArray(recovery?.words)
    ? recovery.words
    : String(recovery?.phrase ?? '').trim().split(/\\s+/)
  const list = element('ol', 'recovery-words')
  words.forEach((word, index) => {
    const item = element('li', 'recovery-word')
    item.append(element('span', 'recovery-word-number', String(index + 1)))
    item.append(element('span', 'recovery-word-value', word))
    list.append(item)
  })
  section.append(list)

  const phrase = words.join(' ')
  const feedback = element('p', 'status')
  feedback.hidden = true
  const copyButton = element('button', 'secondary', text.copy)
  copyButton.type = 'button'
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(phrase)
      feedback.textContent = text.copied
    } catch {
      feedback.textContent = text.copyError
    }
    feedback.hidden = false
  })
  section.append(copyButton, feedback)

  const confirmation = element('label', 'recovery-confirm')
  const checkbox = element('input')
  checkbox.type = 'checkbox'
  checkbox.name = 'recovery-saved'
  confirmation.append(checkbox, element('span', '', text.saved))
  section.append(confirmation)

  const continueButton = element('button', 'primary', text.recoveryContinue)
  continueButton.type = 'button'
  continueButton.disabled = true
  checkbox.addEventListener('change', () => {
    continueButton.disabled = !checkbox.checked
  })
  continueButton.addEventListener('click', () => {
    if (checkbox.checked) onDone()
  })
  section.append(continueButton)
  container.append(section)
  state.recoveryPhraseShown = true
}

function showRecoveryImport(container, state, onDone, text, onBack) {
  container.replaceChildren()
  const section = element('section', 'onboarding recovery-import')
  section.append(element('h1', '', text.recoveryOption))
  const label = element('label', '', text.phraseLabel)
  const textarea = element('textarea', 'recovery-phrase-input')
  textarea.name = 'recovery-phrase'
  textarea.rows = 5
  textarea.autocomplete = 'off'
  textarea.spellcheck = false
  textarea.setAttribute('aria-label', text.phraseLabel)
  label.append(textarea)
  section.append(label)

  const feedback = element('p', 'error')
  feedback.hidden = true
  const actions = element('div', 'actions')
  const importButton = element('button', 'primary', text.import)
  importButton.type = 'button'
  importButton.addEventListener('click', async () => {
    importButton.disabled = true
    importButton.textContent = text.importingIdentity
    feedback.hidden = true
    try {
      const result = await importRecoveryPhrase(textarea.value.trim())
      state.identity = result.identity
      onDone()
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error)
      feedback.hidden = false
      importButton.disabled = false
      importButton.textContent = text.import
    }
  })
  const backButton = element('button', 'secondary', text.continue)
  backButton.type = 'button'
  backButton.addEventListener('click', onBack)
  actions.append(importButton, backButton)
  section.append(actions, feedback)
  container.append(section)
}

export function render(container, state, onDone, { onReload } = {}) {
  const text = translations[language()]
  container.replaceChildren()

  const section = element('section', 'onboarding')
  section.append(element('h1', '', text.welcome))
  section.append(element('p', '', text.intro))

  const actions = element('div', 'actions')
  const importOption = element('div', 'import-option')
  const importLabel = element('label')
  const importCheckbox = element('input')
  importCheckbox.type = 'checkbox'
  importCheckbox.name = 'import-html'
  importLabel.append(importCheckbox, element('span', '', text.importHtml))
  const file = element('input')
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

  const seedButton = element('button', 'secondary', text.seed)
  seedButton.type = 'button'
  seedButton.disabled = true
  actions.append(seedButton)

  const continueButton = element('button', 'primary', text.continue)
  continueButton.type = 'button'
  const feedback = element('p', 'error')
  feedback.hidden = true

  continueButton.addEventListener('click', async () => {
    const selectedFile = importCheckbox.checked ? file.files?.[0] : null
    if (importCheckbox.checked && !selectedFile && !window.confirm(text.fileMissing)) return

    continueButton.disabled = true
    file.disabled = true
    importCheckbox.disabled = true
    continueButton.textContent = text.creating
    feedback.hidden = true
    try {
      const identity = await createIdentity()
      state.identity = identity
      let importError = null
      if (selectedFile) {
        continueButton.textContent = text.importing
        try {
          await importHtml(await readFile(selectedFile, text))
        } catch (error) {
          importError = error instanceof Error ? error.message : String(error)
        }
      }
      const recovery = await getRecoveryPhrase()
      showRecoveryPhrase(container, state, recovery, () => onDone(importError), text)
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error)
      feedback.hidden = false
      continueButton.disabled = false
      file.disabled = false
      importCheckbox.disabled = false
      continueButton.textContent = text.continue
    }
  })

  const recoveryOption = element('button', 'secondary', text.recoveryOption)
  recoveryOption.type = 'button'
  recoveryOption.addEventListener('click', () => {
    showRecoveryImport(container, state, onDone, text, () => render(container, state, onDone, { onReload }))
  })

  actions.append(continueButton, recoveryOption)
  section.append(actions, feedback)
  container.append(section)
}
