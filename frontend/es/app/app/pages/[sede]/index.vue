








<template>
  <div class="menu-page">
    <CarouselBanners v-if="!isLoggedIn" />

    <MenuCategoriesBar
      :categories="categories"
      :active-category-id="activeCategoryId"
      :is-refreshing="isRefreshing"
      :is-loading-light="isLightLoading"
      @select-category="onClickCategory"
    />

    <div class="menu-background">
      <!-- Mostrar loader solo si realmente no hay datos -->
      <ClientOnly>
        <div v-if="showLoader" class="loading-container">
          <div class="spinner"></div>
          <p class="loading-text">
            {{ tMenu.loading_menu || 'Cargando nuestro menú...' }}
          </p>
        </div>
      </ClientOnly>

      <!-- Mostrar contenido siempre (si hay datos o no, para evitar mismatch de hidratación) -->
      <ClientOnly>
        <div v-if="!showLoader" class="menu-content">
          <section
            v-for="(cat, index) in categories"
            :key="cat.category_id"
            :ref="(el) => setCategoryRef(cat.category_id, el)"
            class="menu-category-section"
          >
            <header class="menu-category-section__header">
              <h2
                class="menu-category-section__title"
                :style="index === 0 ? 'color:white' : ''"
              >
                {{ formatLabel(cat.category_name) }}
              </h2>

              <p
                class="menu-category-section__count"
                :style="index === 0 ? 'color:white' : ''"
              >
                {{ cat.products?.length || 0 }} {{ productCountLabel(cat.products?.length || 0) }}
              </p>
            </header>

            <div class="menu-category-section__grid">
              <MenuProductCard
                v-for="prod in cat.products"
                :key="prod.id"
                :product="prod"
                :category-id="cat.category_id"
                :image-base-url="URI"
                :set-product-ref="setProductRef"
                @click="onClickProduct(cat, prod)"
              />
            </div>
          </section>
        </div>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { navigateTo } from '#app'
import CarouselBanners from '~/components/carouselBanners.vue'
import MenuCategoriesBar from '~/components/MenuCategoriesBar.vue'
import MenuProductCard from '~/components/MenuProductCard.vue'
import { URI } from '~/service/conection'
import { useHead, useSitesStore, useUserStore, texts } from '#imports'
import { useMenuPreloader } from '~/composables/useMenuPreloader'
import { useSedeFromRoute, getSiteSlug } from '~/composables/useSedeFromRoute'
import { useSiteRouter } from '~/composables/useSiteRouter'
import { useMenuData } from '~/composables/useMenuData'

const route = useRoute()
const sitesStore = useSitesStore()
const userStore = useUserStore()
const sedeFromRoute = useSedeFromRoute()
const { pushWithSite } = useSiteRouter()

// Detectar sede desde la URL y cargar en el store si no está
const loadSiteFromUrl = async () => {
  if (!import.meta.client || !sedeFromRoute.value) return
  
  // Verificar si la sede ya está cargada en el store
  const currentSiteSlug = getSiteSlug(sitesStore.location.site?.site_name || '')
  if (currentSiteSlug === sedeFromRoute.value && sitesStore.location.site?.site_id) {
    // Ya está cargada, no hacer nada
    return
  }
  
  // Buscar la sede por subdomain (que ahora será el slug de la URL)
  try {
    const response = await fetch(`${URI}/sites/subdomain/${sedeFromRoute.value}`)
    if (response.ok) {
      const data = await response.json()
      const siteData = data?.[0] || data
      if (siteData && siteData.site_id) {
        // Actualizar el store con la sede de la URL
        const prevId = sitesStore.location.site?.site_id
        const newId = siteData?.site_id
        
        sitesStore.location.site = {
          ...(sitesStore.location.site || {}),
          ...siteData
        }
        
        if (prevId !== newId) {
          sitesStore.initStatusWatcher()
        }
      } else {
        // La sede no existe, redirigir al dispatcher
        console.warn(`[Sede] Sede "${sedeFromRoute.value}" no encontrada, redirigiendo al dispatcher`)
        await navigateTo('/', { replace: true })
      }
    } else {
      // La respuesta no fue OK (404, etc.), redirigir al dispatcher
      console.warn(`[Sede] Error al buscar sede "${sedeFromRoute.value}" (${response.status}), redirigiendo al dispatcher`)
      await navigateTo('/', { replace: true })
    }
  } catch (err) {
    console.error('Error loading site by slug:', err)
    // En caso de error, redirigir al dispatcher
    await navigateTo('/', { replace: true })
  }
}

