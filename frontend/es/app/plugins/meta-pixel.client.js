/**
 * Meta (Facebook) Pixel - solo cliente.
 * Configura el ID en nuxt.config.ts (runtimeConfig.public.metaPixelId)
 * o en .env: NUXT_PUBLIC_META_PIXEL_ID=TU_PIXEL_ID
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const pixelId = config.public?.metaPixelId || '';

  if (!pixelId || typeof window === 'undefined') return;

  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(
    window,
    document,
    'script',
    'https://connect.facebook.net/en_US/fbevents.js'
  );

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');

  /**
   * Disparar evento Purchase (pedido completado).
   * Llamar después de crear la orden con éxito.
   * @param {string|number} orderId - ID de la orden
   * @param {number} value - Total del pedido
   * @param {string} [currency='USD'] - Moneda (ej: USD)
   */
  window.trackMetaPurchase = function (orderId, value, currency) {
    if (!window.fbq || !orderId) return;
    window.fbq('track', 'Purchase', {
      value: Number(value) || 0,
      currency: currency || 'USD',
      order_id: String(orderId),
    });
  };
});
