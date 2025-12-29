<template>
  <Dialog
    style="max-width: 30rem; margin: .5rem; width: 90%; font-family: 'Inter', sans-serif;"
    modal
    v-model:visible="store.visibles.currentSite"
    :dismissableMask="true"
    header="UBICACIÓN DE ENTREGA"
  >
    <div class="modal-body">
      <div class="form-group">
        <label>Ciudad</label>
        <div class="fixed-city">
          <span class="fixed-city-name">
            <Icon name="mdi:city" size="18" />
            {{ fixedCity?.city_name || `Ciudad #${cityId || '-'}` }}
          </span>
          <span v-if="loadingSite" class="mini-muted">
            <Icon name="svg-spinners:90-ring-with-bg" /> Cargando...
          </span>
        </div>
      </div>

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
            class="pv-select w-full"
          >
            <template #value="slotProps">
              <div v-if="slotProps.value" class="flex align-items-center">
                <div>{{ slotProps.value.name }}</div>
              </div>
              <span v-else>{{ slotProps.placeholder }}</span>
            </template>
            <template #option="slotProps">
              <div class="flex align-items-center">
                <div>{{ slotProps.option.name }}</div>
              </div>
            </template>
          </Select>
        </div>
        <div v-if="!spinnersView.barrio && cityId && possibleNeigborhoods.length === 0" class="mini-muted error-text">
          No hay barrios disponibles para esta zona.
        </div>
      </div>

      <div class="form-group fade-in" v-if="currenNeigborhood">
        <label>Dirección Exacta</label>
        <div class="input-wrapper">
          <Icon name="mdi:map-marker" class="input-icon" />
          <input 
            type="text" 
            v-model="exactAddress" 
            class="input-modern" 
            placeholder="Ej: Calle 123 # 45 - 67, Apto 201" 
          />
        </div>
        <small class="mini-muted">Escribe la dirección para el domiciliario.</small>
      </div>

      <div
        class="image-preview fade-in"
        v-if="currenNeigborhood?.site_id"
      >
        <div class="image-overlay">
          <p class="site-info">
            <span class="brand">SALCHIMONSTER</span>
            <span class="site"> - {{ currentSite?.site_name || 'SEDE' }}</span>
          </p>
          <div class="delivery-badge">
            <Icon name="mdi:moped" size="16" />
            <span>Domicilio: ${{ formatPrice(currenNeigborhood?.delivery_price) }}</span>
          </div>
        </div>

        <img
          :src="`${URI}/read-product-image/600/site-${currenNeigborhood?.site_id}`"
          class="site-img"
          @error="handleImageError"
        />
      </div>
    </div>

    <template #footer>
      <div class="footer-actions">
        <button class="btn-text" @click="store.setVisible('currentSite', false)">Cancelar</button>
        <button
          @click="confirmLocation"
          :disabled="!canSave"
          class="native-btn"
          :class="{ 'btn-disabled': !canSave }"
        >
          Confirmar Ubicación
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useSitesStore, useUserStore, useSedeFromSubdomain } from '#imports' // Asegúrate de importar useUserStore
import { URI } from '~/service/conection'

/* ================= STORES ================= */
const store = useSitesStore()
const userStore = useUserStore()

/* ================= STATE ================= */
const spinnersView = ref({ barrio: false })
const possibleNeigborhoods = ref([])
const currenNeigborhood = ref(null)
const exactAddress = ref('') // Nuevo estado para la dirección escrita

const currentSite = ref({})
const cachedSites = ref(null)
const loadingSite = ref(false)
const siteFromSubdomain = ref(null)

const cities = ref([])
const fixedCity = ref(null)

// Computed para obtener ID de ciudad desde el subdominio
const cityId = computed(() => siteFromSubdomain.value?.city_id ?? null)

/* ================= HELPERS ================= */
const handleImageError = (e) => { e.target.style.display = 'none' }
const formatPrice = (v) => new Intl.NumberFormat('es-CO').format(v || 0)

function getCurrentSubdomain() {
  const sede = useSedeFromSubdomain()
  return typeof sede === 'string' ? sede : sede?.value
}

/* ================= COMPUTED ================= */
const canSave = computed(() => {
  const nb = currenNeigborhood.value
  // Debe haber barrio Y dirección escrita (mínimo 5 letras para ser válida)
  return !!(nb && (nb.neighborhood_id || nb.id) && exactAddress.value?.length > 4)
})