// Cargar sede desde URL al montar (validación inmediata)
if (import.meta.client && sedeFromRoute.value) {
  loadSiteFromUrl().catch((err) => {
    console.error('[Sede] Error en validación inicial:', err)
    // Si falla la validación inicial, redirigir al dispatcher
    navigateTo('/', { replace: true })
  })
}

/* ==========================
   TRADUCCIONES / IDIOMA
   ========================== */
const langKey = computed(() => (userStore.lang?.name || 'es').toLowerCase())
const isEnglish = computed(() => langKey.value === 'en')

// ✅ Textos UI de esta vista
const tMenu = computed(() => texts[langKey.value]?.menu_page || {})

// ✅ helper: elige EN si existe, si no ES. (y viceversa cuando está en ES)
const pickByLang = (esValue, enValue) => {
  const es = esValue || ''
  const en = enValue || ''
  return isEnglish.value ? (en || es) : (es || en)
}

// ✅ helper: pluralización simple para "producto(s) / product(s)"
const productCountLabel = (n) => {
  const num = Number(n || 0)

  if (isEnglish.value) {
    const s = tMenu.value.product_singular || 'product'
    const p = tMenu.value.product_plural || 'products'
    return num === 1 ? s : p
  }

  const s = tMenu.value.product_singular || 'producto'
  const p = tMenu.value.product_plural || 'productos'
  return num === 1 ? s : p
}

const isLoggedIn = computed(() => {
  return !!userStore.user?.token && !!userStore.user?.inserted_by
})

/* ==========================
   ESTADO PARA REFRESCO EN CLIENTE
   ========================== */
const isRefreshing = ref(false)
let clientRefreshIntervalId = null

const doClientRefresh = async (refreshFn) => {
  try {
    isRefreshing.value = true
    await refreshFn()
  } finally {
    isRefreshing.value = false
  }
}

/* ==========================
   SITE ID
   ========================== */
const siteId = computed(() => (sitesStore?.location?.site?.site_id) || 1)

/* ==========================
   MENU PRERENDER Y ACTUALIZACIÓN AUTOMÁTICA
   ========================== */
const menuPreloader = useMenuPreloader()

/* ==========================
   FETCH & HIDRATACIÓN INTELIGENTE
   ========================== */
// Usar el composable compartido para asegurar consistencia con otros componentes
const { rawCategoriesData, refresh, menuPending, isLightLoading } = useMenuData()

// Inicializar sistema de prerender y actualización periódica
if (import.meta.client) {
  onUnmounted(() => {
    menuPreloader.cleanup()
  })

  // Cuando cambia el site, resetear scroll (pero solo si no hay posición guardada)
  watch(siteId, async (_newSiteId) => {
    const siteSlug = getSiteSlug(sitesStore.location.site?.site_name || '') || 'default'
    const savedScrollPosition = sessionStorage.getItem(`menu-scroll-${siteSlug}`)
    
    // Solo resetear si no hay posición guardada (navegación directa a nuevo site)
    if (savedScrollPosition === null) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    
    // useMenuData se encargará automáticamente de cargar los datos del nuevo site
    // No necesitamos hacer fetch manual aquí
  })
}

/* ==========================
   NORMALIZACIÓN / LABEL
   ========================== */
