<template>

  <div class="vicio-root">
    <Transition name="fade">
      <div v-if="isRedirecting" class="redirect-overlay">
        <div class="redirect-content">
          <div class="redirect-spinner">
            <Icon name="mdi:rocket-launch-outline" size="3em" class="rocket-icon" />
            <div class="pulse-ring"></div>
          </div>
          <h2 class="redirect-title">{{ t('redirecting_to') }}</h2>
          <h3 class="redirect-store">{{ targetSiteName }}</h3>
          <p class="redirect-subtitle">{{ t('starting_experience') }}</p>
        </div>
      </div>
    </Transition>

    <div class="vicio-page" :class="{ 'is-map-collapsed': shouldCollapseMap }">
      <ClientOnly>
        <div class="vicio-map-shell">
          <div id="vicio-map" class="vicio-map"></div>
          <img src="/st-1.png" alt="Sticker 1" class="map-sticker map-sticker--top-left" />
          <img src="/st-2.png" alt="Sticker 2" class="map-sticker map-sticker--bottom-right" />
        </div>
      </ClientOnly>

      <div class="vicio-sidebar">
        <header class="sidebar-header">
          <div class="sidebar-header-top">
            <h2 class="sidebar-title">{{ t('choose_nearest') }}</h2>

            <div class="lang-switch" role="group" :aria-label="t('language')">
              <button
                type="button"
                class="lang-btn"
                :class="{ 'is-active': lang === 'es' }"
                @click="setLang('es')"
                aria-label="Español"
              >
                <img class="lang-flag" :src="FLAGS.es" alt="ES" />
                <span class="lang-label">ES</span>
              </button>

              <button
                type="button"
                class="lang-btn"
                :class="{ 'is-active': lang === 'en' }"
                @click="setLang('en')"
                aria-label="English"
              >
                <img class="lang-flag" :src="FLAGS.en" alt="EN" />
                <span class="lang-label">EN</span>
              </button>
            </div>
          </div>

          <div class="city-select-wrapper">
            <label class="city-label" for="city-filter">{{ t('city') }}</label>
            <Select
              inputId="city-filter"
              v-model="selectedCityId"
              :options="citySelectOptions"
              optionLabel="city_name"
              optionValue="city_id"
              :placeholder="t('all_cities')"
              filter
              style="width: 100%;"
              showClear
              class="w-full"
              @update:modelValue="onCityChange"
            />
          </div>

          <div class="search-wrapper" v-if="selectedCityId && isGoogleCity">
            <InputText
              v-model="addressQuery"
              :placeholder="t('type_address')"
              class="w-full"
              @input="onAddressInput"
              @keyup.enter="validateAddress"
            />
            <Button
              v-if="addressQuery.trim().length >= 3"
              @click="validateAddress"
              :disabled="isCheckingAddress"
              class="btn-validate-address"
              style="margin-top: 0.5rem; width: 100%;"
            >
              <ProgressSpinner v-if="isCheckingAddress" style="width: 1em; height: 1em;" />
              <Icon v-else name="mdi:map-search-outline" size="1.2em" />
              <span>{{ t('validate_address') }}</span>
            </Button>
          </div>

          <div v-if="selectedCityId && isParamsCity" class="params-box">
            <div class="form-group">
              <label class="city-label">{{ t('neighborhood_sector') }}</label>
              <AutoComplete
                v-model="selectedNeighborhood"
                :suggestions="nbSuggestions"
                optionLabel="name"
                class="w-full"
                :minLength="1"
                :delay="150"
                :disabled="loadingNeighborhoods || neighborhoods.length === 0"
                :placeholder="loadingNeighborhoods
                  ? t('loading_neighborhoods')
                  : (neighborhoods.length ? t('type_to_search') : t('no_neighborhoods'))"
                @complete="onNeighborhoodComplete"
                dropdown
                style="width: 100%;"
                forceSelection
              >
                <template #item="{ item }">
                  <div class="ac-item">
                    <Icon name="mdi:map-marker-radius-outline" class="item-icon" />
                    <span>{{ item.name }}</span>
                  </div>
                </template>
              </AutoComplete>
            </div>

            <div class="form-group" style="margin-top:.7rem;">
              <label class="city-label">{{ t('exact_address') }}</label>
              <InputText
                style="width: 100%;"
                v-model="paramExactAddress"
                class="w-full"
                :placeholder="t('exact_address_example_short')"
              />
            </div>
          </div>
        </header>

        <section v-if="coverageResult && isGoogleCity" class="coverage-card">
          <div class="coverage-header">
            <Icon name="mdi:map-marker-check" size="1.4em" class="coverage-icon" />
            <h3 class="coverage-title">{{ t('search_result') }}</h3>
          </div>

          <div class="coverage-body">
            <div class="coverage-row">
              <span class="coverage-label">{{ t('address') }}:</span>
              <span class="coverage-value address-text">{{ coverageResult.formatted_address }}</span>
            </div>

            <div class="coverage-row">
              <span class="coverage-label">{{ t('nearest_store') }}:</span>
              <span class="coverage-value">
                {{ coverageResult.nearest?.site?.site_name || t('na') }}
              </span>
            </div>

            <div class="coverage-row highlight">
              <span class="coverage-label">{{ t('delivery_cost') }}:</span>
              <span class="coverage-value price">{{ formatCOP(coverageResult.delivery_cost_cop) }}</span>
            </div>

            <div class="coverage-status-text" :class="coverageResult.nearest?.in_coverage ? 'text-ok' : 'text-fail'">
              {{ coverageResult.nearest?.in_coverage ? t('we_cover_zone') : t('out_of_delivery_zone') }}
            </div>
          </div>

          <div class="coverage-actions" v-if="coverageResult.nearest">
            <Button
              v-if="coverageResult.nearest?.in_coverage && getExactOrderType(coverageResult.nearest.site.site_id, 3)"
              class="btn-action btn-delivery"
              @click="dispatchToSite(
                getStoreById(coverageResult.nearest.site.site_id) || coverageResult.nearest.site,
                getExactOrderType(coverageResult.nearest.site.site_id, 3),
                { mode: 'gmaps', coverageData: coverageResult, city: selectedCityObj }
              )"
            >
              <template #icon>
                <Icon name="mdi:moped" size="1.2em" />
              </template>
              <span>{{ t('delivery') }}</span>
            </Button>
          </div>
        </section>

        <section v-if="isParamsCity && selectedNeighborhood" class="coverage-card">
          <div class="coverage-header">
            <Icon name="mdi:home-map-marker" size="1.4em" class="coverage-icon" />
            <h3 class="coverage-title">{{ t('your_zone_by_neighborhoods') }}</h3>
          </div>

          <div class="coverage-body">
            <div class="coverage-row">
              <span class="coverage-label">{{ t('neighborhood') }}:</span>
              <span class="coverage-value">{{ selectedNeighborhood?.name || '—' }}</span>
            </div>

            <div class="coverage-row highlight">
              <span class="coverage-label">{{ t('delivery_cost') }}:</span>
              <span class="coverage-value price">{{ formatCOP(paramDeliveryPrice) }}</span>
            </div>

            <div class="coverage-status-text text-ok">{{ t('ready_to_send') }}</div>
          </div>

          <div class="coverage-actions">
            <Button
              class="btn-action btn-delivery"
              :disabled="!canDispatchParams"
              @click="onDispatchParamsDelivery"
            >
              <template #icon>
                <Icon name="mdi:moped" size="1.2em" />
              </template>
              <span>{{ t('delivery') }}</span>
            </Button>
          </div>
        </section>

        <main class="stores-list">
          <article
            v-for="store in filteredStores"
            :key="store.id"
            class="store-item"
            :class="{ 'store-item--active': store.id === selectedStoreId }"
            @click="openModal(store)"
          >
            <div style="grid-area: img;" class="store-img-wrapper">
              <NuxtImg
                v-if="store.img_id"
                :src="`${BACKEND_BASE}/read-photo-product/${store.img_id}`"
                :key="`store-${store.id}-img-${store.img_id}`"
                @error="onImgError(store)"
                class="store-img"
                :alt="t('store_photo_alt')"
                width="80"
                height="80"
                format="webp"
                quality="80"
                loading="lazy"
              />
              <img
                v-else
                :src="FALLBACK_LOGO"
                class="store-img"
                :alt="t('store_photo_alt')"
              />
            </div>

            <div style="grid-area: info;" class="store-info">
              <h3 class="store-name">{{ store.name }}</h3>

              <p class="store-services">
                <span v-for="(ot, index) in getAvailableOrderTypes(store.id)" :key="ot.id">
                  {{ String(ot.name || '').toUpperCase() }}
                  <span v-if="index < getAvailableOrderTypes(store.id).length - 1"> | </span>
                </span>
              </p>

              <p class="store-address">
                {{ store.address }} – {{ store.city }}
              </p>

            </div>


              <div class="store-actions-row" style="grid-area: status;">
                <div class="store-action" :data-status="store.status || 'unknown'">
                  <span v-if="store.status === 'open'" class="status-flex">
                    <Icon name="mdi:check-decagram" size="1.2em" /> {{ t('open') }}
                  </span>
                  <span v-else class="status-flex">
                    <Icon name="mdi:lock" size="1.2em" />
                    <span v-if="store.next_opening_time">
                       {{ t('closed') }} • {{ t('opens_at') }} {{ store.next_opening_time }}
                    </span>
                    <span v-else>
                      {{ t('closed') }}
                    </span>
                  </span>
                </div>
              </div>

            <button
            style="grid-area: wsp;"
              class="store-whatsapp"
              type="button"
              :disabled="!store.site_phone"
              @click.stop="openWhatsApp(store)"
              :title="store.site_phone ? t('write_whatsapp') : t('no_whatsapp')"
            >
              <Icon name="mdi:whatsapp" size="1.8rem" />
            </button>

            <button style="grid-area: arrow;" class="store-arrow" type="button">
              <Icon name="mdi:chevron-right" size="1.8em" />
            </button>
          </article>
        </main>
      </div>

      <Dialog
        v-model:visible="isModalOpen"
        modal
        dismissableMask
        :style="{ width: 'min(92vw, 520px)' }"
        :contentStyle="{ minHeight: '70vh' }"
        :showHeader="false"
      >
        <div v-if="modalStore" class="pv-modal">
          <button class="modal-close-btn" type="button" @click="closeModal">
            <Icon name="mdi:close" size="1.5em" />
          </button>

          <div v-if="modalStep === 1">
            <h3 class="modal-title">{{ t('how_want_order') }}</h3>
            <p class="modal-subtitle">
              {{ t('store_label') }}: <strong>{{ modalStore.name }}</strong>
            </p>

            <div class="modal-whatsapp-row">
              <Button
              
                class="btn-action btn-whatsapp full-width"
                severity="secondary"
                :disabled="!modalStore.site_phone"
                @click="openWhatsApp(modalStore)"
              >
                <template #icon>
                   <Icon name="mdi:whatsapp" size="1.6em" />
                </template>
                <span style="font-size:1.1em;">{{ t('write_whatsapp') }}</span>
              </Button>
            </div>

            <div class="modal-actions">
              <Button
                v-for="ot in getAvailableOrderTypes(modalStore.id)"
                :key="ot.id"
                class="modal-btn"
                :class="getButtonClass(ot.id)"
                @click="handleModalOption(ot)"
                severity="secondary"
              >
                <Icon :name="getIconForOrderType(ot.id)" size="1.8em" />
                <span>{{ ot.name }}</span>
              </Button>
            </div>
          </div>

          <div v-else-if="modalStep === 2">
            <div class="modal-header-nav">
              <Button text class="modal-back-btn" @click="setModalStep(1)">
                <Icon name="mdi:arrow-left" size="1.2em" />
                <span>{{ t('back') }}</span>
              </Button>
            </div>
            <div v-if="isGoogleCity">
              <h3 class="modal-title">{{ t('where_are_you') }}</h3>
              <InputText
                v-model="modalAddressQuery"
                :placeholder="t('address_example')"
                class="w-full"
                style="width: 100%;"
                @keyup.enter="validateModalAddress"
              />
              <Button
                v-if="modalAddressQuery.trim().length >= 3"
                @click="validateModalAddress"
                :disabled="isCheckingModalAddress"
                class="btn-action btn-delivery full-width"
                style="margin-top: 0.75rem;"
              >
                <template #icon>
                  <ProgressSpinner v-if="isCheckingModalAddress" style="width: 1em; height: 1em;" />
                  <Icon v-else name="mdi:map-search-outline" size="1.2em" />
                </template>
                <span>{{ t('validate_address') }}</span>
              </Button>
              <div v-if="modalAddressError" class="modal-error">{{ modalAddressError }}</div>
            </div>
            <div v-else class="params-flow-modal">
              <h3 class="modal-title">{{ t('delivery_details') }}</h3>
              <div class="form-group">
                <label class="city-label">{{ t('search_neighborhood') }}</label>
                <AutoComplete
                  v-model="modalSelectedNeighborhood"
                  :suggestions="modalNbSuggestions"
                  optionLabel="name"
                  class="w-full"
                  :placeholder="t('type_to_search')"
                  :minLength="1"
                  style="width:100%;"
                  :delay="150"
                  @complete="onModalNeighborhoodComplete"
                  dropdown
                  forceSelection
                />
              </div>
              <div v-if="modalSelectedNeighborhood" style="margin: 1rem 0;" class="selected-nb-info">
                 <div class="info-row">
                  <span>{{ t('neighborhood') }}: </span>
                  <strong>{{ modalSelectedNeighborhood.name }}</strong>
                </div>
                <div class="info-row">
                  <span>{{ t('delivery') }}: </span>
                  <strong class="text-green">{{ formatCOP(Number(modalSelectedNeighborhood.delivery_price || 0)) }}</strong>
                </div>
              </div>
              <div class="form-group" style="margin-top: 1rem;">
                <label class="city-label">{{ t('exact_address') }}</label>
                <InputText
                  style="width: 100%;"
                  v-model="modalParamAddress"
                  class="w-full"
                  :placeholder="t('exact_address_example')"
                />
              </div>
              <Button
                class="btn-action btn-delivery full-width"
                style="margin-top: 1.5rem;"
                :disabled="!modalSelectedNeighborhood || !modalParamAddress.trim()"
                @click="onDispatchModalParams"
              >
                <template #icon>
                  <Icon name="mdi:moped" size="1.2em" />
                </template>
                <span>{{ t('confirm_delivery') }}</span>
              </Button>
            </div>
          </div>
          <div v-else-if="modalStep === 3" class="modal-loading-view">
            <ProgressSpinner style="width:48px;height:48px" />
            <p>{{ t('validating_coverage') }}</p>
          </div>
          <div v-else-if="modalStep === 4 && modalCoverageResult">
             <div class="modal-header-nav">
              <Button text class="modal-back-btn" @click="setModalStep(2)">
                <template #icon>
                  <Icon name="mdi:arrow-left" size="1.2em" />
                </template>
                <span>{{ t('back') }}</span>
              </Button>
            </div>
            <h3 class="modal-title">{{ t('coverage_summary') }}</h3>
            <div class="coverage-card" style="margin: 1rem 0; width: auto; border: none; box-shadow: none; background: transparent;">
               <div class="coverage-body" style="padding: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                 <div class="coverage-row">
                  <span class="coverage-label">{{ t('address') }}:</span>
                  <span class="coverage-value address-text">{{ modalCoverageResult.formatted_address }}</span>
                </div>
                 <div class="coverage-row">
                  <span class="coverage-label">{{ t('assigned_store') }}:</span>
                  <span class="coverage-value">
                    {{ modalCoverageResult.nearest?.site?.site_name || t('na') }}
                  </span>
                </div>
                <div class="coverage-row highlight">
                  <span class="coverage-label">{{ t('delivery_cost') }}:</span>
                  <span class="coverage-value price">{{ formatCOP(modalCoverageResult.delivery_cost_cop) }}</span>
                </div>
                <div class="coverage-status-text" :class="modalCoverageResult.nearest?.in_coverage ? 'text-ok' : 'text-fail'">
                  {{ modalCoverageResult.nearest?.in_coverage ? t('we_cover_zone') : t('out_of_delivery_zone') }}
                </div>
               </div>
            </div>
            <Button
              class="btn-action btn-delivery full-width"
              style="margin-top: 1rem;"
              :disabled="!modalCoverageResult.nearest?.in_coverage"
              @click="confirmGoogleDispatch"
            >
              <template #icon>
                <Icon name="mdi:check-circle-outline" size="1.2em" />
              </template>
              <span>{{ t('confirm_and_go') }}</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </div>

  </div>

