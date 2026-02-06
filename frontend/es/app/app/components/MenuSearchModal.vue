<template>
  <Transition name="modal-fade">
    <div v-if="uiStore.isSearchOpen" class="search-modal">
      <div class="menu-background">
        <div class="search-sticky-header">
          <div class="header-content">
            <div class="search-bar-container">
              <i class="fas fa-search search-icon"></i>

              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                class="search-input"
                :placeholder="t('search_placeholder')"
                @input="onSearchInput"
              />

              <button
                v-if="searchQuery"
                class="search-clear-btn"
                type="button"
                @click="clearSearch"
              >
                ✕
              </button>
            </div>

            <button class="close-modal-btn" type="button" @click="closeModal">
              {{ t('close') }}
            </button>
          </div>
        </div>

        <div v-if="showLoader" class="loading-container">
          <div class="spinner"></div>
          <p class="loading-text">{{ t('loading_menu') }}</p>
        </div>

        <div v-else class="menu-content">
          <div v-if="filteredCategories.length === 0 && !menuPending" class="no-results">
            <p>{{ t('no_results', { q: searchQuery }) }} ☹️</p>
            <button class="reset-btn" type="button" @click="clearSearch">
              {{ t('see_all_menu') }}
            </button>
          </div>

          <section
            v-for="(cat, index) in filteredCategories"
            :key="cat.category_id"
            :ref="(el) => setCategoryRef(cat.category_id, el)"
            class="menu-category-section"
          >
            <header class="menu-category-section__header">
              <h2
                class="menu-category-section__title"
                :style="shouldUseWhiteText(index) ? 'color:white' : ''"
              >
                {{ formatLabel(cat.category_name)?.toLowerCase() }}
              </h2>

              <p
                class="menu-category-section__count"
                :style="shouldUseWhiteText(index) ? 'color:white' : ''"
              >
                {{ (cat.products?.length || 0) }} {{ t('products') }}
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
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '~/stores/ui'
import MenuProductCard from '~/components/MenuProductCard.vue'
import { URI } from '~/service/conection'
import { useSitesStore, useUserStore } from '#imports'
import { useSiteRouter } from '~/composables/useSiteRouter'
import { useMenuData } from '~/composables/useMenuData'

const route = useRoute()
const router = useRouter()
const sitesStore = useSitesStore()
const uiStore = useUIStore()
const userStore = useUserStore()

const searchInputRef = ref(null)

/* ================= i18n ================= */
const lang = computed(() =>
  (userStore?.lang?.name || 'es').toString().toLowerCase() === 'en' ? 'en' : 'es'
)

const DICT = {
  es: {
    search_placeholder: '¿Qué se te antoja hoy?',
    close: 'Cerrar',
    loading_menu: 'Cargando nuestro menú...',
    products: 'productos',
    see_all_menu: 'Ver todo el menú',
    no_results: 'No encontramos productos que coincidan con "{q}"'
  },
  en: {
    search_placeholder: 'What are you craving today?',
    close: 'Close',
    loading_menu: 'Loading our menu...',
    products: 'products',
    see_all_menu: 'See full menu',
    no_results: 'We couldn’t find products matching "{q}"'
  }
}

const t = (key, vars = {}) => {
  const dict = DICT[lang.value] || DICT.es
  let s = dict[key] ?? DICT.es[key] ?? key
  Object.entries(vars).forEach(([k, v]) => {
    s = s.replaceAll(`{${k}}`, String(v))
  })
  return s
}

/* ================= Modal / Search ================= */
const searchQuery = ref('')

const closeModal = () => {
  uiStore.closeSearch()
  searchQuery.value = ''
}

const clearSearch = () => {
  searchQuery.value = ''
  if (searchInputRef.value) searchInputRef.value.focus()
}

const onSearchInput = () => {
  // Lógica simple de input
}

