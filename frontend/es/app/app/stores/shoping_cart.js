import { defineStore } from 'pinia'

/** ✅ Soporta respuestas tipo: { data: [coupon] } o coupon directo */
function normalizeCoupon(c) {
  if (!c) return null
  if (Array.isArray(c.data)) return c.data[0] || null
  return c
}

export const usecartStore = defineStore('salchi_supegwseasr_cart_web443', {
  persist: {
    key: 'salchi_surep34er_gsacaret_web4eddf43ssv',
    paths: [
      'cart',
      'last_order',
      'menu',
      'address_details',
      'applied_coupon',
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

      // ✅ Recalcular descuentos si hay cupón y carrito
      if (ctx.store.applied_coupon && Array.isArray(ctx.store.cart) && ctx.store.cart.length > 0) {
        ctx.store.applyCoupon(ctx.store.applied_coupon)
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
    // ✅ Setter seguro (persistente)
    setCouponUi(patch) {
      if (!this.coupon_ui) this.coupon_ui = { enabled: false, draft_code: '' }
      this.coupon_ui = { ...this.coupon_ui, ...patch }
    },

    // ===== LÓGICA DE CUPONES =====
    applyCoupon(coupon) {
      coupon = normalizeCoupon(coupon)
      if (!coupon) return

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

      // ✅ Si hay cupón aplicado, recalcula descuentos
      if (this.applied_coupon) {
        this.applyCoupon(this.applied_coupon)
      }
    },

    removeProductFromCart(signature) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        this.cart.splice(existIndex, 1)
        if (this.applied_coupon) this.applyCoupon(this.applied_coupon)
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
        if (this.applied_coupon) this.applyCoupon(this.applied_coupon)
      }
    },

    incrementProduct(signature) {
      const existIndex = this.cart.findIndex((p) => p.signature === signature)
      if (existIndex !== -1) {
        const existingProduct = this.cart[existIndex]
        existingProduct.pedido_cantidad += 1
        if (this.applied_coupon) this.applyCoupon(this.applied_coupon)
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
