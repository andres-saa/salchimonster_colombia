<template>
  <ClientOnly>
    <div class="page-container">
      <div v-if="order && order.order_id" class="receipt-card">
        <header class="receipt-header">
          <h2 class="client-name">
            🤩 {{ (order.pe_json?.cliente?.cliente_nombres || '').toUpperCase() }}
            {{ (order.pe_json?.cliente?.cliente_apellidos || '').toUpperCase() }} 🤩
          </h2>
          <p class="subtitle-msg">👇 CONFIRMA TU PEDIDO AQUÍ 👇</p>
        </header>

        <div class="receipt-body">
          <div class="order-meta-section">
            <div class="order-id-box">
              <span class="label">ORDEN ID:</span>
              <span class="value">{{ order.order_id }}</span>
            </div>

            <div class="order-dates">
              <p>
                {{ order.user_name }} {{ order.second_name }}
                {{ order.first_last_name }} {{ order.second_last_name }}
              </p>
              <small>
                <b>Fecha:</b> {{ (order.latest_status_timestamp || '').split('T')[0] }} |
                <b>Hora:</b>
                {{
                  (order.latest_status_timestamp || '')
                    .split('T')[1]
                    ?.split(':')
                    .slice(0, 2)
                    .join(':')
                }}
              </small>
            </div>
          </div>

          <div class="products-section">
            <div class="table-header">
              <span>PRODUCTOS</span>
              <span>TOTAL</span>
            </div>

            <div class="table-body">
              <div
                v-for="(product, idx) in order.pe_json?.listaPedidos"
                :key="idx"
                class="product-item-group"
              >
                <div class="product-row">
                  <div class="product-desc">
                    <span v-if="order.site_id === 32">
                      <b>({{ product.pedido_cantidad }} kg)</b> {{ product.pedido_nombre_producto }}
                    </span>
                    <span v-else>
                      <b>({{ product.pedido_cantidad }})</b> {{ product.pedido_nombre_producto }}
                    </span>
                  </div>

                  <div class="product-total">
                    {{
                      formatCurrency(
                        (product.pedido_base_price || product.pedido_precio) * product.pedido_cantidad
                      )
                    }}
                  </div>
                </div>

                <div v-if="product.lista_productocombo?.length" class="details-block">
                  <p class="details-title">COMBO INCLUYE:</p>
                  <p v-for="(c, k) in product.lista_productocombo" :key="k" class="detail-item">
                    -- <b>{{ c.pedido_cantidad }}</b> {{ c.pedido_nombre }}
                  </p>
                </div>

                <div v-if="product.modificadorseleccionList?.length" class="details-block">
                  <div
                    v-for="(mod, m) in product.modificadorseleccionList"
                    :key="m"
                    class="modifier-row"
                  >
                    <span class="detail-item">
                      - ({{ product.pedido_cantidad }}) <b>{{ mod.modificadorseleccion_cantidad }}</b>
                      {{ mod.modificadorseleccion_nombre }}
                    </span>
                    <span class="modifier-price">
                      {{
                        formatCurrency(
                          mod.pedido_precio * mod.modificadorseleccion_cantidad * product.pedido_cantidad
                        )
                      }}
                    </span>
                  </div>
                </div>

                <div class="separator"></div>
              </div>
            </div>
          </div>

          <div class="totals-section">
            <div class="total-row">
              <span>Subtotal</span>
              <b>
                {{
                  formatCurrency(
                    (order.pe_json?.delivery?.delivery_pagocon || 0) +
                      (order.pe_json?.delivery?.total_descuento || 0) -
                      (order.pe_json?.delivery?.delivery_costoenvio || 0)
                  )
                }}
              </b>
            </div>

            <div v-if="(order.pe_json?.delivery?.total_descuento || 0) > 0" class="total-row discount-text">
              <span>Descuento</span>
              <b>- {{ formatCurrency(order.pe_json.delivery.total_descuento) }}</b>
            </div>

            <div class="total-row">
              <span>Domicilio</span>
              <b>{{ formatCurrency(order.pe_json?.delivery?.delivery_costoenvio) }}</b>
            </div>

            <div class="total-row final-total">
              <span>TOTAL A PAGAR</span>
              <span>{{ formatCurrency(order.pe_json?.delivery?.delivery_pagocon) }}</span>
            </div>
          </div>

          <div class="info-section">
            <div class="section-header">DATOS DEL CLIENTE</div>
            <div class="info-grid">
              <div class="info-row">
                <span class="label">Nombre:</span>
                <span class="val">{{ order.user_name }} {{ order.first_last_name }}</span>
              </div>

              <div class="info-row" v-if="order.cedula_nit">
                <span class="label">CC/NIT:</span>
                <span class="val">{{ order.cedula_nit }}</span>
              </div>

              <div class="info-row">
                <span class="label">Teléfono:</span>
                <span class="val">{{ order.user_phone }}</span>
              </div>

              <div class="info-row" v-if="order.order_type !== 'Pasar a recoger'">
                <span class="label">Dirección:</span>
                <span class="val capitalize">{{ (order.user_address || '').toLowerCase() }}</span>
              </div>

              <div class="info-row">
                <span class="label">Método Pago:</span>
                <span class="val capitalize">{{ (order.payment_method || '').toLowerCase() }}</span>
              </div>

              <div class="info-row">
                <span class="label">Entrega:</span>
                <span class="val">{{ order.order_type }}</span>
              </div>

              <div class="info-notes" v-if="order.order_notes">
                <span class="label">Notas:</span>
                <p class="notes-text">{{ (order.order_notes || '').toLowerCase() }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ✅ Footer: solo botón de pagar (WhatsApp va flotante como el otro componente) -->
        <footer class="receipt-footer">
          <button @click="pay" class="btn btn-pay" :disabled="loadingPay">
            <i class="pi" :class="loadingPay ? 'pi-spin pi-spinner' : 'pi-ticket'"></i>
            {{ loadingPay ? 'Procesando...' : 'Pagar' }}
          </button>
        </footer>
      </div>

      <div v-else class="loading-state">
        <div v-if="isLoading" class="spinner"></div>
        <h2 v-if="isLoading">Cargando pedido...</h2>
        <h2 v-else class="error-msg">No se encontró el pedido o hubo un error.</h2>
      </div>

      <!-- ✅ WhatsApp flotante como el que me diste -->
      <a
        v-if="showWhatsappFloat"
        :href="whatsappFloatUrl"
        target="_blank"
        rel="noopener"
        class="wsp-float"
        aria-label="Abrir WhatsApp"
        title="¿Tienes dudas? Escríbenos"
      >
        <Icon size="xx-large" name="mdi:whatsapp" class="wsp-icon" />
      </a>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRuntimeConfig, useHead } from '#imports'
