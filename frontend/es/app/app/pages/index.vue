<template>
  <!-- Mostrar dispatcher cuando no hay sede en la URL -->
  <!-- Permitir cambiar de sede incluso si ya hay una seleccionada -->
  <Dispatcher />
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useSitesStore } from '#imports'
import { useSedeFromRoute, getSiteSlug } from '~/composables/useSedeFromRoute'
import Dispatcher from '~/pages/dispatcher.vue'
import { watch } from 'vue'

// Usar layout específico para home
definePageMeta({
  layout: 'home'
})

const route = useRoute()
const router = useRouter()
const sitesStore = useSitesStore()
const sedeFromRoute = useSedeFromRoute()

// Solo redirigir automáticamente si:
// 1. Hay una sede en el store
// 2. NO hay sede en la URL
// 3. NO estamos en la ruta raíz '/' (para permitir usar el dispatcher)
// 4. El usuario viene de una navegación interna (no es el primer acceso)
watch(
  () => [sitesStore.location?.site?.site_id, sitesStore.location?.order_type, route.path],
  ([siteId, orderType, path]) => {
    if (!import.meta.client) return
    if (!siteId || !orderType) return
    if (sedeFromRoute.value) return // Ya hay sede en la URL
    if (path === '/') return // Estamos en el dispatcher, no redirigir
    
    // Solo redirigir si venimos de otra página (navegación interna)
    // No redirigir si es el primer acceso a '/'
    const siteSlug = getSiteSlug(sitesStore.location.site.site_name)
    if (siteSlug) {
      router.replace(`/${siteSlug}/`)
    }
  },
  { immediate: false } // No ejecutar inmediatamente, solo cuando cambian los valores
)
</script>
