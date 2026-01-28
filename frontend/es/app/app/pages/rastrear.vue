<!-- pages/rastrear.vue (o el componente que uses para /rastrear) -->
<template>
  <div class="track-page">
    <main 
      class="track-main"
      :class="{ 'track-main--with-cargo': hasCargoTracking }"
    >
      <section class="track-card animate-entry">
        <header class="track-card__header">
          <h1 class="track-title">{{ t('title', 'Rastrea tu pedido', 'Track your order') }}</h1>
          <p class="track-subtitle">
            {{
              t(
                'subtitle',
                'Ingresa el ID de tu pedido para ver su estado actual y el historial.',
                'Enter your order ID to see its current status and history.'
              )
            }}
          </p>
        </header>

        <form @submit.prevent="getStatusHistory" class="search-wrapper">
          <div class="search-input-wrapper">
            <Icon name="mdi:tag-outline" class="search-input-icon" />
            <input
              v-model="orderId"
              type="text"
              class="search-input"
              :placeholder="t('placeholder', 'Ejemplo: MOD-0054...', 'Example: MOD-0054...')"
              autocomplete="off"
            />
          </div>

          <button type="submit" class="search-button" :disabled="loading">
            <Transition name="rotate" mode="out-in">
              <Icon
                v-if="loading"
                name="mdi:loading"
                class="search-icon spin-animation"
              />
              <Icon v-else name="mdi:magnify" class="search-icon" />
            </Transition>
          </button>
        </form>

        <div class="track-messages">
          <Transition name="fade" mode="out-in">
            <div v-if="loading" class="alert alert--info" key="loading">
              <Icon name="mdi:clock-outline" class="alert__icon" />
              <span>{{ t('searching', 'Buscando tu pedido...', 'Searching your order...') }}</span>
            </div>

            <div v-else-if="error" class="alert alert--error" key="error">
              <Icon name="mdi:alert-circle-outline" class="alert__icon" />
              <span>{{ error }}</span>
            </div>
          </Transition>
        </div>

        <Transition name="slide-up">
          <section
            v-if="!loading && !error && currentStatus"
            class="current-status"
          >
            <h2 class="current-status__title">
              {{ t('thanks', '¡Gracias por tu compra!', 'Thanks for your purchase!') }}
            </h2>

            <p class="current-status__text">
              {{ getCurrentStatusMessage(currentStatus.status) }}
            </p>

            <div
              v-if="normalizeStatus(currentStatus.status) === 'enviada'"
              class="current-status__badge pulse-badge"
            >
              <Icon
                name="mdi:truck-delivery-outline"
                class="current-status__badge-icon"
              />
              <span>{{ t('on_way', 'Tu pedido está en camino', 'Your order is on the way') }}</span>
            </div>
          </section>
        </Transition>

        <section
          v-if="
            !loading &&
            !error &&
            currentStatus &&
            firstHistory &&
            firstHistory.status_history
          "
          class="history"
        >
          <h3 class="history__title">
            {{ t('history', 'Historial de estado', 'Status history') }}
          </h3>

          <TransitionGroup name="list" tag="ul" class="status-timeline">
            <li
              v-for="(stat, index) in firstHistory.status_history"
              :key="stat.timestamp + '-' + index"
              class="status-timeline__item"
              :style="{ transitionDelay: `${index * 100}ms` }"
            >
              <div class="status-timeline__marker"></div>
              <div class="status-timeline__content">
                <p class="status-timeline__status">
                  {{ translateStatus(stat.status) }}
                </p>
                <p class="status-timeline__timestamp">
                  {{ stat.timestamp }}
                </p>
              </div>
            </li>
          </TransitionGroup>
        </section>

        <!-- Sección de rastreo Rappi Cargo -->
        <Transition name="slide-up">
          <section
            v-if="
              !loading &&
              !error &&
              firstHistory &&
              firstHistory.cargo_response_insert &&
              firstHistory.cargo_response_insert.tracking_url
            "
            class="cargo-tracking"
          >
            <div class="cargo-tracking__header">
              <h3 class="cargo-tracking__title">
                <Icon name="mdi:truck-delivery" class="cargo-tracking__icon" />
                {{ t('cargo_tracking', 'Rastreo en tiempo real', 'Real-time tracking') }}
              </h3>
              <button
                @click="openTrackingInNewWindow"
                class="cargo-tracking__external-btn"
                :title="t('open_external', 'Abrir en nueva ventana', 'Open in new window')"
              >
                <Icon name="mdi:open-in-new" />
                <span>{{ t('open_external', 'Abrir en nueva ventana', 'Open in new window') }}</span>
              </button>
            </div>
            
            <div class="cargo-tracking__iframe-wrapper">
              <iframe
                :src="firstHistory.cargo_response_insert.tracking_url"
                class="cargo-tracking__iframe"
                frameborder="0"
                allowfullscreen
                :title="t('cargo_tracking', 'Rastreo en tiempo real', 'Real-time tracking')"
              ></iframe>
            </div>

            <div v-if="firstHistory.cargo_response_insert.eta" class="cargo-tracking__footer">
              <div class="cargo-tracking__eta">
                <Icon name="mdi:clock-outline" />
                <span>
                  {{ t('eta', 'Tiempo estimado de llegada', 'Estimated arrival time') }}: 
                  <strong>{{ firstHistory.cargo_response_insert.eta }} {{ t('minutes', 'minutos', 'minutes') }}</strong>
                  <span v-if="firstHistory.cargo_response_insert.eta_interval" class="eta-interval">
                    ({{ firstHistory.cargo_response_insert.eta_interval.lower }}-{{ firstHistory.cargo_response_insert.eta_interval.upper }} {{ t('minutes', 'minutos', 'minutes') }})
                  </span>
                </span>
              </div>
              <div v-if="firstHistory.cargo_response_insert.trip_distance" class="cargo-tracking__distance">
                <Icon name="mdi:map-marker-distance" />
                <span>
                  {{ t('distance', 'Distancia', 'Distance') }}: 
                  <strong>{{ firstHistory.cargo_response_insert.trip_distance }} km</strong>
                </span>
              </div>
            </div>
          </section>
        </Transition>

        <Transition name="fade">
          <section
            v-if="!loading && !error && !currentStatus && !firstHistory"
            class="empty-state"
          >
            <Icon
              name="mdi:clipboard-text-search-outline"
              class="empty-state__icon float-animation"
            />
            <p class="empty-state__text">
              {{ t('empty', 'Ingresa el ID de tu pedido para ver su estado.', 'Enter your order ID to see its status.') }}
            </p>
          </section>
        </Transition>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, useUserStore, texts, useSitesStore, useHead } from '#imports'