import { URI, SELF_URI } from '~/service/conection'

// --- Configuración ePayco ---
const config = useRuntimeConfig()
const epaycoPublicKey = config.public.epaycoPublicKey || 'ad3bfbac4531d3b82ece35e36bdf320a'

useHead({
  script: [{ src: 'https://checkout.epayco.co/checkout.js', async: true, defer: true }]
})

// --- Estado ---
const route = useRoute()
const isLoading = ref(true)
const loadingPay = ref(false)
const order = ref(null)

// --- Utils ---
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value || 0)
}

function cleanPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  // permitimos 10+ (Colombia) o 11+ (ej 1xxxxxxxxxx). Solo aseguramos que no quede corto
  return digits.length >= 10 ? digits : null
}

// --- Carga de Datos ---
onMounted(async () => {
  const orderId = route.params.order_id || route.query.order_id

  if (!orderId) {
    isLoading.value = false
    return
  }

  try {
    const data = await $fetch(`${URI}/order-by-id/${orderId}`)
    if (data && data.order_id) {
      order.value = data
    }
  } catch (error) {
    console.error('Error cargando pedido:', error)
  } finally {
    isLoading.value = false
  }
})

// --- Lógica de Pago ---
const pay = () => {
  loadingPay.value = true
  setTimeout(() => payWithEpayco(order.value.order_id), 300)
}

const payWithEpayco = (id) => {
  if (typeof window === 'undefined' || !window.ePayco) {
    alert('Cargando pasarela de pagos, intenta nuevamente.')
    loadingPay.value = false
    return
  }

  const handler = window.ePayco.checkout.configure({
    key: epaycoPublicKey,
    test: false,
    response_type: 'redirect',
    onClosed: () => {
      console.log('Modal cerrado')
      loadingPay.value = false
    }
  })

  const delivery = order.value.pe_json.delivery
  const client = order.value.pe_json.cliente

  handler.open({
    name: id,
    description: `Pedido ${id}`,
    amount: delivery.delivery_pagocon,
    currency: 'cop',
    invoice: id,
    country: 'co',
    lang: 'es',
    external: 'false',
    confirmation: `${URI}/confirmacion-epayco`,
    response: `${SELF_URI}/gracias-epayco`,
    name_billing: `${client.cliente_nombres} ${client.cliente_apellidos}`,
    address_billing: client.cliente_direccion || 'No especificada',
    type_doc_billing: 'cc',
    mobilephone_billing: client.cliente_telefono,
    methodsDisable: ['SP', 'CASH']
  })
}

// ------------------------------------------------------------------------
// ✅ WhatsApp flotante: el número viene en order.site_phone
// ------------------------------------------------------------------------
const whatsappPhone = computed(() => cleanPhone(order.value?.site_phone))

const showWhatsappFloat = computed(() => {
  // si quieres ocultarlo en iframe, descomenta y asegúrate de tener esa bandera
  // if (route.query.iframe === '1') return false
  return !!whatsappPhone.value
})