const formatLabel = (str) => {
  const s = String(str || '').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ==========================
   ADAPTACIÓN DE LA DATA
   (✅ EN: usa english_name si existe, si no usa ES)
   (✅ ES: usa ES si existe, si no usa english_name)
   ========================== */
const categories = computed(() => {
  const raw = rawCategoriesData.value
  if (!raw || !Array.isArray(raw.categorias)) return []

  return raw.categorias
    .filter((cat) => cat.visible && Array.isArray(cat.products) && cat.products.length > 0)
    .map((cat) => {
      const category_id = Number(cat.categoria_id)

      // ✅ “english_name” es el campo EN. “categoria_descripcion” es ES.
      const category_name = pickByLang(cat.categoria_descripcion, cat.english_name)

      const products = (cat.products || [])
        .map((p) => {
          // Calcular precio de la misma manera que MenuProductCard
          const presentationPrice = Number(p.lista_presentacion?.[0]?.producto_precio ?? 0)
          const generalPrice = Number(p.productogeneral_precio ?? 0)
          const fallbackPrice = Number(p.price ?? 0)
          
          const calculatedPrice = presentationPrice > 0 
            ? presentationPrice 
            : generalPrice > 0 
            ? generalPrice 
            : fallbackPrice

          return {
            ...p,
            id: p.producto_id,

            // ✅ EN: english_name si existe, si no ES
            // ✅ ES: ES si existe, si no english_name
            product_name: pickByLang(
              p.productogeneral_descripcionweb || p.productogeneral_descripcion,
              p.english_name || ''
            ),

            price: calculatedPrice,
            image_url:
              p.productogeneral_urlimagen ||
              (p.lista_productobase &&
                p.lista_productobase[0] &&
                p.lista_productobase[0].producto_urlimagen) ||
              ''
          }
        })
        .filter((p) => p.price > 0) // Filtrar productos con precio 0

      return { ...cat, category_id, category_name, products }
    })
})

/* ==========================
   LOADER
   ========================== */
// Asegurar que el estado inicial sea consistente entre servidor y cliente
// No mostrar loader si ya hay datos disponibles (desde caché o SSR)
const showLoader = computed(() => {
  // En SSR, siempre mostrar loader para evitar mismatch
  if (!import.meta.client) {
    return true
  }
  
  // Verificar si hay datos disponibles
  const hasCategories = categories.value.length > 0
  const hasRawData = rawCategoriesData.value?.categorias?.length > 0
  
  // NO mostrar loader si ya hay datos (evita flash y errores de hidratación)
  if (hasCategories || hasRawData) {
    return false
  }
  
  // Solo mostrar loader si está pendiente Y no hay datos
  return menuPending.value
})

/* ==========================
   CLICK PRODUCTO
   ========================== */
const onClickProduct = (category, product) => {
  // Guardar posición del scroll antes de navegar
  if (import.meta.client && typeof window !== 'undefined') {
    const scrollPosition = window.scrollY || window.pageYOffset || 0
    const siteSlug = getSiteSlug(sitesStore.location.site?.site_name || '') || 'default'
    sessionStorage.setItem(`menu-scroll-${siteSlug}`, scrollPosition.toString())
  }
  pushWithSite(`/producto/${product.id}`)
}

/* ==========================
   REFS / OBSERVERS
   ========================== */
const activeCategoryId = ref(null)
const categoryRefs = ref({})
const productRefs = ref({})

const productObserver = ref(null)
const productCategoryObserver = ref(null)

const isProgrammaticScroll = ref(false)
let programmaticScrollTimer = null

// Flag para prevenir activación automática de categoría al montar
const isInitialMount = ref(true)

/* ==========================
   ✅ DEBOUNCE CAMBIO DE CATEGORÍA
   ========================== */
const CATEGORY_CHANGE_DEBOUNCE_MS = 100
let categoryDebounceTimer = null
let pendingCategoryId = null

const scheduleActiveCategoryChange = (catId) => {
  if (!import.meta.client) return
  if (!catId) return
  if (isProgrammaticScroll.value) return

  pendingCategoryId = catId

  if (categoryDebounceTimer) window.clearTimeout(categoryDebounceTimer)

  categoryDebounceTimer = window.setTimeout(() => {
    if (pendingCategoryId && pendingCategoryId !== activeCategoryId.value) {
      activeCategoryId.value = pendingCategoryId
    }
  }, CATEGORY_CHANGE_DEBOUNCE_MS)
}

// ✅ re-observar lo ya renderizado (SSR/caché)
const observeAllProducts = () => {
  if (!import.meta.client) return
  const els = Object.values(productRefs.value)

  els.forEach((el) => {
    if (!el) return

    // animación inicial
    el.classList.add('menu-product-card--hidden')

    if (productObserver.value) productObserver.value.observe(el)
    if (productCategoryObserver.value) productCategoryObserver.value.observe(el)
  })
}

onMounted(async () => {
  if (!import.meta.client) return

  // Cargar sede desde URL si no está en el store
  await loadSiteFromUrl()

  // Inicializar prerender en background (solo para actualizaciones periódicas)
  // NO hace fetch inicial - useMenuData ya lo está haciendo
  menuPreloader.initialize()

  // Restaurar posición del scroll si existe (desde navegación desde producto)
  const siteSlug = getSiteSlug(sitesStore.location.site?.site_name || '') || 'default'
  const savedScrollPosition = sessionStorage.getItem(`menu-scroll-${siteSlug}`)
  
  if (savedScrollPosition !== null) {
    // Esperar a que el contenido se renderice antes de restaurar scroll
    await nextTick()
    // Usar requestAnimationFrame para asegurar que el DOM esté listo
    requestAnimationFrame(() => {
      window.scrollTo({ top: parseInt(savedScrollPosition, 10), behavior: 'instant' })
      // Limpiar la posición guardada después de restaurarla
      sessionStorage.removeItem(`menu-scroll-${siteSlug}`)
    })
  } else {
    // Solo resetear a 0 si no hay posición guardada
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  
  // Resetear categoría activa al montar (no recordar categoría anterior)
  activeCategoryId.value = null

  // Observer para animación de entrada de productos
  productObserver.value = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        const el = entry.target
        if (!el) return
        if (entry.isIntersecting) {
          el.classList.remove('menu-product-card--hidden')
          el.classList.add('menu-product-card--visible')
          obs.unobserve(el)
        }
      })
    },
    {
      root: null,
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.1
    }
  )

  // Observer para actualizar categoría activa según productos visibles (con debounce)
  // NO activar categorías automáticamente al montar inicial
  productCategoryObserver.value = new IntersectionObserver(
    (entries) => {
      // No actualizar categoría activa durante el montaje inicial
      if (isInitialMount.value) return
      if (isProgrammaticScroll.value) return

      const visibles = []

      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const el = entry.target
        if (!el) return

        const catId = Number(el.dataset.categoryId || '')
        if (!catId) return

        visibles.push({
          catId,
          top: entry.boundingClientRect.top
        })
      })

      if (!visibles.length) return

      visibles.sort((a, b) => a.top - b.top)
      const best = visibles[0]

      if (best.catId) {
        scheduleActiveCategoryChange(best.catId)
      }
    },
    {
      root: null,
      rootMargin: '-50px 0px -60% 0px',
      threshold: 0.3
    }
  )

  await nextTick()
  observeAllProducts()

  await doClientRefresh(refresh)

  // Marcar que el montaje inicial ha terminado después de un breve delay
  // Esto permite que el observer funcione normalmente después del montaje
  setTimeout(() => {
    isInitialMount.value = false
  }, 1000)

  clientRefreshIntervalId = window.setInterval(() => {
    doClientRefresh(refresh)
  }, 10 * 60 * 1000)
})