</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead, useSitesStore, useUserStore, usecartStore } from '#imports'
import 'leaflet/dist/leaflet.css'

/* PrimeVue */
import Dialog from 'primevue/dialog'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

/* Address Service */
import { checkAddress } from '~/service/location/addressService'

/* Sede from route */
import { getSiteSlug } from '~/composables/useSedeFromRoute'

/* =======================
   i18n local + persistencia
   ======================= */
const LANG_KEY = 'vicio_lang'
const FLAGS = {
  es: 'https://flagcdn.com/h20/es.png',
  en: 'https://flagcdn.com/h20/us.png'
}

const lang = ref('es')

function safeReadLang() {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'es' || v === 'en') return v
  } catch {}
  return 'es'
}

function setLang(v) {
  lang.value = v === 'en' ? 'en' : 'es'
  try { localStorage.setItem(LANG_KEY, lang.value) } catch {}
}

const I18N = {
  es: {
    language: 'Idioma',
    choose_nearest: 'ELIGE TU SALCHIMONSTER MÁS CERCANO',
    city: 'Ciudad',
    all_cities: 'Todas las ciudades',
    type_address: 'Escribe tu dirección...',
    validate_address: 'Validar Dirección',
    neighborhood_sector: 'Barrio / Sector',
    loading_neighborhoods: 'Cargando barrios...',
    type_to_search: 'Escribe para buscar...',
    no_neighborhoods: 'No hay barrios',
    exact_address: 'Dirección exacta',
    exact_address_example_short: 'Ej: Calle 123 # 45 - 67...',
    search_result: 'Resultado de búsqueda',
    address: 'Dirección',
    nearest_store: 'Sede más cercana',
    delivery_cost: 'Costo envío',
    we_cover_zone: '✅ Cubrimos tu zona',
    out_of_delivery_zone: '❌ Fuera de zona de entrega',
    delivery: 'Domicilio',
    your_zone_by_neighborhoods: 'Tu zona (Por Barrios)',
    neighborhood: 'Barrio',
    ready_to_send: '✅ Listo para enviar',
    store_photo_alt: 'Foto sede',
    open: 'ABIERTO',
    closed: 'CERRADO',
    opens_at: 'ABRE A ', // NUEVO
    how_want_order: '¿Cómo quieres tu pedido?',
    store_label: 'Sede',
    back: 'Volver',
    where_are_you: '¿Dónde estás?',
    address_example: 'Calle 123 # 45 - 67...',
    delivery_details: 'Datos de Entrega',
    search_neighborhood: 'Busca tu Barrio',
    exact_address_example: 'Ej: Calle 123 # 45 - 67 Apt 201',
    confirm_delivery: 'Confirmar Domicilio',
    validating_coverage: 'Validando cobertura...',
    coverage_summary: 'Resumen de Cobertura',
    assigned_store: 'Sede asignada',
    confirm_and_go: 'Confirmar e Ir',
    redirecting_to: 'Te estamos llevando a',
    starting_experience: 'Iniciando tu experiencia...',
    na: 'N/A',
    whatsapp: 'WhatsApp',
    write_whatsapp: 'Escribir por WhatsApp',
    no_whatsapp: 'Esta sede no tiene WhatsApp',
    whatsapp_default_msg: 'Hola, tengo una consulta. ¿Me ayudas por favor?'
  },
  en: {
    language: 'Language',
    choose_nearest: 'CHOOSE YOUR NEAREST SALCHIMONSTER',
    city: 'City',
    all_cities: 'All cities',
    type_address: 'Type your address...',
    validate_address: 'Validate Address',
    neighborhood_sector: 'Neighborhood / Area',
    loading_neighborhoods: 'Loading neighborhoods...',
    type_to_search: 'Type to search...',
    no_neighborhoods: 'No neighborhoods',
    exact_address: 'Exact address',
    exact_address_example_short: 'Ex: Street 123 # 45 - 67...',
    search_result: 'Search result',
    address: 'Address',
    nearest_store: 'Nearest store',
    delivery_cost: 'Delivery cost',
    we_cover_zone: '✅ We deliver to your area',
    out_of_delivery_zone: '❌ Outside delivery area',
    delivery: 'Delivery',
    your_zone_by_neighborhoods: 'Your area (By neighborhoods)',
    neighborhood: 'Neighborhood',
    ready_to_send: '✅ Ready to deliver',
    store_photo_alt: 'Store photo',
    open: 'OPEN',
    closed: 'CLOSED',
    opens_at: 'OPENS ', // NUEVO
    how_want_order: 'How do you want your order?',
    store_label: 'Store',
    back: 'Back',
    where_are_you: 'Where are you?',
    address_example: 'Street 123 # 45 - 67...',
    delivery_details: 'Delivery details',
    search_neighborhood: 'Search your neighborhood',
    exact_address_example: 'Ex: Street 123 # 45 - 67 Apt 201',
    confirm_delivery: 'Confirm delivery',
    validating_coverage: 'Checking coverage...',
    coverage_summary: 'Coverage summary',
    assigned_store: 'Assigned store',
    confirm_and_go: 'Confirm & go',
    redirecting_to: 'Taking you to',
    starting_experience: 'Starting your experience...',
    na: 'N/A',
    whatsapp: 'WhatsApp',
    write_whatsapp: 'Message on WhatsApp',
    no_whatsapp: 'This store has no WhatsApp',
    whatsapp_default_msg: 'Hi! I have a question. Can you help me please?'
  }
}

