/**
 * Expone window.trackMetaPurchase para el evento Purchase (pedido completado).
 * Usa $fbq de nuxt-meta-pixel. orderService y orderServiceEpayco llaman a trackMetaPurchase.
 */
export default defineNuxtPlugin((nuxtApp) => {
  window.trackMetaPurchase = function (orderId, value, currency) {
    const $fbq = nuxtApp.$fbq
    if (typeof $fbq !== 'function' || !orderId) return
    $fbq('track', 'Purchase', {
      value: Number(value) || 0,
      currency: currency || 'USD',
      order_id: String(orderId),
    })
  }
})
