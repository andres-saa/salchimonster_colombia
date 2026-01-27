<template>
  <div>
    <SiteDialog />
    <SiteDialogRecoger />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <ToastContainer />

    <a
      v-if="showWhatsappFloat"
      :href="whatsappFloatUrl"
      target="_blank"
      rel="noopener"
      class="wsp-float"
      aria-label="Abrir WhatsApp"
      title="¿Tienes dudas? Escríbenos"
    >
      <Icon size="xx-large" name="mdi:whatsapp" class="wsp-icon" />
    </a>

    <CartBar />
    <MenuSearchModal />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, nextTick, computed } from '#imports'
import { useRoute, useRouter, useRequestURL } from '#imports'
import { useSitesStore, useUserStore, usecartStore } from '#imports'
import { URI } from './service/conection'
// import { preloadAllSitesMenus } from './composables/useMenuPreloader' // Desactivado: ya no se hace prerender de todas las sedes

const siteStore = useSitesStore()
const userStore = useUserStore()
const cartStore = usecartStore()
const route = useRoute()
const router = useRouter()

// ✅ URL SSR-safe (no se pierde en refresh)
const requestURL = useRequestURL()

// 🔒 Control de ejecución
let running = false
let lastKey = ''

// 🔄 Sync
let syncInterval = null
let lastSavedSnapshot = ''
let isRestoring = true
let isSyncing = false
let syncDebounce = null

let stopRouteWatch = null
let stopQuickWatchers = []

// ------------------------------------------------------------------------
// 0. UTILIDAD: GENERAR UUID V4 (Cliente)
// ------------------------------------------------------------------------
function getUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ------------------------------------------------------------------------
// 1. LÓGICA DE WHATSAPP (REACTIVO + NO SE PIERDE EN REFRESH)
// ------------------------------------------------------------------------
function cleanPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

const whatsappPhone = computed(() => cleanPhone(siteStore.location?.site?.site_phone))

const showWhatsappFloat = computed(() => {
  if (userStore.user?.iframe) return false
  return !!whatsappPhone.value
})

// ✅ URL actual SSR-safe y reactivo a navegación interna
const currentPageUrl = computed(() => `${requestURL.origin}${route.fullPath}`)

const whatsappFloatUrl = computed(() => {
  const phone = whatsappPhone.value
  if (!phone) return '#'

  const text = `Hola 😊 Tengo una duda${currentPageUrl.value ? `\n\nLink: ${currentPageUrl.value}` : ''}`
  const params = new URLSearchParams({ phone, text })
  return `https://api.whatsapp.com/send?${params.toString()}`
})

// ------------------------------------------------------------------------
// 2. PAYLOAD (FUENTE ÚNICA DE VERDAD PARA SYNC)
// ------------------------------------------------------------------------
function generatePayload() {
  return {
    site_location: siteStore.location.site,
    user: userStore.user,
    location_meta: {
      city: siteStore.location.city,
      mode: siteStore.location.mode,
      formatted_address: siteStore.location.formatted_address,
      place_id: siteStore.location.place_id,
      lat: siteStore.location.lat,
      lng: siteStore.location.lng,
      address_details: siteStore.location.address_details,
      neigborhood: siteStore.location.neigborhood,
      delivery_price: siteStore.current_delivery
    },
    cart: cartStore.cart,
    discount: cartStore.coupon || null,
    coupon_ui: cartStore.coupon_ui || null
  }
}