/* Lock scroll */
watch(
  () => uiStore.isSearchOpen,
  (isOpen) => {
    if (!process.client) return
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      nextTick(() => {
        if (searchInputRef.value) searchInputRef.value.focus()
      })
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)

/* ================= Config ================= */
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

/* ================= Fetch ================= */
// Usar el composable compartido para asegurar consistencia
const { rawCategoriesData, refresh, menuPending, siteId } = useMenuData()

const sourceData = computed(() => rawCategoriesData.value)

/* ================= Helpers ================= */
const normalize = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const formatLabel = (str) => {
  const s = String(str || '')
  if (!s) return ''
  // Capitaliza suave sin destruir el resto
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ================= Base categories (RESPONDE AL IDIOMA) ================= */
const baseCategories = computed(() => {
  const raw = sourceData.value
  if (!raw || !Array.isArray(raw.categorias)) return []

  const isEn = lang.value === 'en'

  return raw.categorias
    .filter((cat) => cat.visible && Array.isArray(cat.products) && cat.products.length > 0)
    .map((cat) => {
      const category_id = Number(cat.categoria_id)

      // ✅ AQUÍ: nombre de categoría según idioma actual
      const category_name = isEn
        ? (cat.english_name || cat.categoria_descripcion || '')
        : (cat.categoria_descripcion || cat.english_name || '')

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

            // Nombre según disponibilidad (ya cubre EN si existe english_name)
            product_name:
              p.productogeneral_descripcionweb ||
              p.productogeneral_descripcion ||
              p.english_name ||
              '',

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

/* ================= Live filter ================= */
const filteredCategories = computed(() => {
  const query = normalize(searchQuery.value)
  if (!query) return baseCategories.value

  return baseCategories.value
    .map((cat) => {
      const matchingProducts = cat.products.filter((p) => {
        const name = normalize(p.product_name)
        const desc = normalize(p.productogeneral_descripcion || p.productogeneral_descripcionweb)
        const eng = normalize(p.english_name)
        return name.includes(query) || desc.includes(query) || eng.includes(query)
      })
      return { ...cat, products: matchingProducts }
    })
    .filter((cat) => cat.products.length > 0)
})

const showLoader = computed(() => menuPending.value && baseCategories.value.length === 0)
const shouldUseWhiteText = (index) => index === 0

const onClickProduct = (category, product) => {
  const { pushWithSite } = useSiteRouter()
  uiStore.closeSearch()
  pushWithSite(`/producto/${product.id}`)
}

/* ================= Refs / observers ================= */
const activeCategoryId = ref(null)
const categoryRefs = ref({})
const productRefs = ref({})
const productObserver = ref(null)

onMounted(async () => {
  if (!process.client) return

  productObserver.value = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        const el = entry.target
        if (!el) return
        if (entry.isIntersecting) {
          el.classList.remove('menu-product-card--hidden')
          obs.unobserve(el)
        }
      })
    },
    {
      root: document.querySelector('.search-modal'),
      rootMargin: '0px 0px 20% 0px',
      threshold: 0.01
    }
  )

  await doClientRefresh(refresh)

  clientRefreshIntervalId = window.setInterval(() => {
    doClientRefresh(refresh)
  }, 10 * 60 * 1000)
})

onBeforeUnmount(() => {
  if (productObserver.value) productObserver.value.disconnect()
  if (clientRefreshIntervalId && process.client) window.clearInterval(clientRefreshIntervalId)
  if (process.client) document.body.style.overflow = ''
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
    if (prevEl && productObserver.value) productObserver.value.unobserve(prevEl)
    delete productRefs.value[productId]
    return
  }

  productRefs.value[productId] = el
  el.classList.add('menu-product-card--hidden')
  el.dataset.productId = String(productId)

  if (productObserver.value) productObserver.value.observe(el)
}
</script>

<style scoped>
/* (tu <style> queda igual, no lo toco) */
.search-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 99999;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.menu-background {
  min-height: 100%;
  background-image:
    linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.75) 0,
      rgb(255, 255, 255) 50vh,
      #ffffff 50vh
    ),
    url('https://backend.salchimonster.com/read-photo-product/Ym5HMDik');
  background-repeat: no-repeat;
  background-size: 100% auto;
  background-attachment: local;
}

.search-sticky-header {
  position: sticky;
  top: 0;
  z-index: 10000;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.header-content {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-bar-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 15px;
  color: #9ca3af;
  font-size: 1.1rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 45px;
  border-radius: 99px;
  border: 1px solid #e5e7eb;
  background-color: #f3f4f6;
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;
  color: #333;
}

.search-input:focus {
  background-color: #fff;
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2);
}

.search-clear-btn {
  position: absolute;
  right: 15px;
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #9ca3af;
  cursor: pointer;
  padding: 0 5px;
}

.close-modal-btn {
  background: transparent;
  border: 1px solid #e5e7eb;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.close-modal-btn:hover {
  background: #f3f4f6;
  color: #000;
}

.menu-content {
  max-width: 1300px;
  margin: 0 auto 2.5rem;
  padding: 0 1rem 1rem;
}

.no-results {
  text-align: center;
  padding: 4rem 1rem;
  color: white;
  font-weight: 500;
  font-size: 1.1rem;
}

.reset-btn {
  margin-top: 1rem;
  padding: 8px 16px;
  background: white;
  color: #111;
  border: none;
  border-radius: 20px;
  font-weight: 600;
  cursor: pointer;
}

.menu-category-section {
  padding-top: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(229, 231, 235, 0.5);
}
.menu-category-section:last-of-type {
  border-bottom: none;
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
  transition: color 0.3s ease;
}

.menu-category-section__count {
  margin: 0;
  font-size: 0.8rem;
  color: #6b7280;
}

.menu-category-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.9rem;
  padding-bottom: 5rem;
}

/* En PC: ajustar grid para cards horizontales con imagen 96px */
@media (min-width: 769px) {
  .menu-category-section__grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    max-width: 100%;
  }
}

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

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .menu-background { background-size: contain; }
  .menu-content { padding: 0.5rem 0.5rem 1.5rem; }
  .menu-category-section__title { font-size: 1.5rem; }
  .menu-category-section__grid {
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }
  .close-modal-btn {
    padding: 8px 12px;
    font-size: 0.9rem;
  }
}

*{
  text-transform: capitalize;
}
</style>
