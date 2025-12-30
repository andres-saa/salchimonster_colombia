<!-- pages/gracias-epayco.vue -->
<template>
  <ClientOnly>
    <div class="page">
      <div class="card" v-if="!isLoading && (hasOrder || hasEpayco)">
        <!-- ===== HEADER ===== -->
        <header class="header">
          <h1 class="title">Estado del pago</h1>

          <div class="status-badge" :class="statusClass">
            {{ statusLabel }}
          </div>

          <p class="subtitle" v-if="epaycoPayload?.title_response || epaycoPayload?.text_response">
            <b>{{ epaycoPayload?.title_response || '' }}</b>
            <span v-if="epaycoPayload?.text_response"> — {{ epaycoPayload.text_response }}</span>
          </p>

          <p class="reason" v-if="epaycoData?.x_response_reason_text">
            {{ epaycoData.x_response_reason_text }}
          </p>

          <div class="order-id" v-if="order?.order_id">
            <span>ORDEN</span>
            <b>{{ order.order_id }}</b>
          </div>

          <p class="meta" v-if="order?.latest_status_timestamp">
            <b>Fecha:</b> {{ (order.latest_status_timestamp || '').split('T')[0] || '-' }}
            <span class="dot">•</span>
            <b>Hora:</b>
            {{
              (order.latest_status_timestamp || '')
                .split('T')[1]
                ?.split(':')
                ?.slice(0, 2)
                ?.join(':') || '-'
            }}
          </p>
        </header>

        <!-- ===== BODY ===== -->
        <section class="section" v-if="order?.order_id">
          <h2 class="section-title">Productos</h2>

          <div class="products">
            <div
              class="product"
              v-for="(p, idx) in (order.pe_json?.listaPedidos || [])"
              :key="p.signature || p.pedido_productoid || idx"
            >
              <div class="row">
                <div class="left">
                  <div class="name">
                    <b>({{ p.pedido_cantidad }})</b> {{ p.pedido_nombre_producto }}
                  </div>

                  <div class="sub" v-if="p.lista_productocombo?.length">
                    <div class="sub-title">Combo incluye:</div>
                    <div class="sub-item" v-for="(c, k) in p.lista_productocombo" :key="k">
                      — <b>{{ c.pedido_cantidad }}</b> {{ c.pedido_nombre }}
                    </div>
                  </div>

                  <div class="sub" v-if="p.modificadorseleccionList?.length">
                    <div class="sub-title">Adicionales:</div>
                    <div
                      class="sub-item sub-item--between"
                      v-for="(m, k) in p.modificadorseleccionList"
                      :key="m.modificadorseleccion_id || m.modificadorseleccion_nombre || k"
                    >
                      <span>
                        — <b>{{ m.modificadorseleccion_cantidad }}</b> {{ m.modificadorseleccion_nombre }}
                      </span>
                      <span v-if="Number(m.pedido_precio) > 0" class="sub-price">
                        + {{ pesos(m.pedido_precio * m.modificadorseleccion_cantidad * p.pedido_cantidad) }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="right">
                  <div class="price">
                    {{ pesos((p.pedido_base_price || p.pedido_precio || 0) * (p.pedido_cantidad || 0)) }}
                  </div>
                </div>
              </div>

              <div class="divider"></div>
            </div>
          </div>
        </section>

        <section class="section" v-if="order?.order_id">
          <h2 class="section-title">Totales</h2>

          <div class="totals">
            <div class="tot-row">
              <span>Subtotal</span>
              <b>{{ pesos(calcSubtotal()) }}</b>
            </div>

            <div class="tot-row" v-if="Number(order.pe_json?.delivery?.total_descuento || 0) > 0">
              <span>Descuento</span>
              <b class="red">- {{ pesos(order.pe_json.delivery.total_descuento) }}</b>
            </div>

            <div class="tot-row">
              <span>Domicilio</span>
              <b>{{ pesos(order.pe_json?.delivery?.delivery_costoenvio || 0) }}</b>
            </div>

            <div class="tot-row tot-row--final">
              <span>Total a pagar</span>
              <b>{{ pesos(order.pe_json?.delivery?.delivery_pagocon || 0) }}</b>
            </div>
          </div>
        </section>

        <!-- ===== EPAYCO INFO (SIEMPRE) ===== -->
        <section class="section" v-if="hasEpayco">
          <h2 class="section-title">Información de pago (ePayco)</h2>

          <div class="pay-box">
            <div class="pay-row">
              <span class="label">Ref. Comercio</span>
              <span class="val">{{ epaycoData?.x_id_factura || epaycoData?.x_id_invoice || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Ref. ePayco</span>
              <span class="val">{{ epaycoData?.x_ref_payco || refPayco || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Transacción</span>
              <span class="val">{{ epaycoData?.x_transaction_id || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Fecha</span>
              <span class="val">{{ epaycoData?.x_transaction_date || epaycoData?.x_fecha_transaccion || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Estado</span>
              <span class="val" :class="statusTextClass">
                {{ epaycoData?.x_transaction_state || '-' }}
              </span>
            </div>

            <div class="pay-row">
              <span class="label">Respuesta</span>
              <span class="val">{{ epaycoData?.x_response || epaycoData?.x_respuesta || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Motivo</span>
              <span class="val">{{ epaycoData?.x_response_reason_text || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Banco</span>
              <span class="val">{{ epaycoData?.x_bank_name || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Tarjeta</span>
              <span class="val">{{ epaycoData?.x_cardnumber || '-' }}</span>
            </div>

            <div class="pay-row">
              <span class="label">Monto</span>
              <span class="val">{{ pesos(epaycoData?.x_amount_ok ?? epaycoData?.x_amount ?? 0) }}</span>
            </div>

            <a
              v-if="refPayco"
              class="btn btn-ghost"
              :href="`https://secure.epayco.co/landingresume?ref_payco=${refPayco}`"
              target="_blank"
              rel="noreferrer"
            >
              Ver comprobante (ePayco)
            </a>
          </div>
        </section>

        <!-- ===== ACTIONS ===== -->
        <footer class="actions">
          <NuxtLink class="btn btn-black" to="/">
            Volver al menú
          </NuxtLink>
        </footer>
      </div>

      <!-- ===== LOADING / ERROR ===== -->
      <div class="state" v-else>
        <div v-if="isLoading" class="spinner"></div>
        <h2 v-if="isLoading">Cargando…</h2>

        <div v-else class="error">
          <h2>No se pudo cargar la información</h2>
          <p>Si necesitas ayuda, escríbenos por WhatsApp.</p>
          <NuxtLink class="btn btn-black" to="/">Volver al menú</NuxtLink>
        </div>
      </div>

      <!-- ✅ WhatsApp flotante (igual al otro componente) -->
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from '#imports'

const URI = 'https://backend.salchimonster.com'

const route = useRoute()
const isLoading = ref(true)

const refPayco = computed(() => String(route.query?.ref_payco || ''))
const order = ref(null)

// Guarda TODO el payload que devuelve ePayco (incluye success/title_response/...)
const epaycoPayload = ref(null)
// Guarda SOLO el detalle (payload.data)
const epaycoData = ref(null)

const hasOrder = computed(() => !!order.value?.order_id)
const hasEpayco = computed(() => !!epaycoData.value)

const pesos = (v) => {
  const n = Number(v || 0)
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(n)
}

const calcSubtotal = () => {
  const d = order.value?.pe_json?.delivery || {}
  const pagocon = Number(d.delivery_pagocon || 0)
  const envio = Number(d.delivery_costoenvio || 0)
  const desc = Number(d.total_descuento || 0)
  return pagocon + desc - envio
}

// ===== Detectar estado con tu respuesta real =====
const paymentKind = computed(() => {
  const d = epaycoData.value || {}
  const state = String(d.x_transaction_state || '').toLowerCase()
  const resp = String(d.x_response || d.x_respuesta || '').toLowerCase()
  const type = String(d.x_type_payment || '').toLowerCase()
  const codState = Number(d.x_cod_transaction_state ?? NaN)
  const codResp = Number(d.x_cod_response ?? d.x_cod_respuesta ?? NaN)

  if (state.includes('acept') || resp.includes('acept') || codResp === 1) return 'ok'
  if (state.includes('cancel') || type === 'canceled' || codState === 11) return 'canceled'
  if (resp.includes('rechaz') || state.includes('rechaz') || codResp === 2) return 'failed'

  return hasEpayco.value ? 'unknown' : 'none'
})

const statusLabel = computed(() => {
  switch (paymentKind.value) {
    case 'ok': return 'Pago aprobado ✅'
    case 'canceled': return 'Pago cancelado ⚠️'
    case 'failed': return 'Pago rechazado ❌'
    case 'unknown': return 'Pago en revisión'
    default: return 'Sin información'
  }
})

const statusClass = computed(() => {
  switch (paymentKind.value) {
    case 'ok': return 'ok'
    case 'canceled': return 'warn'
    case 'failed': return 'bad'
    case 'unknown': return 'neutral'
    default: return 'neutral'
  }
})

const statusTextClass = computed(() => {
  switch (paymentKind.value) {
    case 'ok': return 'green'
    case 'canceled': return 'orange'
    case 'failed': return 'red'
    default: return ''
  }
})

// ------------------------------------------------------------------------
// ✅ WhatsApp flotante: teléfono viene en la orden (site_phone)
// ------------------------------------------------------------------------
function cleanPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

const whatsappPhone = computed(() => cleanPhone(order.value?.site_phone))

const showWhatsappFloat = computed(() => !!whatsappPhone.value)

const whatsappFloatUrl = computed(() => {
  const phone = whatsappPhone.value
  if (!phone) return '#'

  const baseUrl = 'https://api.whatsapp.com/send'
  const reason = epaycoData.value?.x_response_reason_text || ''
  const ref = epaycoData.value?.x_ref_payco || refPayco.value || ''
  const ord = order.value?.order_id || ''

  const msg = ord
    ? `Hola 😊 necesito ayuda con el pago de mi orden #${ord}. Ref ePayco: ${ref}. ${reason}`
    : `Hola 😊 necesito ayuda con un pago ePayco. Ref ePayco: ${ref}. ${reason}`

  const params = new URLSearchParams({ phone, text: msg })
  return `${baseUrl}?${params.toString()}`
})

// ✅ Orden ID que devuelve ePayco (la “factura” / invoice que tú mandaste como order_id)
const orderIdFromEpayco = computed(() => {
  const d = epaycoData.value || {}
  // ePayco suele devolver el invoice como x_id_invoice o x_id_factura (según integración)
  return String(d.x_id_invoice || d.x_id_factura || '').trim()
})

onMounted(async () => {
  isLoading.value = true
  try {
    const epayco = refPayco.value
    if (!epayco) {
      isLoading.value = false
      return
    }

    // 1) Consultar ePayco
    try {
      const payload = await $fetch(`https://secure.epayco.co/validation/v1/reference/${epayco}`)
      epaycoPayload.value = payload || null
      epaycoData.value = payload?.data || null
    } catch {
      epaycoPayload.value = null
      epaycoData.value = null
    }

    // 2) Cargar la orden usando el order_id que entrega ePayco
    const ordId = orderIdFromEpayco.value
    if (!ordId) {
      order.value = null
      return
    }

    // ✅ como pediste: endpoint /order/:order_id
    try {
        order.value = await $fetch(`${URI}/order-by-id/${encodeURIComponent(ordId)}`)
    } catch {
      // fallback opcional si tu backend usa otro endpoint
      try {
        order.value = await $fetch(`${URI}/order-by-id/${encodeURIComponent(ordId)}`)
      } catch {
        order.value = null
      }
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
* { box-sizing: border-box; }

.page{
  min-height:100vh;
  padding:24px 12px;
  background:#f3f4f6;
  display:flex;
  justify-content:center;
  align-items:flex-start;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}

.card{
  width:100%;
  max-width:520px;
  background:#fff;
  border-radius:16px;
  box-shadow:0 10px 30px rgba(0,0,0,.08);
  border:1px solid #e5e7eb;
  overflow:hidden;
}

.header{
  padding:18px 16px 12px;
  text-align:center;
  border-bottom:1px dashed #e5e7eb;
}

.title{
  margin:0;
  font-size:18px;
  font-weight:900;
  color:#111827;
}

.subtitle{
  margin:8px 0 0;
  font-size:13px;
  color:#374151;
  font-weight:700;
}

.reason{
  margin:8px 0 0;
  font-size:13px;
  font-weight:800;
  color:#111827;
  background:#f9fafb;
  border:1px solid #e5e7eb;
  padding:10px;
  border-radius:12px;
}

.status-badge{
  margin:12px auto 0;
  width:max-content;
  padding:8px 12px;
  border-radius:999px;
  font-weight:900;
  font-size:12px;
  letter-spacing:.4px;
  text-transform:uppercase;
  border:1px solid transparent;
}

.status-badge.ok{ background:#dcfce7; color:#166534; border-color:#86efac; }
.status-badge.warn{ background:#ffedd5; color:#9a3412; border-color:#fdba74; }
.status-badge.bad{ background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
.status-badge.neutral{ background:#e5e7eb; color:#111827; border-color:#d1d5db; }

.order-id{
  margin:12px auto 0;
  display:inline-flex;
  gap:8px;
  align-items:center;
  padding:8px 12px;
  border-radius:999px;
  background:#111827;
  color:#fff;
  font-size:12px;
  font-weight:900;
  letter-spacing:.5px;
}

.meta{
  margin:10px 0 0;
  font-size:12px;
  color:#374151;
  font-weight:600;
}
.dot{ margin:0 6px; color:#9ca3af; }

.section{ padding:14px 16px; }
.section-title{
  margin:0 0 10px;
  font-size:13px;
  font-weight:900;
  color:#111827;
  text-transform:uppercase;
  letter-spacing:.5px;
}

/* Products */
.products{ display:flex; flex-direction:column; gap:10px; }
.product .row{ display:flex; gap:12px; justify-content:space-between; align-items:flex-start; }
.left{ flex:1; min-width:0; }
.name{ font-size:14px; font-weight:800; color:#111827; line-height:1.25; }
.right{ flex-shrink:0; }
.price{ font-size:14px; font-weight:900; color:#111827; white-space:nowrap; }

.sub{ margin-top:6px; padding-left:12px; border-left:2px solid #e5e7eb; }
.sub-title{ font-size:11px; font-weight:900; color:#6b7280; text-transform:uppercase; margin-bottom:4px; }
.sub-item{ font-size:12px; color:#374151; font-weight:700; line-height:1.35; }
.sub-item--between{ display:flex; justify-content:space-between; gap:10px; }
.sub-price{ white-space:nowrap; font-weight:900; color:#111827; }
.divider{ height:1px; background:#f1f5f9; margin-top:10px; }

/* Totals */
.totals{ display:flex; flex-direction:column; gap:8px; }
.tot-row{ display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#111827; }
.tot-row span{ color:#6b7280; font-weight:900; }
.tot-row b{ font-weight:900; }
.tot-row--final{
  margin-top:6px;
  padding-top:10px;
  border-top:2px solid #111827;
  font-size:16px;
}
.red{ color:#dc2626; }

/* Pay box */
.pay-box{
  border:1px solid #e5e7eb;
  background:#f9fafb;
  border-radius:12px;
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:8px;
}
.pay-row{
  display:grid;
  grid-template-columns:120px 1fr;
  gap:10px;
  align-items:baseline;
  font-size:13px;
}
.label{ color:#6b7280; font-weight:900; text-transform:uppercase; font-size:11px; letter-spacing:.4px; }
.val{ color:#111827; font-weight:800; word-break:break-word; }
.green{ color:#16a34a; font-weight:900; }
.orange{ color:#c2410c; font-weight:900; }
.red{ color:#dc2626; font-weight:900; }

/* Actions */
.actions{
  display:flex;
  gap:10px;
  padding:14px 16px 16px;
  border-top:1px solid #e5e7eb;
  background:#fff;
}
.btn{
  display:inline-flex;
  justify-content:center;
  align-items:center;
  gap:8px;
  width:100%;
  padding:12px 14px;
  border-radius:12px;
  font-weight:900;
  text-decoration:none;
  cursor:pointer;
  border:1px solid transparent;
  transition:transform .08s ease;
  text-transform:uppercase;
  font-size:12px;
  letter-spacing:.4px;
}
.btn:active{ transform:scale(.98); }
.btn-black{ background:#111827; color:#fff; }
.btn-ghost{
  margin-top:10px;
  background:transparent;
  border-color:#111827;
  color:#111827;
}

/* States */
.state{ width:100%; max-width:520px; text-align:center; padding:32px 16px; }
.error{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:16px;
  padding:18px;
  box-shadow:0 10px 30px rgba(0,0,0,.06);
}
.error h2{ margin:0 0 6px; font-size:18px; font-weight:900; color:#111827; }
.error p{ margin:0 0 14px; color:#6b7280; font-weight:800; font-size:13px; }

/* Spinner */
.spinner{
  width:44px;
  height:44px;
  border:4px solid #e5e7eb;
  border-top-color:#111827;
  border-radius:50%;
  animation:spin 1s linear infinite;
  margin:0 auto 12px;
}
@keyframes spin{ to{ transform:rotate(360deg); } }

@media (max-width:420px){
  .actions{ flex-direction:column; }
  .pay-row{ grid-template-columns:1fr; }
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

.wsp-float:hover { transform: scale(1.05); }
.wsp-float:active { transform: scale(0.98); }

.wsp-icon :deep(svg) {
  width: 40px;
  height: 28px;
  display: block;
}
</style>