onBeforeUnmount(() => {
  if (productObserver.value) productObserver.value.disconnect()
  if (productCategoryObserver.value) productCategoryObserver.value.disconnect()

  if (programmaticScrollTimer && import.meta.client) {
    window.clearTimeout(programmaticScrollTimer)
  }

  if (clientRefreshIntervalId && import.meta.client) {
    window.clearInterval(clientRefreshIntervalId)
  }

  if (categoryDebounceTimer && import.meta.client) {
    window.clearTimeout(categoryDebounceTimer)
  }
})

const setCategoryRef = (id, el) => {
  if (!el) {
    delete categoryRefs.value[id]
    return
  }
  categoryRefs.value[id] = el
}

const setProductRef = (productId, categoryId, el) => {
  if (!el) {
    const prevEl = productRefs.value[productId]
    if (prevEl) {
      if (productObserver.value) productObserver.value.unobserve(prevEl)
      if (productCategoryObserver.value) productCategoryObserver.value.unobserve(prevEl)
    }
    delete productRefs.value[productId]
    return
  }

  productRefs.value[productId] = el

  el.classList.add('menu-product-card--hidden')

  el.dataset.productId = String(productId)
  el.dataset.categoryId = String(categoryId)

  if (productObserver.value) productObserver.value.observe(el)
  if (productCategoryObserver.value) productCategoryObserver.value.observe(el)
}

/* ==========================
   SCROLL A CATEGORÍA
   ========================== */
