/**
 * Servicio para validar códigos de cuponera contra la API de descuentos (descuentos backend).
 * Por defecto usa http://localhost:8000; en producción pasar baseUrl desde useRuntimeConfig().public.cuponeraApi.
 */

/**
 * Valida un código de cuponera. Devuelve la respuesta completa del GET /redeem.
 * @param {string} code - Código del usuario en la cuponera
 * @param {string} [date] - Fecha YYYY-MM-DD (opcional, por defecto hoy)
 * @param {boolean} [recordUse=false] - Si true, registra un uso para hoy
 * @param {string} [baseUrl] - URL base API cuponera (ej. useRuntimeConfig().public.cuponeraApi o 'http://localhost:8000')
 * @returns {Promise<{ success: boolean, message: string, cuponera_name?: string, discounts?: Array<{ discount_id: string, discount: object }>, uses_remaining_today?: number, user?: { name: string, first_name?: string, last_name?: string, phone: string, phone_code?: string, email: string, address?: string }, cuponera_site_ids?: number[] | null, free_product?: { product_id: string, name: string, price: number, image: string, max_qty: number } }>}
 */
export async function redeemCuponeraCode(code, date, recordUse = false, baseUrl) {
  const base = (baseUrl || '').toString().replace(/\/$/, '') || 'http://localhost:8000'
  const params = new URLSearchParams({ code: String(code).trim() })
  if (date) params.set('date', date)
  if (recordUse) params.set('record_use', 'true')
  const url = `${base}/redeem?${params.toString()}`
  const res = await fetch(url)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data?.detail ?? (typeof data?.message === 'string' ? data.message : 'Error de cuponera')
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return data
}

/**
 * Convierte el primer descuento del día al formato que espera el store de carrito.
 * Soporta: CART_PERCENT_OFF, CART_AMOUNT_OFF, FREE_ITEM
 * @param {object} redeemResponse - Respuesta de redeemCuponeraCode
 * @param {string} enteredCode - Código que ingresó el usuario
 * @param {number} [currentSiteId] - ID de la sede actual para validar site_ids del descuento
 * @returns {object | null} Cupón para applyCoupon o null si no hay descuento aplicable
 */
