import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { URI } from '../service/conection'

export const useSitesStore = defineStore('site-d3sddfs422', () => {
  
  // 1. HELPER
  const emptyNeighborhood = () => ({
    name: '',
    delivery_price: 0,
    neighborhood_id: null,
    id: null,
    site_id: null,
  })

  // 2. STATE
  const location = ref({
    city: null,
    site: {
      site_id: 1,
      site_name: 'PRINCIPAL',
      site_address: null,
      site_phone: null,
      site_business_hours: null,
      wsp_link: null,
      city_id: 8,
      maps: null,
      show_on_web: true,
      email_address: null,
      status: false,
      comming_soon: false,
    },
    neigborhood: emptyNeighborhood(),
    address_details: null,
    formatted_address: '',
    place_id: '',
    lat: null,
    lng: null,
    mode: 'barrios',
  })

  // ✅ AQUÍ ESTABA EL PROBLEMA: Asegurarse de definir 'visibles'
  const visibles = ref({
    currentSite: false,
    loading: false,
  })

  const current_delivery = ref(0)

  const status = ref({
    status: 'unknown',
    next_opening_time: null,
    networks: null,
  })
  
  let statusTimer = null

  // ───────────── PERSISTENCIA MANUAL (SSR SAFE) ─────────────
  
  const getStorageKey = (siteId) => `site-data-${siteId}`

  // Inicializar storage solo en cliente
  const initStorage = () => {
    if (typeof window === 'undefined') return
    const currentId = location.value.site?.site_id
    if (!currentId) return

    const stored = localStorage.getItem(getStorageKey(currentId))
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        location.value = {
          ...location.value,
          ...parsed,
          // Merge profundo defensivo
          site: { ...location.value.site, ...(parsed.site || {}) },
          neigborhood: { ...emptyNeighborhood(), ...(parsed.neigborhood || {}) }
        }
      } catch (e) { console.error(e) }
    }
  }

  if (typeof window !== 'undefined') {
    initStorage()
  }

  // Watcher: Cambio de Sitio (Cargar datos de ese sitio)
  watch(
    () => location.value.site?.site_id,
    (newId, oldId) => {
      if (typeof window === 'undefined') return
      if (!newId || newId === oldId) return

      const key = getStorageKey(newId)
      const storedData = localStorage.getItem(key)

      if (storedData) {
        try {
          const parsed = JSON.parse(storedData)
          location.value = { ...location.value, ...parsed, site: { ...parsed.site, site_id: newId } }
        } catch (e) { console.error(e) }
      } else {
        // Sitio nuevo: limpiar barrio
        location.value.neigborhood = emptyNeighborhood()
      }
    }
  )

  // Watcher: Guardar cambios en el sitio actual
  watch(
    location,
    (newVal) => {
      if (typeof window === 'undefined') return
      const currentId = newVal.site?.site_id
      if (currentId) {
        try {
          localStorage.setItem(getStorageKey(currentId), JSON.stringify(newVal))
        } catch (e) {}
      }
    },
    { deep: true }
  )

  // ───────────── ACTIONS ─────────────
  
  function setLocation(newLocation) {
    location.value = {
      ...location.value,
      ...newLocation,
      neigborhood: newLocation?.neigborhood ? newLocation.neigborhood : emptyNeighborhood(),
    }
    visibles.value.currentSite = true
  }

  function updateLocation(data, price = 0) {
    location.value.city = data?.city ?? null
    location.value.site = data?.site ?? location.value.site

    const nb = data?.neigborhood

    if (nb) {
      location.value.mode = data?.mode ?? 'barrios'
      location.value.neigborhood = {
        ...emptyNeighborhood(),
        ...nb,
        neighborhood_id: nb.neighborhood_id ?? nb.id ?? null,
        id: nb.id ?? nb.neighborhood_id ?? null,
        delivery_price: price ?? nb.delivery_price ?? 0,
      }
    } else {
      location.value.mode = data?.mode ?? 'google'
      location.value.neigborhood = {
        ...emptyNeighborhood(),
        delivery_price: price ?? 0,
      }
    }

    if (data?.address_details !== undefined) location.value.address_details = data.address_details
    if (data?.formatted_address !== undefined) location.value.formatted_address = data.formatted_address || ''
    if (data?.place_id !== undefined) location.value.place_id = data.place_id || ''
    if (data?.lat !== undefined) location.value.lat = data.lat ?? null
    if (data?.lng !== undefined) location.value.lng = data.lng ?? null

    current_delivery.value = price ?? 0
    visibles.value.currentSite = false
  }

  function setVisible(item, value) {
    if (item === 'loading') {
      visibles.value.loading = true
      if (!value) {
        setTimeout(() => { visibles.value.loading = false }, 500)
      } else {
        visibles.value.loading = value
      }
    } else {
      visibles.value[item] = value
    }
  }

  async function setNeighborhoodPrice() {
    const neighborhoodId = location.value?.neigborhood?.neighborhood_id
    if (!neighborhoodId) return null

    try {
      const res = await fetch(`${URI}/neighborhood/${neighborhoodId}/`)
      if (!res.ok) return null
      const data = await res.json()
      location.value.neigborhood = { ...emptyNeighborhood(), ...data }
      return data
    } catch (error) {
      console.error('Error fetching neighborhood:', error)
      return null
    }
  }

  function setNeighborhoodPriceCero() {
    location.value.neigborhood = {
      ...emptyNeighborhood(),
      ...(location.value.neigborhood || {}),
      delivery_price: 0,
    }
  }

  async function fetchSiteStatus(explicitSiteId) {
    const siteId = explicitSiteId || location.value?.site?.site_id
    if (!siteId) return

    try {
      const res = await fetch(`${URI}/site/${siteId}/status`)
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
      const data = await res.json()

      const raw = data.status || 'unknown'
      let normalized = 'unknown'
      if (raw === 'open') normalized = 'open'
      else if (raw === 'closed' || raw === 'close') normalized = 'closed'

      status.value = {
        status: normalized,
        next_opening_time: data.next_opening_time || null,
        networks: data.networks || status.value.networks || null,
      }
    } catch (err) {
      status.value = {
        status: 'unknown',
        next_opening_time: null,
        networks: status.value.networks || null,
      }
    }
  }

  function initStatusWatcher() {
    if (statusTimer) return
    fetchSiteStatus()
    statusTimer = setInterval(() => { fetchSiteStatus() }, 30000)
  }

  watch(
    () => location.value?.site?.site_id,
    (newId, oldId) => {
      if (!newId || newId === oldId) return
      fetchSiteStatus(newId)
    },
    { immediate: true },
  )

  // ✅ IMPORTANTE: Retornar 'visibles' para que el componente pueda leerlo
  return {
    location,
    visibles,
    current_delivery,
    status,
    setLocation,
    updateLocation,
    setVisible,
    setNeighborhoodPrice,
    setNeighborhoodPriceCero,
    fetchSiteStatus,
    initStatusWatcher,
  }
})
// NO usar { persist: ... } aquí