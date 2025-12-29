<template>
  <div>
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
import { useRoute, useRouter } from '#imports'
import { useSitesStore, useUserStore, usecartStore } from '#imports'
import { useSedeFromSubdomain } from '#imports'
import { URI } from './service/conection'

const siteStore = useSitesStore()
const userStore = useUserStore()
const cartStore = usecartStore()
const route = useRoute()
const router = useRouter()

// 🔒 Control de ejecución
let running = false
let lastKey = ''

// 🔄 Variables para la Sincronización (Sync)
let syncInterval = null
let lastSavedSnapshot = ''
let isRestoring = true

let stopRouteWatch = null

// ------------------------------------------------------------------------
// 1. LÓGICA DE WHATSAPP (con site_phone fresco por subdominio)
// ------------------------------------------------------------------------

function cleanPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

const whatsappPhone = computed(() => {
  return cleanPhone(siteStore.location?.site?.site_phone)
})

const showWhatsappFloat = computed(() => {
  // 1) Si estás en iframe y no quieres mostrarlo:
  if (userStore.user?.iframe) return false
  // 2) Solo mostrar si hay un teléfono válido
  return !!whatsappPhone.value
})

const whatsappFloatUrl = computed(() => {
  if (!whatsappPhone.value) return '#'

  const baseUrl = 'https://api.whatsapp.com/send'
  const phone = whatsappPhone.value

  const pageUrl = process.client ? window.location.href : ''
  const text = `Hola 😊 Tengo una duda con ${pageUrl ? `\n\nLink: ${pageUrl}` : ''}`

  const params = new URLSearchParams({ phone, text })
  return `${baseUrl}?${params.toString()}`
})

// ------------------------------------------------------------------------
// 2. LÓGICA DE SINCRONIZACIÓN (PUT)
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

function startHashSyncer() {
  if (syncInterval) clearInterval(syncInterval)

  syncInterval = setInterval(async () => {
    const currentHash = siteStore.session_hash
    if (!currentHash) return

    if (isRestoring || running) return

    const currentData = generatePayload()
    const currentSnapshot = JSON.stringify(currentData)

    if (currentSnapshot === lastSavedSnapshot) return

    try {
      const res = await fetch(`${URI}/data/${currentHash}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: currentSnapshot
      })

      if (res.ok) {
        lastSavedSnapshot = currentSnapshot
      } else {
        console.warn('Error sincronizando hash:', res.status)
      }
    } catch (e) {
      console.error('Error de red al sincronizar hash:', e)
    }
  }, 3000)
}

// ------------------------------------------------------------------------
// 3. RESTAURACIÓN Y CARGA (GET)
// ------------------------------------------------------------------------

function cleanQueryParams({ removeHash = false, removeCredentials = false, removeIframe = false } = {}) {
  const q = { ...route.query }
  let changed = false

  if (removeHash && q.hash !== undefined) { delete q.hash; changed = true }

  if (removeCredentials) {
    if (q.inserted_by !== undefined) { delete q.inserted_by; changed = true }
    if (q.token !== undefined) { delete q.token; changed = true }
  }

  if (removeIframe && q.iframe !== undefined) { delete q.iframe; changed = true }

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
    siteStore.location.neigborhood = { name: '', delivery_price: price, neighborhood_id: null, id: null, site_id: null }
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
    siteStore.location.neigborhood = { name: '', delivery_price: 0, neighborhood_id: null, id: null, site_id: null }
    siteStore.current_delivery = 0
  }
}

function applyRestoredData(restoredData) {
  if (!restoredData) return

  // Site (desde hash)
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
      iframe: (currentIframeState !== undefined) ? currentIframeState : restoredData.user.iframe
    }
  }

  // Meta Location
  restoreLocationFromMeta(restoredData?.location_meta)

  // Cart
  if (restoredData.cart) {
    const cartItems = Array.isArray(restoredData.cart) ? restoredData.cart : (restoredData.cart.items || [])
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
// 4. 👇 NUEVO: SIEMPRE HIDRATAR EL SITE POR SUBDOMINIO (para WhatsApp y demás)
// ------------------------------------------------------------------------

function getCurrentSubdomain() {
  // ⚠️ Esto debe correr en client (useSedeFromSubdomain a veces depende de window)
  const sede = useSedeFromSubdomain()
  return typeof sede === 'string' ? sede : sede?.value
}

async function fetchSiteBySubdomain(currentSede) {
  if (!currentSede) return null

  try {
    const response = await fetch(`${URI}/sites/subdomain/${currentSede}`)
    if (!response.ok) return null

    const data = await response.json()
    const siteData = data?.[0] || data
    if (!siteData) return null

    const prevId = siteStore.location.site?.site_id ?? siteStore.location.site?.id
    const newId = siteData?.site_id ?? siteData?.id

    // ✅ Importante: sobrescribe con la info real del endpoint (teléfono, wsp_link, address, etc.)
    siteStore.location.site = {
      ...(siteStore.location.site || {}),
      ...siteData
    }

    if (prevId !== newId) siteStore.initStatusWatcher()

    return siteData
  } catch (err) {
    console.error('Error fetchSiteBySubdomain:', err)
    return null
  }
}

// ------------------------------------------------------------------------
// 5. BOOTSTRAP PRINCIPAL
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
      const sessionData = { inserted_by: qInsertedBy, token: qToken, iframe: (qiframe === '1') }
      userStore.user = { ...userStore.user, ...sessionData }
      localStorage.setItem('session_external_data', JSON.stringify(sessionData))
    }

    // ✅ subdominio actual (para hidratar site sí o sí)
    const currentSede = getCurrentSubdomain()

    let siteLoadedFromHash = false

    // 1) Carga por HASH
    const urlHash = route.query.hash
    const storedHash = siteStore.session_hash
    const targetHash = urlHash || storedHash
    const isUrlHash = !!urlHash

    if (targetHash) {
      try {
        const response = await fetch(`${URI}/data/${targetHash}`)
        if (response.ok) {
          const jsonResponse = await response.json()
          const restoredData = jsonResponse?.data || {}

          applyRestoredData(restoredData)

          if (isUrlHash) siteStore.setSessionHash?.(urlHash)
          siteLoadedFromHash = true

          // ✅ siempre hidratar site por subdominio para arreglar WhatsApp y datos del site
          await fetchSiteBySubdomain(currentSede)

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

    // 2) Fallback: si no vino nada del hash, igual carga sede por subdominio
    if (!siteLoadedFromHash) {
      await fetchSiteBySubdomain(currentSede)

      lastSavedSnapshot = JSON.stringify(generatePayload())

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

onMounted(() => {
  bootstrapFromUrl('mounted')
  startHashSyncer()

  window.addEventListener('popstate', onPopState)

  // ✅ mover watch al client para evitar cosas raras SSR
  stopRouteWatch = watch(
    () => route.fullPath,
    () => bootstrapFromUrl('route-watch'),
    { flush: 'post' }
  )
})

onBeforeUnmount(() => {
  if (syncInterval) clearInterval(syncInterval)
  window.removeEventListener('popstate', onPopState)
  if (stopRouteWatch) stopRouteWatch()
})
</script>

<style scoped>
/* ✅ Botón flotante WhatsApp */
.wsp-float {
  position: fixed;
  right: 16px;
  bottom: 96px;
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