export function mapCuponeraDiscountToCoupon(redeemResponse, enteredCode, currentSiteId = null) {
  const discounts = redeemResponse?.discounts
  if (!Array.isArray(discounts) || discounts.length === 0) return null

  const first = discounts[0]
  const d = first?.discount || first
  const type = d?.type
  const params = d?.params || {}
  const conditions = d?.conditions || {}

  // Validar site_ids del descuento individual
  const discountSiteIds = d?.site_ids
  if (currentSiteId != null && Array.isArray(discountSiteIds) && discountSiteIds.length > 0) {
    const siteIdNum = Number(currentSiteId)
    const isValidSite = discountSiteIds.some(id => Number(id) === siteIdNum)
    if (!isValidSite) {
      // Este descuento no es válido para la sede actual
      return null
    }
  }

  const coupon = {
    code: enteredCode,
    discount_name: d?.name || redeemResponse?.cuponera_name || 'Cuponera',
    name: d?.name || redeemResponse?.cuponera_name,
    _fromCuponera: true,
    cuponera_name: redeemResponse?.cuponera_name,
    uses_remaining_today: redeemResponse?.uses_remaining_today,
    sites: redeemResponse?.cuponera_site_ids ? redeemResponse.cuponera_site_ids.map((id) => ({ site_id: id })) : null,
    discount_type: type // Agregar tipo de descuento para identificación
  }

  const minSubtotal = conditions?.min_subtotal
  if (minSubtotal != null && minSubtotal > 0) {
    coupon.min_purchase = minSubtotal
  }

  // CART_PERCENT_OFF: descuento porcentual al carrito
  if (type === 'CART_PERCENT_OFF' && (params?.pct != null || params?.percent != null)) {
    coupon.percent = Number(params.pct ?? params.percent) || 0
    return coupon
  }
  
  // CART_AMOUNT_OFF: descuento fijo al carrito
  if (type === 'CART_AMOUNT_OFF' && (params?.amount != null)) {
    coupon.amount = Number(params.amount) || 0
    return coupon
  }

  // FREE_ITEM: producto gratis
  if (type === 'FREE_ITEM' && params?.free_item) {
    coupon.free_item = {
      mode: params.free_item.mode || 'SPECIFIC_PRODUCT',
      product_id: params.free_item.product_id ? String(params.free_item.product_id) : null,
      category_id: params.free_item.category_id ? String(params.free_item.category_id) : null,
      max_qty: d?.limits?.max_free_qty || 1
    }
    // Para FREE_ITEM, el "ahorro" se calcula cuando se agrega el producto
    // Por ahora marcamos como 0 para que no cause error en el carrito
    coupon.amount = 0
    return coupon
  }

  // CATEGORY_PERCENT_OFF: descuento porcentual por categoría
  if (type === 'CATEGORY_PERCENT_OFF' && (params?.pct != null || params?.percent != null)) {
    const scope = d?.scope || {}
    coupon.percent = Number(params.pct ?? params.percent) || 0
    coupon.category_ids = scope.category_ids || []
    coupon.max_discount_amount = d?.limits?.max_discount_amount || null
    coupon.scope_type = 'CATEGORY'
    coupon.discount_categories = redeemResponse?.discount_categories || []
    return coupon
  }

  // CATEGORY_AMOUNT_OFF: descuento fijo por categoría
  if (type === 'CATEGORY_AMOUNT_OFF' && (params?.amount != null)) {
    const scope = d?.scope || {}
    coupon.amount = Number(params.amount) || 0
    coupon.category_ids = scope.category_ids || []
    coupon.max_discount_amount = d?.limits?.max_discount_amount || null
    coupon.scope_type = 'CATEGORY'
    coupon.discount_categories = redeemResponse?.discount_categories || []
    return coupon
  }

  // PRODUCT_PERCENT_OFF: descuento porcentual por productos específicos
  if (type === 'PRODUCT_PERCENT_OFF' && (params?.pct != null || params?.percent != null)) {
    const scope = d?.scope || {}
    coupon.percent = Number(params.pct ?? params.percent) || 0
    coupon.product_ids = scope.product_ids || []
    coupon.max_discount_amount = d?.limits?.max_discount_amount || null
    coupon.scope_type = 'PRODUCT'
    coupon.discount_products = redeemResponse?.discount_products || []
    return coupon
  }

  // PRODUCT_AMOUNT_OFF: descuento fijo por productos específicos
  if (type === 'PRODUCT_AMOUNT_OFF' && (params?.amount != null)) {
    const scope = d?.scope || {}
    coupon.amount = Number(params.amount) || 0
    coupon.product_ids = scope.product_ids || []
    coupon.max_discount_amount = d?.limits?.max_discount_amount || null
    coupon.scope_type = 'PRODUCT'
    coupon.discount_products = redeemResponse?.discount_products || []
    return coupon
  }

  // BUY_M_PAY_N: lleva M paga N (compra M unidades, paga N; las M-N más baratas gratis)
  if (type === 'BUY_M_PAY_N' && (params?.m != null) && (params?.n != null)) {
    const scope = d?.scope || {}
    const scopeType = scope.scope_type || 'ALL_ITEMS'
    coupon.buy_m_pay_n = true
    coupon.m = Number(params.m) || 3
    coupon.n = Number(params.n) || 2
    coupon.selection_rule = d?.selection_rule || 'CHEAPEST_UNITS'
    coupon.max_groups = d?.limits?.max_groups ?? null

    if (scopeType === 'CATEGORY_IDS' && scope.category_ids?.length) {
      coupon.scope_type = 'CATEGORY'
      coupon.category_ids = scope.category_ids || []
      coupon.discount_categories = redeemResponse?.discount_categories || []
    } else if (scopeType === 'PRODUCT_IDS' && scope.product_ids?.length) {
      coupon.scope_type = 'PRODUCT'
      coupon.product_ids = scope.product_ids || []
      coupon.discount_products = redeemResponse?.discount_products || []
    } else {
      coupon.scope_type = 'ALL_ITEMS'
      coupon.category_ids = []
      coupon.product_ids = []
    }
    return coupon
  }

  return null
}