function t(key) {
  return I18N[lang.value]?.[key] ?? I18N.es[key] ?? key
}

/* =======================
   CONFIG & STATE
   ======================= */
const route = useRoute()
const router = useRouter()
const sitesStore = useSitesStore()
const userStore = useUserStore()
const cartStore = usecartStore()

// Al montar el dispatcher: si llegó por "Cambiar sede" (?cambiar_sede=1), no borrar datos
// para que al dar "atrás" el usuario vuelva con su carrito, cuponera y sede intactos.
onMounted(() => {
  const fromChangeSite = route.query?.cambiar_sede === '1'
  if (fromChangeSite) {
    // Solo resetear el formulario local del dispatcher; no tocar store (cart, sede, cuponera, address)
    selectedCityId.value = 0
    addressQuery.value = ''
    selectedNeighborhood.value = null
    paramExactAddress.value = ''
    coverageResult.value = null
    modalCoverageResult.value = null
    nbSuggestions.value = []
    selectedStoreId.value = null
    dropoffMarker.value = null
    return
  }
  if (sitesStore.location?.site?.site_id && sitesStore.location?.order_type) {
    sitesStore.clearOrderType()
    sitesStore.updateLocation({
      city: sitesStore.location?.city ?? null,
      site: sitesStore.location?.site ?? undefined,
      neigborhood: null,
      address_details: null,
      formatted_address: '',
      place_id: '',
      lat: null,
      lng: null,
      mode: 'barrios',
      order_type: null
    }, 0)
    userStore.resetUser()
    selectedCityId.value = 0
    addressQuery.value = ''
    selectedNeighborhood.value = null
    paramExactAddress.value = ''
    coverageResult.value = null
    modalCoverageResult.value = null
    nbSuggestions.value = []
    selectedStoreId.value = null
    dropoffMarker.value = null
  }
})
const BACKEND_BASE = 'https://backend.salchimonster.com'
const URI = 'https://backend.salchimonster.com'

const map = ref(null)
const leafletModule = ref(null)
const markers = ref({})
const mapBounds = ref(null)
const initialBounds = ref(null)

const stores = ref([])
const cities = ref([])
const sitePaymentsConfig = ref([])
const cityMapStatus = ref([])

const selectedCityId = ref(0)
const selectedStoreId = ref(null)

const sessionToken = ref((typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).substring(2)
)

const isRedirecting = ref(false)
const targetSiteName = ref('')

/* =======================
   WhatsApp helper
   ======================= */
function normalizeWhatsAppPhone(phone) {
  if (!phone) return ''
  let digits = String(phone).replace(/[^\d]/g, '')
  return digits
}

function buildWhatsAppLink(store, customText = '') {
  const digits = normalizeWhatsAppPhone(store?.site_phone)
  if (!digits) return ''
  const text =
    (customText && String(customText).trim())
      ? String(customText).trim()
      : t('whatsapp_default_msg')
  const q = encodeURIComponent(text)
  return `https://wa.me/${digits}?text=${q}`
}

function openWhatsApp(store) {
  const url = buildWhatsAppLink(store, `${t('whatsapp_default_msg')} (${store?.name || ''})`)
  if (!url) return
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    window.location.href = url
  }
}

/* =======================
   App-like: bloquear scroll global
   ======================= */
const preventGesture = (e) => { try { e.preventDefault() } catch {} }
const preventCtrlWheelZoom = (e) => {
  if (e.ctrlKey) {
    try { e.preventDefault() } catch {}
  }
}

function lockPage() {
  if (typeof window === 'undefined') return
  document.documentElement.classList.add('no-global-scroll')
  document.body.classList.add('no-global-scroll')
  window.addEventListener('gesturestart', preventGesture, { passive: false })
  window.addEventListener('gesturechange', preventGesture, { passive: false })
  window.addEventListener('gestureend', preventGesture, { passive: false })
  window.addEventListener('wheel', preventCtrlWheelZoom, { passive: false })
}

function unlockPage() {
  if (typeof window === 'undefined') return
  document.documentElement.classList.remove('no-global-scroll')
  document.body.classList.remove('no-global-scroll')
  window.removeEventListener('gesturestart', preventGesture)
  window.removeEventListener('gesturechange', preventGesture)
  window.removeEventListener('gestureend', preventGesture)
  window.removeEventListener('wheel', preventCtrlWheelZoom)
}

/* =======================
   MOBILE DETECTOR + COLLAPSE MAP
   ======================= */
const isMobile = ref(false)
let mq

function updateIsMobile() {
  if (typeof window === 'undefined') return
  isMobile.value = mq ? mq.matches : window.matchMedia('(max-width: 900px)').matches
}

onMounted(() => {
  if (typeof window !== 'undefined') lang.value = safeReadLang()
  lockPage()
  if (typeof window === 'undefined') return
  mq = window.matchMedia('(max-width: 900px)')
  updateIsMobile()
  if (mq.addEventListener) mq.addEventListener('change', updateIsMobile)
  else mq.addListener(updateIsMobile)
})

onBeforeUnmount(() => {
  unlockPage()
  if (!mq) return
  if (mq.removeEventListener) mq.removeEventListener('change', updateIsMobile)
  else mq.removeListener(updateIsMobile)
})

/* =======================
   CITY OPTIONS
   ======================= */
const orderedCities = computed(() => {
  return [...cities.value.filter((s) => ![18, 15, 19].includes(Number(s.city_id)))]
    .sort((a, b) => (Number(a.index ?? 0) - Number(b.index ?? 0)))
})

const citySelectOptions = computed(() => {
  return [{ city_id: 0, city_name: t('all_cities') }, ...orderedCities.value]
})

const selectedCityObj = computed(() => {
  return cities.value.find((c) => Number(c.city_id) === Number(selectedCityId.value)) || null
})

/* =======================
   Google Sidebar - Address Validation
   ======================= */
const addressQuery = ref('')
const coverageResult = ref(null)
const dropoffMarker = ref(null)
const isCheckingAddress = ref(false)
let dropoffIcon = null

