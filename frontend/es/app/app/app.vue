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

// 🔒 lock para evitar dobles ejecuciones
let running = false
let lastKey = ''

// 💾 Variables para la sincronización de sesión
let syncInterval = null
let lastJsonState = '' // Para comparar si hubo cambios

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

    siteStore.location.neigborhood = {
      name: '',
      delivery_price: price,
      neighborhood_id: null,
      id: null,
      site_id: null,
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
      site_id: nb.site_id ?? null,
    }

    siteStore.current_delivery = price
  } else {
    siteStore.location.neigborhood = {
      name: '',
      delivery_price: 0,
      neighborhood_id: null,
      id: null,
      site_id: null,
    }
    siteStore.current_delivery = 0
  }
}

// ✅ helper: siempre leer subdominio “fresco”
function getCurrentSubdomain() {
  const sede = useSedeFromSubdomain()
  return typeof sede === 'string' ? sede : sede?.value
}

// 🔄 Construye el payload actual basado en los stores
function buildSessionPayload() {
  // Reconstruir location_meta
  let location_meta = {}
  
  if (siteStore.location.mode === 'google') {
    location_meta = {
      mode: 'google',
      city: siteStore.location.city,
      formatted_address: siteStore.location.formatted_address,
      place_id: siteStore.location.place_id,
      lat: siteStore.location.lat,
      lng: siteStore.location.lng,
      address_details: siteStore.location.address_details,
      delivery_price: siteStore.current_delivery
    }
  } else {
    // Modo barrio
    location_meta = {
      mode: 'neighborhood', // o el modo por defecto
      city: siteStore.location.city,
      neigborhood: siteStore.location.neigborhood,
      delivery_price: siteStore.current_delivery
    }
  }

  return {
    site_location: siteStore.location.site,
    user: userStore.user,
    cart: cartStore.cart, // Asumiendo que cartStore.cart tiene items o es el array
    discount: cartStore.discount || null,
    coupon_ui: cartStore.coupon_ui || null, // Asegurar nombres correctos del store
    location_meta: location_meta
  }
}