import { URI } from '@/service/conection'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const orderId = ref('')
const history = ref([])
const currentStatus = ref(null)
const loading = ref(false)
const error = ref(null)

const langKey = computed(() => (user.lang?.name || 'ES').toLowerCase()) // 'es' | 'en'

/**
 * Traducciones locales (fallbacks)
 * Si en tu `texts` ya tienes algo como texts.es.track..., esto igual funciona.
 */
const localTrackTexts = {
  es: {
    title: 'Rastrea tu pedido',
    subtitle: 'Ingresa el ID de tu pedido para ver su estado actual y el historial.',
    placeholder: 'Ejemplo: MOD-0054...',
    searching: 'Buscando tu pedido...',
    empty: 'Ingresa el ID de tu pedido para ver su estado.',
    thanks: '¡Gracias por tu compra!',
    on_way: 'Tu pedido está en camino',
    err_empty: 'Por favor ingresa el ID de tu pedido.',
    err_not_found: 'No pudimos encontrar tu pedido. Verifica el ID e inténtalo de nuevo.',
    err_no_current: 'No encontramos el estado actual de tu pedido.',
    history: 'Historial de estado',

    // Mensajes por estado (es)
    msg: {
      generada: 'Tu pedido ha sido recibido y está en proceso de ser atendido.',
      'en preparacion': 'Tu pedido se encuentra en preparación y en breve estará listo para enviarse.',
      enviada: '¡Tu pedido está en camino!',
      cancelada: 'Tu pedido fue cancelado.',
      'pago pendiente': 'Tu pago está pendiente. Si ya pagaste, espera un momento y vuelve a intentar.',
      'transferencia pendiente': 'Tu transferencia está pendiente de confirmación.',
      'validacion pendiente': 'Tu pedido está pendiente de validación.',
      'no validada por cliente': 'Tu pedido no fue validado por el cliente.',
      'in validation': 'Tu pedido está en validación.',
      archivada: 'Tu pedido fue archivado.',
      'intento de pago archivado': 'El intento de pago fue archivado.',
      'domiciliario solicitado': 'Se solicitó un domiciliario para tu pedido.',
      'no confirmada': 'Tu pedido aún no está confirmado.'
    },
    cargo_tracking: 'Rastreo en tiempo real',
    open_external: 'Abrir en nueva ventana',
    eta: 'Tiempo estimado de llegada',
    minutes: 'minutos',
    distance: 'Distancia'
  },
  en: {
    title: 'Track your order',
    subtitle: 'Enter your order ID to see its current status and history.',
    placeholder: 'Example: MOD-0054...',
    searching: 'Searching your order...',
    empty: 'Enter your order ID to see its status.',
    thanks: 'Thanks for your purchase!',
    on_way: 'Your order is on the way',
    err_empty: 'Please enter your order ID.',
    err_not_found: "We couldn't find your order. Check the ID and try again.",
    err_no_current: "We couldn't find the current status of your order.",
    history: 'Status history',

    // Mensajes por estado (en)
    msg: {
      generada: 'We received your order and it is being processed.',
      'en preparacion': 'Your order is being prepared and will be ready to be sent soon.',
      enviada: 'Your order is on the way!',
      cancelada: 'Your order was cancelled.',
      'pago pendiente': 'Your payment is pending. If you already paid, wait a moment and try again.',
      'transferencia pendiente': 'Your transfer is pending confirmation.',
      'validacion pendiente': 'Your order is pending validation.',
      'no validada por cliente': 'Your order was not validated by the customer.',
      'in validation': 'Your order is in validation.',
      archivada: 'Your order was archived.',
      'intento de pago archivado': 'The payment attempt was archived.',
      'domiciliario solicitado': 'A courier was requested for your order.',
      'no confirmada': 'Your order is not confirmed yet.'
    },
    cargo_tracking: 'Real-time tracking',
    open_external: 'Open in new window',
    eta: 'Estimated arrival time',
    minutes: 'minutes',
    distance: 'Distance'
  }
}