async function validateAddress() {
  const address = addressQuery.value.trim()
  if (address.length < 3) {
    coverageResult.value = null
    return
  }

  isCheckingAddress.value = true
  coverageResult.value = null

  try {
    const cityObj = selectedCityId.value 
      ? cities.value.find((x) => Number(x.city_id) === Number(selectedCityId.value))
      : null

    if (!cityObj?.city_name) {
      throw new Error('Debe seleccionar una ciudad primero')
    }

    const result = await checkAddress({
      address,
      country: 'colombia',
      city: cityObj.city_name
    })

    // Transform the response to match the expected format
    if (result && result.latitude && result.longitude) {
      // Find the nearest site from matching polygons
      let nearestSite = null
      let minDistance = Infinity
      let inCoverage = false

      if (result.matching_polygons && result.matching_polygons.length > 0) {
        // Get the first matching polygon with a site
        // Priorizar polígonos con is_inside: true, pero también considerar otros si no hay ninguno
        let matchingPolygon = result.matching_polygons.find(p => p.is_inside && p.site)
        if (!matchingPolygon) {
          // Si no hay polígono con is_inside, usar el primero que tenga sitio
          matchingPolygon = result.matching_polygons.find(p => p.site)
        }
        
        if (matchingPolygon && matchingPolygon.site) {
          const site = matchingPolygon.site
          nearestSite = {
            site_id: site.site_id,
            site_name: site.site_name,
            subdomain: site.subdomain || null,
            city_id: site.city_id || null,
            city: site.city_name || null,
            site_address: site.site_address || null
          }
          inCoverage = matchingPolygon.is_inside || false
          
          // Calculate approximate distance (simple haversine) siempre que tengamos coordenadas
          if (result.latitude && result.longitude && site.location) {
            const [siteLat, siteLng] = site.location
            const R = 6371 // Earth radius in km
            const dLat = (siteLat - result.latitude) * Math.PI / 180
            const dLng = (siteLng - result.longitude) * Math.PI / 180
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(result.latitude * Math.PI / 180) * Math.cos(siteLat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            minDistance = R * c
          }
        }
      }

      // If no matching polygon, find nearest store
      if (!nearestSite && stores.value.length > 0) {
        let nearest = null
        let minDist = Infinity
        stores.value.forEach(store => {
          const R = 6371
          const dLat = (store.lat - result.latitude) * Math.PI / 180
          const dLng = (store.lng - result.longitude) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(result.latitude * Math.PI / 180) * Math.cos(store.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          const dist = R * c
          if (dist < minDist) {
            minDist = dist
            nearest = store
          }
        })
        if (nearest) {
          nearestSite = {
            site_id: nearest.id,
            site_name: nearest.name.replace('SALCHIMONSTER ', ''),
            subdomain: nearest.subdomain,
            city_id: nearest.cityId,
            city: nearest.city,
            site_address: nearest.address
          }
          minDistance = minDist
        }
      }

      // Obtener el costo de domicilio: priorizar delivery_pricing.price, luego rappi_validation, luego delivery_cost_cop
      let deliveryCost = 0
      if (result.delivery_pricing && result.delivery_pricing.price != null) {
        deliveryCost = Number(result.delivery_pricing.price) || 0
      } else if (result.rappi_validation && result.rappi_validation.estimated_price) {
        deliveryCost = Number(result.rappi_validation.estimated_price) || 0
      } else if (result.delivery_cost_cop != null) {
        deliveryCost = Number(result.delivery_cost_cop) || 0
      }

      // Calcular distancia: priorizar delivery_pricing.distance_km, luego rappi_validation.trip_distance, luego distancia calculada
      let finalDistance = minDistance
      if (result.delivery_pricing && result.delivery_pricing.distance_km != null) {
        // Formato Google Maps: usar distancia de delivery_pricing
        finalDistance = Number(result.delivery_pricing.distance_km) || 0
      } else if (result.rappi_validation && result.rappi_validation.trip_distance != null) {
        // Formato Rappi Cargo: usar trip_distance de rappi_validation
        finalDistance = Number(result.rappi_validation.trip_distance) || 0
      } else if (minDistance === Infinity && nearestSite && result.latitude && result.longitude) {
        // Si no hay distancia disponible y hay una sede, calcularla desde las coordenadas
        const site = nearestSite
        // Intentar obtener coordenadas de la sede desde matching_polygons
        const matchingPolygon = result.matching_polygons?.find(p => p.site && p.site.site_id === site.site_id)
        if (matchingPolygon?.site?.location) {
          const [siteLat, siteLng] = matchingPolygon.site.location
          const R = 6371 // Radio de la Tierra en km
          const dLat = (siteLat - result.latitude) * Math.PI / 180
          const dLng = (siteLng - result.longitude) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(result.latitude * Math.PI / 180) * Math.cos(siteLat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          finalDistance = R * c
        } else if (stores.value.length > 0) {
          // Si no hay coordenadas en matching_polygons, calcular desde stores
          const store = stores.value.find(s => s.id === site.site_id)
          if (store) {
            const R = 6371
            const dLat = (store.lat - result.latitude) * Math.PI / 180
            const dLng = (store.lng - result.longitude) * Math.PI / 180
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(result.latitude * Math.PI / 180) * Math.cos(store.lat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            finalDistance = R * c
          }
        }
      }
      
      // Si aún es Infinity, usar 0 como fallback
      if (finalDistance === Infinity || isNaN(finalDistance)) {
        finalDistance = 0
      }

      // Compatible con ambos formatos: Rappi Cargo (latitude/longitude) y Google Maps (lat/lng)
      const lat = result.latitude || result.lat || null
      const lng = result.longitude || result.lng || null
      
      // Usar formatted_address directamente del backend (como en LocationManager)
      // El backend ya incluye zona, barrio y toda la información completa
      coverageResult.value = {
        formatted_address: result.formatted_address || result.address,
        address: result.address || result.formatted_address,
        lat: lat,
        lng: lng,
        latitude: lat, // Preservar ambos formatos
        longitude: lng, // Preservar ambos formatos
        geocoded: result.geocoded,
        is_inside_any: result.is_inside_any,
        delivery_cost_cop: deliveryCost,
        delivery_pricing: result.delivery_pricing, // Guardar objeto completo de pricing (puede ser null en formato Rappi Cargo)
        rappi_validation: result.rappi_validation, // Guardar objeto completo de validación (puede ser null en formato Google Maps)
        matching_polygons: result.matching_polygons, // Guardar polígonos coincidentes
        nearest: nearestSite ? {
          site: nearestSite,
          distance_km: finalDistance,
          in_coverage: inCoverage || result.is_inside_any
        } : null
      }

      // Update map marker
      if (map.value && leafletModule.value && result.latitude && result.longitude) {
        const L = leafletModule.value
        if (dropoffMarker.value) map.value.removeLayer(dropoffMarker.value)
        dropoffMarker.value = L.marker([result.latitude, result.longitude], { icon: dropoffIcon }).addTo(map.value)
        map.value.setView([result.latitude, result.longitude], 14)
      }
    } else {
      // Usar formatted_address directamente del backend (como en LocationManager)
      coverageResult.value = {
        formatted_address: result.formatted_address || result.address,
        address: result.address,
        lat: null,
        lng: null,
        geocoded: false,
        is_inside_any: false,
        delivery_cost_cop: 0,
        nearest: null
      }
    }
  } catch (error) {
    console.error('Error validating address:', error)
    coverageResult.value = null
    // Mostrar mensaje de error al usuario si es necesario
    if (error.message && error.message.includes('conectar')) {
      alert(lang.value === 'en'
        ? 'Error: Could not connect to address validation server. Please try again later.'
        : 'Error: No se pudo conectar con el servidor de validación. Intenta de nuevo más tarde.'
      )
    }
  } finally {
    isCheckingAddress.value = false
  }
}

function onAddressInput() {
  // Solo limpiar resultados cuando el usuario escribe, no validar automáticamente
  coverageResult.value = null
}

/* =======================
   Barrios Sidebar
   ======================= */
const neighborhoods = ref([])
const loadingNeighborhoods = ref(false)
const selectedNeighborhood = ref(null)
const nbSuggestions = ref([])
const paramExactAddress = ref('')

const paramDeliveryPrice = computed(() => Number(selectedNeighborhood.value?.delivery_price ?? 0))

const paramAssignedStore = computed(() => {
  const nb = selectedNeighborhood.value
  if (!nb?.site_id) return null
  return getStoreById(Number(nb.site_id)) || null
})

const canDispatchParams = computed(() => {
  if (!isParamsCity.value) return false
  if (!selectedNeighborhood.value) return false
  if (!paramExactAddress.value.trim()) return false
  const store = paramAssignedStore.value
  if (!store) return false
  return !!getExactOrderType(store.id, 3)
})

async function onNeighborhoodComplete(e) {
  const q = (e.query || '').trim().toLowerCase()
  const base = neighborhoods.value || []
  nbSuggestions.value = !q
    ? base.slice(0, 50)
    : base.filter((n) => (n.name || '').toLowerCase().includes(q)).slice(0, 50)
}

async function loadNeighborhoodsByCity(cityId) {
  loadingNeighborhoods.value = true
  neighborhoods.value = []
  selectedNeighborhood.value = null
  nbSuggestions.value = []
  try {
    const res = await fetch(`${URI}/neighborhoods/by-city/${cityId}`)
    const data = await res.json()
    neighborhoods.value = Array.isArray(data) ? data : []
  } catch {
    neighborhoods.value = []
  } finally {
    loadingNeighborhoods.value = false
  }
}


/* =======================
   MODAL STATE
   ======================= */
const isModalOpen = ref(false)
const modalStore = ref(null)
const modalStep = ref(1)
const modalAddressQuery = ref('')
const modalCoverageResult = ref(null)
const modalAddressError = ref('')
const modalSelectedNeighborhood = ref(null)
const modalNbSuggestions = ref([])
const modalParamAddress = ref('')
const isCheckingModalAddress = ref(false)

/* =======================
   CITY MAP STATUS
   ======================= */
function isGoogleMapsEnabled(cityId) {
  const config = cityMapStatus.value.find((c) => Number(c.city_id) === Number(cityId))
  return config ? !!config.user_google_map_status : false
}

const isGoogleCity = computed(() => {
  const cityId = modalStore.value
    ? (modalStore.value.cityId || modalStore.value.city_id)
    : selectedCityId.value
  return !!Number(cityId) && isGoogleMapsEnabled(Number(cityId))
})
const isParamsCity = computed(() => !isGoogleCity.value)

const shouldCollapseMap = computed(() => {
  if (!isMobile.value) return false
  const sidebarHasResult =
    (!!coverageResult.value && isGoogleCity.value) ||
    (!!selectedNeighborhood.value && isParamsCity.value)
  const modalIsOpen = !!isModalOpen.value
  return sidebarHasResult || modalIsOpen
})

watch(shouldCollapseMap, async (collapsed) => {
  if (!collapsed) {
    await nextTick()
    setTimeout(() => {
      try {
        map.value?.invalidateSize?.()
        if (initialBounds.value) map.value?.fitBounds?.(initialBounds.value, { padding: [20, 20] })
      } catch {}
    }, 380)
  }
})

watch(lang, () => {
  modalAddressError.value = ''
  coverageResult.value = null
})

watch(addressQuery, () => {
  // Solo limpiar resultados cuando cambia la dirección
  coverageResult.value = null
})

/* =======================
   MODAL LOGIC
   ======================= */
async function openModal(store) {
  selectedStoreId.value = store.id
  modalStore.value = store
  modalStep.value = 1
  isModalOpen.value = true
  modalAddressQuery.value = ''
  modalCoverageResult.value = null
  modalAddressError.value = ''
  modalSelectedNeighborhood.value = null
  modalNbSuggestions.value = []
  modalParamAddress.value = ''
  isCheckingModalAddress.value = false

  const cityId = store.cityId || store.city_id
  if (cityId && !isGoogleMapsEnabled(cityId)) {
    if (neighborhoods.value.length === 0 || Number(selectedCityId.value) !== Number(cityId)) {
      await loadNeighborhoodsByCity(cityId)
    }
  }
}

function closeModal() {
  isModalOpen.value = false
  modalStore.value = null
}

function setModalStep(step) {
  modalStep.value = step
}

async function handleModalOption(orderType) {
  if (Number(orderType.id) === 3) {
    const cityId = modalStore.value.cityId || modalStore.value.city_id
    if (isGoogleMapsEnabled(Number(cityId))) {
      setModalStep(2)
      return
    }
    if (neighborhoods.value.length === 0) {
      await loadNeighborhoodsByCity(cityId)
    }
    setModalStep(2)
    return
  }
  dispatchToSite(modalStore.value, orderType, { mode: 'simple', city: selectedCityObj.value })
}

async function validateModalAddress() {
  const address = modalAddressQuery.value.trim()
  if (address.length < 3) {
    modalCoverageResult.value = null
    modalAddressError.value = ''
    return
  }

  modalStep.value = 3
  modalAddressError.value = ''
  modalCoverageResult.value = null
  isCheckingModalAddress.value = true

  try {
    // Obtener la ciudad del modal store o de la ciudad seleccionada
    let cityName = null
    if (modalStore.value?.city) {
      cityName = modalStore.value.city
    } else if (selectedCityId.value) {
      const cityObj = cities.value.find((x) => Number(x.city_id) === Number(selectedCityId.value))
      cityName = cityObj?.city_name
    }

    if (!cityName) {
      modalAddressError.value = (lang.value === 'en')
        ? 'City is required to validate the address.'
        : 'La ciudad es requerida para validar la dirección.'
      modalStep.value = 2
      return
    }

    const result = await checkAddress({
      address,
      country: 'colombia',
      city: cityName
    })

    // Transform the response to match the expected format
    if (result && result.latitude && result.longitude) {
      // Find the nearest site from matching polygons
      let nearestSite = null
      let minDistance = Infinity
      let inCoverage = false

      if (result.matching_polygons && result.matching_polygons.length > 0) {
        // Get the first matching polygon with a site
        // Priorizar polígonos con is_inside: true, pero también considerar otros si no hay ninguno
        let matchingPolygon = result.matching_polygons.find(p => p.is_inside && p.site)
        if (!matchingPolygon) {
          // Si no hay polígono con is_inside, usar el primero que tenga sitio
          matchingPolygon = result.matching_polygons.find(p => p.site)
        }
        
        if (matchingPolygon && matchingPolygon.site) {
          const site = matchingPolygon.site
          nearestSite = {
            site_id: site.site_id,
            site_name: site.site_name,
            subdomain: site.subdomain || null,
            city_id: site.city_id || null,
            city: site.city_name || null,
            site_address: site.site_address || null
          }
          inCoverage = matchingPolygon.is_inside || false
          
          // Calculate approximate distance siempre que tengamos coordenadas
          if (result.latitude && result.longitude && site.location) {
            const [siteLat, siteLng] = site.location
            const R = 6371
            const dLat = (siteLat - result.latitude) * Math.PI / 180
            const dLng = (siteLng - result.longitude) * Math.PI / 180
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(result.latitude * Math.PI / 180) * Math.cos(siteLat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            minDistance = R * c
          }
        }
      }

      // If no matching polygon, use the modal store
      if (!nearestSite && modalStore.value) {
        nearestSite = {
          site_id: modalStore.value.id,
          site_name: modalStore.value.name.replace('SALCHIMONSTER ', ''),
          subdomain: modalStore.value.subdomain,
          city_id: modalStore.value.cityId,
          city: modalStore.value.city,
          site_address: modalStore.value.address
        }
        inCoverage = result.is_inside_any
        
        // Calcular distancia desde el modal store si tenemos coordenadas
        if (result.latitude && result.longitude && modalStore.value.lat && modalStore.value.lng) {
          const R = 6371
          const dLat = (modalStore.value.lat - result.latitude) * Math.PI / 180
          const dLng = (modalStore.value.lng - result.longitude) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(result.latitude * Math.PI / 180) * Math.cos(modalStore.value.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          minDistance = R * c
        }
      }

      // Obtener el costo de domicilio: priorizar delivery_pricing.price, luego rappi_validation, luego delivery_cost_cop
      let deliveryCost = 0
      if (result.delivery_pricing && result.delivery_pricing.price != null) {
        deliveryCost = Number(result.delivery_pricing.price) || 0
      } else if (result.rappi_validation && result.rappi_validation.estimated_price) {
        deliveryCost = Number(result.rappi_validation.estimated_price) || 0
      } else if (result.delivery_cost_cop != null) {
        deliveryCost = Number(result.delivery_cost_cop) || 0
      }

      // Calcular distancia: priorizar delivery_pricing.distance_km, luego rappi_validation.trip_distance, luego distancia calculada
      let finalDistance = minDistance
      if (result.delivery_pricing && result.delivery_pricing.distance_km != null) {
        // Formato Google Maps: usar distancia de delivery_pricing
        finalDistance = Number(result.delivery_pricing.distance_km) || 0
      } else if (result.rappi_validation && result.rappi_validation.trip_distance != null) {
        // Formato Rappi Cargo: usar trip_distance de rappi_validation
        finalDistance = Number(result.rappi_validation.trip_distance) || 0
      } else if (minDistance === Infinity && nearestSite && result.latitude && result.longitude) {
        // Si no hay distancia disponible y hay una sede, calcularla desde las coordenadas
        const site = nearestSite
        // Intentar obtener coordenadas de la sede desde matching_polygons
        const matchingPolygon = result.matching_polygons?.find(p => p.site && p.site.site_id === site.site_id)
        if (matchingPolygon?.site?.location) {
          const [siteLat, siteLng] = matchingPolygon.site.location
          const R = 6371 // Radio de la Tierra en km
          const dLat = (siteLat - result.latitude) * Math.PI / 180
          const dLng = (siteLng - result.longitude) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(result.latitude * Math.PI / 180) * Math.cos(siteLat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          finalDistance = R * c
        } else if (modalStore.value && modalStore.value.lat && modalStore.value.lng) {
          // Si no hay coordenadas en matching_polygons, calcular desde modalStore
          const R = 6371
          const dLat = (modalStore.value.lat - result.latitude) * Math.PI / 180
          const dLng = (modalStore.value.lng - result.longitude) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(result.latitude * Math.PI / 180) * Math.cos(modalStore.value.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          finalDistance = R * c
        }
      }
      
      // Si aún es Infinity, usar 0 como fallback
      if (finalDistance === Infinity || isNaN(finalDistance)) {
        finalDistance = 0
      }

      // Compatible con ambos formatos: Rappi Cargo (latitude/longitude) y Google Maps (lat/lng)
      const lat = result.latitude || result.lat || null
      const lng = result.longitude || result.lng || null
      
      // Usar formatted_address directamente del backend (como en LocationManager)
      // El backend ya incluye zona, barrio y toda la información completa
      modalCoverageResult.value = {
        formatted_address: result.formatted_address || result.address,
        address: result.address || result.formatted_address,
        lat: lat,
        lng: lng,
        latitude: lat, // Preservar ambos formatos
        longitude: lng, // Preservar ambos formatos
        geocoded: result.geocoded,
        is_inside_any: result.is_inside_any,
        delivery_cost_cop: deliveryCost,
        delivery_pricing: result.delivery_pricing, // Guardar objeto completo de pricing (puede ser null en formato Rappi Cargo)
        rappi_validation: result.rappi_validation, // Guardar objeto completo de validación (puede ser null en formato Google Maps)
        matching_polygons: result.matching_polygons, // Guardar polígonos coincidentes
        nearest: nearestSite ? {
          site: nearestSite,
          distance_km: finalDistance,
          in_coverage: inCoverage || result.is_inside_any
        } : null
      }

      const ot = getExactOrderType(modalStore.value.id, 3)
      if (ot) {
        modalStep.value = 4
      } else {
        modalAddressError.value = (lang.value === 'en')
          ? 'Delivery service is not available for this store.'
          : 'El servicio de domicilio no está disponible en esta sede.'
        modalStep.value = 2
      }
    } else {
      modalAddressError.value = (lang.value === 'en')
        ? 'Could not geocode the address. Please try a more specific address.'
        : 'No se pudo geocodificar la dirección. Intenta con una dirección más específica.'
      modalStep.value = 2
    }
  } catch (error) {
    console.error('Error validating address:', error)
    if (error.message && error.message.includes('conectar')) {
      modalAddressError.value = (lang.value === 'en')
        ? 'Could not connect to address validation server. Please try again later.'
        : 'No se pudo conectar con el servidor de validación. Intenta de nuevo más tarde.'
    } else if (error.message && error.message.includes('ciudad')) {
      modalAddressError.value = error.message
    } else {
      modalAddressError.value = (lang.value === 'en')
        ? 'Error validating address. Please check the address and try again.'
        : 'Error validando dirección. Verifica la dirección e intenta de nuevo.'
    }
    modalStep.value = 2
  } finally {
    isCheckingModalAddress.value = false
  }
}

async function onModalNeighborhoodComplete(e) {
  const q = (e.query || '').trim().toLowerCase()
  const base = neighborhoods.value || []
  modalNbSuggestions.value = !q
    ? base.slice(0, 50)
    : base.filter((n) => (n.name || '').toLowerCase().includes(q)).slice(0, 50)
}

function onDispatchModalParams() {
  if (!modalSelectedNeighborhood.value || !modalParamAddress.value.trim()) return
  const assignedSiteId = modalSelectedNeighborhood.value.site_id
  let targetStore = getStoreById(Number(assignedSiteId))
  if (!targetStore) targetStore = modalStore.value
  const ot = getExactOrderType(targetStore.id, 3)
  if (!ot) {
    alert(lang.value === 'en'
      ? 'The store assigned to this neighborhood does not have delivery enabled.'
      : 'La sede asignada a este barrio no tiene servicio de domicilio activo.'
    )
    return
  }
  dispatchToSite(targetStore, ot, {
    mode: 'params',
    city: cities.value.find((c) => Number(c.city_id) === Number(targetStore.cityId)),
    neighborhood: modalSelectedNeighborhood.value,
    exactAddress: modalParamAddress.value
  })
}

function onDispatchParamsDelivery() {
  if (!canDispatchParams.value) return
  const store = paramAssignedStore.value
  if (!store) return
  const ot = getExactOrderType(store.id, 3)
  if (!ot) {
    alert(lang.value === 'en'
      ? 'This store does not have delivery enabled.'
      : 'Esta sede no tiene habilitado domicilio.'
    )
    return
  }
  dispatchToSite(store, ot, {
    mode: 'params',
    city: selectedCityObj.value,
    neighborhood: selectedNeighborhood.value,
    exactAddress: paramExactAddress.value
  })
}


function confirmGoogleDispatch() {
  if (!modalCoverageResult.value) return
  const siteId = modalCoverageResult.value.nearest?.site?.site_id || modalStore.value.id
  let targetStore = getStoreById(Number(siteId))
  if (!targetStore) targetStore = modalStore.value
  const ot = getExactOrderType(targetStore.id, 3)
  if (ot) {
    dispatchToSite(targetStore, ot, {
      mode: 'gmaps',
      coverageData: modalCoverageResult.value,
      city: selectedCityObj.value
    })
  } else {
    alert(lang.value === 'en'
      ? 'Error: Could not determine the delivery order type.'
      : 'Error: No se pudo determinar el tipo de orden para domicilio.'
    )
  }
}

/* =======================
   API LOADERS
   ======================= */
async function loadPaymentConfig() {
  try {
    const res = await fetch(`${URI}/site-payments-complete`)
    sitePaymentsConfig.value = await res.json()
  } catch (e) { console.error('Error loading payment config', e) }
}

async function loadCityMapStatus() {
  try {
    const res = await fetch('https://api.locations.salchimonster.com/data/cities_google_map_status')
    const data = await res.json()
    cityMapStatus.value = data.data?.cities || []
  } catch (e) { 
    console.error('Error loading city map status', e)
    cityMapStatus.value = []
  }
}

async function loadCities() {
  try {
    const res = await fetch(`${BACKEND_BASE}/cities`)
    cities.value = (await res.json()).filter((c) => c.visible !== false)
  } catch {}
}

async function loadStores() {
  try {
    const res = await fetch(`${BACKEND_BASE}/sites`)
    const data = await res.json()
    const newStores = data
      .filter((s) => s.show_on_web && s.time_zone === 'America/Bogota' && s.site_id != 32)
      .map((s) => ({
        id: s.site_id,
        site_id: s.site_id, // Incluir también site_id explícitamente
        pe_site_id: s.pe_site_id || null, // pe_site_id es requerido - debe venir del backend
        name: `SALCHIMONSTER ${s.site_name}`,
        city: s.city_name,
        cityId: s.city_id,
        address: s.site_address || 'Dirección pendiente',
        lat: s.location?.[0] || 4.0,
        lng: s.location?.[1] || -74.0,
        subdomain: s.subdomain,
        img_id: s.img_id,
        status: 'unknown',
        site_phone: s.site_phone || null
      }))
    
    // Detectar cambios en img_id y actualizar solo si cambió
    if (import.meta.client && stores.value.length > 0) {
      newStores.forEach((newStore) => {
        const oldStore = stores.value.find(s => s.id === newStore.id)
        if (oldStore && oldStore.img_id !== newStore.img_id) {
          // El img_id cambió, actualizar el cache para forzar re-render
          storeImgIds.value[newStore.id] = newStore.img_id
        }
      })
    }
    
    stores.value = newStores
  } catch {}
}

async function loadStatuses() {
  const promises = stores.value.map(async (s) => {
    try {
      const res = await fetch(`${BACKEND_BASE}/site/${s.id}/status`)
      const d = await res.json()
      s.status = d.status
      // CAMBIO: Capturar la hora de apertura
      s.next_opening_time = d.next_opening_time
    } catch {
      if (!s.status) s.status = 'unknown'
    }
  })
  await Promise.all(promises)
}

/* =======================
   ORDER TYPES
   ======================= */
function getAvailableOrderTypes(siteId) {
  const config = sitePaymentsConfig.value.find((s) => String(s.site_id) === String(siteId))
  if (!config || !config.order_types) return []
  return config.order_types.filter((ot) => ot.methods && ot.methods.length > 0)
}
function getExactOrderType(siteId, typeId) {
  const available = getAvailableOrderTypes(siteId)
  return available.find((ot) => Number(ot.id) === Number(typeId)) || null
}
function getIconForOrderType(id) {
  if (Number(id) === 3) return 'mdi:moped'
  if (Number(id) === 2) return 'mdi:shopping-outline'
  if (Number(id) === 6) return 'mdi:silverware-fork-knife'
  return 'mdi:star'
}
function getButtonClass(id) {
  if (Number(id) === 3) return 'modal-btn--delivery'
  return 'modal-btn--pickup'
}

/* =======================
   DISPATCH
   ======================= */
async function dispatchToSite(manualStore, orderTypeObj, extra = { mode: 'simple' }) {
  isRedirecting.value = true
  let targetStore = manualStore
  targetSiteName.value = targetStore?.name || targetStore?.site_name || 'Nueva Sede'
  const targetCityId = targetStore.cityId || targetStore.city_id
  const useGoogleMaps = isGoogleMapsEnabled(Number(targetCityId))
  const isDelivery = Number(orderTypeObj?.id) === 3

  try {
    let userSiteData = null
    let finalAddress = ''
    let finalLat = 0
    let finalLng = 0
    let finalPlaceId = ''
    let deliveryPrice = 0

    if (isDelivery && useGoogleMaps && extra?.mode === 'gmaps' && extra?.coverageData) {
      const coverageData = extra.coverageData
      // Obtener el costo de domicilio: priorizar delivery_pricing.price, luego rappi_validation, luego delivery_cost_cop
      // Compatible con ambos formatos: Rappi Cargo y Google Maps
      if (coverageData.delivery_pricing && coverageData.delivery_pricing.price != null) {
        deliveryPrice = Number(coverageData.delivery_pricing.price) || 0
      } else if (coverageData.rappi_validation && coverageData.rappi_validation.estimated_price) {
        deliveryPrice = Number(coverageData.rappi_validation.estimated_price) || 0
      } else {
        deliveryPrice = coverageData.delivery_cost_cop || 0
      }
      
      // Compatible con ambos formatos: Rappi Cargo (latitude/longitude) y Google Maps (lat/lng)
      const lat = coverageData.latitude || coverageData.lat || 0
      const lng = coverageData.longitude || coverageData.lng || 0
      
      userSiteData = {
        ...coverageData,
        delivery_cost_cop: deliveryPrice,
        formatted_address: coverageData.formatted_address || coverageData.address,
        address: coverageData.address || coverageData.formatted_address,
        delivery_pricing: coverageData.delivery_pricing, // Guardar objeto completo de pricing (puede ser null en formato Rappi Cargo)
        rappi_validation: coverageData.rappi_validation, // Guardar objeto completo de validación (puede ser null en formato Google Maps)
        lat: lat,
        lng: lng,
        latitude: lat, // Preservar ambos formatos
        longitude: lng // Preservar ambos formatos
      }
      finalAddress = coverageData.formatted_address || coverageData.address || ''
      finalLat = lat
      finalLng = lng
      finalPlaceId = coverageData.place_id || ''
    }

    if (isDelivery && !useGoogleMaps && extra?.mode === 'params' && extra?.neighborhood) {
      const nb = extra.neighborhood
      finalAddress = (extra.exactAddress || '').toString()
      deliveryPrice = Number(nb.delivery_price ?? 0)
      userSiteData = {
        formatted_address: finalAddress,
        delivery_cost_cop: deliveryPrice,
        neighborhood: {
          ...nb,
          neighborhood_id: nb.neighborhood_id || nb.id,
          name: nb.name,
          site_id: nb.site_id,
          delivery_price: deliveryPrice,
        },
        nearest: {
          in_coverage: true,
          distance_km: 0,
          site: {
            site_id: targetStore.id || targetStore.site_id,
            site_name: (targetStore.name || targetStore.site_name || '').replace('SALCHIMONSTER ', ''),
            city_id: targetCityId,
            city: targetStore.city,
            site_address: targetStore.address
          }
        }
      }
    }

    // Preparar el objeto de sitio para el store
    const siteData = {
      site_id: targetStore.id || targetStore.site_id,
      pe_site_id: targetStore.pe_site_id || null, // pe_site_id es requerido - debe venir del backend
      site_name: (targetStore.name || targetStore.site_name || '').replace('SALCHIMONSTER ', ''),
      site_address: targetStore.address,
      city_id: targetCityId,
      city: targetStore.city,
      site_phone: targetStore.site_phone || null,
      subdomain: targetStore.subdomain || null // Guardar subdomain para búsqueda por slug
    }

    // Actualizar el store con toda la información
    sitesStore.updateLocation({
      site: siteData,
      city: extra?.city || null,
      neigborhood: extra?.mode === 'params' && extra?.neighborhood
        ? {
            ...extra.neighborhood,
            neighborhood_id: extra.neighborhood.neighborhood_id || extra.neighborhood.id,
            name: extra.neighborhood.name,
            site_id: extra.neighborhood.site_id,
            delivery_price: deliveryPrice,
          }
        : null,
      address_details: userSiteData,
      formatted_address: finalAddress,
      place_id: finalPlaceId,
      lat: finalLat,
      lng: finalLng,
      mode: isDelivery && !useGoogleMaps ? 'barrios' : 'google',
      order_type: orderTypeObj
    }, deliveryPrice)
    
    // Actualizar address_details y calcular is_rappi_cargo (persistente) si hay userSiteData
    if (userSiteData) {
      cartStore.setAddressDetails(userSiteData)
    }

    // Guardar order_type en el store
    sitesStore.setOrderType(orderTypeObj)

    // Actualizar user store si es necesario
    if (userSiteData) {
      userStore.user = {
        ...userStore.user,
        site: userSiteData,
        address: finalAddress,
        lat: finalLat,
        lng: finalLng,
        place_id: finalPlaceId,
        order_type: orderTypeObj
      }
    }

    // Obtener el slug de la sede para la URL
    const siteSlug = getSiteSlug(siteData.site_name)
    
    // Redirigir a la página de la sede: /modelia/, /suba/, etc.
    if (siteSlug) {
      await router.push(`/${siteSlug}/`)
    } else {
      await router.push('/')
    }
  } catch (error) {
    console.error(error)
    isRedirecting.value = false
    alert(lang.value === 'en'
      ? 'Transfer error. Please try again.'
      : 'Error al transferir. Intenta de nuevo.'
    )
  }
}


/* =======================
   IMAGES
   ======================= */
const FALLBACK_LOGO = 'https://gestion.salchimonster.com/images/logo.png'

// Cache de img_id por store para detectar cambios
const storeImgIds = ref({})
let storeRefreshInterval = null

// Inicializar cache de img_id cuando se cargan los stores
watch(stores, (newStores) => {
  if (!import.meta.client) return
  
  newStores.forEach((store) => {
    if (!storeImgIds.value[store.id]) {
      storeImgIds.value[store.id] = store.img_id
    }
  })
}, { immediate: true })

// Verificar cambios en img_id cada 5 minutos
onMounted(() => {
  if (import.meta.client) {
    storeRefreshInterval = setInterval(async () => {
      // Solo verificar cambios, no forzar recarga si no hay cambios
      await loadStores()
    }, 5 * 60 * 1000) // 5 minutos
  }
})

onBeforeUnmount(() => {
  if (storeRefreshInterval) {
    clearInterval(storeRefreshInterval)
    storeRefreshInterval = null
  }
})

const onImgError = (store) => {
  // El fallback se maneja con v-else en el template
  console.warn(`[Dispatcher] Error loading image for store ${store.id}`)
}

/* =======================
   UTILS + DATA
   ======================= */
function getStoreById(id) { return stores.value.find(s => Number(s.id) === Number(id)) }
function formatCOP(v) {
  return v != null
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
    : ''
}

/* =======================
   MAPA + FILTROS
   ======================= */
const filteredStores = computed(() => {
  let base = stores.value
  const cityId = Number(selectedCityId.value || 0)
  if (cityId) base = base.filter((s) => Number(s.cityId) === cityId)
  if (mapBounds.value) {
    base = base.filter((s) =>
      s.lat <= mapBounds.value.north &&
      s.lat >= mapBounds.value.south &&
      s.lng <= mapBounds.value.east &&
      s.lng >= mapBounds.value.west
    )
  }
  return base
})

function updateBounds() {
  if (map.value) {
    const b = map.value.getBounds()
    mapBounds.value = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
  }
}

async function onCityChange() {
  selectedCityId.value = Number(selectedCityId.value || 0)
  coverageResult.value = null
  addressQuery.value = ''
  neighborhoods.value = []
  selectedNeighborhood.value = null
  nbSuggestions.value = []
  if (!selectedCityId.value) paramExactAddress.value = ''
  try {
    if (dropoffMarker.value && map.value) {
      map.value.removeLayer(dropoffMarker.value)
      dropoffMarker.value = null
    }
  } catch {}
  if (selectedCityId.value && !isGoogleMapsEnabled(selectedCityId.value)) {
    await loadNeighborhoodsByCity(selectedCityId.value)
  }
  if (!map.value || !leafletModule.value) return
  const L = leafletModule.value
  const cityIdAtClick = selectedCityId.value
  if (!initialBounds.value) initialBounds.value = map.value.getBounds()
  if (!cityIdAtClick) {
    map.value.flyToBounds(initialBounds.value, { padding: [40, 40], animate: true, duration: 0.9 })
    return
  }
  const cityStores = stores.value.filter((s) => Number(s.cityId) === Number(cityIdAtClick))
  const latlngs = cityStores.map((s) => [s.lat, s.lng])
  if (!latlngs.length) return
  const targetBounds = L.latLngBounds(latlngs)
  map.value.flyToBounds(initialBounds.value, { padding: [40, 40], animate: true, duration: 0.7 })
  setTimeout(() => {
    if (!map.value || Number(selectedCityId.value) !== Number(cityIdAtClick)) return
    map.value.flyToBounds(targetBounds, { padding: [40, 40], animate: true, duration: 0.9 })
  }, 750)
}

onMounted(async () => {
  await Promise.all([loadPaymentConfig(), loadCityMapStatus()])
  await Promise.all([loadCities(), loadStores()])
  await loadStatuses()
  const mod = await import('leaflet')
  const L = mod.default ?? mod
  leafletModule.value = L
  const colombiaBounds = L.latLngBounds(L.latLng(-4.5, -79.5), L.latLng(13.5, -66.5))
  map.value = L.map('vicio-map', {
    zoom: 6,
    minZoom: 5,
    maxZoom: 16,
    maxBounds: colombiaBounds,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: false,
    keyboard: true,
    dragging: true,
    tap: false
  })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map.value)
  const fireIcon = L.divIcon({
    className: 'leaflet-div-icon fire-icon',
    html: `<img src="https://cdn.deliclever.com/viciocdn/ecommerce/icon-fire-color.gif" class="fire-img" style="width:100%;height:100%"/>`,
    iconSize: [42, 42]
  })
  dropoffIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  })
  const group = L.featureGroup()
  stores.value.forEach((s) => {
    const m = L.marker([s.lat, s.lng], { icon: fireIcon })
      .addTo(map.value)
      .bindPopup(`<b>${s.name}</b><br>${s.address}`)
    group.addLayer(m)
    markers.value[s.id] = m
  })
  if (stores.value.length) {
    map.value.fitBounds(group.getBounds(), { padding: [40, 40] })
    map.value.setMinZoom(map.value.getBoundsZoom(group.getBounds()))
    initialBounds.value = group.getBounds()
  } else {
    initialBounds.value = colombiaBounds
    map.value.fitBounds(colombiaBounds, { padding: [40, 40] })
  }
  map.value.on('moveend', updateBounds)
  updateBounds()
})

/* =======================
   SEO
   ======================= */
const pageTitle = computed(() => {
  return 'Salchimonster Colombia - Elige tu Sede y Pide a Domicilio'
})

const pageDescription = computed(() => {
  return 'Elige tu Salchimonster más cercano y pide a domicilio. Encuentra la sede más cercana a tu ubicación en Colombia. La mejor salchipapa, hamburguesas y más. Delivery rápido y seguro.'
})

// URL completa para compartir
const fullUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.href
  }
  return 'https://salchimonster.com/'
})

// Imagen para Open Graph (logo de Salchimonster)
const ogImage = computed(() => {
  // Usar logo de Salchimonster - URL absoluta para compartir en redes sociales
  // Usar el logo del backend que es accesible públicamente
  return 'https://gestion.salchimonster.com/images/logo.png'
})

useHead(() => ({
  title: pageTitle.value,
  link: [
    { rel: 'canonical', href: fullUrl.value }
  ],
  meta: [
    // SEO básico
    { name: 'description', content: pageDescription.value },
    { name: 'robots', content: 'index, follow' },
    { name: 'keywords', content: 'salchimonster, salchipapa, hamburguesas, delivery, domicilio, comida rápida, colombia, restaurante, pedidos online' },
    { name: 'author', content: 'Salchimonster' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
    
    // Open Graph
    { property: 'og:title', content: pageTitle.value },
    { property: 'og:description', content: pageDescription.value },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: fullUrl.value },
    { property: 'og:image', content: ogImage.value },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'Salchimonster Colombia - Elige tu Sede' },
    { property: 'og:site_name', content: 'Salchimonster' },
    { property: 'og:locale', content: 'es_CO' },
    
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: pageTitle.value },
    { name: 'twitter:description', content: pageDescription.value },
    { name: 'twitter:image', content: ogImage.value },
    { name: 'twitter:image:alt', content: 'Salchimonster Colombia - Elige tu Sede' },
    { name: 'twitter:site', content: '@salchimonster' },
    
    // Mobile
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Salchimonster',
        description: pageDescription.value,
        url: 'https://salchimonster.com',
        logo: ogImage.value,
        sameAs: [
          'https://www.facebook.com/salchimonster',
          'https://www.instagram.com/salchimonster',
          'https://www.tiktok.com/@salchimonster'
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Customer Service',
          availableLanguage: ['Spanish', 'English']
        },
        areaServed: {
          '@type': 'Country',
          name: 'Colombia'
        },
        servesCuisine: 'Fast Food',
        priceRange: '$$'
      })
    },
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Salchimonster Colombia',
        url: 'https://salchimonster.com',
        description: pageDescription.value,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://salchimonster.com/buscar?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      })
    }
  ]
}))
</script>

