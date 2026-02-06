import { defineStore } from 'pinia'

/** ✅ Soporta respuestas tipo: { data: [coupon] } o coupon directo */
function normalizeCoupon(c) {
  if (!c) return null
  if (Array.isArray(c.data)) return c.data[0] || null
  return c
}

export const usecartStore = defineStore('salchi_supegwseasr2_cart_web443', {
  persist: {
    key: 'salchi_surep34er_gsacaret_web334eddf43ssv',
    paths: [
      'cart',
      'last_order',
      'menu',
      'address_details',
      'is_rappi_cargo',
      'applied_coupon',
      'applied_cuponera',
      'coupon_ui',
      'order_notes'
    ],

    afterRestore: (ctx) => {
      // ✅ Asegurar estructura por si vienes de versiones viejas
      if (!ctx.store.coupon_ui) {
        ctx.store.coupon_ui = { enabled: false, draft_code: '' }
      }

      // ✅ Normaliza cupón persistido si venía envuelto en {data:[...]}
      ctx.store.applied_coupon = normalizeCoupon(ctx.store.applied_coupon)
      
      // ✅ Normaliza cuponera persistida
      if (ctx.store.applied_cuponera && typeof ctx.store.applied_cuponera === 'object') {
        ctx.store.applied_cuponera = {
          ...ctx.store.applied_cuponera,
          _isCuponera: true
        }
      }

      // ✅ Recalcular descuentos: priorizar cuponera sobre cupón
      if (ctx.store.applied_cuponera && typeof ctx.store.applied_cuponera === 'object') {
        if (Array.isArray(ctx.store.cart) && ctx.store.cart.length > 0) {
          ctx.store.applyCuponera(ctx.store.applied_cuponera)
        }
      } else if (ctx.store.applied_coupon && Array.isArray(ctx.store.cart) && ctx.store.cart.length > 0) {
        ctx.store.applyCoupon(ctx.store.applied_coupon)
      }

      // ✅ Recalcular is_rappi_cargo si hay address_details pero no hay flag (compatibilidad hacia atrás)
      if (ctx.store.address_details && typeof ctx.store.address_details === 'object' && Object.keys(ctx.store.address_details).length > 0) {
        if (ctx.store.is_rappi_cargo === undefined || ctx.store.is_rappi_cargo === null) {
          ctx.store.is_rappi_cargo = ctx.store.calculateIsRappiCargo(ctx.store.address_details)
        }
      } else {
        // Si no hay address_details, asegurar que is_rappi_cargo sea false
        ctx.store.is_rappi_cargo = false
      }
    }
  },

  state: () => ({
    currentProduct: {},
    currentSection: {},
    currentVideoIndex: 0,
    currentVideoTime: 0,
    discount_codes: [],

    applied_coupon: null,
    applied_cuponera: null, // ✅ Cuponera aplicada (separada de cupones normales)

    // ✅ UI de cupón persistente (switch + draft)
    coupon_ui: {
      enabled: false,
      draft_code: ''
    },

    visibles: {
      currentProduct: false,
      addAdditionToCart: false,
      loading: true,
      last_order: '',
    },

    cart: [],
    address_details: {},
    is_rappi_cargo: false, // Flag persistente para indicar si la orden requiere Rappi Cargo
    last_order: '',
    sending_order: false,
    was_reserva: false,
    order_notes: ''
  }),

  getters: {
    totalItems(state) {
      if (!Array.isArray(state.cart) || state.cart.length === 0) return 0
      return state.cart.reduce((acc, p) => acc + (Number(p.pedido_cantidad) || 0), 0)
    },

    cartTotal(state) {
      if (!Array.isArray(state.cart) || state.cart.length === 0) return 0
      return state.cart.reduce((total, product) => total + this.calculateTotalProduct(product), 0)
    },

    isProductInCart: (state) => (productId) => {
      return state.cart.some((item) => item.pedido_productoid === productId)
    },

    getProductTotal() {
      return (product) => {
        const productBasePrice = this.getProductPrice(product)
        let total = productBasePrice

        if (product.modificadorseleccionList && product.modificadorseleccionList.length > 0) {
          product.modificadorseleccionList.forEach((ad) => {
            const adPrice = parseInt(ad.pedido_precio) || 0
            const adQuantity = parseInt(ad.modificadorseleccion_cantidad) || 1
            total += adPrice * adQuantity
          })
        }

        return total * (product.pedido_cantidad || 1)
      }
    },

    cartTotalDiscount(state) {
      if (!Array.isArray(state.cart) || state.cart.length === 0) return 0
      return state.cart.reduce((acc, p) => {
        const qty = Number(p.pedido_cantidad) || 1
        const disc = Number(p.pedido_descuento) || 0
        return acc + disc * qty
      }, 0)
    },

    cartSubtotal(state) {
      if (!Array.isArray(state.cart) || state.cart.length === 0) return 0
      return state.cart.reduce((total, product) => total + this.calculateSubtotalProduct(product), 0)
    },
  },

  actions: {
    // Función helper para calcular si es Rappi Cargo basándose en address_details
    calculateIsRappiCargo(addressData) {
      if (!addressData || typeof addressData !== 'object') return false
      
      // Prioridad 1: Si rappi_validation existe y no es null → es Rappi Cargo
      if (addressData.rappi_validation != null && typeof addressData.rappi_validation === 'object') {
        return true
      }
      
      // Prioridad 2: Si delivery_pricing.uses_rappi === true → es Rappi Cargo
      if (addressData.delivery_pricing?.uses_rappi === true) {
        return true
      }
      
      // Si delivery_pricing existe pero uses_rappi === false → NO es Rappi Cargo
      // Si delivery_pricing es null pero rappi_validation también es null → NO es Rappi Cargo
      return false
    },

    // Actualizar address_details y calcular is_rappi_cargo
    setAddressDetails(addressData) {
      this.address_details = addressData || {}
      this.is_rappi_cargo = this.calculateIsRappiCargo(addressData)
    },
    // ✅ Setter seguro (persistente)
    setCouponUi(patch) {
      if (!this.coupon_ui) this.coupon_ui = { enabled: false, draft_code: '' }
      this.coupon_ui = { ...this.coupon_ui, ...patch }
    },

    // ===== LÓGICA DE CUPONERAS (SEPARADA) =====
    applyCuponera(cuponeraData) {
      // cuponeraData debe incluir: code, discount (con percent o amount), discount_name, uses_remaining_today, cuponera_site_ids, min_purchase
      // Para FREE_ITEM: free_item: true, free_product: { product_id, name, price, max_qty }
      if (!cuponeraData) return
      
      // Guardar cuponera aplicada (el código queda en el input aunque no se aplique el descuento aún)
      this.applied_cuponera = {
        ...cuponeraData,
        _isCuponera: true,
        _minPurchaseNotMet: false
      }
      
      // Limpiar cupón normal si había uno
      this.applied_coupon = null
      
      // Si no se cumple compra mínima: mantener cuponera y código, quitar descuentos del carrito, mostrar advertencia
      const minPurchase = cuponeraData.min_purchase != null ? Number(cuponeraData.min_purchase) : 0
      if (minPurchase > 0 && this.cartSubtotal < minPurchase) {
        this.applied_cuponera._minPurchaseNotMet = true
        this.cart.forEach((item) => { item.pedido_descuento = 0 })
        return
      }
      
      // Para FREE_ITEM con requisitos, siempre establecer flags de feedback (incluso con carrito vacío)
      if (cuponeraData.free_item && cuponeraData.free_product) {
        const rp = cuponeraData.requires_purchase
        const buyX = rp?.type === 'BUY_X_IN_SCOPE' && rp.buy_x != null ? Number(rp.buy_x) || 0 : 0
        if (buyX > 0 && (!Array.isArray(this.cart) || this.cart.length === 0)) {
          this.applied_cuponera._freeProductInCart = false
          this.applied_cuponera._requiresPurchaseNotMet = true
          this.applied_cuponera._requiresPurchaseBuyX = buyX
          this.applied_cuponera._unitsInScope = 0
          return
        }
      }
      
      // Aplicar descuento en el carrito
      if (!Array.isArray(this.cart) || this.cart.length === 0) return
      
      const clampNonNegativeInt = (n) => {
        n = Number.isFinite(n) ? Math.floor(n) : 0
        return n < 0 ? 0 : n
      }
      
      // ===== BUY_M_PAY_N: Lleva M paga N (sobre el mismo producto: 3 del mismo para reclamar, no 2+1 de distintos) =====
      if (cuponeraData.buy_m_pay_n && cuponeraData.m != null && cuponeraData.n != null) {
        const m = Number(cuponeraData.m) || 3
        const n = Number(cuponeraData.n) || 2
        const selectionRule = (cuponeraData.selection_rule || 'CHEAPEST_UNITS').toUpperCase()
        const maxGroups = cuponeraData.max_groups != null ? Number(cuponeraData.max_groups) : null

        const getProductKey = (item) => {
          if (cuponeraData.scope_type === 'PRODUCT') {
            return String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
          }
          if (cuponeraData.scope_type === 'CATEGORY') {
            return 'cat_' + String(item.categoria_id || item.pedido_categoriaid || '')
          }
          return String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
        }

        const isEligible = (item) => {
          if (cuponeraData.scope_type === 'CATEGORY') {
            const ids = (cuponeraData.category_ids || []).map(id => String(id))
            return ids.includes(String(item.categoria_id || item.pedido_categoriaid || ''))
          }
          if (cuponeraData.scope_type === 'PRODUCT') {
            const ids = (cuponeraData.product_ids || []).map(id => String(id))
            const pid = String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
            return ids.includes(pid)
          }
          return true
        }

        this.cart.forEach((item) => { item.pedido_descuento = 0 })

        // Unidades elegibles agrupadas por producto (o por categoría si scope es categoría)
        const unitsByProduct = new Map() // key -> [{ item, price }, ...]
        for (const item of this.cart) {
          if (!isEligible(item)) continue
          const key = getProductKey(item)
          const qty = Number(item.pedido_cantidad) || 1
          const price = Number(item.pedido_base_price) || 0
          const list = unitsByProduct.get(key) || []
          for (let i = 0; i < qty; i++) {
            list.push({ item, price })
          }
          unitsByProduct.set(key, list)
        }

        // Grupos válidos solo por producto: cada producto forma floor(units/m) grupos
        const groupsPerProduct = new Map() // key -> number of groups
        let totalGroups = 0
        for (const [key, list] of unitsByProduct) {
          const g = Math.floor(list.length / m)
          groupsPerProduct.set(key, g)
          totalGroups += g
        }
        const totalGroupsCapped = (maxGroups != null && maxGroups > 0) ? Math.min(totalGroups, maxGroups) : totalGroups
        const discountUnitsTotal = totalGroupsCapped * (m - n)

        const totalEligible = Array.from(unitsByProduct.values()).reduce((acc, list) => acc + list.length, 0)
        this.applied_cuponera._buyMPayNInCart = totalGroupsCapped >= 1
        this.applied_cuponera._buyMPayNNeedsMore = totalGroupsCapped < 1
        this.applied_cuponera._buyMPayNUnitsNeeded = m
        this.applied_cuponera._buyMPayNSameProduct = true

        if (discountUnitsTotal <= 0) return

        // Descontar solo por producto: en cada producto, las (m-n) unidades más baratas (o caras) de ese producto, hasta su número de grupos
        let remainingToAssign = discountUnitsTotal
        const discountByItem = new Map()
        for (const [key, list] of unitsByProduct) {
          const groupsThisProduct = groupsPerProduct.get(key) || 0
          const discountUnitsThisProduct = Math.min(groupsThisProduct * (m - n), remainingToAssign)
          remainingToAssign -= discountUnitsThisProduct
          if (discountUnitsThisProduct <= 0) continue
          const sorted = [...list].sort((a, b) => selectionRule === 'MOST_EXPENSIVE_UNITS' ? b.price - a.price : a.price - b.price)
          const toDiscountThisProduct = sorted.slice(0, discountUnitsThisProduct)
          for (const { item } of toDiscountThisProduct) {
            const prev = discountByItem.get(item) || { item, count: 0 }
            prev.count++
            discountByItem.set(item, prev)
          }
        }
        for (const { item, count } of discountByItem.values()) {
          if (count <= 0) continue
          const qty = Number(item.pedido_cantidad) || 1
          const basePrice = Number(item.pedido_base_price) || 0
          const totalDiscount = basePrice * count
          item.pedido_descuento = clampNonNegativeInt(totalDiscount / qty)
        }
        this.applied_cuponera._buyMPayNInCart = true
        this.applied_cuponera._buyMPayNNeedsMore = false
        return
      }

      // ===== BUY_X_GET_Y_PERCENT_OFF: Compra Y, lleva X más al y_discount_pct% (por producto, mismo producto) =====
      if (cuponeraData.buy_x_get_y_pct_off && (cuponeraData.buy_qty != null || cuponeraData.get_qty != null) && cuponeraData.y_discount_pct != null) {
        const buyQty = Number(cuponeraData.buy_qty) || 1
        const getQty = Number(cuponeraData.get_qty) || 1
        const groupSize = buyQty + getQty
        const discountPct = Number(cuponeraData.y_discount_pct) || 0
        const selectionRule = (cuponeraData.selection_rule || 'CHEAPEST_UNITS').toUpperCase()
        const maxGroups = cuponeraData.max_groups != null ? Number(cuponeraData.max_groups) : null

        const getProductKey = (item) => {
          if (cuponeraData.scope_type === 'PRODUCT') {
            return String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
          }
          if (cuponeraData.scope_type === 'CATEGORY') {
            return 'cat_' + String(item.categoria_id || item.pedido_categoriaid || '')
          }
          return String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
        }

        const isEligible = (item) => {
          if (cuponeraData.scope_type === 'CATEGORY') {
            const ids = (cuponeraData.category_ids || []).map(id => String(id))
            return ids.includes(String(item.categoria_id || item.pedido_categoriaid || ''))
          }
          if (cuponeraData.scope_type === 'PRODUCT') {
            const ids = (cuponeraData.product_ids || []).map(id => String(id))
            const pid = String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
            return ids.includes(pid)
          }
          return true
        }

        this.cart.forEach((item) => { item.pedido_descuento = 0 })

        const unitsByProductBXY = new Map()
        for (const item of this.cart) {
          if (!isEligible(item)) continue
          const key = getProductKey(item)
          const qty = Number(item.pedido_cantidad) || 1
          const price = Number(item.pedido_base_price) || 0
          const list = unitsByProductBXY.get(key) || []
          for (let i = 0; i < qty; i++) {
            list.push({ item, price })
          }
          unitsByProductBXY.set(key, list)
        }

        const groupsPerProductBXY = new Map()
        let totalGroupsBXY = 0
        for (const [key, list] of unitsByProductBXY) {
          const g = groupSize > 0 ? Math.floor(list.length / groupSize) : 0
          groupsPerProductBXY.set(key, g)
          totalGroupsBXY += g
        }
        const totalGroupsCappedBXY = (maxGroups != null && maxGroups > 0) ? Math.min(totalGroupsBXY, maxGroups) : totalGroupsBXY
        const discountUnitsTotalBXY = totalGroupsCappedBXY * getQty

        this.applied_cuponera._buyXGetYPctOffInCart = totalGroupsCappedBXY >= 1
        this.applied_cuponera._buyXGetYPctOffNeedsMore = totalGroupsCappedBXY < 1
        this.applied_cuponera._buyXGetYPctOffBuyQty = buyQty
        this.applied_cuponera._buyXGetYPctOffGetQty = getQty
        this.applied_cuponera._buyXGetYPctOffGroupSize = groupSize
        this.applied_cuponera._buyXGetYPctOffPct = discountPct

        if (discountUnitsTotalBXY <= 0 || discountPct <= 0) return

        let remainingToAssign = discountUnitsTotalBXY
        const discountByItem = new Map()
        for (const [key, list] of unitsByProductBXY) {
          const groupsThisProduct = groupsPerProductBXY.get(key) || 0
          const discountUnitsThisProduct = Math.min(groupsThisProduct * getQty, remainingToAssign)
          remainingToAssign -= discountUnitsThisProduct
          if (discountUnitsThisProduct <= 0) continue
          const sorted = [...list].sort((a, b) => selectionRule === 'MOST_EXPENSIVE_UNITS' ? b.price - a.price : a.price - b.price)
          const toDiscountThisProduct = sorted.slice(0, discountUnitsThisProduct)
          for (const { item, price } of toDiscountThisProduct) {
            const prev = discountByItem.get(item) || { item, count: 0, totalDiscountAmount: 0 }
            prev.count++
            prev.totalDiscountAmount += Math.floor(price * (discountPct / 100))
            discountByItem.set(item, prev)
          }
        }
        for (const { item, count, totalDiscountAmount } of discountByItem.values()) {
          if (count <= 0) continue
          const qty = Number(item.pedido_cantidad) || 1
          item.pedido_descuento = clampNonNegativeInt(totalDiscountAmount / qty)
        }
        return
      }

      // ===== FREE_ITEM: Producto gratis (BUY_X_IN_SCOPE | MIN_QTY_IN_SCOPE | MIN_SUBTOTAL_IN_SCOPE) =====
      if (cuponeraData.free_item && cuponeraData.free_product) {
        const freeProductId = String(cuponeraData.free_product.product_id)
        const maxFreeQtyLimit = cuponeraData.free_product.max_qty || 1 // Límite máximo absoluto
        const rp = cuponeraData.requires_purchase
        const rpType = rp?.type || null

        this.cart.forEach((item) => { item.pedido_descuento = 0 })
        this.applied_cuponera._freeProductInCart = false
        this.applied_cuponera._requiresPurchaseNotMet = false
        this.applied_cuponera._requiresPurchaseType = rpType
        this.applied_cuponera._unitsInScope = 0
        this.applied_cuponera._subtotalInScope = 0
        this.applied_cuponera._groupsCompleted = 0
        this.applied_cuponera._actualMaxFree = 0

        const scopeType = cuponeraData.requires_purchase_scope_type || 'ALL_ITEMS'
        const categoryIds = (cuponeraData.requires_purchase_category_ids || []).map(String)
        const productIds = (cuponeraData.requires_purchase_product_ids || []).map(String)

        // Calcular unidades y subtotal en scope (siempre, para cualquier tipo de requisito)
        let unitsInScope = 0
        let subtotalInScope = 0
        for (const item of this.cart) {
          const qty = Number(item.pedido_cantidad) || 1
          const basePrice = Number(item.pedido_base_price) || 0
          const inScope = scopeType === 'CATEGORY' && categoryIds.length
            ? categoryIds.includes(String(item.categoria_id || item.pedido_categoriaid || ''))
            : scopeType === 'PRODUCT' && productIds.length
              ? productIds.includes(String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || ''))
              : true
          if (inScope) {
            unitsInScope += qty
            subtotalInScope += basePrice * qty
          }
        }
        this.applied_cuponera._unitsInScope = unitsInScope
        this.applied_cuponera._subtotalInScope = subtotalInScope

        let groupsCompleted = 0
        if (rpType === 'BUY_X_IN_SCOPE' && rp?.buy_x != null) {
          const buyX = Number(rp.buy_x) || 0
          this.applied_cuponera._requiresPurchaseBuyX = buyX
          if (buyX < 1) {
            groupsCompleted = 1
          } else {
            groupsCompleted = Math.floor(unitsInScope / buyX)
            if (groupsCompleted < 1) {
              this.applied_cuponera._requiresPurchaseNotMet = true
              return
            }
          }
        } else if (rpType === 'MIN_QTY_IN_SCOPE' && rp?.min_qty != null) {
          const minQty = Number(rp.min_qty) || 0
          this.applied_cuponera._requiresPurchaseMinQty = minQty
          if (minQty < 1) {
            groupsCompleted = 1
          } else {
            groupsCompleted = Math.floor(unitsInScope / minQty)
            if (unitsInScope < minQty) {
              this.applied_cuponera._requiresPurchaseNotMet = true
              return
            }
          }
        } else if (rpType === 'MIN_SUBTOTAL_IN_SCOPE' && rp?.min_subtotal != null) {
          const minSubtotal = Number(rp.min_subtotal) || 0
          this.applied_cuponera._requiresPurchaseMinSubtotal = minSubtotal
          if (minSubtotal <= 0) {
            groupsCompleted = 1
          } else {
            groupsCompleted = Math.floor(subtotalInScope / minSubtotal)
            if (subtotalInScope < minSubtotal) {
              this.applied_cuponera._requiresPurchaseNotMet = true
              return
            }
          }
        } else {
          // Sin requisito de compra: solo 1 producto gratis
          groupsCompleted = 1
        }
        this.applied_cuponera._groupsCompleted = groupsCompleted

        // Cantidad máxima de productos gratis desbloqueados = min(grupos completados, límite máximo)
        const actualMaxFree = Math.min(groupsCompleted, maxFreeQtyLimit)
        this.applied_cuponera._actualMaxFree = actualMaxFree

        // Buscar si el producto gratis ya está en el carrito y cuántas unidades tiene
        let freeProductInCart = null
        let currentFreeQty = 0
        for (const item of this.cart) {
          const itemProductId = String(
            item.pedido_productoid ||
            item.producto_id ||
            item.productogeneral_id ||
            this.getProductId(item) ||
            ''
          )
          if (itemProductId === freeProductId) {
            if (!freeProductInCart) freeProductInCart = item
            currentFreeQty += Number(item.pedido_cantidad) || 1
          }
        }

        // Si lleva menos de las que le corresponden gratis, agregar el resto (respetando actualMaxFree)
        const unitsToAdd = Math.max(0, actualMaxFree - currentFreeQty)
        if (unitsToAdd > 0 && !this._addingFreeProduct && actualMaxFree >= 1) {
          this._addingFreeProduct = true // Evitar loop infinito
          const fp = cuponeraData.free_product
          const freeProductToAdd = {
            producto_id: fp.product_id,
            productogeneral_precio: fp.price || 0,
            productogeneral_descripcion: fp.name || 'Producto gratis',
            productogeneral_urlimagen: fp.image || '',
            categoria_id: fp.category_id || null,
            productogeneral_escombo: '0',
            lista_productobase: [],
            lista_presentacion: [{ producto_id: fp.product_id, producto_precio: fp.price || 0 }]
          }
          this.addProductToCart(freeProductToAdd, unitsToAdd, [])
          this._addingFreeProduct = false
          // Buscar de nuevo el producto (puede ser la misma línea actualizada o una nueva)
          freeProductInCart = null
          currentFreeQty = 0
          for (const item of this.cart) {
            const itemProductId = String(
              item.pedido_productoid ||
              item.producto_id ||
              item.productogeneral_id ||
              this.getProductId(item) ||
              ''
            )
            if (itemProductId === freeProductId) {
              if (!freeProductInCart) freeProductInCart = item
              currentFreeQty += Number(item.pedido_cantidad) || 1
            }
          }
        }

        // Aplicar descuento 100% a las unidades desbloqueadas (puede haber varias líneas del mismo producto)
        let totalFreeQty = 0
        let remainingToDiscount = actualMaxFree
        for (const item of this.cart) {
          const itemProductId = String(
            item.pedido_productoid ||
            item.producto_id ||
            item.productogeneral_id ||
            this.getProductId(item) ||
            ''
          )
          if (itemProductId !== freeProductId) continue
          const qty = Number(item.pedido_cantidad) || 1
          totalFreeQty += qty
          const basePrice = Number(item.pedido_base_price) || 0
          const unitsToDiscountThisLine = Math.min(qty, remainingToDiscount)
          remainingToDiscount -= unitsToDiscountThisLine
          item.pedido_descuento = clampNonNegativeInt((basePrice * unitsToDiscountThisLine) / qty)
        }
        if (totalFreeQty > 0) {
          this.applied_cuponera._freeProductInCart = true
          const unitsDiscounted = Math.min(totalFreeQty, actualMaxFree)
          const firstLine = this.cart.find(item => {
            const pid = String(item.pedido_productoid || item.producto_id || item.productogeneral_id || this.getProductId(item) || '')
            return pid === freeProductId
          })
          const basePrice = firstLine ? Number(firstLine.pedido_base_price) || 0 : 0
          this.applied_cuponera._freeProductApplied = {
            product_id: freeProductId,
            units_discounted: unitsDiscounted,
            units_in_cart: totalFreeQty,
            discount_amount: basePrice * unitsDiscounted
          }
        }
        return
      }
      
      // ===== DESCUENTOS POR CATEGORÍA =====
      if (cuponeraData.scope_type === 'CATEGORY' && Array.isArray(cuponeraData.category_ids) && cuponeraData.category_ids.length > 0) {
        const categoryIds = cuponeraData.category_ids.map(id => String(id))
        const maxDiscountAmount = cuponeraData.max_discount_amount || Infinity
        let totalDiscountApplied = 0
        let hasMatchingProduct = false
        
        // Primero resetear descuentos
        this.cart.forEach((item) => {
          item.pedido_descuento = 0
        })
        
        // Aplicar descuento solo a productos de las categorías especificadas
        for (const item of this.cart) {
          const itemCategoryId = String(item.categoria_id || item.pedido_categoriaid || '')
          
          if (categoryIds.includes(itemCategoryId)) {
            hasMatchingProduct = true
            const qty = Number(item.pedido_cantidad) || 1
            const basePrice = Number(item.pedido_base_price) || 0
            let discountPerUnit = 0
            
            // Porcentaje
            if (cuponeraData.percent != null) {
              const decimal = Number(cuponeraData.percent) / 100
              discountPerUnit = clampNonNegativeInt(basePrice * decimal)
            }
            // Monto fijo
            else if (cuponeraData.amount != null) {
              discountPerUnit = clampNonNegativeInt(Number(cuponeraData.amount))
            }
            
            // Verificar límite máximo
            const itemTotalDiscount = discountPerUnit * qty
            if (totalDiscountApplied + itemTotalDiscount > maxDiscountAmount) {
              // Ajustar para no exceder el límite
              const remainingDiscount = maxDiscountAmount - totalDiscountApplied
              discountPerUnit = clampNonNegativeInt(remainingDiscount / qty)
            }
            
            item.pedido_descuento = discountPerUnit
            totalDiscountApplied += discountPerUnit * qty
            
            if (totalDiscountApplied >= maxDiscountAmount) break
          }
        }
        
        // Guardar estado de si hay producto de la categoría
        this.applied_cuponera._categoryProductInCart = hasMatchingProduct
        this.applied_cuponera._totalDiscountApplied = totalDiscountApplied
        
        return
      }
      
      // ===== DESCUENTOS POR PRODUCTO =====
      if (cuponeraData.scope_type === 'PRODUCT' && Array.isArray(cuponeraData.product_ids) && cuponeraData.product_ids.length > 0) {
        const productIds = cuponeraData.product_ids.map(id => String(id))
        const maxDiscountAmount = cuponeraData.max_discount_amount || Infinity
        let totalDiscountApplied = 0
        let hasMatchingProduct = false
        
        // Primero resetear descuentos
        this.cart.forEach((item) => {
          item.pedido_descuento = 0
        })
        
        // Aplicar descuento solo a productos específicos
        for (const item of this.cart) {
          const itemProductId = String(
            item.pedido_productoid || 
            item.producto_id || 
            item.productogeneral_id || 
            this.getProductId(item) || 
            ''
          )
          
          if (productIds.includes(itemProductId)) {
            hasMatchingProduct = true
            const qty = Number(item.pedido_cantidad) || 1
            const basePrice = Number(item.pedido_base_price) || 0
            let discountPerUnit = 0
            
            // Porcentaje
            if (cuponeraData.percent != null) {
              const decimal = Number(cuponeraData.percent) / 100
              discountPerUnit = clampNonNegativeInt(basePrice * decimal)
            }
            // Monto fijo
            else if (cuponeraData.amount != null) {
              discountPerUnit = clampNonNegativeInt(Number(cuponeraData.amount))
            }
            
            // Verificar límite máximo
            const itemTotalDiscount = discountPerUnit * qty
            if (totalDiscountApplied + itemTotalDiscount > maxDiscountAmount) {
              const remainingDiscount = maxDiscountAmount - totalDiscountApplied
              discountPerUnit = clampNonNegativeInt(remainingDiscount / qty)
            }
            
            item.pedido_descuento = discountPerUnit
            totalDiscountApplied += discountPerUnit * qty
            
            if (totalDiscountApplied >= maxDiscountAmount) break
          }
        }
        
        // Guardar estado
        this.applied_cuponera._productScopeInCart = hasMatchingProduct
        this.applied_cuponera._totalDiscountApplied = totalDiscountApplied
        
        return
      }
      
      // ===== DESCUENTO GLOBAL (TODO EL CARRITO) =====
      const maxDiscountAmount = cuponeraData.max_discount_amount ?? Infinity

      // Porcentaje
      if (cuponeraData.percent != null) {
        const decimal = Number(cuponeraData.percent) / 100
        this.cart.forEach((item) => {
          const basePrice = Number(item.pedido_base_price) || 0
          item.pedido_descuento = clampNonNegativeInt(basePrice * decimal)
        })
        // Respetar límite máximo
        let totalDiscount = this.cart.reduce((sum, item) => sum + (item.pedido_descuento || 0) * (Number(item.pedido_cantidad) || 1), 0)
        if (totalDiscount > maxDiscountAmount && maxDiscountAmount < Infinity) {
          const scale = maxDiscountAmount / totalDiscount
          this.cart.forEach((item) => {
            item.pedido_descuento = clampNonNegativeInt((item.pedido_descuento || 0) * scale)
          })
        }
      }
      // Monto fijo
      else if (cuponeraData.amount != null) {
        const totalUnits = this.totalItems
        if (!totalUnits) return

        let rawAmount = Number(cuponeraData.amount) || 0
        const cappedAmount = maxDiscountAmount < Infinity ? Math.min(rawAmount, maxDiscountAmount) : rawAmount
        const discountPerUnit = clampNonNegativeInt(cappedAmount / totalUnits)

        this.cart.forEach((item) => {
          item.pedido_descuento = discountPerUnit
        })
      }
    },
    
    removeCuponera() {
      this.applied_cuponera = null
      
      if (Array.isArray(this.cart) && this.cart.length > 0) {
        this.cart.forEach((item) => {
          item.pedido_descuento = 0
        })
      }
    },

    // ===== LÓGICA DE CUPONES (NO se aplica si hay cuponera activa) =====
    applyCoupon(coupon) {
      coupon = normalizeCoupon(coupon)
      if (!coupon) return
      
      // ✅ Si hay cuponera activa, NO se puede aplicar cupón normal
      if (this.applied_cuponera) {
        console.warn('No se puede aplicar cupón normal cuando hay una cuponera activa')
        return
      }

      this.applied_coupon = coupon

      // ✅ Al aplicar cupón, switch ON y sincroniza draft_code
      this.setCouponUi({
        enabled: true,
        draft_code: coupon?.code || this.coupon_ui?.draft_code || ''
      })

      if (!Array.isArray(this.cart) || this.cart.length === 0) return

      // 🔥 IMPORTANTÍSIMO: si amount es muy pequeño y lo divides entre muchas unidades,
      // puede quedar 0 por unidad. Por eso añadimos un mínimo opcional de 1 si quieres.
      // Si NO quieres mínimo, deja Math.floor tal cual (como está).
      const clampNonNegativeInt = (n) => {
        n = Number.isFinite(n) ? Math.floor(n) : 0
        return n < 0 ? 0 : n
      }

      // Porcentaje (descuento por unidad basado en base_price)
      if (coupon.percent != null) {
        const decimal = Number(coupon.percent) / 100
        this.cart.forEach((item) => {
          const basePrice = Number(item.pedido_base_price) || 0
          item.pedido_descuento = clampNonNegativeInt(basePrice * decimal)
        })
      }
      // Monto fijo (dividido entre unidades)
      else if (coupon.amount != null) {
        const totalUnits = this.totalItems
        if (!totalUnits) return

        const discountPerUnit = clampNonNegativeInt(Number(coupon.amount) / totalUnits)

        this.cart.forEach((item) => {
          item.pedido_descuento = discountPerUnit
        })
      }
      // Si no trae percent ni amount, no hace nada (pero queda aplicado para UI)
    },

    removeCoupon() {
      this.applied_coupon = null

      // ✅ No toco enabled/draft para que el usuario no pierda lo escrito.
      // Si quieres apagar el switch al quitar cupón, descomenta:
      // this.setCouponUi({ enabled: false })

      if (Array.isArray(this.cart) && this.cart.length > 0) {
        this.cart.forEach((item) => {
          item.pedido_descuento = 0
        })
      }
    },

    // ===== Helpers de precio =====
    calculateSubtotalProduct(product) {
      if (!product || typeof product !== 'object') return 0

      const {
        pedido_base_price = 0,
        pedido_cantidad = 1,
        modificadorseleccionList = [],
      } = product

      const basePrice = Number(pedido_base_price) || 0
      const cantidad = Number(pedido_cantidad) || 1

      const adiciones = Array.isArray(modificadorseleccionList)
        ? modificadorseleccionList.reduce(
            (total, { pedido_precio = 0, modificadorseleccion_cantidad = 1 }) =>
              total + (Number(pedido_precio) || 0) * (Number(modificadorseleccion_cantidad) || 1),
            0,
          )
        : 0

      return (basePrice + adiciones) * cantidad
    },

    calculateTotalProduct(product) {
      if (!product || typeof product !== 'object') return 0

      const {
        pedido_base_price = 0,
        pedido_cantidad = 1,
        modificadorseleccionList = [],
        pedido_descuento = 0,
      } = product

      let basePrice = (Number(pedido_base_price) - Number(pedido_descuento))
      if (basePrice < 0) basePrice = 0

      const cantidad = Number(pedido_cantidad) || 1

      const adiciones = Array.isArray(modificadorseleccionList)
        ? modificadorseleccionList.reduce(
            (total, { pedido_precio = 0, modificadorseleccion_cantidad = 1 }) =>
              total + (Number(pedido_precio) || 0) * (Number(modificadorseleccion_cantidad) || 1),
            0,
          )
        : 0

      return (basePrice + adiciones) * cantidad
    },

    // ===== UI helpers =====
    setCurrentVideoIndex(index) {
      this.currentVideoIndex = index
    },
    setCurrentVideoTime(time) {
      this.currentVideoTime = time
    },
    setCurrentProduct(product) {
      this.currentProduct = product
    },
    setVisible(item, status) {
      this.visibles[item] = status
    },

    // ===== Identificadores / base price =====
    getProductId(product) {
      if (product?.lista_presentacion && product.lista_presentacion.length > 0) {
        return product.lista_presentacion[0].producto_id
      } else if (product?.producto_id) {
        return product.producto_id
      }
    },

    getProductPrice(product) {
      if (product?.productogeneral_precio) {
        return Number(product.productogeneral_precio) || 0
      } else if (product?.lista_presentacion && product.lista_presentacion.length > 0) {
        return Number(product.lista_presentacion[0].producto_precio) || 0
      }
      return 0
    },

    buildSignature(product_id, modificadores = []) {
      const aditions = modificadores.map((p) => ({
        id: p.modificadorseleccion_id,
        quantity: p.modificadorseleccion_cantidad,
      }))
      return `${product_id}-${JSON.stringify(aditions)}`
    },

    // ===== Carrito =====
    addProductToCart(product, quantity = 1, additionalItems = []) {
      const basePrice = this.getProductPrice(product)

      const productId = this.getProductId(product) ?? product.producto_id ?? product.productogeneral_id
      const newProduct = {
        pedido_precio: basePrice,
        pedido_escombo: product.productogeneral_escombo,
        pedido_cantidad: quantity,
        pedido_base_price: basePrice,
        pedido_productoid: productId,
        producto_id: productId, // Para validación de descuentos (scope PRODUCT_IDS)
        pedido_descuento: 0,
        categoria_id: product.categoria_id || null,
        pedido_categoriaid: product.categoria_id || null, // Alias para validación por categoría

        lista_productocombo: product.lista_productobase
          ? product.lista_productobase.map((p) => ({
              pedido_productoid: p.producto_id,
              pedido_cantidad: p.productocombo_cantidad,
              pedido_precio: p.productocombo_precio,
              pedido_nombre: p.producto_descripcion,
            }))
          : [],

        pedido_nombre_producto: product.productogeneral_descripcion,

        modificadorseleccionList: additionalItems.map((add) => ({
          modificador_id: add.modificador_id,
          modificadorseleccion_id: add.modificadorseleccion_id,
          pedido_precio: add.modificadorseleccion_precio,
          modificadorseleccion_cantidad: add.modificadorseleccion_cantidad || 1,
          modificadorseleccion_nombre: add.modificadorseleccion_nombre,
        })),

        productogeneral_urlimagen: product.productogeneral_urlimagen,
      }

      const signature = this.buildSignature(newProduct.pedido_productoid, newProduct.modificadorseleccionList)
      newProduct.signature = signature

      const existIndex = this.cart.findIndex((p) => p.signature === signature)

      if (existIndex !== -1) {
        const existingProduct = this.cart[existIndex]
        existingProduct.pedido_cantidad += quantity
      } else {
        this.cart.push(newProduct)
      }

      // ✅ Recalcular descuentos: priorizar cuponera sobre cupón
      if (this.applied_cuponera) {
        this.applyCuponera(this.applied_cuponera)
      } else if (this.applied_coupon) {
        this.applyCoupon(this.applied_coupon)
      }
    },

    removeProductFromCart(signature) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        this.cart.splice(existIndex, 1)
        // ✅ Recalcular descuentos: priorizar cuponera sobre cupón
        if (this.applied_cuponera) {
          this.applyCuponera(this.applied_cuponera)
        } else if (this.applied_coupon) {
          this.applyCoupon(this.applied_coupon)
        }
      }
    },

    decrementProduct(signature) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        const existingProduct = this.cart[existIndex]
        existingProduct.pedido_cantidad -= 1
        if (existingProduct.pedido_cantidad <= 0) {
          this.cart.splice(existIndex, 1)
        }
        // ✅ Recalcular descuentos: priorizar cuponera sobre cupón
        if (this.applied_cuponera) {
          this.applyCuponera(this.applied_cuponera)
        } else if (this.applied_coupon) {
          this.applyCoupon(this.applied_coupon)
        }
      }
    },

    incrementProduct(signature) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        const existingProduct = this.cart[existIndex]
        existingProduct.pedido_cantidad += 1
        // ✅ Recalcular descuentos: priorizar cuponera sobre cupón
        if (this.applied_cuponera) {
          this.applyCuponera(this.applied_cuponera)
        } else if (this.applied_coupon) {
          this.applyCoupon(this.applied_coupon)
        }
      }
    },

    incrementAdditional(signature, additionalItem) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        const existingProduct = this.cart[existIndex]
        const aditional = existingProduct.modificadorseleccionList.find((a) => a === additionalItem)
        if (aditional) aditional.modificadorseleccion_cantidad++
      }
    },

    decrementAdditional(signature, additionalItem) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        const existingProduct = this.cart[existIndex]
        const aditionalIndex = existingProduct.modificadorseleccionList.findIndex((a) => a === additionalItem)

        if (aditionalIndex !== -1) {
          const target = existingProduct.modificadorseleccionList[aditionalIndex]
          target.modificadorseleccion_cantidad--

          if (target.modificadorseleccion_cantidad < 1) {
            existingProduct.modificadorseleccionList.splice(aditionalIndex, 1)
          }
        }
      }
    },
  },
})