// ------------------------------------------------------------------------
// 3. SYNC AHORA (PUT INMEDIATO) + SCHEDULE (DEBOUNCE)
// ------------------------------------------------------------------------
async function syncNow() {
  if (!process.client) return
  if (isRestoring || running || isSyncing) return

  let currentHash = siteStore.session_hash

  // 🆕 si no hay hash aún, lo generamos y lo guardamos en store
  if (!currentHash) {
    currentHash = getUUID()
    siteStore.setSessionHash?.(currentHash)
    // console.log('✨ Nuevo Hash Generado (Local):', currentHash)
  }

  const currentData = generatePayload()
  const currentSnapshot = JSON.stringify(currentData)

  // sin cambios
  if (currentSnapshot === lastSavedSnapshot) return

  isSyncing = true
  try {
    const res = await fetch(`${URI}/data/${currentHash}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: currentSnapshot
    })

    if (res.ok) {
      lastSavedSnapshot = currentSnapshot
      // console.log('✅ Sync PUT exitoso:', currentHash)
    } else {
      console.warn('⚠️ Error en Sync PUT:', res.status)
    }
  } catch (e) {
    console.error('❌ Error de red Sync PUT:', e)
  } finally {
    isSyncing = false
  }
}

function scheduleSync(ms = 150) {
  clearTimeout(syncDebounce)
  syncDebounce = setTimeout(() => {
    syncNow()
  }, ms)
}

// Mantén tu interval como “backup”
function startHashSyncer() {
  if (syncInterval) clearInterval(syncInterval)

  syncInterval = setInterval(async () => {
    if (isRestoring || running || isSyncing) return
    await syncNow()
  }, 3000)
}

// Guardado al salir (para que no se pierda dirección si recargas muy rápido)
function syncOnUnload() {
  try {
    const currentHash = siteStore.session_hash
    if (!currentHash) return

    const payload = JSON.stringify(generatePayload())

    // keepalive suele funcionar bien en beforeunload
    fetch(`${URI}/data/${currentHash}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    })
  } catch (e) {}
}

// ------------------------------------------------------------------------
// 4. RESTAURACIÓN Y LIMPIEZA DE QUERY
// ------------------------------------------------------------------------
function cleanQueryParams({ removeHash = false, removeCredentials = false, removeIframe = false } = {}) {
  const q = { ...route.query }
  let changed = false

  if (removeHash && q.hash !== undefined) {
    delete q.hash
    changed = true
  }

  if (removeCredentials) {
    if (q.inserted_by !== undefined) {
      delete q.inserted_by
      changed = true
    }
    if (q.token !== undefined) {
      delete q.token
      changed = true
    }
  }

  if (removeIframe && q.iframe !== undefined) {
    delete q.iframe
    changed = true
  }

  if (changed) router.replace({ query: q })
}

function restoreLocationFromMeta(meta) {
  if (!meta) return

  if (meta.city) siteStore.location.city = meta.city
  if (meta.mode) siteStore.location.mode = meta.mode

  if (meta.mode === 'google') {
    siteStore.location.formatted_address = meta.formatted_address || ''
    siteStore.location.place_id = meta.place_id || ''
    siteStore.location.lat = meta.lat ?? null
    siteStore.location.lng = meta.lng ?? null
    siteStore.location.address_details = meta.address_details ?? null

    const price = meta.delivery_price ?? meta.price ?? 0
    siteStore.location.neigborhood = {
      name: '',
      delivery_price: price,
      neighborhood_id: null,
      id: null,
      site_id: null
    }
    siteStore.current_delivery = price
    return
  }

  if (meta.neigborhood) {
    const nb = meta.neigborhood
    const price = nb.delivery_price ?? meta.delivery_price ?? 0

    siteStore.location.neigborhood = {
      name: nb.name || '',
      delivery_price: price,
      neighborhood_id: nb.neighborhood_id ?? nb.id ?? null,
      id: nb.id ?? nb.neighborhood_id ?? null,
      site_id: nb.site_id ?? null
    }
    siteStore.current_delivery = price
  } else {
    siteStore.location.neigborhood = {
      name: '',
      delivery_price: 0,
      neighborhood_id: null,
      id: null,
      site_id: null
    }
    siteStore.current_delivery = 0
  }
}

function applyRestoredData(restoredData) {
  if (!restoredData) return

  // Site
  if (restoredData.site_location) {
    const prevId = siteStore.location.site?.site_id ?? siteStore.location.site?.id
    const newId = restoredData.site_location?.site_id ?? restoredData.site_location?.id
    siteStore.location.site = restoredData.site_location
    if (prevId !== newId) siteStore.initStatusWatcher()
  }

  // User
  if (restoredData.user) {
    const currentIframeState = userStore.user?.iframe
    userStore.user = {
      ...userStore.user,
      ...restoredData.user,
      iframe: currentIframeState !== undefined ? currentIframeState : restoredData.user.iframe
    }
  }

  // Meta Location
  restoreLocationFromMeta(restoredData?.location_meta)

  // Cart
  if (restoredData.cart) {
    const cartItems = Array.isArray(restoredData.cart) ? restoredData.cart : restoredData.cart.items || []
    if (cartItems.length > 0) {
      cartStore.cart = Array.isArray(restoredData.cart) ? restoredData.cart : restoredData.cart
    }
  }

  // Coupons
  if (restoredData.discount) cartStore.applyCoupon?.(restoredData.discount)
  if (restoredData.coupon_ui && cartStore.setCouponUi) cartStore.setCouponUi(restoredData.coupon_ui)

  lastSavedSnapshot = JSON.stringify(generatePayload())
}

