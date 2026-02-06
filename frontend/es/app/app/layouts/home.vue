<template>
  <div class="home-layout">
    <main class="home-layout__content">
      <slot />
    </main>
  </div>
</template>

<script setup>
// Layout específico para home/dispatcher
// Sin TopBar, sin Sidebar, solo el contenido
// Max-width 1920px para que banners y fondos ocupen toda la pantalla
</script>

<style scoped>
.home-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
}

.home-layout__content {
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>

<style>
/* Estilos globales para que los banners, barra de categorías y fondos ocupen todo el ancho disponible (hasta 1920px) */
/* El contenido de productos mantiene su max-width de 1300px */

/* Contenedor principal con max-width 1920px - ocupa todo el espacio disponible */
.home-layout__content {
  max-width: 1920px;
  margin: 0 auto;
  width: 100%;
}

/* Banners ocupan todo el ancho del contenedor (hasta 1920px) */
.banner-container {
  width: 100%;
  max-width: 1920px;
  margin-left: auto;
  margin-right: auto;
}

/* Barra de categorías ocupa todo el ancho del contenedor (hasta 1920px) */
.menu-categories-bar {
  width: 100%;
  max-width: 1920px;
  margin-left: auto;
  margin-right: auto;
}

/* Fondo del menú ocupa todo el ancho del contenedor (hasta 1920px) */
.menu-background {
  width: 100%;
  max-width: 1920px;
  margin-left: auto;
  margin-right: auto;
}

/* El contenido de productos mantiene su max-width de 1300px */
.menu-content {
  max-width: 1300px;
  margin: 0 auto;
}
</style>
