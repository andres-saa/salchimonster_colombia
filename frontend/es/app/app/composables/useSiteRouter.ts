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
    // Si los composables fallan, retornar funciones con fallbacks
    console.warn('[useSiteRouter] Error inicializando composables:', e)
    return {
      getCurrentSiteSlug: () => {
        try {
          // Intentar obtener desde el store directamente
          const { useSitesStore } = require('~/stores/site')
          const sitesStore = useSitesStore()
          if (sitesStore?.location?.site?.site_name) {
            const { getSiteSlug } = require('./useSedeFromRoute')
            return getSiteSlug(sitesStore.location.site.site_name)
          }
        } catch {}
        return null
      },
      pushWithSite: (path: string) => {
        // Fallback: usar window.location
        try {
          if (typeof window !== 'undefined') {
            // Intentar obtener el slug del store directamente
            let finalPath = path.startsWith('/') ? path : `/${path}`
            try {
              const { useSitesStore } = require('~/stores/site')
              const sitesStore = useSitesStore()
              if (sitesStore?.location?.site?.site_name) {
                const { getSiteSlug } = require('./useSedeFromRoute')
                const siteSlug = getSiteSlug(sitesStore.location.site.site_name)
                if (siteSlug) {
                  finalPath = `/${siteSlug}${finalPath}`
                }
              }
            } catch {}
            window.location.href = finalPath
          }
        } catch (err) {
          console.error('[useSiteRouter] Error en fallback pushWithSite:', err)
        }
      },
      replaceWithSite: (path: string) => {
        // Fallback: usar window.location.replace
        try {
          if (typeof window !== 'undefined') {
            // Intentar obtener el slug del store directamente
            let finalPath = path.startsWith('/') ? path : `/${path}`
            try {
              const { useSitesStore } = require('~/stores/site')
              const sitesStore = useSitesStore()
              if (sitesStore?.location?.site?.site_name) {
                const { getSiteSlug } = require('./useSedeFromRoute')
                const siteSlug = getSiteSlug(sitesStore.location.site.site_name)
                if (siteSlug) {
                  finalPath = `/${siteSlug}${finalPath}`
                }
              }
            } catch {}
            window.location.replace(finalPath)
          }
        } catch (err) {
          console.error('[useSiteRouter] Error en fallback replaceWithSite:', err)
        }
      },
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
    try {
      const siteSlug = getCurrentSiteSlug()
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const finalPath = siteSlug ? `/${siteSlug}${cleanPath}` : cleanPath
      
      // Intentar usar router de Vue Router primero
      if (router && typeof router.push === 'function') {
        router.push(finalPath).catch((err) => {
          // Si falla, usar fallback
          console.warn('[useSiteRouter] Router.push falló, usando fallback:', err)
          if (typeof window !== 'undefined') {
            window.location.href = finalPath
          }
        })
        return
      }
      
      // Fallback: usar window.location si router no está disponible
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = finalPath
        return
      }
      
      console.error('[useSiteRouter] Router no disponible y no hay fallback')
    } catch (error) {
      console.error('[useSiteRouter] Error en pushWithSite:', error)
      // Último recurso: intentar navegación directa
      try {
        const siteSlug = getCurrentSiteSlug()
        const cleanPath = path.startsWith('/') ? path : `/${path}`
        const finalPath = siteSlug ? `/${siteSlug}${cleanPath}` : cleanPath
        if (typeof window !== 'undefined') {
          window.location.href = finalPath
        }
      } catch (e) {
        console.error('[useSiteRouter] Error en fallback de navegación:', e)
      }
    }
  }

  /**
   * Reemplaza la ruta actual incluyendo la sede
   */
  const replaceWithSite = (path: string) => {
    try {
      const siteSlug = getCurrentSiteSlug()
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const finalPath = siteSlug ? `/${siteSlug}${cleanPath}` : cleanPath
      
      // Intentar usar router de Vue Router primero
      if (router && typeof router.replace === 'function') {
        router.replace(finalPath).catch((err) => {
          // Si falla, usar fallback
          console.warn('[useSiteRouter] Router.replace falló, usando fallback:', err)
          if (typeof window !== 'undefined') {
            window.location.replace(finalPath)
          }
        })
        return
      }
      
      // Fallback: usar window.location.replace si router no está disponible
      if (typeof window !== 'undefined' && window.location) {
        window.location.replace(finalPath)
        return
      }
      
      console.error('[useSiteRouter] Router no disponible y no hay fallback')
    } catch (error) {
      console.error('[useSiteRouter] Error en replaceWithSite:', error)
      // Último recurso: intentar navegación directa
      try {
        const siteSlug = getCurrentSiteSlug()
        const cleanPath = path.startsWith('/') ? path : `/${path}`
        const finalPath = siteSlug ? `/${siteSlug}${cleanPath}` : cleanPath
        if (typeof window !== 'undefined') {
          window.location.replace(finalPath)
        }
      } catch (e) {
        console.error('[useSiteRouter] Error en fallback de navegación:', e)
      }
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
