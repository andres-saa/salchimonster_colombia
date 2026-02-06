<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import {
  useRoute,
  useRouter,
  useSitesStore,
  useSidebarStore,
  useUserStore,
  useUIStore,
  usecartStore,
  texts
} from '#imports'
import { getSiteSlug } from '~/composables/useSedeFromRoute'
import { useFetch } from '#imports'

const uistore = useUIStore()
const route = useRoute()
const router = useRouter()
const siteStore = useSitesStore()
const sidebarStore = useSidebarStore()
const user = useUserStore()
const cartStore = usecartStore()

const handleSearch = () => {
  uistore.isSearchOpen = true
}

// --- LÓGICA DE ESTADO (Abierto/Cerrado) ---
const isOpen = computed(() => {
  // En SSR, siempre retornar false para evitar mismatch
  if (!isClient.value) return false
  const st = siteStore.status
  if (!st) return false
  if (typeof st === 'string') return st === 'open'
  return st.status === 'open'
})

// Hora de apertura para el mensaje de cerrado
const nextOpeningTime = computed(() => {
  // En SSR, retornar valor por defecto para evitar mismatch
  if (!isClient.value) return 'pronto'
  return siteStore.status?.next_opening_time || 'pronto'
})

// Idiomas
const languages = [
  { name: 'ES', label: 'Español', flag: 'https://flagcdn.com/w20/co.png' },
  { name: 'EN', label: 'English', flag: 'https://flagcdn.com/w20/us.png' }
]

// Idioma por defecto
if (!user.lang || !user.lang.name) {
  user.lang = languages[0]
}

// Dropdown idioma
const isLangOpen = ref(false)
const langButtonRef = ref(null)
const langMenuRef = ref(null)

const setLang = (lang) => {
  user.lang = lang
  isLangOpen.value = false
}

// --- refs para menús / "Más" ---
const menusContainerRef = ref(null)
const moreButtonRef = ref(null)
const moreMenuRef = ref(null)

const isClient = ref(false)

// Inicializar con menús por defecto para SSR (asegurar que se muestren desde el inicio)
// En móvil siempre mostramos 4 menús, así que inicializamos con 4
const visibleMenus = ref([
  { label: 'Domicilios', to: '/', isSpecial: true },
  { label: 'Sedes', to: '/sedes' },
  { label: 'Carta', to: '/carta' },
  { label: 'Rastrear', to: '/rastrear' }
])
const overflowMenus = ref([
  { label: 'Ayuda', to: '/pqr' }
])
const isMoreOpen = ref(false)
const windowWidth = ref(0)

// En desktop siempre mostrar 4 menús y el resto en "Más"
// En móvil se usa el burger menu, no se muestran menús aquí

// --- LÓGICA DE AUTENTICACIÓN Y NAVEGACIÓN EXTERNA ---

// Helper para saber si está logueado
const isLoggedIn = computed(() => {
  return !!user.user?.token && !!user.user?.inserted_by
})

const isIframe = computed(() => {
  return user.user.iframe
})

// Acción: Nuevo Pedido (Limpia el carrito y redirige al dispatcher)
const goToNewOrder = () => {
  // Limpiar el carrito
  cartStore.cart = []
  cartStore.applied_coupon = null
  cartStore.coupon_ui = { enabled: false, draft_code: '' }
  cartStore.setAddressDetails({}) // Esto también limpia is_rappi_cargo
  cartStore.order_notes = ''
  
  // Redirigir al dispatcher
  router.push('/')
}

// Acción: Cerrar Sesión
const handleLogout = () => {
  // Eliminar sesión en el store (token, inserted_by, iframe) para que la persistencia se actualice
  user.clearSession()

  // Eliminar sesión externa guardada en localStorage (evita que al volver siga logueado)
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('session_external_data')
  }

  // Redirigir al dispatcher (página principal)
  router.push('/')
}

// --- LÓGICA DE PERFIL DE USUARIO Y JWT ---
const isProfileOpen = ref(false)