// 📡 Función que se ejecuta cada 5s
async function syncSession() {
  // Solo sincronizar si hay un hash activo en el store
  const hash = siteStore.session_hash
  
  // DEBUG: Ver si corre el intervalo
  console.log(`⏱️ Tick Sync... Hash actual: ${hash ? hash : 'NINGUNO'}`)

  if (!hash) return

  try {
    const currentData = buildSessionPayload()
    const currentJson = JSON.stringify(currentData)

    // DEBUG: Comparación
    if (currentJson === lastJsonState) {
        console.log('💤 Sync ignorado: El estado es IDÉNTICO al anterior.')
        return
    }
    
    // DEBUG: Ver diferencia si falla
    console.log('⚡ CAMBIO DETECTADO. Preparando envío...')
    console.log('ANTES:', lastJsonState)
    console.log('AHORA:', currentJson)

    // 🚨 ALERT SOLO CUANDO HAY CAMBIO REAL
    alert(`🚀 Sincronizando cambios al servidor...\nHash: ${hash}`)

    // Actualizamos el estado local antes de enviar para evitar loops si la red es lenta
    lastJsonState = currentJson

    const response = await fetch(`${URI}/data/${hash}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: currentJson
    })

    if (!response.ok) {
      alert(`❌ Error al guardar en servidor: ${response.statusText}`)
      console.warn('Error sincronizando sesión:', response.statusText)
    } else {
        console.log('✅ Guardado exitoso en servidor')
    }
  } catch (error) {
    alert(`❌ Excepción en Sync: ${error.message}`)
    console.error('Error en syncSession:', error)
  }
}

async function bootstrapFromUrl(reason = 'nav') {
  if (running) {
      console.warn(`Bootstrap saltado (ya estaba corriendo). Razón: ${reason}`)
      return
  }
  running = true

  try {
    const qInsertedBy = route.query.inserted_by
    const qToken = route.query.token
    const qiframe = route.query.iframe
    const isIframe = qiframe === '1'

    // ✅ hash: primero URL, si no hay -> store
    const hashFromQuery = route.query.hash
    const storedHash = siteStore.session_hash || ''
    const hashToUse = hashFromQuery || storedHash || ''
    
    // 🚨 DEBUG INICIAL
    // alert(`Bootstrap iniciado (${reason})\nHash URL: ${hashFromQuery}\nHash Store: ${storedHash}`)

    // ✅ persistir hash SOLO si vino por URL
    if (hashFromQuery) siteStore.setSessionHash(hashFromQuery)

    // clave para evitar repetir exactamente lo mismo
    const key = JSON.stringify({
      path: route.fullPath,
      hashToUse,
      inserted_by: qInsertedBy,
      token: qToken,
      iframe: qiframe,
      host: process.client ? window.location.host : '',
      reason,
    })
    if (key === lastKey) {
        console.log('🗝️ Bootstrap saltado: misma key que la anterior')
        return
    }
    lastKey = key

    // ======================================================
    // 0) RECUPERAR SESIÓN (F5 safe)
    // ======================================================
    if (process.client) {
      const storedSession = localStorage.getItem('session_external_data')
      if (storedSession) {
        try {
          const parsedSession = JSON.parse(storedSession)
          userStore.user = { ...userStore.user, ...parsedSession }
        } catch (e) {
          console.error('Error leyendo sesión local', e)
        }
      }
    }

    if (qInsertedBy && qToken) {
      const sessionData = { inserted_by: qInsertedBy, token: qToken, iframe: isIframe }
      userStore.user = { ...userStore.user, ...sessionData }
      if (process.client) {
        localStorage.setItem('session_external_data', JSON.stringify(sessionData))
      }
    }

    // ======================================================
    // 1) CARGA POR HASH (URL o STORE)
    // ======================================================
    let siteLoadedFromHash = false

    if (hashToUse) {
      alert(`🔎 Buscando datos para Hash: ${hashToUse}`) // DEBUG
      try {
        const response = await fetch(`${URI}/data/${hashToUse}`)
        if (response.ok) {
          const jsonResponse = await response.json()
          const restoredData = jsonResponse?.data || {}
          
          alert('✅ Datos recibidos del servidor. Restaurando estado...') // DEBUG

          // Guardamos el estado inicial tal cual vino del servidor para no disparar un PUT inmediato innecesario
          // (aunque si los stores formatean la data distinto, el primer sync la corregirá, lo cual es bueno)
          
          if (restoredData.site_location) {
            const prevId = siteStore.location.site?.site_id ?? siteStore.location.site?.id
            const newId = restoredData.site_location?.site_id ?? restoredData.site_location?.id
            siteStore.location.site = restoredData.site_location
            if (prevId !== newId) siteStore.initStatusWatcher()
            siteLoadedFromHash = true
          }

          if (restoredData.user) {
            const currentIframeState = userStore.user.iframe
            userStore.user = {
              ...userStore.user,
              ...restoredData.user,
              iframe: (currentIframeState !== undefined) ? currentIframeState : restoredData.user.iframe,
            }
          }

          restoreLocationFromMeta(restoredData?.location_meta)

          if (restoredData.cart) {
            const cartItems = Array.isArray(restoredData.cart)
              ? restoredData.cart
              : (restoredData.cart.items || [])

            if (cartItems.length > 0) {
              cartStore.cart = Array.isArray(restoredData.cart)
                ? restoredData.cart
                : restoredData.cart
            }
          }

          if (restoredData.discount) cartStore.applyCoupon(restoredData.discount)
          if (restoredData.coupon_ui && cartStore.setCouponUi) cartStore.setCouponUi(restoredData.coupon_ui)
          
          // DEBUG: Establecer lastJsonState para que no salte sync inmediato si es igual
          // lastJsonState = JSON.stringify(buildSessionPayload()); 

          // ✅ limpiar query SOLO si venía el hash en URL
          if (hashFromQuery || qInsertedBy || qToken || qiframe !== undefined) {
            cleanQueryParams({
              removeHash: !!hashFromQuery,
              removeCredentials: !!(qInsertedBy && qToken),
              removeIframe: qiframe !== undefined,
            })
          }
        } else {
          alert('❌ El hash existe pero el servidor devolvió error (404/500)') // DEBUG
          // si el hash guardado ya no sirve, lo limpiamos
          if (!hashFromQuery) siteStore.clearSessionHash()
        }
      } catch (err) {
        alert(`❌ Error restaurando hash: ${err.message}`)
        console.error('❌ Error restaurando hash:', err)
      }
    }

    // ======================================================
    // 2) CARGA NORMAL (Subdominio) si no se cargó por hash
    // ======================================================
    if (!siteLoadedFromHash) {
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
  }
}

function onPopState() {
  bootstrapFromUrl('popstate')
}

onMounted(() => {
  // Alert inicial
  alert('🏁 App Montada. Iniciando bootstrap...')
  bootstrapFromUrl('mounted')
  window.addEventListener('popstate', onPopState)

  // ⏱️ INICIO DEL INTERVALO DE 5 SEGUNDOS
  syncInterval = setInterval(() => {
    syncSession()
  }, 5000)
})

watch(
  () => route.fullPath,
  () => bootstrapFromUrl('route-watch'),
  { flush: 'post' }
)

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
  
  // 🧹 LIMPIEZA DEL INTERVALO
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
})
</script>