/** Helper tipo tu `tl` */
const t = (key, esFallback, enFallback) => {
  const lk = langKey.value
  // 1) intenta texts (si tú lo tienes centralizado)
  const fromTexts =
    texts?.[lk]?.track?.[key] ??
    texts?.[lk]?.common?.[key] ??
    null

  if (fromTexts) return fromTexts

  // 2) fallback local
  const local = localTrackTexts?.[lk]?.[key]
  if (local) return local

  // 3) fallback por parámetros
  return lk === 'en' ? (enFallback ?? esFallback ?? key) : (esFallback ?? enFallback ?? key)
}

const firstHistory = computed(() => {
  return Array.isArray(history.value) && history.value.length > 0
    ? history.value[0]
    : null
})

const hasCargoTracking = computed(() => {
  return !!(
    firstHistory.value?.cargo_response_insert?.tracking_url
  )
})

const normalizeStatus = (s) => String(s ?? '').trim().toLowerCase()

// Título de página
const sitesStore = useSitesStore()
const siteName = computed(() => sitesStore?.location?.site?.site_name || '')
const pageTitle = computed(() => {
  const pageName = 'RASTREAR'
  if (siteName.value) {
    return `SM - ${siteName.value.toUpperCase()} | ${pageName}`
  }
  return `SM | ${pageName}`
})

