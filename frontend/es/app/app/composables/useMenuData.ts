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

  // Función para cargar desde caché (solo para referencia, no para evitar fetch)
  const loadMenuFromCache = () => {
    // Solo para referencia, pero NO usaremos esto para evitar el fetch
    if (import.meta.client) {
      const prerenderedMenu = menuPreloader.getCachedMenu(siteId.value)
      if (prerenderedMenu) {
        return prerenderedMenu
      }
    }

    const cachedMenu = menuStore.getMenuBySite(siteId.value)
    const cachedTimestamp = menuStore.getUpdatedAtBySite(siteId.value)

    if (cachedMenu && cachedTimestamp) {
      const now = Date.now()
      const age = now - cachedTimestamp
      if (age < CACHE_TTL) {
        return cachedMenu
      }
    }

    return null
  }

  // Cargar products-light directamente
  const { data: rawCategoriesData, refresh, pending: menuPending } = useFetch(
    () => `${URI}/tiendas/${siteId.value}/products-light`,
    {
      key: () => `menu-data-${siteId.value}`,
      server: true,
      // Default vacío para asegurar que SIEMPRE se haga el fetch
      default: () => ({ categorias: [] }),
      // Forzar que siempre haga la petición
      lazy: false,
      immediate: true,
      // Asegurar que siempre se ejecute el fetch cuando cambie el siteId
      watch: [siteId]
    }
  )
  
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
