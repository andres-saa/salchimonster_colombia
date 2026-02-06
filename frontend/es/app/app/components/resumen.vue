<template>
  <div class="summary-wrapper">
    <div class="summary-card">
      <div class="card-header">
        <h5 class="title">Resumen</h5>
      </div>

      <!-- Indicador de cuponera/cupón activo -->
      <div v-if="store.applied_cuponera || store.applied_coupon" class="active-discount-banner">
        <div class="discount-icon">
          <i class="pi" :class="(store.applied_cuponera?.buy_m_pay_n) ? 'pi-shopping-cart' : 'pi-tag'"></i>
        </div>
        <div class="discount-info">
          <span class="discount-name">
            {{ store.applied_cuponera?.discount_name || store.applied_cuponera?.cuponera_name || store.applied_coupon?.discount_name || store.applied_coupon?.name || 'Descuento' }}
          </span>
          <!-- Lleva M paga N: bloque dedicado más legible -->
          <template v-if="store.applied_cuponera?.buy_m_pay_n">
            <div class="discount-lleva-paga">
              <span class="lleva-paga-main">
                Lleva <strong>{{ store.applied_cuponera.m }}</strong> · paga <strong>{{ store.applied_cuponera.n }}</strong>
              </span>
              <span class="lleva-paga-hint">{{ store.applied_cuponera.m - store.applied_cuponera.n }} {{ (store.applied_cuponera.m - store.applied_cuponera.n) === 1 ? 'unidad gratis' : 'unidades gratis' }} por cada {{ store.applied_cuponera.m }}</span>
              <span class="discount-scope" v-if="store.applied_cuponera?.discount_categories?.length">
                En: {{ store.applied_cuponera.discount_categories.map(c => c.name).join(', ') }}
              </span>
              <span class="discount-scope" v-else-if="store.applied_cuponera?.discount_products?.length">
                En: {{ store.applied_cuponera.discount_products.map(p => p.name).join(', ') }}
              </span>
            </div>
          </template>
          <template v-else>
            <span class="discount-detail" v-if="store.applied_cuponera?.percent || store.applied_coupon?.percent">
              {{ store.applied_cuponera?.percent || store.applied_coupon?.percent }}% de descuento
            </span>
            <span class="discount-detail" v-else-if="store.applied_cuponera?.amount || store.applied_coupon?.amount">
              {{ formatoPesosColombianos(store.applied_cuponera?.amount || store.applied_coupon?.amount) }} de descuento
            </span>
            <span class="discount-scope" v-if="store.applied_cuponera?.discount_categories?.length && !store.applied_cuponera?.free_product">
              En: {{ store.applied_cuponera.discount_categories.map(c => c.name).join(', ') }}
            </span>
          </template>
        </div>
      </div>

      <div class="product-list">
        <div 
          v-for="product in store.cart" 
          :key="product.productogeneral_id || product.signature" 
          class="product-item"
          :class="{ 'has-discount': product.pedido_descuento > 0 }"
        >
          <div class="product-main-row">
            <div class="product-info">
              <span class="qty-badge">( {{ product.pedido_cantidad }} )</span>
              <span class="product-name">
                {{ formatName(product.pedido_nombre_producto) }}
              </span>
            </div>
            
            <div class="product-price">
              <!-- Precio original tachado si hay descuento -->
              <template v-if="product.pedido_descuento > 0">
                <span class="original-price">
                  {{ formatoPesosColombianos(getProductSubtotal(product)) }}
                </span>
                <span class="discounted-price">
                  {{ formatoPesosColombianos(getProductSubtotal(product) - (product.pedido_descuento * product.pedido_cantidad)) }}
                </span>
              </template>
              <template v-else>
                <span v-if="product.modificadorseleccionList.length < 1">
                  {{ formatoPesosColombianos(product.pedido_base_price * product.pedido_cantidad) }}
                </span>
                <span v-else>
                  {{ formatoPesosColombianos(store.calculateSubtotalProduct(product)) }}
                </span>
              </template>
            </div>
          </div>

          <!-- Badge de descuento por producto (aviso de producto gratis va aquí en la línea del producto) -->
          <div v-if="product.pedido_descuento > 0" class="product-discount-block" :class="{ 'badge-lleva-paga': store.applied_cuponera?.buy_m_pay_n, 'badge-free-item': store.applied_cuponera?.free_product && !store.applied_cuponera?.buy_m_pay_n }">
            <div class="product-discount-badge">
              <template v-if="store.applied_cuponera?.buy_m_pay_n">
                <i class="pi pi-shopping-cart"></i>
                <span>{{ getLlevaPagaFreeUnits(product) }} gratis</span>
              </template>
              <template v-else-if="store.applied_cuponera?.free_product && isFreeProductItem(product)">
                <i class="pi pi-gift"></i>
                <span>Gratis · Incluido por cuponera</span>
              </template>
              <template v-else-if="store.applied_cuponera?.free_product">
                <i class="pi pi-gift"></i>
                <span>Gratis</span>
              </template>
              <template v-else>
                <i class="pi pi-percentage"></i>
                <span>-{{ formatoPesosColombianos(product.pedido_descuento * product.pedido_cantidad) }}</span>
              </template>
            </div>
            <!-- Aviso de requisito solo en la línea del producto gratis -->
            <div v-if="store.applied_cuponera?.free_product && isFreeProductItem(product) && (store.applied_cuponera._requiresPurchaseMinSubtotal || store.applied_cuponera.requires_purchase?.min_subtotal)" class="product-free-requirement">
              Compra mínimo {{ formatoPesosColombianos(store.applied_cuponera._requiresPurchaseMinSubtotal || store.applied_cuponera.requires_purchase?.min_subtotal) }} en {{ (store.applied_cuponera.discount_categories || []).map(c => c.name).join(', ') || 'productos seleccionados' }} y te lo regalamos.
            </div>
          </div>

          <div 
            v-if="product.lista_productocombo && product.lista_productocombo.length > 0"
            class="combo-list"
          >
            <div 
              v-for="comboItem in product.lista_productocombo" 
              :key="comboItem.producto_id"
              class="combo-item"
            >
              <span class="combo-qty">( {{ product.pedido_cantidad }} ) <b>{{ parseInt(comboItem.pedido_cantidad) }}</b></span>
              <span class="combo-name">{{ formatName(comboItem.pedido_nombre) }}</span>
            </div>
          </div>

          <div 
            v-if="product.modificadorseleccionList && product.modificadorseleccionList.length > 0"
            class="additions-list"
          >
            <div 
              v-for="item in product.modificadorseleccionList" 
              :key="item.modificadorseleccion_id || item.modificadorseleccion_nombre"
              class="addition-row"
            >
              <div class="addition-name">
                - ( {{ product.pedido_cantidad }} ) <b>{{ item.modificadorseleccion_cantidad }}</b> {{ formatName(item.modificadorseleccion_nombre) }}
              </div>
              <div v-if="item.pedido_precio > 0" class="addition-price">
                {{ formatoPesosColombianos(item.pedido_precio * item.modificadorseleccion_cantidad * product.pedido_cantidad) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="summary-totals">
        <div class="total-row">
          <span class="label">Subtotal</span>
          <span class="value">{{ formatoPesosColombianos(store.cartSubtotal) }}</span>
        </div>

        <!-- Desglose de descuento mejorado -->
        <div class="total-row discount-row" v-if="store.cartTotalDiscount > 0">
          <div class="discount-label-wrapper">
            <span class="label discount">
              <i class="pi pi-tag"></i>
              Descuento
            </span>
            <span class="discount-source" v-if="store.applied_cuponera?.code || store.applied_coupon?.code">
              ({{ store.applied_cuponera?.code || store.applied_coupon?.code }})
            </span>
          </div>
          <span class="value discount">- {{ formatoPesosColombianos(store.cartTotalDiscount) }}</span>
        </div>

        <div class="total-row" v-if="siteStore?.location?.site?.site_id != 33">
          <div class="label-wrapper">
            <span class="label" :class="{ 'strike': deliveryPrice === 0 && !isEditingDelivery }">
               Domicilio
             </span>
             <button 
               v-if="isLoggedIn" 
               type="button" 
               class="edit-btn" 
               @click="toggleEditDelivery"
             >
               {{ isEditingDelivery ? 'Guardar' : 'Cambiar' }}
             </button>
          </div>
          
          <div class="value">
            <div v-if="isEditingDelivery">
          <input type="number" v-model.number="deliveryPrice" />
            </div>

            <div v-else>
              <template v-if="siteStore.location.neigborhood.delivery_price === 0">
                 <span class="free-delivery">
                   {{ route.path.includes('reservas') ? 'Ir a la sede' : 'Recoger en local' }}
                 </span>
              </template>
              <template v-else-if="siteStore.location.neigborhood.delivery_price > 0">
                {{ formatoPesosColombianos(siteStore.location.neigborhood.delivery_price) }}
              </template>
            </div>
          </div>
        </div>

        <div class="total-row final-total">
          <span class="label">Total</span>
          <span class="value">
         {{ formatoPesosColombianos(store.cartTotal + (deliveryPrice || 0)) }}
          </span>
        </div>

        <!-- Ahorro total -->
        <div v-if="store.cartTotalDiscount > 0" class="savings-banner">
          <i class="pi pi-check-circle"></i>
          <span>¡Estás ahorrando {{ formatoPesosColombianos(store.cartTotalDiscount) }}!</span>
        </div>
      </div>

      <div class="actions-container">
        
        <div v-if="siteStore.status?.status == 'closed' && route.path != '/reservas' && !isLoggedIn" class="closed-alert">
          <i class="pi pi-clock"></i> Cerrado, abre a las {{ siteStore.status.next_opening_time }}
        </div>

        <div v-if="!minPurchaseValidation.valid && route.path.includes('/pay')" class="closed-alert" style="background-color: #fef2f2; border-color: #fecaca; color: #b91c1c;">
          <i class="pi pi-exclamation-triangle"></i> {{ minPurchaseValidation.message }}
        </div>

        <div v-if="!hasProducts && route.path.includes('/pay')" class="closed-alert" style="background-color: #fef2f2; border-color: #fecaca; color: #b91c1c;">
          <i class="pi pi-shopping-cart"></i> Agrega productos al carrito para continuar
        </div>

        <div class="buttons-stack">

            <NuxtLink to="/" v-if="route.path.includes('cart')" class="link-wrapper">
                <button type="button" class="btn btn-text">
                    Volver al menú
                </button>
            </NuxtLink>

            <NuxtLink to="/cart" v-else-if="route.path != '/reservas' && !route.path.includes('/pay')" class="link-wrapper">
                <button type="button" class="btn btn-text">
                    Volver al carrito
                </button>
            </NuxtLink>

            <NuxtLink 
                to="/pay" 
                v-if="route.path.includes('cart') && canPurchase && route.path == '/reservas'"
                class="link-wrapper"
            >
                <button type="button" class="btn btn-primary">
                    Pedir
                </button>
            </NuxtLink>

            <NuxtLink to="/pay" v-else-if="route.path.includes('/cart') && !route.path.includes('/pay') && hasProducts" class="link-wrapper">
                <button type="button" class="btn btn-primary">
Finalizar pedido
                </button>
            </NuxtLink>

            <button
                v-else-if="route.path.includes('/pay') && !reportes.loading.visible && canPurchase && (isLoggedIn || user.user.payment_method_option?.id != 9)"
                type="button"
                class="btn btn-primary"
                :disabled="reportes.loading.visible || !canProceedToPayment"
                @click="orderService.sendOrder()"
            >
                <span v-if="reportes.loading.visible">Procesando...</span>
                <span v-else>
                    {{ isLoggedIn ? 'Generar Pedido / Link' : 'Finalizar pedido' }}
                </span>
            </button>

            <button
                v-else-if="route.path.includes('/pay') && !reportes.loading.visible && canPurchase && !isLoggedIn && user.user.payment_method_option?.id == 9"
                type="button"
                class="btn btn-primary"
                :disabled="reportes.loading.visible || !canProceedToPayment"
                @click="pay"
            >
                <span v-if="reportes.loading.visible">Procesando...</span>
                <span v-else>Pagar con tarjeta</span>
            </button>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useHead } from '#imports'
import { formatoPesosColombianos } from '~/service/utils/formatoPesos'
import { usecartStore, useSitesStore, useUserStore, useReportesStore } from '#imports'
import { orderService } from '@/service/order/orderService.ts'
import { orderServiceEpayco } from '@/service/order/orderServiceEpayco'
import { URI, SELF_URI } from '@/service/conection'

// --- Script ePayco (necesario solo para usuarios no logueados que paguen con tarjeta) ---
useHead({
  script: [
    {
      src: 'https://checkout.epayco.co/checkout.js',
      async: true,
      defer: true
    }
  ]
})


const deliveryPrice = computed({
  get: () => {
    const ad = store.address_details || siteStore.location?.address_details
    
    // 1) Priorizar delivery_pricing.price (nuevo sistema LocationManager)
    if (ad?.delivery_pricing?.price != null) {
      return Number(ad.delivery_pricing.price) || 0
    }
    
    // 2) Priorizar Rappi validation (sistema anterior)
    if (ad?.rappi_validation?.estimated_price != null) {
      return Number(ad.rappi_validation.estimated_price) || 0
    }
    
    // 3) Barrios (lo normal)
    const nb = siteStore.location?.neigborhood
    if (nb && nb.delivery_price != null) return Number(nb.delivery_price) || 0

    // 4) Google (coverage-details) - delivery_cost_cop
    if (ad && ad.delivery_cost_cop != null) return Number(ad.delivery_cost_cop) || 0

    // 5) fallback extra (por si lo guardaste en user.site)
    const u = user.user?.site
    if (u?.delivery_pricing?.price != null) {
      return Number(u.delivery_pricing.price) || 0
    }
    if (u?.rappi_validation?.estimated_price != null) {
      return Number(u.rappi_validation.estimated_price) || 0
    }
    if (u && u.delivery_cost_cop != null) return Number(u.delivery_cost_cop) || 0

    return 0
  },
  set: (v) => {
    // Si estás editando manualmente, garantizamos que exista neigborhood
    if (!siteStore.location.neigborhood) siteStore.location.neigborhood = {}
    siteStore.location.neigborhood.delivery_price = Math.max(0, Number(v) || 0)
  }
})



const reportes = useReportesStore()
const route = useRoute()
const store = usecartStore()
const siteStore = useSitesStore()
const user = useUserStore()
const order_id = ref('')
const epaycoPublicKey = 'ad3bfbac4531d3b82ece35e36bdf320a'

// --- LÓGICA DE LOGIN Y EDICIÓN DE DOMICILIO ---
const isEditingDelivery = ref(false)

const isLoggedIn = computed(() => {
  return !!user.user?.token && !!user.user?.inserted_by
})

// Si hay usuario logueado (admin), puede comprar aunque la sede esté cerrada
const canPurchase = computed(() => {
  return siteStore.status?.status !== 'closed' || isLoggedIn.value
})

const toggleEditDelivery = () => {
  isEditingDelivery.value = !isEditingDelivery.value
}
// ---------------------------------------------

const formatName = (str) => {
  if (!str) return ''
  const lower = str.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

// Calcular subtotal de un producto (precio base + adiciones)
const getProductSubtotal = (product) => {
  const basePrice = Number(product.pedido_base_price) || 0
  const qty = Number(product.pedido_cantidad) || 1
  
  let adiciones = 0
  if (Array.isArray(product.modificadorseleccionList)) {
    adiciones = product.modificadorseleccionList.reduce(
      (total, item) => total + (Number(item.pedido_precio) || 0) * (Number(item.modificadorseleccion_cantidad) || 1),
      0
    )
  }
  
  return (basePrice + adiciones) * qty
}

// Saber si este ítem es el producto gratis de la cuponera
const isFreeProductItem = (product) => {
  const fp = store.applied_cuponera?.free_product
  if (!fp?.product_id) return false
  const pid = String(product.pedido_productoid || product.producto_id || product.productogeneral_id || '')
  return pid === String(fp.product_id)
}

// Unidades gratis en este ítem por promo Lleva M paga N (100% descuento en algunas unidades)
const getLlevaPagaFreeUnits = (product) => {
  const basePrice = Number(product.pedido_base_price) || 0
  if (basePrice <= 0) return 0
  const qty = Number(product.pedido_cantidad) || 1
  const totalDiscount = (Number(product.pedido_descuento) || 0) * qty
  return Math.round(totalDiscount / basePrice)
}

// Validar monto mínimo de compra del cupón
const validateMinPurchase = () => {
  const coupon = store.applied_coupon
  if (!coupon || !coupon.min_purchase || coupon.min_purchase <= 0) {
    return { valid: true, message: null }
  }
  
  const subtotal = store.cartSubtotal
  if (subtotal < coupon.min_purchase) {
    return {
      valid: false,
      message: `El monto mínimo de compra para este cupón es: ${formatoPesosColombianos(coupon.min_purchase)}`
    }
  }
  
  return { valid: true, message: null }
}

const minPurchaseValidation = computed(() => validateMinPurchase())
const hasProducts = computed(() => (store.cart?.length || 0) > 0)
const canProceedToPayment = computed(() => {
  return minPurchaseValidation.value.valid && hasProducts.value
})

onMounted(() => {
  if (user.user.payment_method_option?.id != 7 && !route.path.includes('reservas')) {
    siteStore.setNeighborhoodPrice()
  } else {
    siteStore.setNeighborhoodPriceCero()
  }
})

watch(() => store.cart, () => {
  // Revalidar cupón si hay uno aplicado y el carrito cambia
  if (store.applied_coupon && store.applied_coupon.min_purchase) {
    const validation = validateMinPurchase()
    if (!validation.valid) {
      // Si no cumple el mínimo, remover el cupón
      store.removeCoupon()
    }
  }
}, { deep: true })

watch(() => store.applied_coupon, (newCoupon) => {
  // Validar cuando se aplica un cupón nuevo
  if (newCoupon && newCoupon.min_purchase) {
    const validation = validateMinPurchase()
    if (!validation.valid) {
      store.removeCoupon()
    }
  }
}, { deep: true })

const pay = async () => {
  if (typeof window !== 'undefined' && !window.ePayco) {
      console.warn('El SDK de ePayco aun no ha cargado.')
      alert('Cargando pasarela de pagos, intenta de nuevo en un momento...')
      return
  }

  order_id.value = await orderServiceEpayco.sendOrder()
  
  // if (!order_id.value) return
  // payWithEpayco(order_id.value)
}

const payWithEpayco = (id) => {
  if (typeof window === 'undefined' || !window.ePayco) {
      console.error('ePayco SDK no cargado')
      return
  }

  // const handler = window.ePayco.checkout.configure({
  //   key: epaycoPublicKey,
  //   test: false,
  //   response_type: 'redirect',
  //   onClosed: () => console.log('Modal cerrado')
  // })

  // Usamos el precio del domicilio del store (que pudo ser editado manualmente)
  const totalAPagar = store.cartTotal + (deliveryPrice.value || 0)

  handler.open({
    name: id,
    description: `Pedido ${id}`,
    amount: totalAPagar,
    currency: siteStore?.location?.site?.time_zone === 'America/New_York' ? 'usd' : 'cop',
    invoice: id,
    country: 'co',
    lang: 'es',
    external: 'false',
    confirmation: `${URI}/confirmacion-epayco`,
    response: `${SELF_URI}/gracias-epayco`,
    name_billing: user.user.name || '',
    address_billing: user.user.address || '',
    type_doc_billing: 'cc',
    mobilephone_billing: user.user.phone_number || '',
    email_billing: user.user.email || '',
    methodsDisable: ['SP', 'CASH']
  })
}
</script>

<style scoped>
/* --- Card --- */
.summary-card {
  background-color: var(--bg-card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
  padding: 1.5rem;
  position: sticky;
  top: 6rem;
  transition: all 0.3s ease;
}

.title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1rem;
}

/* --- Lista de Productos --- */
.product-list {
  display: flex;
  flex-direction: column;
  padding-right: 0.5rem;
}

.product-list::-webkit-scrollbar { width: 4px; }
.product-list::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 4px; }

.product-item {
  border-bottom: 3px dashed var(--border-color);
  padding: .5rem 0;
}
.product-item:last-child { border-bottom: none; padding-bottom: 0; }

.product-main-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 0.95rem;
  color: var(--text-main);
  margin-bottom: 0.25rem;
}