const whatsappFloatUrl = computed(() => {
  const phone = whatsappPhone.value
  if (!phone) return '#'

  const baseUrl = 'https://api.whatsapp.com/send'
  const text = `Hola 😊 Tengo una duda sobre mi orden #${order.value?.order_id || ''}`
  const params = new URLSearchParams({ phone, text })
  return `${baseUrl}?${params.toString()}`
})
</script>

<style scoped>
/* Reset */
* {
  box-sizing: border-box;
}

/* --- Layout de PÁGINA (Ya no es Modal) --- */
.page-container {
  min-height: 100vh;
  background-color: #f3f4f6;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem 1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* --- Tarjeta Estilo Recibo --- */
.receipt-card {
  background: #fff;
  width: 100%;
  max-width: 480px;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  position: relative;
  margin-bottom: 2rem;
}

/* Borde dentado decorativo (Estilo Ticket) */
.receipt-card::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 0;
  width: 100%;
  height: 5px;
  background: radial-gradient(circle, transparent, transparent 50%, #fff 50%, #fff 100%) -7px -8px /
    16px 16px repeat-x;
}

/* --- Encabezado --- */
.receipt-header {
  padding: 2rem 1rem 1rem;
  text-align: center;
  border-bottom: 2px dashed #eee;
}

.client-name {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
  color: #111;
  line-height: 1.2;
}

.subtitle-msg {
  font-size: 1rem;
  font-weight: 700;
  color: #444;
  margin: 0;
}

/* --- Cuerpo --- */
.receipt-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* --- Meta Data --- */
.order-meta-section {
  text-align: center;
}
.order-id-box {
  background: #f3f4f6;
  display: inline-block;
  padding: 0.3rem 1rem;
  border-radius: 4px;
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}
.order-dates {
  font-size: 0.85rem;
  color: #555;
}
.order-dates p {
  margin: 0;
  font-weight: 600;
  font-size: 1rem;
  color: #000;
}

/* --- Tabla Productos --- */
.table-header {
  background: #000;
  color: #fff;
  padding: 0.5rem 0.75rem;
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 0.85rem;
  border-radius: 4px 4px 0 0;
}

.table-body {
  border: 1px solid #eee;
  border-top: none;
  padding: 0.5rem;
}

.product-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
}

.product-desc {
  line-height: 1.3;
  flex: 1;
  padding-right: 0.5rem;
}
.product-total {
  font-weight: 600;
  white-space: nowrap;
}

.details-block {
  padding-left: 1rem;
  font-size: 0.85rem;
  color: #555;
  margin-bottom: 0.25rem;
}
.details-title {
  font-weight: 700;
  font-size: 0.75rem;
  margin: 0.2rem 0;
}
.detail-item {
  margin: 0;
}

.modifier-row {
  display: flex;
  justify-content: space-between;
}
.separator {
  height: 1px;
  background: #eee;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* --- Totales --- */
.totals-section {
  border-top: 2px solid #000;
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
}

.final-total {
  font-size: 1.25rem;
  font-weight: 800;
  margin-top: 0.5rem;
}

.discount-text {
  color: #dc2626;
}

/* --- Información Cliente --- */
.info-section {
  margin-top: 0.5rem;
}
.section-header {
  background: #000;
  color: #fff;
  font-weight: 700;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.info-grid {
  display: grid;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.info-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: baseline;
}
.info-row .label {
  font-weight: 700;
  color: #444;
}
.info-notes {
  margin-top: 0.5rem;
}
.notes-text {
  margin: 0;
}
.capitalize {
  text-transform: capitalize;
}

/* --- Footer --- */
.receipt-footer {
  padding: 1.5rem;
  background: #f9fafb;
  border-top: 1px solid #eee;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  border-radius: 0 0 0.75rem 0.75rem;
}

.btn {
  border: none;
  border-radius: 0.5rem;
  padding: 1rem;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  transition: transform 0.1s;
}
.btn:active {
  transform: scale(0.98);
}

.btn-pay {
  background-color: #000;
  color: #fff;
  flex: 1;
}
.btn-pay:disabled {
  background-color: #555;
  cursor: not-allowed;
}

/* --- Loading / Error --- */
.loading-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 80vh;
  width: 100%;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ddd;
  border-top: 4px solid #000;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-msg {
  color: #dc2626;
}

/* ✅ WhatsApp flotante (igual al otro) */
.wsp-float {
  position: fixed;
  right: 16px;
  bottom: 80px;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: #25d366;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
  z-index: 9999;
  transition: transform 0.12s ease, opacity 0.2s ease;
}

.wsp-float:hover {
  transform: scale(1.05);
}

.wsp-float:active {
  transform: scale(0.98);
}

.wsp-icon :deep(svg) {
  width: 40px;
  height: 28px;
  display: block;
}
</style>