// Función segura para decodificar JWT
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')

    // Decodificación compatible con caracteres especiales (utf-8)
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    console.error('Error decodificando token:', e)
    return null
  }
}

// Datos computados del usuario desde el token
const userInfo = computed(() => {
  if (!user.user?.token || typeof window === 'undefined') return null
  return parseJwt(user.user.token)
})

// URL de la foto con timestamp para evitar caché
const userPhotoUrl = computed(() => {
  if (!userInfo.value?.dni) return 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png'
  return `https://backend.salchimonster.com/read-product-image/600/employer-${userInfo.value.dni}?timestamp=${new Date().getTime()}`
})

const toggleProfile = () => {
  isProfileOpen.value = !isProfileOpen.value
}

// --- MENÚS DINÁMICOS ---
// Ruta de domicilios reactiva: si hay sede, ir a /{sede}/, sino a /
const domiciliosRoute = computed(() => {
  // En SSR, siempre retornar '/' para evitar mismatch
  if (!isClient.value) return '/'
  if (siteStore.location?.site?.site_id && siteStore.location?.order_type) {
    const siteName = siteStore.location.site.site_name || ''
    const slug = getSiteSlug(siteName)
    return slug ? `/${slug}/` : '/'
  }
  return '/'
})

const menusAll = computed(() => {
  // En SSR, siempre retornar menús públicos para evitar mismatch
  if (!isClient.value) {
    const langKey = 'es'
    const t = texts[langKey]?.menus || {}
    return [
      { label: t.domicilios || 'Domicilios', to: '/', isSpecial: true },
      { label: t.sedes || 'Sedes', to: `/sedes` },
      { label: t.carta || 'Carta', to: `/carta` },
      { label: t.rastrear || 'Rastrear', to: `/rastrear` },
      { label: t.ayuda || 'Ayuda', to: `/pqr` },
      { label: t.franquicias || 'Franquicias', to: `/franquicias` },
      { label: t.colaboraciones || 'Colaboraciones', to: `/colaboraciones` },
      { label: t.sonando || 'Sonando', to: `/sonando` }
    ]
  }

  const langKey = (user.lang?.name || 'es').toLowerCase()
  const t = texts[langKey]?.menus || {}

  const menusPublicos = [
    { label: t.domicilios || 'Domicilios', to: domiciliosRoute.value, isSpecial: true },
    { label: t.sedes || 'Sedes', to: `/sedes` },
    { label: t.carta || 'Carta', to: `/carta` },
    { label: t.rastrear || 'Rastrear', to: `/rastrear` },
    { label: t.ayuda || 'Ayuda', to: `/pqr` },
    { label: t.franquicias || 'Franquicias', to: `/franquicias` },

    { label: t.colaboraciones || 'Colaboraciones', to: `/colaboraciones` },
    { label: t.sonando || 'Sonando', to: `/sonando` }
  ]

  const menusLogueados = [
    { label: 'Menu', to: domiciliosRoute.value, isSpecial: true },
    { label: t.rastrear || 'Rastrear', to: `/rastrear` }
  ]

  return isLoggedIn.value ? menusLogueados : menusPublicos
})

// ✅ Country (para filtrar redes por país)
const country = computed(() => {
 
    const code =  siteStore?.location?.site?.country_code  || 'co'
    return code
})

// ✅ Default Colombia (fallback)
const defaultSocialLinks = [
  
]

// ✅ API: redes por país
const SOCIAL_LINKS_API = 'https://backend.salchimonster.com/data/social_links_by_country_v1'

// Cache para social links con TTL de 5 minutos
const SOCIAL_LINKS_CACHE_KEY = 'topbar-social-links-cache'
const SOCIAL_LINKS_CACHE_TTL = 5 * 60 * 1000 // 5 minutos
let socialLinksRefreshInterval = null

const loadSocialLinksFromCache = () => {
  if (!import.meta.client) return null
  try {
    const cached = localStorage.getItem(SOCIAL_LINKS_CACHE_KEY)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      const age = Date.now() - timestamp
      if (age < SOCIAL_LINKS_CACHE_TTL) {
        return data
      }
    }
  } catch (e) {
    console.error('Error leyendo caché de social links:', e)
  }
  return null
}