/* ================= ACTIONS ================= */
const confirmLocation = () => {
  if (!canSave.value) return

  const nb = currenNeigborhood.value
  const delivery = nb?.delivery_price || 0

  // Construir objeto de Sede
  const siteObj = (currentSite.value && currentSite.value.site_id)
    ? currentSite.value
    : { site_id: nb?.site_id, site_name: 'SEDE' }

  // 1. Actualizar Store de Sitios (Lógica de negocio/precios)
  store.updateLocation(
    {
      city: fixedCity.value || { city_id: cityId.value },
      neigborhood: nb,
      site: siteObj,
      mode: 'barrios',
    },
    delivery
  )

  // 2. Actualizar Usuario (Texto visible y dirección para el pedido)
  userStore.user.address = exactAddress.value
  // Guardamos también el objeto completo por si se necesita
  userStore.user.site = {
    ...siteObj,
    delivery_cost_cop: delivery,
    formatted_address: exactAddress.value
  }

  store.setVisible('currentSite', false)
}

/* ================= API CALLS ================= */
const getCities = async () => {
  try {
    cities.value = await (await fetch(`${URI}/cities`)).json()
  } catch {
    cities.value = []
  }
}

const resolveFixedCity = async () => {
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
    if (res.ok) {
      const data = await res.json()
      siteFromSubdomain.value = data?.[0] || data || null
    }
  } catch (e) {
    console.error(e)
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

/* ================= RESTORE ================= */
const restoreFromStore = () => {
  // Restaurar Barrio
  const storedNb = store.location?.neigborhood
  if (storedNb) {
    const wantedId = storedNb.neighborhood_id || storedNb.id
    if (wantedId) {
      const match = possibleNeigborhoods.value.find(n => (n.neighborhood_id || n.id) === wantedId)
      if (match) currenNeigborhood.value = match
    }
  }

  // Restaurar Dirección escrita
  if (userStore.user.address) {
    exactAddress.value = userStore.user.address
  }
}

/* ================= LIFECYCLE ================= */
onMounted(async () => {
  await loadSiteBySubdomain()
  await resolveFixedCity()
  await changePossiblesNeigborhoods()
  await restoreFromStore() // Mover aquí para asegurar que los barrios ya cargaron
})

// Watch: Si cambia el barrio, buscar info de la sede
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

// Watch: Si el store se abre externamente, re-sincronizar datos
watch(() => store.visibles.currentSite, (val) => {
  if (val) restoreFromStore()
})

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
/* Estilos modernizados */
.modal-body { display: flex; flex-direction: column; gap: 1.25rem; padding-top: 0.5rem; }

.form-group label {
  font-weight: 700; font-size: 0.8rem; color: #374151;
  margin-bottom: 0.4rem; display: block; text-transform: uppercase; letter-spacing: 0.05em;
}

/* Fixed City Box */
.fixed-city {
  padding: 0.8rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #f9fafb; display: flex; justify-content: space-between; align-items: center; color: #111;
}
.fixed-city-name { font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
.mini-muted { font-size: 0.75rem; opacity: 0.7; display: flex; align-items: center; gap: 4px; }
.error-text { color: #ef4444; margin-top: 0.5rem; }

/* Input Dirección */
.input-wrapper { position: relative; }
.input-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
.input-modern {
  width: 100%; padding: 0.8rem 1rem 0.8rem 2.2rem;
  border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.95rem; outline: none; transition: 0.2s;
}
.input-modern:focus { border-color: #000; box-shadow: 0 0 0 2px rgba(0,0,0,0.05); }

/* Image Preview */
.image-preview {
  position: relative; width: 100%; border-radius: 12px; overflow: hidden;
  background: #eee; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-top: 0.5rem;
}
.site-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
.image-overlay {
  position: absolute; bottom: 0; left: 0; width: 100%;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 2rem 1rem 1rem; color: #fff;
}
.site-info { font-weight: 800; font-size: 1.1rem; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.delivery-badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: #fff; color: #000; padding: 4px 8px;
  border-radius: 4px; font-weight: 700; font-size: 0.8rem; margin-top: 0.5rem;
}

/* Footer */
.footer-actions { display: flex; justify-content: flex-end; gap: 1rem; align-items: center; width: 100%; }
.btn-text { background: none; border: none; cursor: pointer; color: #6b7280; font-weight: 600; }
.btn-text:hover { color: #000; }
.native-btn {
  background: #000; color: #fff; padding: 0.8rem 1.5rem; border: none; border-radius: 8px;
  font-weight: 700; cursor: pointer; transition: 0.2s;
}
.native-btn:active { transform: scale(0.98); }
.native-btn.btn-disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; transform: none; }

/* Animations */
.fade-in { animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

/* PrimeVue Overrides */
:deep(.p-select) { width: 100%; border-radius: 8px; }
:deep(.p-select:focus) { border-color: #000; box-shadow: 0 0 0 2px rgba(0,0,0,0.1); }
:deep(.p-dialog-header) { padding: 1.2rem; border-bottom: 1px solid #f3f4f6; }
:deep(.p-dialog-content) { padding: 1.2rem; }
:deep(.p-dialog-footer) { padding: 1rem 1.2rem; border-top: 1px solid #f3f4f6; }
</style>