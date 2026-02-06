<script setup>
// Redirigir /menu a /carta
if (import.meta.client) {
  await navigateTo('/carta', { replace: true })
} else {
  // En SSR, usar redirect
  await navigateTo('/carta', { redirectCode: 301 })
}
</script>

<template>
  <div />
</template>