const pageDescription = computed(() => {
  return 'Rastrea el estado de tu pedido en tiempo real. Ingresa el ID de tu pedido y conoce su ubicación y estado actual.'
})

useHead(() => ({
  title: pageTitle.value,
  meta: [
    { name: 'description', content: pageDescription.value },
    { name: 'robots', content: 'noindex, nofollow' },
    { property: 'og:title', content: pageTitle.value },
    { property: 'og:description', content: pageDescription.value },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: pageTitle.value },
    { name: 'twitter:description', content: pageDescription.value }
  ]
}))

/**
 * ✅ Traducción de estados:
 * - En ES: muestra tal cual (pero normalizado para buscar mensajes)
 * - En EN: si existe traducción, la muestra; si no, devuelve lo de DB (en español)
 */
const statusTranslationsEN = {
  'no confirmada': 'Unconfirmed',
  'cancelada': 'Cancelled',
  'in validation': 'In validation',
  'no validada por cliente': 'Not validated by customer',
  'intento de pago archivado': 'Payment attempt archived',
  'validacion pendiente': 'Validation pending',
  'enviada': 'Shipped',
  'generada': 'Created',
  'pago pendiente': 'Payment pending',
  'domiciliario solicitado': 'Courier requested',
  'transferencia pendiente': 'Transfer pending',
  'archivada': 'Archived',
  'en preparacion': 'In preparation'
}

const translateStatus = (statusFromDB) => {
  const original = String(statusFromDB ?? '').trim()
  const norm = normalizeStatus(original)

  // ES: deja el texto original (como viene DB)
  if (langKey.value !== 'en') return original || ''

  // EN: traduce si hay match; si no, devuelve original (en español)
  return statusTranslationsEN[norm] || original
}

const getCurrentStatusMessage = (statusFromDB) => {
  const original = String(statusFromDB ?? '').trim()
  const norm = normalizeStatus(original)

  // Mensaje por estado (fallback si no existe: muestra "Estado actual: X" traducido)
  const lk = langKey.value
  const msg = localTrackTexts?.[lk]?.msg?.[norm]

  if (msg) return msg

  // si no lo tenemos, mostramos lo que viene de DB en español (pedido por ti),
  // y el prefijo se traduce según idioma.
  const prefix = lk === 'en' ? 'Current status:' : 'Estado actual:'
  return `${prefix} ${lk === 'en' ? (translateStatus(original) || original) : (original || '')}`
}

const openTrackingInNewWindow = () => {
  if (firstHistory.value?.cargo_response_insert?.tracking_url) {
    window.open(firstHistory.value.cargo_response_insert.tracking_url, '_blank', 'noopener,noreferrer')
  }
}

const setOrderIdInUrl = async (id) => {
  const nextQuery = { ...route.query, order_id: id }
  await router.replace({ query: nextQuery })
}

const getStatusHistory = async () => {
  const id = (orderId.value || '').trim()

  if (!id) {
    error.value = t('err_empty', 'Por favor ingresa el ID de tu pedido.', 'Please enter your order ID.')
    currentStatus.value = null
    history.value = []
    return
  }

  loading.value = true
  error.value = null
  currentStatus.value = null
  history.value = []

  try {
    await setOrderIdInUrl(id)

    const result = await $fetch(`${URI}/history-my-orden/${id}`)

    // timeout estético
    await new Promise((resolve) => setTimeout(resolve, 450))

    history.value = Array.isArray(result) ? result : []
    currentStatus.value = history.value[0]?.current_status || null

    if (!currentStatus.value) {
      error.value = t('err_no_current', 'No encontramos el estado actual de tu pedido.', "We couldn't find the current status of your order.")
    }
  } catch (err) {
    console.error('Error al obtener el historial de estado:', err)
    error.value = t('err_not_found', 'No pudimos encontrar tu pedido. Verifica el ID e inténtalo de nuevo.', "We couldn't find your order. Check the ID and try again.")
    history.value = []
    currentStatus.value = null
  } finally {
    loading.value = false
  }
}