// ------------------------------------------------------------------------
// 5. HIDRATACIÓN DEL SITE (SLUG)
// ------------------------------------------------------------------------
async function fetchSiteBySlug(siteSlug) {
  if (!siteSlug) return null

  try {
    const response = await fetch(`${URI}/sites/subdomain/${siteSlug}`)
    if (!response.ok) return null

    const data = await response.json()
    const siteData = data?.[0] || data
    if (!siteData) return null

    const prevId = siteStore.location.site?.site_id ?? siteStore.location.site?.id
    const newId = siteData?.site_id ?? siteData?.id

    siteStore.location.site = {
      ...(siteStore.location.site || {}),
      ...siteData
    }

    if (prevId !== newId) siteStore.initStatusWatcher()
    return siteData
  } catch (err) {
    console.error('Error fetchSiteBySlug:', err)
    return null
  }
}

// ------------------------------------------------------------------------
// 6. BOOTSTRAP PRINCIPAL (CORREGIDO: NO RESTAURA EN NAVEGACIÓN INTERNA)
// ------------------------------------------------------------------------
async function bootstrapFromUrl(reason = 'nav') {
  if (!process.client) return
  if (running) return

  running = true
  isRestoring = true

  try {
    const key = JSON.stringify({
      path: route.fullPath,
      hash: route.query.hash,
      stored_hash: siteStore.session_hash,
      inserted_by: route.query.inserted_by,
      token: route.query.token,
      iframe: route.query.iframe,
      reason
    })

    if (key === lastKey) {
      isRestoring = false
      return
    }
    lastKey = key

    // 0) Storage Local (Session)
    const storedSession = localStorage.getItem('session_external_data')
    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession)
        userStore.user = { ...userStore.user, ...parsedSession }
      } catch (e) {
        console.error(e)
      }
    }

    const qInsertedBy = route.query.inserted_by
    const qToken = route.query.token
    const qiframe = route.query.iframe

    if (qInsertedBy && qToken) {
      const sessionData = { inserted_by: qInsertedBy, token: qToken, iframe: qiframe === '1' }
      userStore.user = { ...userStore.user, ...sessionData }
      localStorage.setItem('session_external_data', JSON.stringify(sessionData))
    }

    // Obtener slug de la URL (ya no usamos subdominios)
    const { useSedeFromRoute } = await import('./composables/useSedeFromRoute')
    const sedeFromRoute = useSedeFromRoute()
    const siteSlug = sedeFromRoute.value
    
    let siteLoadedFromHash = false

    // ✅ Prioridad: Si hay datos en el store (viene del dispatcher), usarlos directamente
    // Esto elimina la dependencia del hash para navegación interna
    const hasStoreData = siteStore.location?.order_type && siteStore.location?.site?.site_id
    
    if (hasStoreData && reason !== 'popstate') {
      // Los datos ya están en el store, solo hidratar sede desde la URL si es necesario
      if (siteSlug) {
        await fetchSiteBySlug(siteSlug)
      }
      siteLoadedFromHash = true // Marcar como cargado para evitar sobrescritura
    }

    // ✅ Solo restaurar desde backend cuando tiene sentido:
    // - primer load / refresh (mounted) Y no hay datos en store
    // - back/forward (popstate)
    // - viene un hash explícito en la URL (?hash=...) - para compatibilidad con links compartidos
    const urlHash = route.query.hash
    const shouldRestoreFromBackend = !hasStoreData && (reason === 'mounted' || reason === 'popstate' || !!urlHash)

    const storedHash = siteStore.session_hash
    const targetHash = urlHash || storedHash
    const isUrlHash = !!urlHash

    // 1) GET desde backend SOLO cuando toca (evita pisar carrito en navegación interna)
    // El hash solo se usa para links compartidos, no como fuente principal de datos
    if (shouldRestoreFromBackend && targetHash) {
      try {
        const response = await fetch(`${URI}/data/${targetHash}`)
        if (response.ok) {
          const jsonResponse = await response.json()
          const restoredData = jsonResponse?.data || {}

          applyRestoredData(restoredData)

          if (isUrlHash) siteStore.setSessionHash?.(urlHash)
          siteLoadedFromHash = true

          // Hidratar sede desde la URL si hay slug
          if (siteSlug) {
            await fetchSiteBySlug(siteSlug)
          }

          // limpia hash SOLO si venía en URL (link compartido)
          if (isUrlHash) {
            cleanQueryParams({
              removeHash: true,
              removeCredentials: !!(qInsertedBy && qToken),
              removeIframe: qiframe !== undefined
            })
          }
        } else {
          console.warn('Hash inválido o expirado, limpiando store.')
          siteStore.clearSessionHash?.()
        }
      } catch (err) {
        console.error('❌ Error restaurando hash:', err)
      }
    }

    // 2) Fallback / Navegación interna: NO pisar estado, solo hidratar sede desde URL y limpiar credenciales si aplica
    if (!siteLoadedFromHash) {
      // Hidratar sede desde la URL si hay slug
      if (siteSlug) {
        await fetchSiteBySlug(siteSlug)
      }

      const needsCredClean = !!(qInsertedBy && qToken)
      const needsIframeClean = qiframe !== undefined

      if (needsCredClean || needsIframeClean) {
        cleanQueryParams({
          removeCredentials: needsCredClean,
          removeIframe: needsIframeClean
        })
      }
    }

    // 3) Snapshot base
    lastSavedSnapshot = JSON.stringify(generatePayload())
  } finally {
    await nextTick()
    running = false
    isRestoring = false
  }
}

