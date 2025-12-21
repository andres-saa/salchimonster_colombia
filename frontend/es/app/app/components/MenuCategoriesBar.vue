<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import { useSitesStore } from '#imports'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  activeCategoryId: {
    type: [Number, String, null], 
    default: null
  }
})

const emit = defineEmits(['select-category'])
const containerRef = ref(null)
const siteStore = useSitesStore()

// ✅ 1. Lógica de estado
const isOpen = computed(() => {
  const st = siteStore.status
  if (!st) return false
  if (typeof st === 'string') return st === 'open'
  return st.status === 'open'
})

// ✅ 2. Scroll Logic Optimizada
const isPinned = ref(true)
const lastScrollY = ref(0)
const ticking = ref(false) // Para evitar exceso de llamadas (throttling simple)

const handleScroll = () => {
  if (typeof window === 'undefined') return
  
  // Usamos requestAnimationFrame para sincronizar con el refresco de pantalla
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
  
  // Ignorar movimientos muy pequeños para evitar "temblores"
  if (Math.abs(delta) < 10) return 

  // Si bajamos (delta > 0) y pasamos el umbral del header (> 60px), ocultamos
  if (delta > 0 && currentY > 60) {
    isPinned.value = false
  } else {
    // Si subimos, mostramos
    isPinned.value = true
  }
  
  lastScrollY.value = currentY
}

// ✅ 3. Calculamos la posición TOP dinámica
const categoriesBarTop = computed(() => {
  // Caso A: Usuario bajando scroll (Header principal oculto -> Top 0)
  if (!isPinned.value) return '0px'

  // Caso B: Usuario arriba o subiendo (Header principal visible)
  // Ajusta estos valores píxel-perfecto con la altura real de tu header
  return isOpen.value ? '3.6rem' : '5.7rem'
})

const formatLabel = (str) => {
  const s = String(str || '').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const onClickCategory = (category) => {
  emit('select-category', category)
}

const centerActiveCategoryPill = () => {
  const container = containerRef.value
  if (!container) return
  const activeId = props.activeCategoryId
  if (!activeId) return
  const activeEl = container.querySelector(`[data-cat-pill-id="${activeId}"]`)
  if (!activeEl) return

  const targetScrollLeft = activeEl.offsetLeft + activeEl.offsetWidth / 2 - container.clientWidth / 2
  container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
}

watch(() => props.activeCategoryId, () => {
  nextTick(() => { centerActiveCategoryPill() })
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
    class="menu-categories-bar" 
    :style="{ top: categoriesBarTop }"
  >
    <div class="menu-categories-bar__scroll" ref="containerRef">
      <button
        v-for="cat in categories"
        :key="cat.category_id"
        class="menu-categories-bar__item"
        :class="{ 'menu-categories-bar__item--active': cat.category_id == activeCategoryId }"
        :data-cat-pill-id="cat.category_id"
        @click="onClickCategory(cat)"
      >
        <img 
          v-if="cat.products[0]?.productogeneral_urlimagen"
          class="menu-categories-bar__img"
          :src="`https://img.restpe.com/${cat.products[0]?.productogeneral_urlimagen}`" 
          alt=""
        > 
        <span class="menu-categories-bar__text">{{ formatLabel(cat.category_name) }}</span>   
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
  
  /* MEJORA: Transición más rápida y suave (ease-in-out) */
  transition: top 0.2s ease-in-out;
  
  /* MEJORA CRÍTICA: Hint para la GPU, evita saltos al hacer scroll */
  will-change: top;
  
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.menu-categories-bar__scroll {
  margin: 0 auto;
  padding: 0.75rem 1rem;
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  
  /* Smooth scroll interno para cuando se centran las píldoras */
  scroll-behavior: smooth;
}
.menu-categories-bar__scroll::-webkit-scrollbar { display: none; }

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
  /* Reducimos transición del hover para que se sienta más responsivo */
  transition: background-color 0.2s, color 0.2s, transform 0.1s;
  white-space: nowrap;
  flex-shrink: 0;
  
  /* Evitar selección de texto azul en móviles al tocar rápido */
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
  transform: translateY(0px); /* Efecto de click */
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
</style>