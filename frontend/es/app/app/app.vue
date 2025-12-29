<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <ToastContainer />

    <CartBar />
    <MenuSearchModal />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, nextTick } from '#imports'
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
let lastSavedSnapshot = '' // Para comparar cambios
let isRestoring = true // 🛡️ Bloqueo inicial para no guardar datos vacíos sobre el hash

// ------------------------------------------------------------------------
// 1. LÓGICA DE SINCRONIZACIÓN (PUT)
// ------------------------------------------------------------------------

/**
 * Genera el objeto JSON exacto que espera el backend
 */
function generatePayload() {
  return {
    site_location: siteStore.location.site,
    user: userStore.user,
    // Construimos location_meta basándonos en lo que 'restoreLocationFromMeta' espera leer
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
    cart: cartStore.cart, // Asumiendo que es un array o objeto serializable
    discount: cartStore.coupon || null, // Ajusta según tu store de carrito
    coupon_ui: cartStore.coupon_ui || null
  }
}

/**
 * Revisa cada 3 segundos si hay cambios y envía PUT
 */
function startHashSyncer() {
  // Limpiamos intervalo previo si existe
  if (syncInterval) clearInterval(syncInterval)

  syncInterval = setInterval(async () => {
    // 1. Si no hay hash en el store, no hay nada que actualizar en el servidor
    const currentHash = siteStore.session_hash
    if (!currentHash) return

    // 2. Si todavía estamos restaurando datos (bootstrap), NO guardar para evitar sobrescribir
    if (isRestoring || running) return

    // 3. Generar "Snapshot" actual
    const currentData = generatePayload()
    const currentSnapshot = JSON.stringify(currentData)

    // 4. Comparar con el último guardado. Si son iguales, no hacer nada.
    if (currentSnapshot === lastSavedSnapshot) return

    // 5. Detectamos cambio -> ENVIAR PUT
    try {
      // console.log('🔄 Detectados cambios locales, sincronizando hash...', currentHash)
      
      const res = await fetch(`${URI}/data/${currentHash}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: currentSnapshot
      })

      if (res.ok) {
        // Actualizamos la referencia del último snapshot guardado
        lastSavedSnapshot = currentSnapshot
      } else {
        console.warn('Error sincronizando hash:', res.status)
      }
    } catch (e) {
      console.error('Error de red al sincronizar hash:', e)
    }

  }, 3000) // ⏱️ Cada 3 segundos
}

// ------------------------------------------------------------------------
// 2. LÓGICA DE RESTAURACIÓN Y CARGA (GET)
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
    const currentIframeState = userStore.user.iframe
    userStore.user = {
      ...userStore.user,
      ...restoredData.user,
      iframe: (currentIframeState !== undefined) ? currentIframeState : restoredData.user.iframe,
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
  if (restoredData.discount) cartStore.applyCoupon(restoredData.discount)
  if (restoredData.coupon_ui && cartStore.setCouponUi) cartStore.setCouponUi(restoredData.coupon_ui)
  
  // 🔥 Importante: Actualizamos el snapshot inicial para que el watcher no crea que hubo un cambio 
  // inmediatamente después de cargar los datos del servidor.
  lastSavedSnapshot = JSON.stringify(generatePayload())
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
      site_id: nb.site_id ?? null,
    }
    siteStore.current_delivery = price
  } else {
    siteStore.location.neigborhood = { name: '', delivery_price: 0, neighborhood_id: null, id: null, site_id: null }
    siteStore.current_delivery = 0
  }
}

function getCurrentSubdomain() {
  const sede = useSedeFromSubdomain()
  return typeof sede === 'string' ? sede : sede?.value
}

async function bootstrapFromUrl(reason = 'nav') {
  if (running) return
  running = true
  isRestoring = true // 🔴 Iniciando carga, bloquear sync

  try {
    const key = JSON.stringify({
      path: route.fullPath,
      hash: route.query.hash,
      stored_hash: siteStore.session_hash,
      inserted_by: route.query.inserted_by,
      token: route.query.token,
      iframe: route.query.iframe,
      reason,
    })
    
    if (key === lastKey) {
      isRestoring = false // Si salimos por cache key, habilitar sync
      return
    }
    lastKey = key

    let siteLoaded = false

    // 0) Storage Local (Session)
    const storedSession = localStorage.getItem('session_external_data')
    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession)
        userStore.user = { ...userStore.user, ...parsedSession }
      } catch (e) { console.error(e) }
    }

    const qInsertedBy = route.query.inserted_by
    const qToken = route.query.token
    const qiframe = route.query.iframe
    
    if (qInsertedBy && qToken) {
      const sessionData = { inserted_by: qInsertedBy, token: qToken, iframe: (qiframe === '1') }
      userStore.user = { ...userStore.user, ...sessionData }
      localStorage.setItem('session_external_data', JSON.stringify(sessionData))
    }

    // 1) Carga por HASH (URL o Store)
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
          
          if (isUrlHash) siteStore.setSessionHash(urlHash)
          siteLoaded = true

          if (isUrlHash) {
            cleanQueryParams({
              removeHash: true,
              removeCredentials: !!(qInsertedBy && qToken),
              removeIframe: qiframe !== undefined,
            })
          }
        } else {
          console.warn('Hash inválido o expirado, limpiando store.')
          siteStore.clearSessionHash()
        }
      } catch (err) {
        console.error('❌ Error restaurando hash:', err)
      }
    }

    // 2) Fallback Subdominio
    if (!siteLoaded) {
      try {
        const currentSede = getCurrentSubdomain()
        if (currentSede) {
          const response = await fetch(`${URI}/sites/subdomain/${currentSede}`)
          if (response.ok) {
            const data = await response.json()
            const siteData = data?.[0] || data
            if (siteData) {
              const prevId = siteStore.location.site?.site_id ?? siteStore.location.site?.id
              const newId = siteData?.site_id ?? siteData?.id
              siteStore.location.site = siteData
              if (prevId !== newId) siteStore.initStatusWatcher()
            }
          }
        }
        
        // Si cargamos de cero (sin hash), definimos el snapshot actual como base
        lastSavedSnapshot = JSON.stringify(generatePayload())
        
        const needsCredClean = !!(qInsertedBy && qToken)
        const needsIframeClean = qiframe !== undefined
        if (needsCredClean || needsIframeClean) {
          cleanQueryParams({
            removeCredentials: needsCredClean,
            removeIframe: needsIframeClean,
          })
        }
      } catch (err) {
        console.error('Error cargando sede:', err)
      }
    }

  } finally {
    await nextTick()
    running = false
    isRestoring = false // 🟢 Carga terminada, el sync puede trabajar
  }
}

function onPopState() {
  bootstrapFromUrl('popstate')
}

onMounted(() => {
  bootstrapFromUrl('mounted')
  startHashSyncer() // ✅ Iniciamos el "cron" de 3 segundos
  window.addEventListener('popstate', onPopState)
})

watch(
  () => route.fullPath,
  () => bootstrapFromUrl('route-watch'),
  { flush: 'post' }
)

onBeforeUnmount(() => {
  if (syncInterval) clearInterval(syncInterval) // 🧹 Limpieza
  window.removeEventListener('popstate', onPopState)
})
</script>