const saveSocialLinksToCache = (data) => {
  if (!import.meta.client) return
  try {
    localStorage.setItem(SOCIAL_LINKS_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('Error guardando caché de social links:', e)
  }
}

// Usar useFetch para prerenderizado en SSR y actualización periódica
const { data: socialLinksData, refresh: refreshSocialLinks } = useFetch(SOCIAL_LINKS_API, {
  key: 'topbar-social-links',
  server: true,
  default: () => {
    // Cargar desde caché local si está disponible (para prerenderizado)
    if (import.meta.client) {
      const cached = loadSocialLinksFromCache()
      return cached ? { data: cached } : null
    }
    return null
  }
})

// Computed para extraer los datos del formato de respuesta
const socialLinksDB = computed(() => {
  if (!socialLinksData.value) {
    // Si no hay datos de useFetch, intentar desde caché local
    if (import.meta.client) {
      const cached = loadSocialLinksFromCache()
      return cached
    }
    return null
  }
  // soporta: { data: { co:[], us:[], es:[] } } o directamente { co:[], us:[], es:[] }
  const payload = socialLinksData.value?.data && typeof socialLinksData.value.data === 'object' 
    ? socialLinksData.value.data 
    : socialLinksData.value
  return payload && typeof payload === 'object' ? payload : null
})

// Persistir en caché cuando se actualicen los datos de useFetch
if (import.meta.client) {
  watch(
    socialLinksData,
    (val) => {
      if (val) {
        // Extraer los datos del formato de respuesta
        const payload = val?.data && typeof val.data === 'object' 
          ? val.data 
          : val
        if (payload && typeof payload === 'object') {
          saveSocialLinksToCache(payload)
        }
      }
    },
    { immediate: true }
  )
}

// Función para actualizar periódicamente cada 5 minutos
const startSocialLinksRefresh = () => {
  if (!import.meta.client) return
  if (socialLinksRefreshInterval) {
    clearInterval(socialLinksRefreshInterval)
  }
  
  socialLinksRefreshInterval = setInterval(() => {
    refreshSocialLinks() // Actualizar usando useFetch refresh
  }, SOCIAL_LINKS_CACHE_TTL)
}

// ✅ socialLinks: primero DB, si no, fallback Colombia
const socialLinks = computed(() => {
  const fromDB = socialLinksDB.value?.[country.value]
  const list = Array.isArray(fromDB) ? fromDB : null

  const finalList = list || defaultSocialLinks

  // filtra enabled si existe, y url válida
  return finalList
    .filter(n => (n?.enabled ?? true))
    .filter(n => !!n?.url)
    .map(n => ({
      name: n.name,
      url: n.url,
      icon: n.icon
    }))
})

const isActiveRoute = (path) => route.path === path

const toggleSidebar = (event) => {
  event.stopPropagation()
  sidebarStore.toggle()
}

const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
  }
}

// Función eliminada - ya no se necesita cálculo dinámico
// En desktop siempre mostramos 4 menús

const recalcMenus = () => {
  const allMenus = menusAll.value
  if (!windowWidth.value) {
    // En SSR o sin windowWidth, mostrar 4 menús (para desktop)
    visibleMenus.value = allMenus.slice(0, 4)
    overflowMenus.value = allMenus.slice(4)
    return
  }
  if (windowWidth.value <= 900) {
    // En móvil ocultar menús, se usa el burger menu
    visibleMenus.value = []
    overflowMenus.value = []
    isMoreOpen.value = false
    return
  }

  // En desktop siempre mostrar 4 menús y el resto en "Más"
  visibleMenus.value = allMenus.slice(0, 4)
  overflowMenus.value = allMenus.slice(4)
  if (!overflowMenus.value.length) isMoreOpen.value = false
}

const hasOverflow = computed(() => overflowMenus.value.length > 0)