function onPopState() {
  bootstrapFromUrl('popstate')
}

// ------------------------------------------------------------------------
// 7. QUICK WATCHERS PARA SYNC INMEDIATO (CARRITO/DIRECCIÓN/CUPÓN)
// ------------------------------------------------------------------------
function setupQuickSyncWatchers() {
  // Limpia watchers previos
  stopQuickWatchers.forEach((fn) => fn && fn())
  stopQuickWatchers = []

  // Carrito (deep)
  stopQuickWatchers.push(
    watch(
      () => cartStore.cart,
      () => scheduleSync(120),
      { deep: true, flush: 'post' }
    )
  )

  // Cupón / UI cupón / delivery
  stopQuickWatchers.push(
    watch(
      () => [cartStore.coupon, cartStore.coupon_ui, siteStore.current_delivery],
      () => scheduleSync(120),
      { deep: true, flush: 'post' }
    )
  )

  // Dirección (google/manual)
  stopQuickWatchers.push(
    watch(
      () => [
        siteStore.location.mode,
        siteStore.location.formatted_address,
        siteStore.location.place_id,
        siteStore.location.lat,
        siteStore.location.lng,
        siteStore.location.neigborhood?.id,
        siteStore.location.neigborhood?.neighborhood_id,
        siteStore.location.neigborhood?.delivery_price
      ],
      () => scheduleSync(120),
      { flush: 'post' }
    )
  )
}

// ------------------------------------------------------------------------
// 8. LIFECYCLE
// ------------------------------------------------------------------------
onMounted(() => {
  bootstrapFromUrl('mounted')
  startHashSyncer()
  setupQuickSyncWatchers()

  window.addEventListener('popstate', onPopState)
  window.addEventListener('beforeunload', syncOnUnload)

  stopRouteWatch = watch(
    () => route.fullPath,
    () => bootstrapFromUrl('route-watch'),
    { flush: 'post' }
  )

  // Inicializar prerender de menús para todas las sedes en background
  // Desactivado: ya no se hace prerender de todas las sedes
  // if (process.client) {
  //   preloadAllSitesMenus().catch(err => 
  //     console.error('[App] Error inicializando prerender de menús:', err)
  //   )
  // }
})

onBeforeUnmount(() => {
  if (syncInterval) clearInterval(syncInterval)
  clearTimeout(syncDebounce)
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('beforeunload', syncOnUnload)
  if (stopRouteWatch) stopRouteWatch()
  stopQuickWatchers.forEach((fn) => fn && fn())
})
</script>

<style scoped>
.wsp-float {
  position: fixed;
  right: 16px;
  bottom: 80px;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: #25d366;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
  z-index: 9999;
  transition: transform 0.12s ease, opacity 0.2s ease;
}

.wsp-float:hover {
  transform: scale(1.05);
}

.wsp-float:active {
  transform: scale(0.98);
}

.wsp-icon :deep(svg) {
  width: 40px;
  height: 28px;
  display: block;
}
</style>
