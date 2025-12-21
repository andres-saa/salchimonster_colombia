<template>
  <div class="app-layout">
    <header
      ref="topbarRef"
      class="app-layout__topbar"
      :style="layoutVars"
    >
      <TopBar v-if="!['gracias', 'pagar'].some(word => route.path.includes(word))" />
    </header>

    <div
      class="app-layout__shell"
      :class="{ 'app-layout__shell--full': isCartaRoute }"
      :style="layoutVars"
    >
      <div style="position: fixed; left: 0; top: 0; z-index: -1;">
        <div style="width: 100vw; height: 100vh;"></div>
      </div>

      <aside class="app-layout__sidebar" :style="layoutVars">
        <Sidebar />
      </aside>

      <main
        class="app-layout__content"
        :class="{ 'app-layout__content--full': isCartaRoute }"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useSitesStore } from '#imports'

const route = useRoute()
const siteStore = useSitesStore()

const isOpen = computed(() => {
  const st = siteStore.status
  if (!st) return false
  if (typeof st === 'string') return st === 'open'
  return st.status === 'open'
})

/* ===== Scroll hide/show ===== */
const isPinned = ref(true)
const lastScrollY = ref(0)

const handleScroll = () => {
  if (typeof window === 'undefined') return
  const currentY = window.scrollY || window.pageYOffset || 0
  const delta = currentY - lastScrollY.value

  if (Math.abs(delta) < 5) {
    lastScrollY.value = currentY
    return
  }

  if (delta > 0 && currentY > 80) isPinned.value = false
  else isPinned.value = true

  lastScrollY.value = currentY
}

/* ===== Medir altura real del TopBar ===== */
const topbarRef = ref(null)
const topbarH = ref(0)
let ro = null

const measureTopbar = () => {
  topbarH.value = topbarRef.value?.offsetHeight || 0
}

/* CSS vars (transform) */
const layoutVars = computed(() => {
  const h = topbarH.value
  return {
    '--topbar-h': `${h}px`,
    '--topbar-y': isPinned.value ? '0px' : `-${h}px`,
    '--sidebar-y': isPinned.value ? `${h}px` : '0px',
  }
})

const isCartaRoute = computed(() => {
  const path = route.path || ''
  const keywords = ['/carta', '/cart', '/sedes', '/franquicias', '/colaboraciones', '/sonando', '/producto', '/pay', '/gracias']
  return keywords.some(keyword => path.includes(keyword))
})

onMounted(() => {
  if (typeof window === 'undefined') return
  lastScrollY.value = window.scrollY || 0
  window.addEventListener('scroll', handleScroll, { passive: true })

  measureTopbar()

  // ResizeObserver = mantiene altura correcta si cambia por cinta/estado/idioma
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(measureTopbar)
    if (topbarRef.value) ro.observe(topbarRef.value)
  } else {
    window.addEventListener('resize', measureTopbar, { passive: true })
  }
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', measureTopbar)
  if (ro) ro.disconnect()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

/* TOPBAR: fijo + translate (suave) */
.app-layout__topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;

  background: #ffffff71;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  transform: translate3d(0, var(--topbar-y), 0);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

/* SHELL */
.app-layout__shell {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  display: flex;

  /* para que el contenido arranque debajo del topbar fijo */
  padding-top: var(--topbar-h);
}

@media (min-width: 2049px) {
  .app-layout__shell { max-width: 1600px; margin: 0 auto; }
  .app-layout__shell.app-layout__shell--full { max-width: none; margin: 0; }
}

/* SIDEBAR: fijo + translate (sube/baja siguiendo al topbar) */
.app-layout__sidebar {
  width: 260px;
  color: #fff;
  overflow-y: auto;
  max-height: 100vh;

  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;

  transform: translate3d(0, var(--sidebar-y), 0);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;

  scrollbar-width: none;
  -ms-overflow-style: none;
}
.app-layout__sidebar::-webkit-scrollbar { display: none; }

/* CONTENIDO */
.app-layout__content {
  width: 100%;
  padding: 0;
  padding-left: 260px;
}
.app-layout__content--full { padding-left: 0; }

/* Transición Nuxt */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Responsive */
@media (max-width: 900px) {
  .app-layout__shell {
    flex-direction: column;
    max-width: 100%;
    position: relative;
  }

  .app-layout__content,
  .app-layout__content--full {
    padding: 0;
    overflow-y: visible;
  }
}

/* Respeta usuarios con reduced motion */
@media (prefers-reduced-motion: reduce) {
  .app-layout__topbar,
  .app-layout__sidebar {
    transition: none;
  }
}
</style>