.product-info { display: flex; gap: 0.5rem; }

.qty-badge {
  font-weight: 600;
  min-width: 24px;
  color: var(--primary);
  min-width: max-content;
}

.product-name {
  font-weight: 500;
  line-height: 1.4;
}

.product-price {
  font-weight: 600;
  white-space: nowrap;
  margin-left: 0.5rem;
}

/* --- Combos y Adiciones --- */
.combo-list, .additions-list {
  margin-left: 1.8rem;
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.combo-item, .addition-row {
  display: flex;
  justify-content: start;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.combo-qty { font-weight: 600; margin-right: 0.5rem; }
.addition-price { font-weight: 500; white-space: nowrap; margin-left: 0.5rem; }

/* --- Totales --- */
.divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 1.5rem 0;
}

.summary-totals {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  color: var(--text-main);
}

.label { color: var(--text-secondary); }
.value { font-weight: 600; }

.discount { color: var(--success-text); }
.strike { text-decoration: line-through; opacity: 0.6; }
.free-delivery { color: var(--success-text); font-weight: 700; font-size: 0.8rem; }

/* --- Banner de descuento activo --- */
.active-discount-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #6ee7b7;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.discount-icon {
  background: #10b981;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.discount-icon i { font-size: 0.9rem; }

.discount-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.discount-name {
  font-weight: 700;
  color: #065f46;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.discount-detail {
  font-size: 0.8rem;
  color: #047857;
  font-weight: 500;
}

.discount-scope {
  font-size: 0.75rem;
  color: #059669;
  font-style: italic;
}
/* Lleva M paga N: bloque dedicado */
.discount-lleva-paga {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.15rem;
}
.lleva-paga-main {
  font-size: 0.95rem;
  color: #047857;
  font-weight: 600;
}
.lleva-paga-main strong {
  color: #065f46;
  font-weight: 700;
}
.lleva-paga-hint {
  font-size: 0.75rem;
  color: #059669;
  opacity: 0.95;
}
.discount-lleva-paga .discount-scope {
  margin-top: 0.1rem;
}

/* --- Producto con descuento --- */
.product-item.has-discount {
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
  border-radius: 8px;
  padding: 0.5rem;
  margin: 0 -0.5rem;
  border-left: 3px solid #eab308;
}

.product-discount-block {
  margin-top: 0.25rem;
  margin-left: 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.product-discount-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #dc2626;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.product-discount-badge i { font-size: 0.6rem; }

.product-free-requirement {
  font-size: 0.7rem;
  color: #0d9488;
  line-height: 1.3;
}

.product-discount-block.badge-lleva-paga .product-discount-badge {
  background: #059669;
  color: white;
}

.product-discount-block.badge-free-item .product-discount-badge {
  background: #7c3aed;
  color: white;
}

.original-price {
  text-decoration: line-through;
  color: #9ca3af;
  font-size: 0.8rem;
  margin-right: 0.5rem;
}

.discounted-price {
  color: #dc2626;
  font-weight: 700;
}

/* --- Fila de descuento mejorada --- */
.discount-row {
  background: #f0fdf4;
  padding: 0.5rem;
  border-radius: 6px;
  margin: 0 -0.5rem;
}

.discount-label-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.discount-label-wrapper .label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.discount-label-wrapper i { font-size: 0.8rem; }

.discount-source {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 500;
}

/* --- Banner de ahorro --- */
.savings-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.6rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 0.75rem;
}

.savings-banner i { font-size: 1rem; }

.final-total {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 2px solid var(--border-color);
  font-size: 1.25rem;
}
.final-total .label { color: var(--text-main); font-weight: 700; }
.final-total .value { font-weight: 800; }

/* --- ESTILOS EDICIÓN DOMICILIO --- */
.label-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.edit-btn {
  background: none;
  border: 1px solid var(--primary);
  color: var(--primary);
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.edit-btn:hover {
  background-color: var(--primary);
  color: white;
}

.delivery-input {
  width: 100px;
  padding: 0.2rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: right;
  font-weight: 600;
  outline: none;
}

.delivery-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.delivery-input::-webkit-outer-spin-button,
.delivery-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.delivery-input[type=number] {
  -moz-appearance: textfield;
}

/* --- Botones --- */
.actions-container { margin-top: 2rem; }

.closed-alert {
  background-color: var(--danger-bg);
  color: var(--danger-text);
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 1rem;
  border: 1px solid #fecaca;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.buttons-stack { 
    display: flex; 
    flex-direction: column-reverse; 
    gap: 0.75rem; 
}

.btn {
  width: 100%;
  padding: 0.875rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
  border: 1px solid var(--primary);
}
.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

.btn-text {
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
}
.btn-text:hover {
  color: var(--text-main);
  text-decoration: underline;
  background-color: #f9fafb;
}

.link-wrapper { text-decoration: none; display: block; width: 100%; }

@media (max-width: 768px) {
  .summary-card {
    position: relative;
    top: 0;
    box-shadow: none;
    border: none;
 box-shadow: var(--shadow);
    padding: 1rem;
  }
  .summary-wrapper { padding: 0; margin-top: 2rem; }
  .final-total { font-size: 1.1rem; }
   
}
</style>