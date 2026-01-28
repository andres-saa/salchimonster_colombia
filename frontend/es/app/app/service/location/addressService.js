// Address validation service using LocationManager API
// En desarrollo usa localhost:8000, en producción usa la URL de producción
const getLocationManagerUrl = () => {
  // En desarrollo (localhost), usar localhost:8000
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhost) {
      return 'http://localhost:8000/api'
    }
  }
  
  // En servidor, verificar si estamos en desarrollo
  if (typeof process !== 'undefined' && process.env) {
    const isDev = process.env.NODE_ENV === 'development' || 
                  process.env.NUXT_PUBLIC_LOCATION_MANAGER_URL?.includes('localhost')
    if (isDev) {
      return 'http://localhost:8000/api'
    }
  }
  
  // Producción: usar URL de producción
  return 'https://location-manager.salchimonster.com/api'
}

const API_BASE_URL = getLocationManagerUrl()

/** 
 * Check address validation
 * @param {Object} params - Address check parameters
 * @param {string} params.address - The address to validate
 * @param {string} [params.country] - Country (default: 'colombia')
 * @param {string} [params.city] - City name (required)
 * @returns {Promise<Object>} CheckAddressResponse
 */
export async function checkAddress({ address, country = 'colombia', city }) {
  if (!address || !address.trim()) {
    throw new Error('La dirección es requerida')
  }

  if (!city) {
    throw new Error('La ciudad es requerida')
  }

  try {
    // El backend espera "Colombia" con mayúscula según el schema
    const requestBody = {
      address: address.trim(),
      country: country === 'colombia' ? 'Colombia' : country,
      city: city ? city.trim() : null
    }

    const url = `${API_BASE_URL}/check/address`
    console.log('POST to:', url, 'Body:', requestBody)

    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors', // Explícitamente habilitar CORS
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      let errorDetails = null
      try {
        const errorData = await response.json()
        errorMessage = errorData.detail || errorData.message || errorMessage
        errorDetails = errorData
        console.error('Error response from server:', errorData)
      } catch (e) {
        // Si no se puede parsear el error, intentar leer como texto
        try {
          const errorText = await response.text()
          console.error('Error response (text):', errorText)
          errorMessage = errorText || errorMessage
        } catch (e2) {
          console.error('Could not parse error response')
        }
      }
      
      // Si es un 400, dar más detalles
      if (response.status === 400) {
        throw new Error(`Error de validación: ${errorMessage}. Verifica que la dirección y ciudad sean correctas.`)
      }
      
      throw new Error(errorMessage)
    }

    return await response.json()
  } catch (error) {
    // Si es un error de red (CORS, conexión, etc.)
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.error('Error de conexión con el servidor de LocationManager:', error)
      throw new Error('No se pudo conectar con el servidor de validación de direcciones.')
    }
    console.error('Error checking address:', error)
    throw error
  }
}

export default {
  checkAddress
}
