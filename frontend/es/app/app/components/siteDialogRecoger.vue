<template>

  <div>
      <Transition name="fade">
      <div v-if="isRedirecting" class="redirect-overlay">
        <div class="redirect-content">
          <div class="redirect-spinner">
            <Icon name="mdi:rocket-launch-outline" size="3em" class="rocket-icon" />
            <div class="pulse-ring"></div>
          </div>
          <h2 class="redirect-title">Te estamos llevando a</h2>
          <h3 class="redirect-store">{{ targetSiteName }}</h3>
          <p class="redirect-subtitle">Transfiriendo tu pedido...</p>
        </div>
      </div>
    </Transition>

  <Dialog
    style="max-width: 30rem; margin: .5rem; width: 90%; font-family: 'Inter', sans-serif;"
    modal
    v-model:visible="store.visibles.currentSiteRecoger"
    :dismissableMask="true"
    header="UBICACIÓN DE ENTREGA"
  >
    <div class="modal-body">
      
      <div class="form-group fade-in">
        <label>¿En qué sede vas a recoger?</label>
        <div class="custom-select">
          <Select
            v-model="currenNeigborhood"
            :options="possibleNeigborhoods"
            optionLabel="name"
            placeholder="Selecciona tu sede"
            filter
            filterPlaceholder="Buscar sede..."
            :disabled="!possibleNeigborhoods.length"
            :loading="spinnersView.sede"
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
        <div v-if="!spinnersView.sede && possibleNeigborhoods.length === 0" class="mini-muted error-text">
          No hay sedes disponibles para la ciudad #18.
        </div>
      </div>

      <div class="form-group fade-in" v-if="currenNeigborhood">
        <label>Dirección de la Sede (Fija)</label>
        <div class="input-wrapper">
          <Icon name="mdi:map-marker" class="input-icon" />
          <input 
            type="text" 
            v-model="exactAddress" 
            class="input-modern input-locked" 
            readonly
            placeholder="Cargando dirección de la sede..." 
          />
          <Icon name="mdi:lock-outline" class="lock-icon" />
        </div>
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
            <Icon name="mdi:walk" size="16" /> <span>Para Recoger</span>
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
        <button class="btn-text" @click="store.setVisible('currentSiteRecoger', false)">Cancelar</button>
        <button
          @click="confirmLocation"
          :disabled="!canSave"
          class="native-btn"
          :class="{ 'btn-disabled': !canSave }"
        >
          Confirmar y Redirigir
        </button>
      </div>
    </template>
  </Dialog>
  </div>


</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useSitesStore, useUserStore } from '#imports'
import { URI } from '~/service/conection'

/* ================= STORES ================= */
const store = useSitesStore()
const userStore = useUserStore()
const siteStore = useSitesStore()


const isRedirecting = ref(false)
const targetSiteName = ref('')
/* ================= STATE ================= */
const spinnersView = ref({ sede: false })
const possibleNeigborhoods = ref([])
const currenNeigborhood = ref(null)
const exactAddress = ref('') 

const currentSite = ref({})
const cachedSites = ref(null)
const cities = ref([])
const fixedCity = ref(null)

// CIUDAD FIJA EN 18
const cityId = ref(18) 

/* ================= HELPERS ================= */
const handleImageError = (e) => { e.target.style.display = 'none' }
const formatPrice = (v) => new Intl.NumberFormat('es-CO').format(v || 0)

/* ================= COMPUTED ================= */
const canSave = computed(() => {
  const nb = currenNeigborhood.value
  return !!(nb && (nb.neighborhood_id || nb.id) && exactAddress.value?.length > 0)
})

/* ================= ACTIONS ================= */
const confirmLocation = () => {
  if (!canSave.value || !currentSite.value) return

  isRedirecting.value = true
  targetSiteName.value = currentSite.value?.site_name
  const subdomain = currentSite.value?.subdomain
  const currentHash = siteStore.session_hash
    if (!currentHash) return

  window.location.href = `https://${subdomain}.salchimonster.com/pay?hash=${currentHash}/`

  store.setVisible('currentSiteRecoger', false)
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
  if (!cities.value.length) await getCities()
  const match = cities.value.find(c => Number(c.city_id) === Number(cityId.value))
  fixedCity.value = match || { city_id: cityId.value, city_name: 'Ciudad #18' }
}