const lastLoadedId = ref('')

// ✅ si cambia el query manualmente, también carga
watch(
  () => route.query.order_id || route.query.id,
  (newVal) => {
    const id = newVal ? String(newVal).trim() : ''
    if (!id) return
    if (id === lastLoadedId.value) return
    orderId.value = id
    lastLoadedId.value = id
    getStatusHistory()
  },
  { immediate: false }
)

// ✅ si el usuario escribe, limpiamos el error suavemente
watch(
  () => orderId.value,
  () => {
    if (error.value) error.value = null
  }
)

onMounted(() => {
  const idFromUrl = route.query.order_id || route.query.id
  if (idFromUrl) {
    const id = String(idFromUrl).trim()
    orderId.value = id
    lastLoadedId.value = id
    getStatusHistory()
  }
})
</script>

<style scoped>
/* TUS MISMOS ESTILOS - NO ES NECESARIO CAMBIARLOS */
:root {
  --primary-color: #d60000;
}

.track-page {
  min-height: 80vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem 3rem;
  background: radial-gradient(circle at top, #f8fafc, #f1f5f9);
}

@media (max-width: 640px) {
  .track-page {
    padding: 0;
  }
}

.track-main {
  width: 100%;
  max-width: 720px;
  margin: auto;
}

.track-main--with-cargo {
  max-width: 1200px;
}

@media (max-width: 640px) {
  .track-main {
    max-width: 100%;
    margin: 0;
  }

  .track-main--with-cargo {
    max-width: 100%;
  }
}

.animate-entry {
  animation: cardEnter 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  opacity: 0;
  transform: translateY(30px);
}

@keyframes cardEnter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.track-card {
  background-color: #ffffff;
  border-radius: 1.5rem;
  padding: 2rem 1.75rem 2.5rem;
  box-shadow: 0 22px 45px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

@media (max-width: 640px) {
  .track-card {
    border-radius: 0;
    padding: 1.5rem 1rem 2rem;
    box-shadow: none;
    border-left: none;
    border-right: none;
  }
}

.track-card:hover {
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.12);
}

.track-card__header {
  text-align: center;
  margin-bottom: 2rem;
}

.track-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--primary-color);
}

.track-subtitle {
  margin-top: 0.5rem;
  margin-bottom: 0;
  font-size: 0.95rem;
  color: #6b7280;
}

.search-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: nowrap;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
}

.search-input-icon {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.1rem;
  color: #9ca3af;
  transition: color 0.3s ease;
}

.search-input-wrapper:focus-within .search-input-icon {
  color: var(--primary-color);
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  font-size: 0.95rem;
  color: #111827;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(214, 0, 0, 0.08);
  background-color: #fff;
  transform: scale(1.01);
}

.search-button {
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: var(--primary-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  overflow: hidden;
}

.search-button:disabled {
  opacity: 0.8;
  cursor: wait;
  transform: scale(0.95);
}

.search-button:not(:disabled):hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(214, 0, 0, 0.3);
}

.search-button:not(:disabled):active {
  transform: translateY(0);
}

.search-icon {
  font-size: 1.4rem;
  color: #ffffff;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.track-messages {
  min-height: 2.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.alert {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  border-radius: 999px;
  padding: 0.5rem 0.9rem;
}

.alert__icon {
  font-size: 1.1rem;
}

.alert--info {
  background-color: #e0f2fe;
  color: #0369a1;
}

.alert--error {
  background-color: #fee2e2;
  color: #b91c1c;
}

.current-status {
  margin-top: 1.2rem;
  padding: 1.5rem 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #fff1f2, #fff7ed);
  border: 1px solid rgba(252, 165, 165, 0.4);
  text-align: center;
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.5);
}

