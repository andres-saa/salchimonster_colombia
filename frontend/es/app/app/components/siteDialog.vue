<template>
  <Dialog
    style="max-width: 30rem; margin: .5rem; width: 90%;"
    modal
    v-model:visible="store.visibles.currentSite"
  >
    <div>
      <div class="modal-body">
        <!-- ================== CIUDAD FIJA (SIN SELECTOR) ================== -->
        <div class="form-group">
          <label>Ciudad</label>
          <div class="fixed-city">
            <span class="fixed-city-name">
              {{ fixedCity?.city_name || `Ciudad #${cityId || '-'}` }}
            </span>
            <span v-if="loadingSite" class="mini-muted">Cargando sede…</span>
          </div>
        </div>

        <!-- ================== BARRIO (SIEMPRE) ================== -->
        <div class="form-group fade-in">
          <label>¿Cuál es tu barrio?</label>

          <div class="custom-select">
            <Select
              v-model="currenNeigborhood"
              :options="possibleNeigborhoods"
              optionLabel="name"
              placeholder="Selecciona tu barrio"
              filter
              filterPlaceholder="Buscar barrio..."
              :disabled="!possibleNeigborhoods.length || !cityId"
              :loading="spinnersView.barrio"
              class="pv-select"
            />
          </div>

          <span v-if="spinnersView.barrio" class="loader-mini-external"></span>

          <div v-if="!spinnersView.barrio && cityId && possibleNeigborhoods.length === 0" class="mini-muted">
            No hay barrios disponibles para esta ciudad.
          </div>
        </div>

        <!-- Preview de sede -->
        <div
          class="image-preview fade-in"
          v-if="currenNeigborhood?.site_id"
        >
          <div style="padding: 1rem;" class="image-overlay">
            <p class="site-info">
              <span class="brand">SALCHIMONSTER - </span>
              <span class="site">{{ currentSite?.site_name || 'Cargando...' }}</span>
            </p>
            <p class="delivery-info">
              Domicilio: ${{ formatPrice(currenNeigborhood?.delivery_price) }}
            </p>
          </div>

          <img
            :src="`${URI}/read-product-image/600/site-${currenNeigborhood?.site_id}`"
            class="site-img"
            style="aspect-ratio: 5/3; object-fit: cover;"
            @error="handleImageError"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <button
        @click="confirmLocation"
        :disabled="!canSave"
        class="native-btn"
        :class="{ 'btn-disabled': !canSave }"
      >
        Confirmar Ubicación
      </button>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'

import { useSedeFromSubdomain } from '#imports'
import { useSitesStore } from '@/stores/site'
import { URI } from '@/service/conection'

const store = useSitesStore()

// ================== ESTADOS ==================
const spinnersView = ref({ barrio: false })
const possibleNeigborhoods = ref([])
const currenNeigborhood = ref(null)

const currentSite = ref({})
const cachedSites = ref(null)

const loadingSite = ref(false)
const siteFromSubdomain = ref(null)

const cities = ref([])
const fixedCity = ref(null)     // objeto ciudad {city_id, city_name, ...}
const cityId = computed(() => siteFromSubdomain.value?.city_id ?? null)

// ================== HELPERS ==================
const handleImageError = (e) => { e.target.style.display = 'none' }
const formatPrice = (v) => new Intl.NumberFormat('es-CO').format(v || 0)

// ✅ subdominio fresco
function getCurrentSubdomain() {
  const sede = useSedeFromSubdomain()
  return typeof sede === 'string' ? sede : sede?.value
}

// ================== COMPUTED ==================
const canSave = computed(() => {
  const nb = currenNeigborhood.value
  if (!nb) return false
  return !!(nb.neighborhood_id || nb.id)
})

// ================== CONFIRM ==================
const confirmLocation = () => {
  if (!canSave.value) return

  const nb = currenNeigborhood.value
  const delivery = nb?.delivery_price || 0

  // ✅ site: preferimos el completo si ya lo resolvimos por site_id
  const siteObj = (currentSite.value && currentSite.value.site_id)
    ? currentSite.value
    : { site_id: nb?.site_id, site_name: 'SEDE' }

  store.updateLocation(
    {
      city: fixedCity.value || { city_id: cityId.value },
      neigborhood: nb,
      site: siteObj,
      mode: 'barrios',
    },
    delivery
  )

  store.setVisible('currentSite', false)
}

// ================== APIs ==================
const getCities = async () => {
  try {
    cities.value = await (await fetch(`${URI}/cities`)).json()
  } catch {
    cities.value = []
  }
}

