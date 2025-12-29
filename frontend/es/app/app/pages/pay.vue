<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSedeFromSubdomain } from '#imports'
import { URI } from '@/service/conection'

const CONFIG_URL = 'https://api.locations.salchimonster.com/data/cities_google_map_status'

const loading = ref(true)
const site = ref<any | null>(null)
const cityConfig = ref<any[]>([])
const errorMsg = ref<string>('')

// ✅ subdominio fresco
function getCurrentSubdomain() {
  const sede = useSedeFromSubdomain()
  return typeof sede === 'string' ? sede : sede?.value
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

async function loadSiteBySubdomain(subdomain: string) {
  const res = await fetchWithTimeout(`${URI}/sites/subdomain/${subdomain}`, 8000)
  if (!res.ok) throw new Error(`No pude cargar sede (${res.status})`)
  const data = await res.json()
  return data?.[0] || data || null
}

async function loadCityConfig() {
  const res = await fetchWithTimeout(CONFIG_URL, 8000)
  if (!res.ok) throw new Error(`No pude cargar config ciudades (${res.status})`)
  const json = await res.json()
  return json?.data?.cities || []
}

onMounted(async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const sub = getCurrentSubdomain()
    if (!sub) throw new Error('No hay subdominio')

    // 1) sede
    site.value = await loadSiteBySubdomain(sub)

    // 2) config
    cityConfig.value = await loadCityConfig()
  } catch (e: any) {
    console.error(e)
    errorMsg.value = e?.message || 'Error cargando datos'
    // fallback seguro
    site.value = site.value || null
    cityConfig.value = cityConfig.value || []
  } finally {
    loading.value = false
  }
})

const currentCityId = computed<number | null>(() => {
  const id = site.value?.city_id
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
