// composables/useSiteRouter.ts
import { useRouter, useRoute } from 'vue-router'
import { useSedeFromRoute, getSiteSlug } from './useSedeFromRoute'
import { useSitesStore } from '~/stores/site'

/**
 * Composable para manejar rutas que incluyen la sede en la URL
 * Ejemplo: /modelia/cart, /modelia/producto/123
 */
export function useSiteRouter() {
  let router, route, sedeFromRoute
  
  try {
    router = useRouter()
    route = useRoute()
    sedeFromRoute = useSedeFromRoute()
  } catch (e) {
    // Si los composables fallan, retornar funciones que no hacen nada o usan fallbacks
    console.warn('[useSiteRouter] Error inicializando composables:', e)
    return {
      getCurrentSiteSlug: () => null,
      pushWithSite: (path: string) => {},
      replaceWithSite: (path: string) => {},
      getRouteWithSite: (path: string) => path,
      siteSlug: { value: null }
    }
  }
  
  const sitesStore = useSitesStore()

  /**
   * Obtiene el slug de la sede actual (desde URL o store)
   */
  const getCurrentSiteSlug = (): string | null => {
    try {
      // Prioridad: URL > Store
      if (sedeFromRoute?.value) {
        return sedeFromRoute.value
      }
      
      if (sitesStore?.location?.site?.site_name) {
        return getSiteSlug(sitesStore.location.site.site_name)
      }
    } catch (e) {
      console.warn('[useSiteRouter] Error obteniendo site slug:', e)
    }
    
    return null
  }

  /**
   * Navega a una ruta incluyendo la sede en la URL
   * @param path - Ruta relativa (ej: '/cart', '/producto/123')
   */
  const pushWithSite = (path: string) => {
    const siteSlug = getCurrentSiteSlug()
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    if (siteSlug) {
      router.push(`/${siteSlug}${cleanPath}`)
    } else {
      router.push(cleanPath)
    }
  }

  /**
   * Reemplaza la ruta actual incluyendo la sede
   */
  const replaceWithSite = (path: string) => {
    const siteSlug = getCurrentSiteSlug()
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    if (siteSlug) {
      router.replace(`/${siteSlug}${cleanPath}`)
    } else {
      router.replace(cleanPath)
    }
  }

  /**
   * Obtiene la ruta completa con sede para usar en links
   */
  const getRouteWithSite = (path: string): string => {
    const siteSlug = getCurrentSiteSlug()
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    if (siteSlug) {
      return `/${siteSlug}${cleanPath}`
    }
    return cleanPath
  }

  return {
    getCurrentSiteSlug,
    pushWithSite,
    replaceWithSite,
    getRouteWithSite,
    siteSlug: sedeFromRoute
  }
}
