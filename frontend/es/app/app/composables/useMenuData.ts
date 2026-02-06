import { computed, watch, ref, nextTick } from 'vue'
import { useFetch } from '#imports'
import { useSitesStore, useMenuStore } from '#imports'
import { URI } from '~/service/conection'
import { useMenuPreloader } from './useMenuPreloader'

const CACHE_TTL = 30 * 60 * 1000

/**
 * Composable compartido para obtener datos del menú
 * Asegura que todos los componentes usen el mismo default y lógica de caché
 */
export function useMenuData() {
  const sitesStore = useSitesStore()
  const menuStore = useMenuStore()
  const menuPreloader = useMenuPreloader()

  const siteId = computed(() => sitesStore?.location?.site?.site_id || 1)

  // Función para cargar desde caché
  const loadMenuFromCache = () => {
    if (import.meta.client) {
      // 1. Intentar desde el preloader primero
      const prerenderedMenu = menuPreloader.getCachedMenu(siteId.value)
      if (prerenderedMenu) {
        const cachedTimestamp = menuStore.getUpdatedAtBySite(siteId.value) || Date.now()
        const now = Date.now()
        const age = now - cachedTimestamp
        if (age < CACHE_TTL) {
          return prerenderedMenu
        }
      }

      // 2. Intentar desde el store de Pinia
      const cachedMenu = menuStore.getMenuBySite(siteId.value)
      const cachedTimestamp = menuStore.getUpdatedAtBySite(siteId.value)

      if (cachedMenu && cachedTimestamp) {
        const now = Date.now()
        const age = now - cachedTimestamp
        if (age < CACHE_TTL) {
          return cachedMenu
        }
      }
    }

    return null
  }

  // Obtener datos del caché para usar como default
  const getCachedDataForSite = (currentSiteId: number) => {
    if (import.meta.client) {
      // Intentar desde el preloader primero
      const prerenderedMenu = menuPreloader.getCachedMenu(currentSiteId)
      if (prerenderedMenu) {
        const cachedTimestamp = menuStore.getUpdatedAtBySite(currentSiteId) || Date.now()
        const now = Date.now()
        const age = now - cachedTimestamp
        if (age < CACHE_TTL) {
          return prerenderedMenu
        }
      }

      // Intentar desde el store de Pinia
      const cachedMenu = menuStore.getMenuBySite(currentSiteId)
      const cachedTimestamp = menuStore.getUpdatedAtBySite(currentSiteId)

      if (cachedMenu && cachedTimestamp) {
        const now = Date.now()
        const age = now - cachedTimestamp
        if (age < CACHE_TTL) {
          return cachedMenu
        }
      }
    }
    return null
  }

  // Obtener caché inicial para el site actual
  const initialCachedData = getCachedDataForSite(siteId.value)
  const hasInitialCache = initialCachedData !== null && Array.isArray(initialCachedData.categorias) && initialCachedData.categorias.length > 0

  // Cargar products-light SOLO en el servidor (SSR) para que venga en el HTML
  // En el cliente NO hacer fetch automático - usar solo los datos del servidor
  const { data: rawCategoriesData, refresh, pending: menuPending } = useFetch(
    () => `${URI}/tiendas/${siteId.value}/products-light`,
    {
      key: () => `menu-data-${siteId.value}`,
      server: true, // Solo fetch en servidor (SSR) - los datos vienen en el HTML
      client: false, // NO hacer fetch en el cliente - usar solo datos del servidor
      // Usar datos del caché como default para que estén disponibles inmediatamente
      default: () => initialCachedData || { categorias: [] },
      // NO usar lazy - queremos que se cargue en el servidor
      lazy: false,
      immediate: true,
      // Asegurar que siempre se ejecute el fetch cuando cambie el siteId (solo en servidor)
      watch: [siteId]
    }
  )

  // En el cliente, NO hacer refresh automático
  // Solo usar los datos que vienen del servidor en el HTML
  // El refresh solo se hará cuando se llame explícitamente desde el endpoint de regeneración
  
  // Debug: Log cuando los datos cambian o cuando está pendiente
  if (import.meta.client) {
    watch(
      [() => rawCategoriesData.value, menuPending],
      ([newVal, isPending]) => {
        if (isPending) {
          console.log('[useMenuData] Cargando menu...')
        } else if (newVal && Array.isArray(newVal.categorias)) {
          console.log('[useMenuData] Datos recibidos:', newVal.categorias.length, 'categorías')
        }
      },
      { immediate: true }
    )
  }

  // Persistir en caché cuando se actualicen los datos
  if (import.meta.client) {
    watch(
      rawCategoriesData,
      (val) => {
        if (val && Array.isArray(val.categorias) && val.categorias.length) {
          menuStore.setMenuForSite(siteId.value, { data: val, timestamp: Date.now() })
        }
      },
      { immediate: true }
    )
  }

  return {
    rawCategoriesData,
    refresh,
    menuPending,
    siteId,
    loadMenuFromCache
  }
}
