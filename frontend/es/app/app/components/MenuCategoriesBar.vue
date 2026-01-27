<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import { useSitesStore, useUserStore, useUIStore} from '#imports' // <-- 1. Importar useUserStore

const props = defineProps({
  categories: { type: Array, default: () => [] },
  activeCategoryId: { type: [Number, String, null], default: null },
  isLoadingLight: { type: Boolean, default: false }
})

const emit = defineEmits(['select-category'])
const containerRef = ref(null)
const siteStore = useSitesStore()
const userStore = useUserStore() // <-- 2. Instanciar store
const uistore = useUIStore()
const handleSearch = () => {
  uistore.isSearchOpen = true
}
// ✅ Detección Iframe
const isIframeMode = computed(() => {
  return userStore.user?.iframe && userStore.user?.token
})

// ✅ 1. Lógica de estado
const isOpen = computed(() => {
  const st = siteStore.status
  if (!st) return false
  if (typeof st === 'string') return st === 'open'
  return st.status === 'open'
})

// ✅ 2. Scroll Logic
const isPinned = ref(true)
const lastScrollY = ref(0)
const ticking = ref(false)

const handleScroll = () => {
  if (typeof window === 'undefined') return
  
  // Si es iframe mode, no gastamos recursos calculando scroll para el pin
  if (isIframeMode.value) return 

  if (!ticking.value) {
    window.requestAnimationFrame(() => {
      performScrollLogic()
      ticking.value = false
    })
    ticking.value = true
  }
}

const performScrollLogic = () => {
  const currentY = window.scrollY || window.pageYOffset || 0
  const delta = currentY - lastScrollY.value
  
  if (Math.abs(delta) < 10) return 

  if (delta > 0 && currentY > 60) {
    isPinned.value = false
  } else {
    isPinned.value = true
  }
  lastScrollY.value = currentY
}

// ✅ 3. Calculamos la posición TOP dinámica
const categoriesBarTop = computed(() => {
  // SI ES IFRAME: Siempre pegado arriba (0px)
  if (isIframeMode.value) return '0px'

  // Lógica normal
  if (!isPinned.value) return '0px'
  return isOpen.value ? '3.6rem' : '5.7rem'
})

const formatLabel = (str) => {
  const s = String(str || '').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const onClickCategory = (category) => emit('select-category', category)

const centerActiveCategoryPill = () => {
  const container = containerRef.value
  if (!container || !props.activeCategoryId) return
  const activeEl = container.querySelector(`[data-cat-pill-id="${props.activeCategoryId}"]`)
  if (!activeEl) return

  const targetScrollLeft = activeEl.offsetLeft + activeEl.offsetWidth / 2 - container.clientWidth / 2
  container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
}

watch(() => props.activeCategoryId, () => {
  nextTick(() => centerActiveCategoryPill())
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    lastScrollY.value = window.scrollY || 0
    window.addEventListener('scroll', handleScroll, { passive: true })
    centerActiveCategoryPill()
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleScroll)
  }
})
</script>

<template>
  <div 
    :key="isIframeMode ? 'static-iframe' : isPinned"
    class="menu-categories-bar fade-in-teleport"
    :style="{ top: categoriesBarTop }"
  >


        




    <div class="menu-categories-bar__scroll" ref="containerRef">
      <ClientOnly>
        <!-- Mostrar skeletons mientras se carga light -->
        <template v-if="isLoadingLight">
          <div
            v-for="i in 5"
            :key="`skeleton-${i}`"
            class="menu-categories-bar__item menu-categories-bar__item--skeleton"
          >
            <div class="menu-categories-bar__skeleton-img"></div>
            <div class="menu-categories-bar__skeleton-text"></div>
          </div>
        </template>
        
        <!-- Mostrar categorías reales cuando no se está cargando light -->
        <template v-else>
          <button
            v-for="cat in categories"
            :key="cat.category_id"
            class="menu-categories-bar__item"
            :class="{ 'menu-categories-bar__item--active': cat.category_id == activeCategoryId }"
            :data-cat-pill-id="cat.category_id"
            @click="onClickCategory(cat)"
          >
            <NuxtImg 
              v-if="cat.products[0]?.productogeneral_urlimagen"
              class="menu-categories-bar__img"
              :src="`https://img.restpe.com/${cat.products[0]?.productogeneral_urlimagen}`" 
              alt=""
              format="webp"
              width="100"
              height="100"
              sizes="(max-width: 768px) 28px, 24px"
              quality="65"
              loading="lazy"
            /> 
            <span class="menu-categories-bar__text">{{ formatLabel(cat.category_name) }}</span>   
          </button>
        </template>
      </ClientOnly>

      <button style="height: 2.5rem;width: 2.5rem;width: 3rem; position: absolute;right: 0;border: none; background:linear-gradient(to left , white 90%, transparent);" type="button" class="action-btn search-btn" @click="handleSearch" title="Buscar">
        <Icon name="mdi:magnify" class="action-icon" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu-categories-bar {
  position: sticky;
  z-index: 99;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  width: 100%;
  max-width: 1920px;
  margin-left: auto;
  margin-right: auto;
  
  /* IMPORTANTE: Eliminamos 'transition: top' para que no deslice. */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  will-change: opacity, transform;
}

/* CLASE PARA LA ANIMACIÓN DE TELETRANSPORTE */
.fade-in-teleport {
  animation: teleportAppear .3s ease ;
}

@keyframes teleportAppear {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.menu-categories-bar__scroll {
  margin: 0 auto;
  padding: 0.75rem 1rem;
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  max-width: 1920px;
  /* scrollbar-width: none; */
  scroll-behavior: smooth;
}
/* .menu-categories-bar__scroll::-webkit-scrollbar { display: none; } */

.menu-categories-bar__item {
  padding: 0.4rem 0.8rem;
  display: flex;
  align-items: center;
  border-radius: 99px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #374151;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, transform 0.1s;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none; 
  -webkit-tap-highlight-color: transparent;
}

.menu-categories-bar__text { padding-left: 0.5rem; }

.menu-categories-bar__img {
  height: 1.5rem;
  width: 1.5rem;
  border-radius: 50%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.menu-categories-bar__item:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #b91c1c;
  transform: translateY(-1px);
}

.menu-categories-bar__item:active {
  transform: translateY(0px);
}

.menu-categories-bar__item--active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

@media (max-width: 768px) {
  .menu-categories-bar__scroll { padding: 0.75rem; gap: 0.6rem; }
  .menu-categories-bar__item { padding: 0.5rem 1rem; font-size: 1rem; }
  .menu-categories-bar__img { height: 1.8rem; width: 1.8rem; }
}


/* --- BOTONES DE ACCIÓN --- */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  color: #555;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
 
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

/* Skeleton para categorías mientras se carga light */
.menu-categories-bar__item--skeleton {
  pointer-events: none;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.menu-categories-bar__skeleton-img {
  height: 1.5rem;
  width: 1.5rem;
  border-radius: 50%;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}

.menu-categories-bar__skeleton-text {
  height: 0.8rem;
  width: 4rem;
  border-radius: 4px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  margin-left: 0.5rem;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

</style>