.current-status__title {
  margin: 0 0 0.4rem;
  font-size: 1.4rem;
  font-weight: 700;
  color: #b91c1c;
}

.current-status__text {
  margin: 0;
  font-size: 0.95rem;
  color: #4b5563;
}

.current-status__badge {
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  background-color: #dcfce7;
  color: #15803d;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid #86efac;
}

.pulse-badge {
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(74, 222, 128, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
  }
}

.history {
  margin-top: 2rem;
}

.history__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: #111827;
}

.status-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

.status-timeline__item {
  display: flex;
  gap: 0.75rem;
  position: relative;
  padding-bottom: 1.5rem;
}

.status-timeline__item:last-child {
  padding-bottom: 0;
}

.status-timeline__item::before {
  content: "";
  position: absolute;
  left: 0.4rem;
  top: 0.7rem;
  width: 2px;
  height: calc(100% - 0.7rem);
  background: linear-gradient(to bottom, #fca5a5, rgba(254, 202, 202, 0.2));
  opacity: 0.8;
  z-index: 0;
}

.status-timeline__item:last-child::before {
  display: none;
}

.status-timeline__marker {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  background: #ef4444;
  margin-top: 0.3rem;
  box-shadow: 0 0 0 4px rgba(254, 226, 226, 1);
  flex-shrink: 0;
  z-index: 1;
  position: relative;
  transition: transform 0.3s ease;
}

.status-timeline__item:hover .status-timeline__marker {
  transform: scale(1.2);
  background: #dc2626;
}

.status-timeline__content {
  flex: 1;
}

.status-timeline__status {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  text-transform: capitalize;
  color: #111827;
}

.status-timeline__timestamp {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: #6b7280;
}

.empty-state {
  margin-top: 1.5rem;
  padding: 2rem 1rem;
  border-radius: 1rem;
  background-color: #f8fafc;
  border: 2px dashed #e2e8f0;
  text-align: center;
}

.empty-state__icon {
  font-size: 2.5rem;
  color: #cbd5e1;
  display: inline-block;
}

.float-animation {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.empty-state__text {
  margin-top: 0.8rem;
  font-size: 0.9rem;
  color: #64748b;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.rotate-enter-active,
.rotate-leave-active {
  transition: all 0.3s ease;
}
.rotate-enter-from,
.rotate-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Estilos para rastreo Rappi Cargo */
.cargo-tracking {
  margin-top: 2rem;
  padding: 0;
  border-radius: 1rem;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  overflow: hidden;
}

.cargo-tracking__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cargo-tracking__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0369a1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cargo-tracking__icon {
  font-size: 1.3rem;
  color: #0284c7;
}

.cargo-tracking__external-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #0284c7;
  background-color: #ffffff;
  color: #0284c7;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.cargo-tracking__external-btn:hover {
  background-color: #0284c7;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(2, 132, 199, 0.3);
}

.cargo-tracking__external-btn:active {
  transform: translateY(0);
}

.cargo-tracking__iframe-wrapper {
  position: relative;
  width: 100%;
  height: 500px;
  overflow: hidden;
  background-color: #ffffff;
}

.cargo-tracking__iframe {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0;
}

.cargo-tracking__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.cargo-tracking__eta,
.cargo-tracking__distance {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #475569;
}

.cargo-tracking__eta strong,
.cargo-tracking__distance strong {
  color: #0369a1;
  font-weight: 700;
}

.eta-interval {
  color: #64748b;
  font-size: 0.85rem;
  margin-left: 0.25rem;
}

@media (max-width: 640px) {
  .cargo-tracking {
    border-radius: 0;
    border-left: none;
    border-right: none;
    margin-top: 0;
  }

  .cargo-tracking__header {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
  }

  .cargo-tracking__external-btn {
    width: 100%;
    justify-content: center;
  }

  .cargo-tracking__iframe-wrapper {
    height: 400px;
  }

  .cargo-tracking__footer {
    padding: 1rem;
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
    