<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { navigateTo } from '#app'
import { useSedeFromRoute } from '~/composables/useSedeFromRoute'
import { useSitesStore } from '~/stores/site'
import { URI } from '@/service/conection'

const CONFIG_URL = 'https://api.locations.salchimonster.com/data/cities_google_map_status'

const loading = ref(true)
const site = ref<any | null>(null)
const cityConfig = ref<any[]>([])
const errorMsg = ref<string>('')

const sitesStore = useSitesStore()
const sedeFromRoute = useSedeFromRoute()

// ✅ Obtener slug desde la ruta o desde el store
function getCurrentSiteSlug(): string | null {
  // Prioridad: URL > Store
  if (sedeFromRoute.value) {
    return sedeFromRoute.value
  }
  
  if (sitesStore?.location?.site?.site_name) {
    // Normalizar el nombre del sitio a slug
    return sitesStore.location.site.site_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim()
  }
  
  return null
}

// ✅ fetch con timeout para que nunca se quede pegado
async function fetchWithTimeout(url: string, ms = 8000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

async function loadSiteBySlug(slug: string) {
  // Cargar todas las sedes y buscar por slug (normalizando el nombre)
  const res = await fetchWithTimeout(`${URI}/sites`, 8000)
  if (!res.ok) throw new Error(`No pude cargar sedes (${res.status})`)
  const allSites = await res.json()
  
  // Buscar la sede que coincida con el slug
  const foundSite = allSites.find((s: any) => {
    if (!s.site_name) return false
    const siteSlug = s.site_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim()
    return siteSlug === slug.toLowerCase()
  })
  
  return foundSite || null
}

async function loadCityConfig() {
  const res = await fetchWithTimeout(CONFIG_URL, 8000)
  if (!res.ok) throw new Error(`No pude cargar config ciudades (${res.status})`)
  const json = await res.json()
  return json?.data?.cities || []
}

// ✅ Usar el site del store si ya está disponible
const currentSite = computed(() => {
  return sitesStore?.location?.site || site.value
})

async function loadSiteData() {
  loading.value = true
  errorMsg.value = ''
  
  try {
    // Prioridad 1: Si ya tenemos el site en el store con site_id, usarlo directamente
    if (sitesStore?.location?.site?.site_id) {
      site.value = sitesStore.location.site
    } else {
      // Prioridad 2: Intentar cargarlo desde el slug de la URL
      const slug = getCurrentSiteSlug()
      if (!slug) {
        // Prioridad 3: Si no hay slug, usar el site del store si existe (aunque no tenga site_id)
        if (sitesStore?.location?.site) {
          site.value = sitesStore.location.site
        } else {
          throw new Error('No se pudo determinar la sede')
        }
      } else {
        const loadedSite = await loadSiteBySlug(slug)
        if (loadedSite && loadedSite.site_id) {
          site.value = loadedSite
          // Actualizar el store con el site cargado
          sitesStore.location.site = loadedSite
        } else {
          // Si no se encontró por slug, intentar usar el del store
          if (sitesStore?.location?.site?.site_id) {
            site.value = sitesStore.location.site
          } else {
          // La sede no existe, redirigir al dispatcher
          console.warn(`[Pay] Sede con slug "${slug}" no encontrada, redirigiendo al dispatcher`)
          await navigateTo('/', { replace: true })
          return
          }
        }
      }
    }

    // Cargar config de ciudades
    cityConfig.value = await loadCityConfig()
  } catch (e: any) {
    console.error('Error en loadSiteData:', e)
    errorMsg.value = e?.message || 'Error cargando datos'
    // fallback: usar site del store si existe
    if (!site.value && sitesStore?.location?.site) {
      site.value = sitesStore.location.site
    }
    cityConfig.value = cityConfig.value || []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Si ya hay una sede en el store, usarla inmediatamente
  if (sitesStore?.location?.site?.site_id) {
    site.value = sitesStore.location.site
    loading.value = false
    // Cargar config en background
    loadCityConfig().then(config => {
      cityConfig.value = config
    }).catch(() => {
      cityConfig.value = []
    })
  } else {
    // Si no hay sede en el store, cargar desde la URL
    loadSiteData()
  }
})

// Observar cambios en el store para actualizar el site
watch(() => sitesStore?.location?.site, (newSite, oldSite) => {
  if (newSite && newSite.site_id) {
    const siteChanged = !oldSite || oldSite.site_id !== newSite.site_id
    
    site.value = newSite
    
    // Si el site cambió, recargar la configuración de ciudades
    if (siteChanged) {
      loading.value = true
      loadCityConfig().then(config => {
        cityConfig.value = config
        loading.value = false
      }).catch(() => {
        cityConfig.value = []
        loading.value = false
      })
    } else {
      loading.value = false
    }
  }
}, { immediate: true, deep: true })

const currentCityId = computed<number | null>(() => {
  const current = currentSite.value
  const id = current?.city_id
  return id != null && id !== '' ? Number(id) : null
})

const shouldUseGoogleMaps = computed<boolean>(() => {
  // ✅ fallback: si no hay ciudad o no hay config -> Barrios
  if (!currentCityId.value) return false
  if (!cityConfig.value.length) return false

  const cfg = cityConfig.value.find(c => Number(c.city_id) === Number(currentCityId.value))
  return !!cfg?.user_google_map_status
})

const viewKey = computed(() => {
  return `${currentCityId.value ?? 'no-city'}-${shouldUseGoogleMaps.value ? 'gm' : 'nb'}`
})
</script>

<template>
  <ClientOnly>
    <div v-if="loading" class="loading-container">
      <p>Cargando...</p>
    </div>

    <div v-else>
      <paycGoogle v-if="shouldUseGoogleMaps" :key="viewKey" />
      <paycBarrios v-else :key="viewKey" />

      <!-- Debug opcional -->
      <!--
      <div style="font-size:11px;color:#777;margin-top:8px;">
        sub={{ useSedeFromSubdomain() }} |
        city_id={{ site?.city_id }} |
        cities={{ cityConfig.length }} |
        google={{ shouldUseGoogleMaps }} |
        err={{ errorMsg }}
      </div>
      -->
    </div>
  </ClientOnly>
</template>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: #666;
}
</style>
