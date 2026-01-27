// composables/useMenuPreloader.ts
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMenuStore } from '~/stores/menu'
import { useSitesStore } from '~/stores/site'
import { URI } from '~/service/conection'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutos
const CACHE_TTL = 30 * 60 * 1000 // 30 minutos (TTL del caché)

interface MenuData {
  categorias: any[]
  [key: string]: any
}

interface MenuCacheEntry {
  data: MenuData
  timestamp: number
  etag?: string // Para verificar cambios
}

interface FetchResult {
  data: MenuData
  etag?: string
}

// Cache global para todos los sites
const menuCache = ref<Record<number, MenuCacheEntry>>({})
const refreshIntervals = ref<Record<number, ReturnType<typeof setInterval>>>({})
const isRefreshing = ref<Record<number, boolean>>({})
const allSites = ref<Array<{ site_id: number }>>([])
const isPreloadingAll = ref(false)

/**
 * Obtiene el menú de un site desde el servidor
 * Carga products-light
 */
async function fetchMenuFromServer(siteId: number): Promise<FetchResult | null> {
  try {
    const response = await fetch(`${URI}/tiendas/${siteId}/products-light`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[MenuPreloader] Error fetching menu for site ${siteId}:`, response.status)
      return null
    }

    const data = await response.json()
    const etag = response.headers.get('etag') || undefined

    return { data, etag }
  } catch (error) {
    console.error(`[MenuPreloader] Error fetching menu for site ${siteId}:`, error)
    return null
  }
}

/**
 * Verifica si el menú ha cambiado comparando ETags
 * Usa products-light para el check
 */
async function checkMenuChanged(siteId: number, currentEtag?: string): Promise<boolean> {
  try {
    const response = await fetch(`${URI}/tiendas/${siteId}/products-light`, {
      method: 'HEAD', // Solo headers, no body
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) return true // Si falla, asumimos que cambió

    const newEtag = response.headers.get('etag')
    return newEtag !== currentEtag
  } catch (error) {
    console.error(`[MenuPreloader] Error checking menu changes for site ${siteId}:`, error)
    return true // Si falla, asumimos que cambió
  }
}

/**
 * Precarga el menú para un site específico
 */
export async function preloadMenuForSite(siteId: number): Promise<void> {
  if (isRefreshing.value[siteId]) {
    return // Ya se está refrescando
  }

  isRefreshing.value[siteId] = true

  try {
    const result = await fetchMenuFromServer(siteId)
    if (result) {
      const { data, etag } = result
      const menuStore = useMenuStore()
      
      // Guardar en el store de Pinia
      menuStore.setMenuForSite(siteId, data)
      
      // Guardar en caché local con timestamp y etag
      menuCache.value[siteId] = {
        data,
        timestamp: Date.now(),
        etag
      }

      console.log(`[MenuPreloader] Menu precargado para site ${siteId}`)
    }
  } catch (error) {
    console.error(`[MenuPreloader] Error precargando menú para site ${siteId}:`, error)
  } finally {
    isRefreshing.value[siteId] = false
  }
}

/**
 * Actualiza el menú para un site si ha cambiado
 */
export async function refreshMenuForSite(siteId: number, force = false): Promise<void> {
  if (isRefreshing.value[siteId] && !force) {
    return // Ya se está refrescando
  }

  const cached = menuCache.value[siteId]
  
  // Si hay caché y no es forzado, verificar si cambió
  if (cached && !force) {
    const hasChanged = await checkMenuChanged(siteId, cached.etag)
    if (!hasChanged) {
      console.log(`[MenuPreloader] Menú para site ${siteId} no ha cambiado`)
      return // No ha cambiado, no actualizar
    }
  }

  isRefreshing.value[siteId] = true

  try {
    const result = await fetchMenuFromServer(siteId)
    if (result) {
      const { data, etag } = result
      const menuStore = useMenuStore()
      
      // Actualizar en el store
      menuStore.setMenuForSite(siteId, data)
      
      // Actualizar caché local
      menuCache.value[siteId] = {
        data,
        timestamp: Date.now(),
        etag
      }

      console.log(`[MenuPreloader] Menú actualizado para site ${siteId}`)
    }
  } catch (error) {
    console.error(`[MenuPreloader] Error actualizando menú para site ${siteId}:`, error)
  } finally {
    isRefreshing.value[siteId] = false
  }
}

/**
 * Inicia la actualización periódica para un site
 */
export function startPeriodicRefresh(siteId: number): void {
  // Limpiar intervalo anterior si existe
  if (refreshIntervals.value[siteId]) {
    clearInterval(refreshIntervals.value[siteId])
  }

  // Actualizar cada 10 minutos
  refreshIntervals.value[siteId] = setInterval(() => {
    refreshMenuForSite(siteId)
  }, REFRESH_INTERVAL)

  console.log(`[MenuPreloader] Actualización periódica iniciada para site ${siteId}`)
}

/**
 * Detiene la actualización periódica para un site
 */
export function stopPeriodicRefresh(siteId: number): void {
  if (refreshIntervals.value[siteId]) {
    clearInterval(refreshIntervals.value[siteId])
    delete refreshIntervals.value[siteId]
    console.log(`[MenuPreloader] Actualización periódica detenida para site ${siteId}`)
  }
}

/**
 * Obtiene el menú cached para un site
 */
export function getCachedMenu(siteId: number): MenuData | null {
  const cached = menuCache.value[siteId]
  if (!cached) return null

  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL) {
    return null // Caché expirado
  }

  return cached.data
}

/**
 * Obtiene todas las sedes disponibles
 */
async function fetchAllSites(): Promise<Array<{ site_id: number }>> {
  try {
    const response = await fetch(`${URI}/sites`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[MenuPreloader] Error fetching sites:`, response.status)
      return []
    }

    const sites = await response.json()
    // Filtrar solo las sedes que están activas y visibles
    return (sites || []).filter(
      (s: any) => s.show_on_web && s.site_id && s.time_zone === 'America/Bogota' && s.site_id !== 32
    )
  } catch (error) {
    console.error(`[MenuPreloader] Error fetching sites:`, error)
    return []
  }
}

