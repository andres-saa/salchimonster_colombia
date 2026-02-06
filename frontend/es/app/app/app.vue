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
let isRestoring = true
let stopRouteWatch = null

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
// generatePayload eliminada - ya no se necesita sincronizar con backend

// ------------------------------------------------------------------------
// 3. SYNC AHORA (PUT INMEDIATO) + SCHEDULE (DEBOUNCE)
// ------------------------------------------------------------------------
// syncNow eliminada - ya no se necesita sincronizar con backend

// scheduleSync eliminada - ya no se necesita sincronizar con backend

// Mantén tu interval como “backup”
// startHashSyncer eliminada - ya no se necesita sincronizar con backend

// Guardado al salir (para que no se pierda dirección si recargas muy rápido)
// syncOnUnload eliminada - ya no se necesita sincronizar con backend

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

// ------------------------------------------------------------------------
// 3. FUNCIONES DE RESTAURACIÓN ELIMINADAS
// ------------------------------------------------------------------------
// Las funciones restoreLocationFromMeta y applyRestoredData han sido eliminadas
// porque ya no se restaura desde el backend. El store maneja la persistencia automáticamente.

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
// 6. BOOTSTRAP PRINCIPAL (SIMPLIFICADO - Solo usa store persistente)
// ------------------------------------------------------------------------
async function bootstrapFromUrl(reason = 'nav') {
  if (!process.client) return
  if (running) return

  running = true
  isRestoring = true

  try {
    const key = JSON.stringify({
      path: route.fullPath,
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

    // 0) Storage Local (Session) - Solo para credenciales externas
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

    // Hidratar sede desde la URL si hay slug
    if (siteSlug) {
      await fetchSiteBySlug(siteSlug)
    }

    // Limpiar credenciales de la URL si aplica
    const needsCredClean = !!(qInsertedBy && qToken)
    const needsIframeClean = qiframe !== undefined

    if (needsCredClean || needsIframeClean) {
      cleanQueryParams({
        removeCredentials: needsCredClean,
        removeIframe: needsIframeClean
      })
    }
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
// 7. WATCHERS ELIMINADOS
// ------------------------------------------------------------------------
// Los watchers de sincronización han sido eliminados porque el store
// maneja la persistencia automáticamente. No es necesario sincronizar con el backend.

// ------------------------------------------------------------------------
// 8. LIFECYCLE
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// 9. LISTENER POSTMESSAGE PARA IFRAME (Nuevo Pedido desde padre)
// ------------------------------------------------------------------------
function handlePostMessage(event) {
  // Validar origen por seguridad (ajusta según tu dominio)
  // const allowedOrigins = ['https://tu-dominio.com', 'https://otro-dominio.com']
  // if (!allowedOrigins.includes(event.origin)) return
  
  // Por ahora aceptamos cualquier origen, pero puedes restringirlo
  if (event.data && typeof event.data === 'object') {
    // Escuchar mensaje "new-order" desde el iframe padre
    if (event.data.type === 'new-order' || event.data.action === 'new-order') {
      console.log('[App] Recibida señal de nuevo pedido desde iframe padre')
      
      // Limpiar el carrito (misma lógica que goToNewOrder)
      cartStore.cart = []
      cartStore.applied_coupon = null
      cartStore.coupon_ui = { enabled: false, draft_code: '' }
      cartStore.setAddressDetails({}) // Esto también limpia is_rappi_cargo
      cartStore.order_notes = ''
      
      // Redirigir al dispatcher (home)
      router.push('/')
      
      // Opcional: Enviar confirmación al padre
      if (event.source && event.source !== window) {
        event.source.postMessage({
          type: 'new-order-confirmed',
          success: true,
          timestamp: new Date().toISOString()
        }, event.origin)
      }
    }
  }
}

onMounted(() => {
  bootstrapFromUrl('mounted')

  window.addEventListener('popstate', onPopState)
  
  // Agregar listener para postMessage desde iframe padre
  if (import.meta.client) {
    window.addEventListener('message', handlePostMessage)
  }

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
  window.removeEventListener('popstate', onPopState)
  if (import.meta.client) {
    window.removeEventListener('message', handlePostMessage)
  }
  if (stopRouteWatch) stopRouteWatch()
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
