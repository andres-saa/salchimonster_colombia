<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const siteUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://salchimonster.com'
})

const logoUrl = 'https://gestion.salchimonster.com/images/logo.png'

// Descripción mejorada para Google
const pageDescription = 'Salchimonster Colombia - La mejor salchipapa de Colombia. Pide a domicilio, encuentra tu sede más cercana. Menú completo, domicilios, sedes en todo Colombia. Pedidos online disponibles.'

// Metatags globales para SEO y redes sociales
useHead({
  title: 'Salchimonster Colombia - Menú · DOMICILIOS · Sedes · PEDÍ YA',
  meta: [
    {
      name: 'description',
      content: pageDescription
    },
    { name: 'robots', content: 'index, follow' },
    { name: 'keywords', content: 'salchimonster, salchipapa, domicilio, delivery, colombia, pedidos online, menú, sedes, restaurante, comida rápida, salchipapas, hamburguesas, perros calientes' },
    // Open Graph
    { property: 'og:title', content: 'Salchimonster Colombia - Menú · DOMICILIOS · Sedes · PEDÍ YA' },
    { property: 'og:description', content: pageDescription },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: computed(() => `${siteUrl.value}${route.fullPath}`) },
    { property: 'og:image', content: logoUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'Salchimonster Logo' },
    { property: 'og:site_name', content: 'Salchimonster' },
    { property: 'og:locale', content: 'es_CO' },
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Salchimonster Colombia - Menú · DOMICILIOS · Sedes · PEDÍ YA' },
    { name: 'twitter:description', content: pageDescription },
    { name: 'twitter:image', content: logoUrl },
    { name: 'twitter:image:alt', content: 'Salchimonster Logo' },
    // Additional SEO
    { name: 'author', content: 'Salchimonster' },
    { name: 'language', content: 'es' },
    { name: 'geo.region', content: 'CO' },
    { name: 'geo.placename', content: 'Colombia' },
    { name: 'application-name', content: 'Salchimonster' },
    { name: 'apple-mobile-web-app-title', content: 'Salchimonster' }
  ],
  link: [
    { rel: 'canonical', href: computed(() => `${siteUrl.value}${route.fullPath}`) },
    { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' }
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        '@id': `${siteUrl.value}/#restaurant`,
        name: 'Salchimonster',
        alternateName: 'Salchimonster Colombia',
        description: pageDescription,
        url: siteUrl.value,
        logo: logoUrl,
        image: logoUrl,
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'CO',
          addressRegion: 'Colombia'
        },
        servesCuisine: 'Salchipapa',
        priceRange: '$$',
        telephone: '+57',
        areaServed: {
          '@type': 'Country',
          name: 'Colombia'
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Menú Salchimonster',
          itemListElement: [
            {
              '@type': 'OfferCatalog',
              name: 'Menú',
              url: `${siteUrl.value}/menu`
            },
            {
              '@type': 'OfferCatalog',
              name: 'Domicilios',
              url: `${siteUrl.value}/domicilios`
            },
            {
              '@type': 'OfferCatalog',
              name: 'Sedes',
              url: `${siteUrl.value}/sedes`
            }
          ]
        },
        sameAs: [
          'https://www.facebook.com/salchimonster',
          'https://www.instagram.com/salchimonster'
        ]
      })
    },
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${siteUrl.value}/#organization`,
        name: 'Salchimonster',
        alternateName: 'Salchimonster Colombia',
        url: siteUrl.value,
        logo: logoUrl,
        description: pageDescription,
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'CO',
          addressRegion: 'Colombia'
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Customer Service',
          areaServed: 'CO',
          availableLanguage: ['es', 'en']
        },
        sameAs: [
          'https://www.facebook.com/salchimonster',
          'https://www.instagram.com/salchimonster'
        ]
      })
    },
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${siteUrl.value}/#website`,
        url: siteUrl.value,
        name: 'Salchimonster Colombia',
        description: pageDescription,
        publisher: {
          '@id': `${siteUrl.value}/#organization`
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl.value}/buscar?q={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      })
    }
  ]
})
</script>