// --- CERRAR DROPDOWNS (CLICK AFUERA / ESC / CAMBIO DE RUTA) ---
const onDocClick = (e) => {
  // Idioma
  if (isLangOpen.value) {
    const btn = langButtonRef.value
    const menu = langMenuRef.value
    const inside = btn?.contains(e.target) || menu?.contains(e.target)
    if (!inside) isLangOpen.value = false
  }
  
  // Botón "Más"
  if (isMoreOpen.value) {
    const btn = moreButtonRef.value
    const menu = moreMenuRef.value
    const inside = btn?.contains(e.target) || menu?.contains(e.target)
    if (!inside) isMoreOpen.value = false
  }
  
  // Perfil
  if (isProfileOpen.value) {
    const trigger = document.querySelector('.profile-trigger')
    const card = document.querySelector('.profile-card')
    const inside = trigger?.contains(e.target) || card?.contains(e.target)
    if (!inside) isProfileOpen.value = false
  }
}

const onKeyDown = (e) => {
  if (e.key === 'Escape') {
    isLangOpen.value = false
    isMoreOpen.value = false
    isProfileOpen.value = false
  }
}

watch(
  () => route.path,
  () => {
    isLangOpen.value = false
    isMoreOpen.value = false
    isProfileOpen.value = false
  }
)

onMounted(() => {
  isClient.value = true
  handleResize()
  if (typeof window !== 'undefined') window.addEventListener('resize', handleResize)
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocClick, true)
    document.addEventListener('keydown', onKeyDown)
  }

  siteStore.initStatusWatcher()
  
  // Iniciar actualización periódica cada 5 minutos para social links
  startSocialLinksRefresh()
  
  nextTick().then(() => recalcMenus())
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize)
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onKeyDown)
  }
  
  // Limpiar intervalo de actualización
  if (socialLinksRefreshInterval) {
    clearInterval(socialLinksRefreshInterval)
    socialLinksRefreshInterval = null
  }
})

watch([menusAll, windowWidth], () => {
  nextTick().then(() => recalcMenus())
}, { immediate: true })

// Computed para determinar si mostrar el botón "Más" (solo en desktop)
const shouldShowMoreButton = computed(() => {
  // Solo mostrar en desktop (no en móvil)
  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
    return false
  }
  // En desktop mostrar si hay más de 4 menús
  return overflowMenus.value.length > 0
})

// --- Diálogo Cambiar sede / Quedarme ---
const showSiteChangeDialog = ref(false)
const currentSiteDisplayName = computed(() => {
  const name = siteStore?.location?.site?.site_name
  return name ? name.toLowerCase() : 'Salchimonster'
})

const openSiteChangeDialog = (e) => {
  e.preventDefault()
  showSiteChangeDialog.value = true
}

const closeSiteChangeDialog = () => {
  showSiteChangeDialog.value = false
}

const goToChangeSite = () => {
  showSiteChangeDialog.value = false
  // Ir al dispatcher sin borrar datos: si el usuario da "atrás" vuelve con su carrito y sede
  router.push({ path: '/', query: { cambiar_sede: '1' } })
}

const stayOnCurrentSite = () => {
  showSiteChangeDialog.value = false
}
</script>