const scrollToCategoryId = (id) => {
  if (!import.meta.client) return

  const el = categoryRefs.value[id]
  if (!el) return

  const HEADER_OFFSET = 7 * 16 // 7rem
  const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET

  isProgrammaticScroll.value = true
  if (programmaticScrollTimer) window.clearTimeout(programmaticScrollTimer)

  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })

  programmaticScrollTimer = window.setTimeout(() => {
    isProgrammaticScroll.value = false
  }, 1000)
}

/* ==========================
   CLICK CATEGORÍA
   ========================== */
const onClickCategory = (category) => {
  activeCategoryId.value = category.category_id

  // Solo hacer scroll, NO modificar la URL
  if (import.meta.client) {
    scrollToCategoryId(category.category_id)
  }
}

watch(
  categories,
  (list) => {
    if (!list.length) return

    // NO establecer categoría activa automáticamente al montar
    // Solo observar productos cuando las categorías estén disponibles
    nextTick(() => {
      observeAllProducts()
    })
  },
  { immediate: true, flush: 'post' }
)

/* ==========================
   SEO / META
   ========================== */
const siteName = computed(() => sitesStore?.location?.site?.site_name || '')

const pageTitle = computed(() => {
  const base = 'DOMICILIOS'
  const categoryQ = route.query.category
  const pageName = categoryQ && typeof categoryQ === 'string'
    ? `${formatLabel(categoryQ).toUpperCase()} | ${base}`
    : base
  
  if (siteName.value) {
    return `SM - ${siteName.value.toUpperCase()} | ${pageName}`
  }
  return pageName
})

const pageDescription = computed(() => {
  const site = siteName.value ? ` en ${siteName.value}` : ''
  const categoryQ = route.query.category
  if (categoryQ && typeof categoryQ === 'string') {
    return `Menú de ${formatLabel(categoryQ)}${site}. Pide tu salchipapa favorita a domicilio. Salchimonster - La mejor salchipapa de Colombia.`
  }
  return `Pide tu salchipapa favorita a domicilio${site}. Salchimonster - La mejor salchipapa de Colombia. Menú completo con delivery.`
})

// Obtener URL actual y imagen para compartir
const currentUrl = computed(() => {
  if (typeof window === 'undefined') {
    const siteUrl = sitesStore?.location?.site?.subdomain 
      ? `https://${sitesStore.location.site.subdomain}.salchimonster.com`
      : 'https://salchimonster.com'
    return `${siteUrl}${route.fullPath}`
  }
  return window.location.href
})

const ogImage = computed(() => {
  // Usar imagen del primer producto destacado o logo
  const firstProduct = categories.value[0]?.products?.[0]
  if (firstProduct?.image_url) {
    return firstProduct.image_url
  }
  if (firstProduct?.productogeneral_urlimagen) {
    return `${URI}/read-photo-product/${firstProduct.productogeneral_urlimagen}`
  }
  return 'https://salchimonster.com/favicon.ico'
})

// Structured Data (JSON-LD) para SEO
const structuredData = computed(() => {
  const site = sitesStore?.location?.site
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://salchimonster.com'
  
  // Datos del restaurante
  const restaurantData = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: site?.site_name ? `Salchimonster ${site.site_name}` : 'Salchimonster',
    image: ogImage.value,
    url: currentUrl.value || siteUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site?.city_name || 'Colombia',
      addressCountry: 'CO'
    },
    telephone: site?.site_phone || '',
    servesCuisine: 'Colombian',
    priceRange: '$$',
    acceptsReservations: 'https://schema.org/False',
    menu: `${siteUrl}/menu`
  }

  // Datos del menú (solo si hay categorías)
  if (categories.value.length > 0) {
    return [
      restaurantData,
      {
        '@context': 'https://schema.org',
        '@type': 'Menu',
        name: `Menú ${site?.site_name || 'Salchimonster'}`,
        hasMenuSection: categories.value.slice(0, 10).map(cat => ({ // Limitar a 10 categorías
          '@type': 'MenuSection',
          name: pickByLang(cat.categoria_descripcion, cat.english_name || ''),
          hasMenuItem: (cat.products || []).slice(0, 20).map(prod => ({ // Limitar a 20 productos por categoría
            '@type': 'MenuItem',
            name: pickByLang(
              prod.productogeneral_descripcion || prod.product_name || '',
              prod.english_name || ''
            ),
            description: pickByLang(
              prod.productogeneral_descripcionadicional || prod.productogeneral_descripcionweb || '',
              prod.english_description || ''
            ),
            image: prod.image_url || (prod.productogeneral_urlimagen ? `${URI}/read-photo-product/${prod.productogeneral_urlimagen}` : ''),
            offers: {
              '@type': 'Offer',
              price: prod.price || prod.productogeneral_precio || 0,
              priceCurrency: 'COP',
              availability: 'https://schema.org/InStock'
            }
          }))
        }))
      }
    ]
  }
  
  return [restaurantData]
})