/**
 * Precarga el menú para todas las sedes disponibles
 * Usa procesamiento en lotes para no sobrecargar el servidor
 */
export async function preloadAllSitesMenus(): Promise<void> {
  if (isPreloadingAll.value) {
    return // Ya se está precargando
  }

  isPreloadingAll.value = true

  try {
    // 1. Obtener todas las sedes
    const sites = await fetchAllSites()
    allSites.value = sites

    if (sites.length === 0) {
      console.warn('[MenuPreloader] No se encontraron sedes para precargar')
      return
    }

    console.log(`[MenuPreloader] Iniciando prerender para ${sites.length} sedes`)

    // 2. Precargar menús en paralelo con límite de concurrencia (5 a la vez)
    const BATCH_SIZE = 5
    const siteIds = sites.map(s => s.site_id)

    for (let i = 0; i < siteIds.length; i += BATCH_SIZE) {
      const batch = siteIds.slice(i, i + BATCH_SIZE)
      
      // Precargar este lote en paralelo
      await Promise.all(
        batch.map(siteId => 
          preloadMenuForSite(siteId).catch(err => 
            console.error(`[MenuPreloader] Error precargando menú para site ${siteId}:`, err)
          )
        )
      )

      // Pequeña pausa entre lotes para no sobrecargar
      if (i + BATCH_SIZE < siteIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`[MenuPreloader] Prerender completado para ${sites.length} sedes`)
  } catch (error) {
    console.error('[MenuPreloader] Error en prerender de todas las sedes:', error)
  } finally {
    isPreloadingAll.value = false
  }
}

/**
 * Composable principal para usar el menú con prerender y actualización automática
 */
export function useMenuPreloader() {
  const menuStore = useMenuStore()
  const sitesStore = useSitesStore()
  
  const siteId = computed(() => sitesStore?.location?.site?.site_id || 1)
  const isLoading = computed(() => isRefreshing.value[siteId.value] || false)

  /**
   * Obtiene el menú para el site actual desde caché
   * NO hace fetch - solo devuelve lo que está en caché
   */
  const getMenu = async (): Promise<MenuData | null> => {
    if (typeof window === 'undefined') return null // Solo en cliente
    
    const currentSiteId = siteId.value

    // 1. Intentar obtener del caché local primero
    let cached = getCachedMenu(currentSiteId)
    
    // 2. Si no hay en caché local, intentar del store de Pinia
    if (!cached) {
      const storeData = menuStore.getMenuBySite(currentSiteId)
      if (storeData) {
        cached = storeData
        // Sincronizar con caché local
        const updatedAt = menuStore.getUpdatedAtBySite(currentSiteId) || Date.now()
        menuCache.value[currentSiteId] = {
          data: cached,
          timestamp: updatedAt
        }
      }
    }

    return cached
  }

  /**
   * Inicializa el sistema de actualización periódica (sin prerender de todas las sedes)
   * NO hace fetch inicial si useMenuData ya está cargando o tiene datos
   */
  const initialize = async () => {
    if (typeof window === 'undefined') return // Solo en cliente

    const currentSiteId = siteId.value

    // NO hacer fetch inicial aquí - useMenuData ya lo está haciendo
    // Solo iniciar la actualización periódica en background
    startPeriodicRefresh(currentSiteId)
  }

  /**
   * Limpia recursos al desmontar
   */
  const cleanup = () => {
    stopPeriodicRefresh(siteId.value)
  }

  // Auto-inicializar y limpiar (solo en cliente)
  if (typeof window !== 'undefined') {
    onMounted(() => {
      initialize()
    })

    onUnmounted(() => {
      cleanup()
    })

    // Reiniciar cuando cambia el site
    watch(siteId, (newSiteId, oldSiteId) => {
      if (newSiteId !== oldSiteId && oldSiteId) {
        stopPeriodicRefresh(oldSiteId)
        initialize()
      }
    })
  }

  return {
    getMenu,
    initialize,
    cleanup,
    isLoading,
    siteId,
    refreshMenu: () => refreshMenuForSite(siteId.value, true),
    preloadAllSites: preloadAllSitesMenus,
    getCachedMenu: (id: number) => getCachedMenu(id)
  }
}