<style scoped>
/* =========================
   GLOBAL
   ========================= */
:global(html.no-global-scroll),
:global(body.no-global-scroll) {
  height: 100%;
  overflow: hidden !important;
  overscroll-behavior: none;
}
:global(body.no-global-scroll) { margin: 0; }
:global(html.no-global-scroll) { -webkit-text-size-adjust: 100%; }

.vicio-root { width: 100%; height: 100%; }
.vicio-page {
  display: flex;
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: 'Roboto', sans-serif;
  touch-action: none;
}

.vicio-map-shell {
  flex: 1 1 55%;
  height: 100%;
  background: #e2e8f0;
  overflow: hidden;
  position: relative;
}
.vicio-map {
  width: 100%;
  height: 100%;
  background: #e2e8f0;
  touch-action: pan-x pan-y pinch-zoom;
}

/* Stickers sobre el mapa */
.map-sticker {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
  user-select: none;
  width: 200px;
  height: auto;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.map-sticker--top-left {
  top: 20px;
  left: 10px;
  transform: rotate(8deg);
}

.map-sticker--bottom-right {
  bottom: 20px;
  right: 10px;
  transform: rotate(-12deg);
}

@media (max-width: 900px) {
  .map-sticker--top-left {
    left: -10px;
  }
  
  .map-sticker--bottom-right {
    right: -10px;
  }
}

.vicio-sidebar {
  flex: 1 1 45%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-left: 1px solid var(--border-subtle);
  box-shadow: -5px 0 25px rgba(0, 0, 0, 0.05);
  height: 100%;
  overflow: hidden;
}

.sidebar-header {
  padding: 1.4rem 1.8rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  position: relative;
  z-index: 5;
}

.sidebar-header-top{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: .75rem;
}

.sidebar-title {
  font-size: 0.82rem;
  letter-spacing: 0.18em;
  font-weight: 800;
  margin: 0 0 0.9rem;
  text-transform: uppercase;
  color: #1e293b; /* Más oscuro para contraste */
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
}
.sidebar-title::before { content: "🔥"; font-size: 1rem; }

.lang-switch{
  display:flex;
  gap:.4rem;
  margin-top:.05rem;
  flex-shrink:0;
}
.lang-btn{
  display:inline-flex;
  align-items:center;
  gap:.35rem;
  padding:.28rem .45rem;
  border-radius:999px;
  border:1px solid #e2e8f0;
  background:#fff;
  cursor:pointer;
  font-weight:800;
  font-size:.72rem;
  letter-spacing:.08em;
  color:#334155;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.lang-btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0,0,0,.06);
}
.lang-btn.is-active{
  border-color:#ff6600;
  box-shadow: 0 6px 16px rgba(255,102,0,.15);
}
.lang-flag{
  width:18px;
  height:18px;
  border-radius:999px;
  object-fit:cover;
  border:1px solid rgba(0,0,0,.08);
}
.lang-label{ line-height:1; }

.city-select-wrapper { margin-bottom: 0.9rem; }
.city-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #475569; /* Gris más oscuro para legibilidad */
  margin-bottom: 0.35rem;
}