useHead(() => {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://salchimonster.com'
  const fullUrl = currentUrl.value || `${siteUrl}${route.fullPath}`
  
  return {
    title: pageTitle.value,
    meta: [
      { name: 'description', content: pageDescription.value },
      { name: 'robots', content: 'index, follow' },
      // Open Graph
      { property: 'og:title', content: pageTitle.value },
      { property: 'og:description', content: pageDescription.value },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: fullUrl },
      { property: 'og:image', content: ogImage.value },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: `Menú Salchimonster${siteName.value ? ` - ${siteName.value}` : ''}` },
      { property: 'og:site_name', content: 'Salchimonster' },
      { property: 'og:locale', content: isEnglish.value ? 'en_US' : 'es_CO' },
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle.value },
      { name: 'twitter:description', content: pageDescription.value },
      { name: 'twitter:image', content: ogImage.value },
      { name: 'twitter:image:alt', content: `Menú Salchimonster${siteName.value ? ` - ${siteName.value}` : ''}` },
      // Additional SEO
      { name: 'keywords', content: `salchimonster, salchipapa, domicilio, delivery, ${siteName.value || 'colombia'}, menu, restaurante` }
    ],
    script: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(structuredData.value)
      }
    ]
  }
})
</script>









<style scoped>
.menu-page {
  min-height: 100vh;
  color: #111827;
  padding-bottom: 5rem;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* CONTENIDO */
.menu-content {
  max-width: 1300px;
  margin: 0rem auto 2.5rem;
  padding: 1rem;
  width: 100%;
}

/* SECCIÓN CATEGORÍA */
.menu-category-section {
  padding-top: 2rem;
  padding:1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.menu-category-section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.menu-category-section__header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.menu-category-section__title {
  font-size: 2rem;
  font-weight: 700;
  margin: 1rem 0;
 
  text-transform: none;
}

.menu-category-section__count {
  margin: 0;
  font-size: 0.8rem;
  color: #6b7280;
}

/* GRID PRODUCTOS */
.menu-category-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.9rem;
  padding-bottom: 2rem;
}

/* En PC: ajustar grid para cards horizontales con imagen 96px */
@media (min-width: 769px) {
  .menu-category-section__grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    max-width: 100%;
  }
}

/* 📱 RESPONSIVE MÓVIL */
@media (max-width: 768px) {
  .menu-content {
    padding: 0.5rem 0.5rem 1.5rem;
    margin-bottom: 1.5rem;
  }

  .menu-category-section {
    padding-top: 1.2rem;
    padding: .0rem;
    padding-bottom: 1rem;
  }

  .menu-category-section__title {
    font-size: 1.5rem;
  }

  .menu-category-section__grid {
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }
}

.menu-background {
  min-height: 100vh;
  position: relative;
  background-image:
    linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.596) 0,
      rgb(255, 255, 255) 50vh,
      #ffffff 50vh
    );
  background-repeat: no-repeat;
  background-size: 100%;
}

/* Imagen de fondo optimizada y estática */
.menu-background::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Imagen de fondo: alta resolución con blur más pronunciado */
  background-image: url('https://backend.salchimonster.com/read-photo-product/YckqCZfe');
  background-repeat: no-repeat;
  /* Alta resolución: usar tamaño completo sin reducir */
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  /* Blur más pronunciado para suavizar */
  filter: blur(4px);
  transform: scale(1.05); /* Escala para evitar bordes del blur */
  z-index: -1;
  will-change: transform; /* Optimización de rendimiento */
  /* Forzar aceleración por hardware */
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* LOADER INICIAL */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #ffaa00;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 1rem;
}

.loading-text {
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
