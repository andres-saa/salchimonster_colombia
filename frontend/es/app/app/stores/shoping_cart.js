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
      
      // Guardar cuponera aplicada
      this.applied_cuponera = {
        ...cuponeraData,
        _isCuponera: true
      }
      
      // Limpiar cupón normal si había uno
      this.applied_coupon = null
      
      // Aplicar descuento en el carrito
      if (!Array.isArray(this.cart) || this.cart.length === 0) return
      
      const clampNonNegativeInt = (n) => {
        n = Number.isFinite(n) ? Math.floor(n) : 0
        return n < 0 ? 0 : n
      }
      
      // ===== BUY_M_PAY_N: Lleva M paga N =====
      if (cuponeraData.buy_m_pay_n && cuponeraData.m != null && cuponeraData.n != null) {
        const m = Number(cuponeraData.m) || 3
        const n = Number(cuponeraData.n) || 2
        const selectionRule = (cuponeraData.selection_rule || 'CHEAPEST_UNITS').toUpperCase()
        const maxGroups = cuponeraData.max_groups != null ? Number(cuponeraData.max_groups) : null

        const isEligible = (item) => {
          if (cuponeraData.scope_type === 'CATEGORY') {
            const ids = (cuponeraData.category_ids || []).map(id => String(id))
            return ids.includes(String(item.categoria_id || item.pedido_categoriaid || ''))
          }
          if (cuponeraData.scope_type === 'PRODUCT') {
            const ids = (cuponeraData.product_ids || []).map(id => String(id))
            const pid = String(item.pedido_productoid || item.producto_id || item.productogeneral_id || '')
            return ids.includes(pid)
          }
          return true
        }

        this.cart.forEach((item) => { item.pedido_descuento = 0 })
        const units = []
        for (const item of this.cart) {
          if (!isEligible(item)) continue
          const qty = Number(item.pedido_cantidad) || 1
          const price = Number(item.pedido_base_price) || 0
          for (let i = 0; i < qty; i++) {
            units.push({ item, price })
          }
        }
        const totalEligible = units.length
        let groups = Math.floor(totalEligible / m)
        if (maxGroups != null && maxGroups > 0) groups = Math.min(groups, maxGroups)
        const discountUnits = groups * (m - n)
        this.applied_cuponera._buyMPayNInCart = totalEligible >= m
        this.applied_cuponera._buyMPayNNeedsMore = totalEligible < m
        if (discountUnits <= 0) return
        units.sort((a, b) => selectionRule === 'MOST_EXPENSIVE_UNITS' ? b.price - a.price : a.price - b.price)
        const toDiscount = units.slice(0, discountUnits)
        const discountByItem = new Map()
        for (const { item } of toDiscount) {
          const prev = discountByItem.get(item) || { item, count: 0 }
          prev.count++
          discountByItem.set(item, prev)
        }
        for (const { item, count } of discountByItem.values()) {
          const qty = Number(item.pedido_cantidad) || 1
          const basePrice = Number(item.pedido_base_price) || 0
          const totalDiscount = basePrice * count
          item.pedido_descuento = clampNonNegativeInt(totalDiscount / qty)
        }
        this.applied_cuponera._buyMPayNInCart = true
        this.applied_cuponera._buyMPayNNeedsMore = false
        return
      }

      // ===== FREE_ITEM: Producto gratis =====
      if (cuponeraData.free_item && cuponeraData.free_product) {
        const freeProductId = String(cuponeraData.free_product.product_id)
        const maxFreeQty = cuponeraData.free_product.max_qty || 1
        
        // Primero resetear descuentos
        this.cart.forEach((item) => {
          item.pedido_descuento = 0
        })
        
        // Buscar el producto gratis en el carrito
        for (const item of this.cart) {
          const itemProductId = String(
            item.pedido_productoid || 
            item.producto_id || 
            item.productogeneral_id || 
            this.getProductId(item) || 
            ''
          )
          
          if (itemProductId === freeProductId) {
            const qty = Number(item.pedido_cantidad) || 1
            const unitsToDiscount = Math.min(qty, maxFreeQty)
            const basePrice = Number(item.pedido_base_price) || 0
            
            item.pedido_descuento = clampNonNegativeInt((basePrice * unitsToDiscount) / qty)
            
            this.applied_cuponera._freeProductInCart = true
            this.applied_cuponera._freeProductApplied = {
              product_id: freeProductId,
              units_discounted: unitsToDiscount,
              discount_amount: basePrice * unitsToDiscount
            }
            break
          }
        }
        
        if (!this.applied_cuponera._freeProductInCart) {
          this.applied_cuponera._freeProductInCart = false
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
      // Porcentaje
      if (cuponeraData.percent != null) {
        const decimal = Number(cuponeraData.percent) / 100
        this.cart.forEach((item) => {
          const basePrice = Number(item.pedido_base_price) || 0
          item.pedido_descuento = clampNonNegativeInt(basePrice * decimal)
        })
      }
      // Monto fijo
      else if (cuponeraData.amount != null) {
        const totalUnits = this.totalItems
        if (!totalUnits) return
        
        const discountPerUnit = clampNonNegativeInt(Number(cuponeraData.amount) / totalUnits)
        
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

      const newProduct = {
        pedido_precio: basePrice,
        pedido_escombo: product.productogeneral_escombo,
        pedido_cantidad: quantity,
        pedido_base_price: basePrice,
        pedido_productoid: this.getProductId(product),
        pedido_descuento: 0,
        categoria_id: product.categoria_id || null, // ✅ Guardar categoría para descuentos por categoría

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