<template>
  <div class="app-topbar-wrapper">

    <ClientOnly>
      <div v-if="!isOpen" class="closed-ribbon-container">
        <div class="marquee-track">
          <div class="marquee-content">
            <span v-for="n in 4" :key="'A'+n">
              🚨 ESTAMOS CERRADOS, ABRIMOS A LAS {{ nextOpeningTime }} &nbsp;&nbsp; • &nbsp;&nbsp;
            </span>
          </div>
          <div class="marquee-content">
            <span v-for="n in 4" :key="'B'+n">
              🚨 ESTAMOS CERRADOS, ABRIMOS A LAS {{ nextOpeningTime }} &nbsp;&nbsp; • &nbsp;&nbsp;
            </span>
          </div>
        </div>
      </div>
    </ClientOnly>

    <header class="app-topbar-container">
      <div class="header-inner">

        <div class="logo-sesion">
          <button
            v-if="isLoggedIn"
            @click.prevent="goToNewOrder"
            class="new"
            type="button"
          >
            Nuevo pedido
          </button>

          <NuxtLink :to="domiciliosRoute" class="logo-link">
            <img src="https://gestion.salchimonster.com/images/logo.png" alt="Logo" class="logo-img" />
          </NuxtLink>
          
          <div class="title-block">
            <div class="site-info">
              <Icon name="mdi:map-marker" class="marker-icon" />
              <button type="button" class="site-name-link" @click="openSiteChangeDialog">
                <span class="site-name">
                  {{ currentSiteDisplayName }}
                </span>
              </button>
              <div v-if="isOpen" class="live-dot-container" title="Estamos Abiertos">
                <div class="live-dot"></div>
              </div>
            </div>
          </div>
        </div>

        <nav class="menus" ref="menusContainerRef">
          <template v-for="item in visibleMenus" :key="item.to">
            <NuxtLink
              v-if="!item.isSpecial"
              :to="item.to"
              class="menu-item"
              :class="{ 'menu-item--active': isActiveRoute(item.to) }"
            >
              {{ item.label }}
            </NuxtLink>
            <NuxtLink
              v-else
              :to="item.to"
              class="menu-item"
              :class="{ 'menu-item--active': isActiveRoute(item.to) }"
            >
              {{ item.label }}
            </NuxtLink>
          </template>

          <!-- En móvil siempre mostrar el botón "Más" si hay más de 4 menús -->
          <div 
            v-if="shouldShowMoreButton" 
            class="more-wrapper"
          >
            <button type="button" class="more-button" ref="moreButtonRef" @click="isMoreOpen = !isMoreOpen">
              Más <Icon name="mdi:chevron-down" class="more-chevron" />
            </button>

            <transition name="fade-slide">
              <ul 
                v-if="isMoreOpen" 
                ref="moreMenuRef"
                class="dropdown-menu more-dropdown"
              >
                <li v-for="item in overflowMenus" :key="item.to">
                  <NuxtLink
                    :to="item.to"
                    class="dropdown-item"
                    :class="{ 'menu-item--active': isActiveRoute(item.to) }"
                    @click="isMoreOpen = false"
                  >
                    {{ item.label }}
                  </NuxtLink>
                </li>
              </ul>
            </transition>
          </div>

          <div class="social-icons">
            <a
              v-for="net in socialLinks"
              :key="net.name"
              :href="net.url"
              class="social-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon :name="net.icon" class="social-icon" />
            </a>
          </div>
        </nav>

        <div class="header-actions">

          <!-- 🔤 Selector de idioma -->
          <div class="lang-selector">
            <button
              ref="langButtonRef"
              type="button"
              class="lang-trigger"
              :aria-expanded="isLangOpen"
              aria-haspopup="listbox"
              @click.stop="isLangOpen = !isLangOpen"
              title="Idioma"
            >
              <img :src="user.lang?.flag" alt="" class="lang-flag" />
              <span class="lang-code">{{ user.lang?.name || 'ES' }}</span>
              <Icon name="mdi:chevron-down" class="lang-chevron" />
            </button>

            <transition name="fade-slide">
              <ul
                v-if="isLangOpen"
                ref="langMenuRef"
                class="dropdown-menu lang-dropdown"
                role="listbox"
              >
                <li v-for="lng in languages" :key="lng.name">
                  <button 
                  style="height: 2.5rem;"
                    type="button"
                    class="dropdown-item lang-item"
                    :class="{ 'is-selected': user.lang?.name === lng.name }"
                    @click="setLang(lng)"
                  >
                    <img :src="lng.flag" alt="" class="lang-flag" />
                    <span>{{ lng.label }}</span>
                    <Icon v-if="user.lang?.name === lng.name" name="mdi:check" class="lang-check" />
                  </button>
                </li>
              </ul>
            </transition>
          </div>

          <button style="height: 2.5rem;width: 2.5rem;" type="button" class="action-btn search-btn" @click="handleSearch" title="Buscar">
            <Icon name="mdi:magnify" class="action-icon" />
          </button>

          <div v-if="isLoggedIn && userInfo" class="user-profile-wrapper">
            <button class="profile-trigger" @click.stop="toggleProfile">
              <img :src="userPhotoUrl" alt="User" class="profile-avatar" />
              <span class="profile-name">{{ userInfo.name }}</span>
            </button>

            <transition name="fade-slide">
              <div v-if="isProfileOpen" class="profile-card">
                <div class="card-header">
                  <img :src="userPhotoUrl" alt="Profile" class="card-avatar-large" />
                  <div class="card-info">
                    <h4 class="card-name">{{ userInfo.name }}</h4>
                    <span class="card-role">{{ userInfo.rol }}</span>
                  </div>
                </div>
                <hr class="card-divider" />
                <div class="card-details">
                  <div class="detail-row">
                    <Icon name="mdi:card-account-details-outline" class="detail-icon" />
                    <span><strong>DNI:</strong> {{ userInfo.dni }}</span>
                  </div>
                  <div class="detail-row">
                    <Icon name="mdi:store-marker-outline" class="detail-icon" />
                    <span><strong>Sede:</strong> {{ userInfo.site_name }}</span>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <button
            v-if="isLoggedIn && !isIframe"
            @click.prevent="handleLogout"
            class="new"
            style="background-color: #333; margin-left: 0.5rem;"
            type="button"
          >
            cerrar
          </button>

          <button
            type="button"
            class="icon-button burger-button"
            :class="{ 'burger-visible': !hasOverflow }"
            @click="toggleSidebar"
          >
            <Icon name="mdi:menu" class="header-icon" />
          </button>
        </div>

      </div>
    </header>

    <!-- Diálogo: Cambiar sede o quedarme -->
    <Teleport to="body">
      <div
        v-if="showSiteChangeDialog"
        class="site-change-dialog-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-change-dialog-title"
        @click.self="closeSiteChangeDialog"
      >
        <div class="site-change-dialog">
          <button type="button" class="site-change-dialog-close" @click="closeSiteChangeDialog" aria-label="Cerrar">
            <Icon name="mdi:close" />
          </button>
          <h2 id="site-change-dialog-title" class="site-change-dialog-title">
            ¿Cambiar de sede o quedarte en {{ currentSiteDisplayName }}?
          </h2>
          <div class="site-change-dialog-actions">
            <button type="button" class="site-change-btn site-change-btn--primary" @click="goToChangeSite">
              Cambiar sede
            </button>
            <button type="button" class="site-change-btn site-change-btn--secondary" @click="stayOnCurrentSite">
              Quedarme en {{ currentSiteDisplayName }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* --- VARIABLES --- */
:root {
  --nav-height: 65px;
  --nav-height-mobile: 72px;
}

/* --- WRAPPER GLOBAL --- */
.app-topbar-wrapper {
  position: relative;
  width: 100%;
  z-index: 100;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* --- CINTA CERRADO --- */
.closed-ribbon-container {
  width: 100%;
  background: repeating-linear-gradient(
    45deg,
    #c62828,
    #c62828 10px,
    #d32f2f 10px,
    #d32f2f 20px
  );
  color: white;
  font-weight: 700;
  font-size: 0.8rem;
  padding: 0.5rem 0;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  position: relative;
  display: flex;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.marquee-track {
  display: flex;
  white-space: nowrap;
  animation: marquee 30s linear infinite;
  width: max-content;
}

.marquee-content {
  display: flex;
  align-items: center;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* --- HEADER CONTAINER --- */
.app-topbar-container {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  transition: all 0.3s ease;
}

.header-inner {
  max-width: 1920;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.5rem;
  height: var(--nav-height);
}

/* --- LOGO Y SITE INFO --- */
.logo-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: center;
  transition: opacity 0.2s;
}
.logo-link:hover { opacity: 0.9; }

.site-name-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
  color: inherit;
  display: inline-flex;
  align-items: center;
  transition: opacity 0.2s;
}
.site-name-link:hover { opacity: 0.8; }
.site-name-link:hover .site-name {
  text-decoration: underline;
}

.logo-sesion {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-img {
  width: 42px;
  height: 42px;
  object-fit: cover;
}

.site-info {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--primary-color, #d32f2f);
}

.marker-icon {
  font-size: 1.2rem;
}

.site-name {
  font-weight: 800;
  font-size: 1rem;
  min-width: max-content;
  text-transform: capitalize;
  color: #333;
  line-height: 1.1;
}

/* Punto Verde */
.live-dot-container {
  display: flex;
  align-items: center;
  margin-left: 0.4rem;
}
.live-dot {
  width: 8px;
  height: 8px;
  background-color: #00e676;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7);
  animation: blink-dot 2s infinite;
}
@keyframes blink-dot {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(0, 230, 118, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); }
}

/* --- MENÚ DE ESCRITORIO --- */
.menus {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
}

/* En desktop siempre mostrar máximo 4 menús visibles */
@media (min-width: 901px) {
  .menus {
    /* Limitar visualmente a 4 menús + botón Más */
    max-width: fit-content;
  }
}

.menu-item {
  position: relative;
  color: #444;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  padding: 0.5rem 0;
  transition: color 0.2s;
}

.menu-item:hover { color: var(--primary-color, #d32f2f); }

.menu-item--active {
  color: var(--primary-color, #d32f2f);
}
.menu-item--active::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 3px;
  background-color: var(--primary-color, #d32f2f);
  border-radius: 2px;
  animation: slide-up 0.3s ease;
}

@keyframes slide-up {
  from { width: 0; opacity: 0; margin-left: 50%; }
  to { width: 100%; opacity: 1; margin-left: 0; }
}

/* --- BOTÓN 'MÁS' --- */
.more-wrapper { position: relative; }
.more-button {
  background: transparent;
  border: 1px solid #e0e0e0;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
}
.more-button:hover { background: #f9f9f9; border-color: #ccc; }

/* --- DROPDOWNS (base) --- */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  padding: 0.5rem;
  min-width: 160px;
  list-style: none;
  z-index: 200;
  border: 1px solid #f0f0f0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #333;
  text-decoration: none;
  transition: background 0.2s;
}
.dropdown-item:hover { background-color: #f5f5f5; }

/* --- REDES SOCIALES --- */
.social-icons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
}
.social-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #555;
  transition: all 0.2s;
}
.social-link:hover {
  background-color: #f0f0f0;
  color: var(--primary-color, #d32f2f);
  transform: translateY(-2px);
}
.social-icon { font-size: 1.2rem; }

/* --- ACCIONES DERECHA --- */
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

/* --- SELECTOR DE IDIOMA --- */
.lang-selector {
  position: relative;
  display: flex;
  align-items: center;
}

.lang-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  border-radius: 999px;
  border: 1px solid #eee;
  background: rgba(255, 255, 255, 0.882);
  cursor: pointer;
  transition: all 0.2s;
}

.lang-trigger:hover {
  background: rgb(240, 240, 240);
  border-color: #e0e0e0;
}

.lang-flag {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  object-fit: cover;
}

.lang-code {
  font-weight: 800;
  font-size: 0.8rem;
  color: #333;
  letter-spacing: 0.04em;
}

.lang-chevron {
  font-size: 1.05rem;
  color: #666;
}

.lang-dropdown {
  min-width: 190px;
  z-index: 350;
}

.lang-item {
  justify-content: space-between;
}

.lang-check {
  font-size: 1.05rem;
  color: var(--primary-color, #d32f2f);
}

.lang-item.is-selected {
  background-color: rgba(185, 28, 28, 0.07);
}

/* --- PERFIL DE USUARIO --- */
.user-profile-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: transparent;
  border: 1px solid transparent;
  padding: 0.3rem 0.6rem 0.3rem 0.3rem;
  border-radius: 2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-trigger:hover {
  background-color: rgba(0,0,0,0.05);
  border-color: #eee;
}

.profile-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #fff;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.profile-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #444;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* OVERLAY CARD */
.profile-card {
  position: absolute;
  top: calc(100% + 14px);
  right: -20px;
  width: 290px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  padding: 1.5rem;
  z-index: 300;
  border: 1px solid #f0f0f0;
}

/* Flechita del overlay */
.profile-card::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 35px;
  width: 12px;
  height: 12px;
  background: white;
  transform: rotate(45deg);
  border-top: 1px solid #f0f0f0;
  border-left: 1px solid #f0f0f0;
}

.card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.card-avatar-large {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--primary-color, #d32f2f);
  padding: 3px;
  background: white;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: center;
}

.card-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #333;
}

.card-role {
  font-size: 0.75rem;
  color: white;
  background-color: var(--primary-color, #d32f2f);
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-divider {
  border: 0;
  border-top: 1px solid #eee;
  margin: 1rem 0;
}

.card-details {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.95rem;
  color: #555;
}

.detail-icon {
  font-size: 1.3rem;
  color: #888;
}

/* Botón Hamburguesa */
.burger-button {
  display: none;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #333;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background 0.2s;
}
.burger-button:hover { background-color: rgba(0,0,0,0.05); }
.header-icon { font-size: 1.8rem; }

/* Transiciones Vue */
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.2s ease; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateY(-10px); }

/* --- RESPONSIVE --- */
@media (min-width: 901px) {
  .burger-visible { display: none; }
}

@media (max-width: 900px) {
  /* En móvil ocultar menús, usar burger menu */
  .menus { display: none; }
  .burger-button { display: inline-flex; justify-content: center; align-items: center; }
  .header-inner { padding: 0.5rem 1rem; height: var(--nav-height-mobile); }
  .logo-img { width: 48px; height: 48px; }
  .site-name { font-size: 1.1rem; }
  .marker-icon { font-size: 1.3rem; }
  .header-actions { gap: 0.5rem; }
  .header-icon { font-size: 2rem; color: var(--primary-color, #d32f2f); }

  /* Ajustes Profile Móvil */
  .profile-name { display: none; }
  .profile-trigger { padding: 0; }
  .profile-card { right: -50px; width: 260px; }
  .profile-card::before { right: 65px; }

  /* Idioma en móvil: un poquito más grande */
  .lang-trigger { padding: 0.5rem 0.7rem; }
}

@media (max-width: 400px) {
  .site-name { font-size: 0.95rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* --- BOTONES DE ACCIÓN --- */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  color: #555;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-right: 0.2rem;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04);
  color: var(--primary-color, #d32f2f);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.action-btn:active {
  transform: scale(0.95);
  background-color: rgba(0, 0, 0, 0.08);
}

.action-icon { font-size: 1.4rem; }

@media (max-width: 900px) {
  .action-btn { width: 44px; height: 44px; border: 1px solid #f0f0f0; }
  .action-icon { font-size: 1.5rem; }
  .search-btn { margin-right: 0.5rem; }
  .title-block{max-width: 5rem;}
}

.new {
  border: none;
  border-radius: 0.3rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  background-color: var(--primary-color, #b91c1c);
  color: #ffffff;
}

/* --- Diálogo Cambiar sede --- */
.site-change-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.site-change-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  padding: 1.5rem;
  max-width: 90%;
  width: 22rem;
  position: relative;
}

.site-change-dialog-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
}

.site-change-dialog-close:hover {
  background: #f0f0f0;
  color: #333;
}

.site-change-dialog-close .icon,
.site-change-dialog-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.site-change-dialog-title {
  margin: 0 0 1.25rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: #333;
  line-height: 1.4;
  padding-right: 1.75rem;
}

.site-change-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.site-change-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  border: 1px solid transparent;
}

.site-change-btn--primary {
  background-color: var(--primary-color, #b91c1c);
  color: white;
  border-color: var(--primary-color, #b91c1c);
}

.site-change-btn--primary:hover {
  filter: brightness(1.05);
}

.site-change-btn--secondary {
  background: #f5f5f5;
  color: #333;
  border-color: #e0e0e0;
}

.site-change-btn--secondary:hover {
  background: #eee;
  border-color: #ccc;
}
</style>