.search-wrapper { position: relative; display: flex; flex-direction: column; gap: 0.25rem; }
.params-box { margin-top: .6rem; }
.ac-item { display: flex; align-items: center; gap: .55rem; }
.item-icon { color: #64748b; font-size: 1.1em; }

/* Tarjeta Resultado */
.coverage-card {
  margin: 1rem 1.8rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.coverage-header {
  background: #f8fafc;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}
.coverage-icon { color: #ff6600; }
.coverage-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #334155;
}
.coverage-body { padding: 1rem; font-size: 0.9rem; }
.coverage-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
.coverage-label { color: #64748b; font-weight: 500; font-size: 0.85rem; }
.coverage-value { color: #1e293b; font-weight: 600; text-align: right; max-width: 60%; }
.coverage-value.address-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.coverage-value.price { color: #16a34a; font-weight: 800; font-size: 1rem; }
.coverage-status-text {
  margin-top: 0.8rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
}
.text-ok { color: #15803d; }
.text-fail { color: #b91c1c; }
.coverage-actions { display: flex; gap: 0.8rem; padding: 0 1rem 1rem; flex-wrap: wrap; }

/* Botones */
.btn-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.7rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}
.btn-action:disabled { opacity: .55; cursor: not-allowed; filter: grayscale(1); }
.btn-action:active { transform: scale(0.97); }

.btn-validate-address {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all 0.2s ease;
}
.btn-validate-address:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 6px 15px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}
.btn-validate-address:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ✅ Botón Domicilio: Naranja vibrante */
.btn-delivery {
  background: linear-gradient(135deg, #ff6600 0%, #ff5500 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(255, 102, 0, 0.3);
}
.btn-delivery:hover {
  background: linear-gradient(135deg, #ff5500 0%, #e64a19 100%);
  box-shadow: 0 6px 15px rgba(255, 102, 0, 0.4);
  transform: translateY(-1px);
}

/* ✅ Botón WhatsApp: Verde Intenso + Gradiente */
.btn-whatsapp{
  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
}
.btn-whatsapp:hover {
  background: linear-gradient(135deg, #2ecc71 0%, #16a085 100%);
  box-shadow: 0 6px 15px rgba(37, 211, 102, 0.5);
  transform: translateY(-1px);
}
.full-width { width: 100%; }

/* Lista de Sedes */
.stores-list {
  flex: 1;
  overflow-y: auto;
  background: #ffffff;
  padding: 0.45rem 0 1.2rem;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

.store-item {
  display: grid;
  align-items: center;
  justify-content: space-between;
  grid-template-areas: 
  "img info wsp arrow"
  "img info wsp arrow"
   "img info wsp arrow"
  "img status status status";
  grid-template-columns: auto 1fr auto auto;
  padding: 1.1rem 1.8rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  gap: 1rem;
  width: 100%;
  transition: all 0.2s ease;
  position: relative;
}
.store-item:hover { background: #f8fafc; }

/* ✅ Estado Activo: Borde más grueso y fondo cálido */
.store-item--active {
  background: #fffcf9;
  border-left: 5px solid #ff6600;
}
.store-item--active .store-name { color: #ff6600; }

.store-img-wrapper {
  width: 90px;
  height: 90px;
  flex-shrink: 0;
  border-radius: 0.8rem;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  background-color: #f1f5f9;
}
.store-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.store-item:hover .store-img { transform: scale(1.05); }

.store-info { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.store-name { margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e293b; transition: color 0.2s; }
.store-services { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #f97316; letter-spacing: 0.12em; }
.store-address { font-size: 0.84rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 500; }

.store-actions-row{
  display:flex;
  align-items:center;
  gap:.55rem;
  flex-wrap:wrap;
  margin-top: 0.2rem;
}

.store-action {
  align-self: flex-start;
  border: none;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.4rem 0.9rem;
  border-radius: 10rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s ease;
}

/* ✅ ETIQUETAS DE ESTADO: Colores Intensos */
.store-action[data-status='open'] {
  background: linear-gradient(135deg, #00c853 0%, #009624 100%);
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(0, 200, 83, 0.4); /* Glow verde */
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.store-action[data-status='closed'],
.store-action[data-status='close'] {
  background: linear-gradient(135deg, #d50000 0%, #9b0000 100%);
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(213, 0, 0, 0.4); /* Glow rojo */
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.store-action[data-status='unknown'] { background: #cbd5e1; color: #475569; }

.status-flex { display: flex; align-items: center; gap: 0.35rem; }

/* ✅ Botón flotante WhatsApp en la lista */
.store-whatsapp{
  border:none;
  background: linear-gradient(135deg, #25D366 50%, #128C7E 100%);
  color:#ffffff;
  font-size:.72rem;
  height: 2.8rem;
  width: 2.8rem;
  box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
  border-radius:50%;
  display:flex;
  justify-content: center;
  align-items:center;
  cursor:pointer;
  transition: all 0.2s ease;
  z-index: 2;
}
.store-whatsapp:hover{ transform: scale(1.1) rotate(5deg); box-shadow: 0 6px 16px rgba(37, 211, 102, 0.5); }
.store-whatsapp:disabled{ opacity:.4; filter:grayscale(1); cursor:not-allowed; box-shadow:none; }

.store-arrow {
  background: transparent;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.store-item:hover .store-arrow {
  background: #f1f5f9;
  color: #334155;
  transform: translateX(3px);
}

:global(.leaflet-div-icon.fire-icon) { width: 42px !important; height: 42px !important; border: none; background: transparent; display: flex; align-items: center; justify-content: center; }
:global(.leaflet-div-icon.fire-icon .fire-img) { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); transition: transform 0.3s; }
:global(.leaflet-div-icon.fire-icon:hover .fire-img) { transform: scale(1.2); }
:deep(.leaflet-tile) { filter: grayscale(100%) !important; }

/* Modal Styles */
.modal-close-btn { position: absolute; top: 12px; right: 12px; background: #f1f5f9; border-radius: 50%; width: 32px; height: 32px; border: none; cursor: pointer; color: #64748b; padding: 0; display:flex; align-items:center; justify-content:center; transition: all 0.2s; }
.modal-close-btn:hover { background: #fee2e2; color: #ef4444; }

.modal-title {
  margin: 0 0 5px;
  font-size: 1.3rem;
  font-weight: 900;
  color: #0f172a;
  text-align: center;
  text-transform: uppercase;
  margin-top: 1.5rem;
  letter-spacing: -0.02em;
}
.modal-subtitle { text-align: center; color: #64748b; font-size: 0.95rem; margin-bottom: 1.2rem; }
.modal-whatsapp-row{ margin-bottom: .8rem; }

.modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
.modal-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border-radius: 16px;
  width: 100%;
  aspect-ratio: 1 / 0.85;
  border: 2px solid transparent;
  background: #f8fafc;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.modal-btn--delivery:hover { background: #fff7ed; border-color: #ff6600; color: #c2410c; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(255, 102, 0, 0.15); }
.modal-btn--pickup:hover { background: #f0fdf4; border-color: #16a34a; color: #15803d; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(22, 163, 74, 0.15); }

.modal-header-nav { margin-bottom: 0.8rem; }
.modal-back-btn { display: inline-flex; align-items: center; gap: 6px; margin: 1rem; color: #475569; font-weight: 600; }
.modal-back-btn:hover { color: #0f172a; background: #f1f5f9; }

.modal-error { margin-top: 10px; color: #ef4444; font-size: 0.85rem; text-align: center; font-weight: 600; }
.modal-loading-view { text-align: center; padding: 2rem 0; color: #64748b; }

.redirect-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.95); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
.redirect-content { text-align: center; animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.redirect-spinner { position: relative; display: inline-flex; margin-bottom: 2rem; color: #ff6600; }
.rocket-icon { z-index: 2; animation: rocketFloat 1.5s ease-in-out infinite alternate; color: #ff6600; filter: drop-shadow(0 4px 6px rgba(255,102,0,0.4)); }
.pulse-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; border-radius: 50%; border: 3px solid #ff6600; opacity: 0; animation: pulse 2s infinite; }
.redirect-store { font-size: 2.5rem; font-weight: 900; color: #0f172a; margin: 0.5rem 0; letter-spacing: -0.03em; }
.redirect-subtitle { font-size: 1.1rem; color: #64748b; font-weight: 500; }

@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes rocketFloat { from { transform: translateY(0); } to { transform: translateY(-15px) rotate(5deg); } }
@keyframes pulse { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .vicio-page { flex-direction: column; }
  .vicio-map-shell { flex: 0 0 auto; height: 35%; width: 100%; z-index: 10; transition: height 0.38s ease, opacity 0.38s ease, transform 0.38s ease; }
  .vicio-sidebar { flex: 1 1 auto; height: 65%; width: 100%; overflow: hidden; border-radius: 1.5rem 1.5rem 0 0; margin-top: -1.5rem; z-index: 20; box-shadow: 0 -4px 25px rgba(0,0,0,0.1); transition: height 0.38s ease, border-radius 0.38s ease, margin-top 0.38s ease; }
  .vicio-page.is-map-collapsed .vicio-map-shell { height: 0% !important; opacity: 0; transform: translateY(-10px); pointer-events: none; }
  .vicio-page.is-map-collapsed .vicio-sidebar { height: 100% !important; margin-top: 0 !important; border-radius: 0 !important; }
  .store-img-wrapper { width: 70px; height: 70px; }
  .store-item { padding: 1rem 1.2rem; }
  .coverage-card { margin: 1rem; }
  .sidebar-header-top { align-items: center; }
}

* { transition: all .2s ease-out; }

</style>