const changePossiblesNeigborhoods = async () => {
  if (!cityId.value) return
  spinnersView.value.sede = true
  try {
    possibleNeigborhoods.value = await (await fetch(`${URI}/neighborhoods/by-city/${cityId.value}`)).json()
  } catch {
    possibleNeigborhoods.value = []
  } finally {
    spinnersView.value.sede = false
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

/* ================= RESTORE & LOGIC ================= */
const restoreFromStore = () => {
  const storedNb = store.location?.neigborhood
  if (storedNb) {
    const wantedId = storedNb.neighborhood_id || storedNb.id
    if (wantedId) {
      const match = possibleNeigborhoods.value.find(n => (n.neighborhood_id || n.id) === wantedId)
      if (match) currenNeigborhood.value = match
    }
  }
}

/* ================= LIFECYCLE ================= */
onMounted(async () => {
  await resolveFixedCity()
  await changePossiblesNeigborhoods()
  await restoreFromStore()
})

// Watch: Cargar info de la sede y dirección al seleccionar "Barrio/Sede"
watch(currenNeigborhood, async (newVal) => {
  exactAddress.value = 'Cargando dirección...'
  
  if (!newVal?.site_id) {
    currentSite.value = {}
    exactAddress.value = ''
    return
  }

  try {
    const allSites = await ensureSitesLoaded()
    const siteFound = allSites.find(s => Number(s.site_id) === Number(newVal.site_id))
    
    if (siteFound) {
      currentSite.value = siteFound
      exactAddress.value = siteFound.site_address || 'Dirección no disponible'
    } else {
      currentSite.value = { site_name: 'Sede', site_id: newVal.site_id }
      exactAddress.value = ''
    }
  } catch {
    currentSite.value = { site_name: 'Sede', site_id: newVal.site_id }
    exactAddress.value = ''
  }
})

// Watch corregido: Ahora escucha currentSiteRecoger
watch(() => store.visibles.currentSiteRecoger, (val) => {
  if (val) restoreFromStore()
})
</script>

<style scoped>
.modal-body { display: flex; flex-direction: column; gap: 1.25rem; padding-top: 0.5rem; }

.form-group label {
  font-weight: 700; font-size: 0.8rem; color: #374151;
  margin-bottom: 0.4rem; display: block; text-transform: uppercase; letter-spacing: 0.05em;
}

/* Input Dirección */
.input-wrapper { position: relative; }
.input-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #6b7280; z-index: 2; }
.lock-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; }

.input-modern {
  width: 100%; padding: 0.8rem 2.5rem 0.8rem 2.2rem;
  border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.95rem; outline: none; transition: 0.2s;
}

.input-locked {
  background-color: #f3f4f6; color: #4b5563; cursor: not-allowed; border-color: #e5e7eb;
}

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

.redirect-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100dvh;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  z-index: 99999;
  display: flex; align-items: center; justify-content: center;
}

.redirect-content { text-align: center; animation: popIn 0.5s ease-out; }
.redirect-spinner { position: relative; display: inline-flex; margin-bottom: 2rem; color: #ff6600; }
.rocket-icon { z-index: 2; animation: rocketFloat 1.5s ease-in-out infinite alternate; color: #ff6600; }
.pulse-ring {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 80px; height: 80px; border-radius: 50%; border: 2px solid #ff6600;
  opacity: 0; animation: pulse 2s infinite;
}
.redirect-title { font-size: 1.2rem; color: #64748b; margin: 0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; }
.redirect-store { font-size: 2.5rem; font-weight: 900; color: #0f172a; margin: 0.5rem 0; line-height: 1.1; max-width: 90vw; }
.redirect-subtitle { font-size: 1rem; color: #94a3b8; margin-top: 1rem; }
@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes rocketFloat { from { transform: translateY(0); } to { transform: translateY(-10px); } }
@keyframes pulse { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

</style>