const status = document.querySelector('#status')

async function loadIdentity() {
  try {
    const response = await fetch('/api/v1/identity')
    if (!response.ok) {
      let message = response.statusText || `HTTP ${response.status}`
      try {
        const body = await response.json()
        message = body?.error?.message || message
      } catch {
        // Keep the HTTP status message when the response is not JSON.
      }
      throw new Error(message)
    }

    const body = await response.json()
    if (body.identity === null) {
      status.textContent = 'Sin identidad. La UI de onboarding vendrá en la siguiente tarea.'
      return
    }

    if (body.identity && typeof body.identity.user_id === 'string') {
      status.textContent = `Identidad: ${body.identity.user_id}`
      return
    }

    throw new Error('Respuesta inesperada de la API')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    status.textContent = `Error al conectar con la API: ${message}`
  }
}

loadIdentity()