const resolveFixedCity = async () => {
  // intenta resolver el nombre de la ciudad desde /cities
  if (!cityId.value) return
  if (!cities.value.length) await getCities()

  const match = cities.value.find(c => Number(c.city_id) === Number(cityId.value))
  fixedCity.value = match || { city_id: cityId.value, city_name: '' }
}

const loadSiteBySubdomain = async () => {
  loadingSite.value = true
  try {
    const sub = getCurrentSubdomain()
    if (!sub) return

    const res = await fetch(`${URI}/sites/subdomain/${sub}`)
    if (!res.ok) return

    const data = await res.json()
    siteFromSubdomain.value = data?.[0] || data || null
  } catch {
    siteFromSubdomain.value = null
  } finally {
    loadingSite.value = false
  }
}

const changePossiblesNeigborhoods = async () => {
  if (!cityId.value) { possibleNeigborhoods.value = []; return }
  spinnersView.value.barrio = true
  try {
    possibleNeigborhoods.value = await (await fetch(`${URI}/neighborhoods/by-city/${cityId.value}`)).json()
  } catch {
    possibleNeigborhoods.value = []
  } finally {
    spinnersView.value.barrio = false
  }
}

const ensureSitesLoaded = async () => {
  if (cachedSites.value) return cachedSites.value
  try {
    cachedSites.value = await (await fetch(`${URI}/sites`)).json()
  } catch {
    cachedSites.value = []
  }
  return cachedSites.value
}

// ================== RESTORE ==================
const restoreFromStore = async () => {
  // si ya hay barrio guardado y pertenece a esta ciudad, lo re-seleccionamos
  const storedNb = store.location?.neigborhood
  if (!storedNb) return

  const wantedId = storedNb.neighborhood_id || storedNb.id
  if (!wantedId) return

  const match = possibleNeigborhoods.value.find(n => (n.neighborhood_id || n.id) === wantedId)
  if (match) currenNeigborhood.value = match
}

// ================== LIFECYCLE ==================
onMounted(async () => {
  // 1) Sede por subdominio
  await loadSiteBySubdomain()

  // 2) Resolver ciudad (nombre) y cargar barrios
  await resolveFixedCity()
  await changePossiblesNeigborhoods()

  // 3) Restaurar selección previa (si aplica)
  await restoreFromStore()
})

// Cuando cambia el barrio, trae la sede (por site_id)
watch(currenNeigborhood, async (newVal) => {
  if (!newVal?.site_id) {
    currentSite.value = {}
    return
  }

  try {
    const allSites = await ensureSitesLoaded()
    currentSite.value = allSites.find(s => Number(s.site_id) === Number(newVal.site_id)) || {}
  } catch {
    currentSite.value = { site_name: 'Sede', site_id: newVal.site_id }
  }
})

// Si por alguna razón cambia la sede/city_id (hash/subdominio), recarga barrios
watch(cityId, async (newId, oldId) => {
  if (!newId || newId === oldId) return
  currenNeigborhood.value = null
  currentSite.value = {}
  fixedCity.value = null
  await resolveFixedCity()
  await changePossiblesNeigborhoods()
})
</script>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
  font-family: inherit;
  user-select: none;
}

.custom-select :deep(.p-select) {
  width: 100%;
}

.custom-select :deep(.p-select:hover) {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.custom-select :deep(.p-select[aria-expanded="true"]) {
  border-color: #000;
  background: #fff;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.custom-select :deep(.p-select-overlay) {
  border: 1px solid #000;
  border-top: none;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.modal-body {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  overflow-y: visible;
}

.form-group label {
  font-weight: 700;
  font-size: 0.85rem;
  color: #374151;
  margin-bottom: 0.5rem;
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fixed-city {
  padding: .8rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: .75rem;
}

.fixed-city-name {
  font-weight: 800;
  font-size: .95rem;
  color: #111827;
}

.mini-muted {
  font-size: .8rem;
  opacity: .7;
}

.loader-mini-external {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #ccc;
  border-top-color: #000;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-left: 5px;
}

.image-preview {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #eee;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}
.image-preview img { width: 100%; height: 100%; object-fit: cover; }

.site-info {
  font-weight: 800;
  font-size: 1rem;
  margin: 0;
  text-transform: uppercase;
}
.delivery-info {
  font-size: 0.85rem;
  margin: 0;
  opacity: 0.9;
  margin-top: 2px;
}

.native-btn {
  background: #000;
  color: #fff;
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 0.5rem;
  font-size: 1rem;
  transition: transform 0.1s;
}
.native-btn:active { transform: scale(0.98); }
.native-btn.btn-disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

@keyframes spin { to { transform: rotate(360deg); } }
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

* { text-transform: uppercase; }
</style>
