// composables/useSedeFromRoute.ts
import { computed } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Detecta la sede desde el primer segmento de la ruta
 * Ejemplo: /modelia/cart -> "modelia"
 *          /cart -> null (no hay sede)
 */
export const useSedeFromRoute = () => {
  let route
  try {
    route = useRoute()
  } catch (e) {
    // Si useRoute() falla (fuera de setup), retornar computed que siempre retorna null
    return computed(() => null)
  }
  
  const sede = computed(() => {
    if (!route || !route.path) return null
    const path = route.path
    if (!path || path === '/') return null
    
    // Remover el leading slash y dividir por '/'
    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) return null
    
    const firstSegment = segments[0]
    
    // Lista de rutas que NO son sedes (rutas estáticas)
    const staticRoutes = [
      'dispatcher',
      'sedes',
      'franquicias',
      'colaboraciones',
      'pqr',
      'horarios',
      'sonando',
      'rastrear',
      'gracias',
      'gracias-epayco',
      'cart',
      'pay',
      'carta',
      'menu',
      'buscar',
      'producto',
      'pagar'
    ]
    
    // Si el primer segmento es una ruta estática, no es una sede
    if (staticRoutes.includes(firstSegment.toLowerCase())) {
      return null
    }
    
    return firstSegment
  })
  
  return sede
}

/**
 * Obtiene el subdomain de un sitio desde su nombre
 * Normaliza el nombre para crear un slug válido para URL
 */
export function getSiteSlug(siteName: string): string {
  if (!siteName) return ''
  
  return siteName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar espacios y caracteres especiales con guiones
    .replace(/^-+|-+$/g, '') // Quitar guiones al inicio y final
    .trim()
}
