<template>
  <div class="checkout-page">


    <Transition name="fade">
      <div v-if="isRedirecting" class="redirect-overlay">
        <div class="redirect-content">
          <div class="redirect-spinner">
            <Icon name="mdi:rocket-launch-outline" size="3em" class="rocket-icon" />
            <div class="pulse-ring"></div>
          </div>
          <h2 class="redirect-title">Te estamos llevando a</h2>
          <h3 class="redirect-store">{{ targetSiteName }}</h3>
          <p class="redirect-subtitle">Transfiriendo tu pedido...</p>
        </div>
      </div>
    </Transition>

    <div class="checkout-layout">
      <header class="page-header">
        <h1>{{ t('finalize_purchase') }}</h1>
      </header>

      <div class="checkout-grid">
        <div class="form-column">
          <div class="card card-tabs" v-if="computedOrderTypesVisible.length > 0">
            <div class="tabs-container">
              <label
                v-for="opt in computedOrderTypesVisible"
                :key="opt.id"
                class="tab-item"
                :class="{ 'is-active': orderTypeIdStr === String(opt.id) }"
              >
                <input
                  type="radio"
                  name="order_type"
                  :value="String(opt.id)"
                  v-model="orderTypeIdStr"
                  class="hidden-radio"
                />
                <span class="tab-label">{{ opt.name }}</span>
              </label>
            </div>
          </div>
          <div v-else class="card loading-card">
            <Icon name="svg-spinners:3-dots-fade" size="24" />
            <p>{{ lang === 'en' ? 'Loading delivery options...' : 'Cargando opciones de entrega...' }}</p>
          </div>

          <!-- Cuponera al inicio: código para autocompletar datos -->
          <section class="card form-section cuponera-top">
            <h2 class="section-title">
              <Icon name="mdi:ticket-account-outline" size="22" />
              {{ lang === 'en' ? 'Have a cuponera?' : '¿Tienes cuponera?' }}
            </h2>
            <p class="cuponera-subtitle">
              {{ lang === 'en' ? 'Enter your code and your data will be filled in automatically.' : 'Ingresa tu código y se completarán tus datos automáticamente.' }}
            </p>
            <div class="cuponera-input-row">
              <input
                type="text"
                v-model="cuponeraCodeInput"
                :placeholder="t('code_placeholder')"
                :disabled="temp_code?.status === 'active'"
                class="cuponera-input"
              />
              <button
                v-if="temp_code?.status === 'active'"
                class="btn-coupon remove"
                @click="clearCuponeraTop"
                type="button"
              >
                <Icon name="mdi:trash-can-outline" />
              </button>
              <button
                v-else
                class="btn-coupon apply"
                @click="applyCuponeraFromTop"
                :disabled="!cuponeraCodeInput?.trim() || isApplyingCoupon"
                type="button"
              >
                {{ isApplyingCoupon ? (lang === 'en' ? 'Applying...' : 'Aplicando...') : (lang === 'en' ? 'Apply' : 'Aplicar') }}
              </button>
            </div>
            <div
              v-if="temp_code?.status"
              class="coupon-feedback cuponera-feedback"
              :class="temp_code.status === 'active' ? 'positive' : 'negative'"
            >
              <Icon :name="temp_code.status === 'active' ? 'mdi:check-circle' : 'mdi:alert-circle'" size="18" />
              <div class="feedback-info">
                <template v-if="temp_code.status === 'active'">
                  <span class="discount-title">{{ temp_code.discount_name }}</span>
                  <span v-if="store.applied_coupon?._fromCuponera" class="data-filled-msg">
                    {{ lang === 'en' ? 'Your data has been filled in.' : 'Tus datos se han completado.' }}
                  </span>
                  <span class="discount-amount" v-if="temp_code.free_item || temp_code.free_product">
                    <Icon name="mdi:gift-outline" size="16" />
                    {{ temp_code.free_product?.name || (lang === 'en' ? 'Free product' : 'Producto gratis') }}
                    <template v-if="store.applied_cuponera?._requiresPurchaseNotMet">
                      <span class="product-note warning">
                        <Icon name="mdi:alert" size="14" />
                        <template v-if="store.applied_cuponera._requiresPurchaseType === 'MIN_SUBTOTAL_IN_SCOPE'">
                          <template v-if="lang === 'en'">To get it free: spend at least {{ formatCOP(store.applied_cuponera._requiresPurchaseMinSubtotal ?? 0) }} on {{ (temp_code.discount_categories?.length ? temp_code.discount_categories.map(c => c.name).join(', ') : temp_code.discount_products?.length ? temp_code.discount_products.map(p => p.name).join(', ') : 'selected items') }}. (So far: {{ formatCOP(store.applied_cuponera._subtotalInScope ?? 0) }})</template>
                          <template v-else>Para llevártelo gratis: compra mínimo {{ formatCOP(store.applied_cuponera._requiresPurchaseMinSubtotal ?? 0) }} en {{ (temp_code.discount_categories?.length ? temp_code.discount_categories.map(c => c.name).join(', ') : temp_code.discount_products?.length ? temp_code.discount_products.map(p => p.name).join(', ') : 'productos aplicables') }}. (Llevas: {{ formatCOP(store.applied_cuponera._subtotalInScope ?? 0) }})</template>
                        </template>
                        <template v-else-if="store.applied_cuponera._requiresPurchaseType === 'MIN_QTY_IN_SCOPE'">
                          {{ lang === 'en' ? 'Add at least' : 'Agrega al menos' }} {{ store.applied_cuponera._requiresPurchaseMinQty ?? temp_code.requires_purchase?.min_qty ?? 1 }} {{ lang === 'en' ? 'units of' : 'unidades de' }}
                          <template v-if="temp_code.discount_products?.length">{{ temp_code.discount_products.map(p => p.name).join(', ') }}</template>
                          <template v-else-if="temp_code.discount_categories?.length">{{ temp_code.discount_categories.map(c => c.name).join(', ') }}</template>
                          <template v-else>{{ lang === 'en' ? 'these products' : 'estos productos' }}</template>
                          {{ lang === 'en' ? ' to get the free product' : ' y te lo regalamos' }}
                        </template>
                        <template v-else>
                          {{ lang === 'en' ? 'Add at least' : 'Agrega al menos' }} {{ temp_code.requires_purchase?.buy_x ?? store.applied_cuponera._requiresPurchaseBuyX ?? 2 }} {{ lang === 'en' ? 'products from' : 'productos de' }}
                          <template v-if="temp_code.discount_products?.length">{{ temp_code.discount_products.map(p => p.name).join(', ') }}</template>
                          <template v-else-if="temp_code.discount_categories?.length">{{ temp_code.discount_categories.map(c => c.name).join(', ') }}</template>
                          <template v-else>{{ lang === 'en' ? 'this category' : 'esta categoría' }}</template>
                          {{ lang === 'en' ? ' to get the free product' : ' y te lo regalamos' }}
                        </template>
                      </span>
                    </template>
                    <template v-else-if="store.applied_cuponera?._freeProductInCart">
                      <span class="product-note applied">
                        <Icon name="mdi:check" size="14" />
                        <template v-if="store.applied_cuponera._freeProductApplied?.units_in_cart > store.applied_cuponera._actualMaxFree">
                          ({{ store.applied_cuponera._actualMaxFree }} {{ lang === 'en' ? 'of' : 'de' }} {{ store.applied_cuponera._freeProductApplied.units_in_cart }} {{ lang === 'en' ? 'free' : 'gratis' }})
                        </template>
                        <template v-else>
                          ({{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }})
                        </template>
                      </span>
                    </template>
                    <template v-else>
                      <span class="product-note warning">
                        <Icon name="mdi:alert" size="14" />
                        ({{ lang === 'en' ? 'Add to cart to apply discount' : 'Agrégalo al carrito para aplicar el descuento' }})
                      </span>
                    </template>
                  </span>
                  <span class="discount-amount" v-else-if="temp_code.amount && temp_code.amount > 0">
                    {{ lang === 'en' ? 'You save' : 'Ahorras' }}: <strong>{{ formatCOP(temp_code.amount) }}</strong>
                    <span v-if="temp_code.discount_categories?.length" class="scope-info">
                      <br>{{ lang === 'en' ? 'On:' : 'En:' }} {{ temp_code.discount_categories.map(c => c.name).join(', ') }}
                      <template v-if="store.applied_cuponera?._categoryProductInCart === false">
                        <span class="product-note warning">
                          <br><Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add a product from this category to apply' : 'Agrega un producto de esta categoría para aplicar' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._categoryProductInCart === true">
                        <span class="product-note applied">
                          <br><Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                    <span v-if="temp_code.discount_products?.length" class="scope-info">
                      <br>{{ lang === 'en' ? 'On:' : 'En:' }} {{ temp_code.discount_products.map(p => p.name).join(', ') }}
                      <template v-if="store.applied_cuponera?._productScopeInCart === false">
                        <span class="product-note warning">
                          <br><Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add one of these products to apply' : 'Agrega uno de estos productos para aplicar' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._productScopeInCart === true">
                        <span class="product-note applied">
                          <br><Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                  </span>
                  <span class="discount-amount" v-else-if="temp_code.percent">
                    {{ lang === 'en' ? 'You save' : 'Ahorras' }}: <strong>{{ temp_code.percent }}%</strong>
                    <span v-if="temp_code.discount_categories?.length" class="scope-info">
                      <br>{{ lang === 'en' ? 'On:' : 'En:' }} {{ temp_code.discount_categories.map(c => c.name).join(', ') }}
                      <template v-if="store.applied_cuponera?._categoryProductInCart === false">
                        <span class="product-note warning">
                          <br><Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add a product from this category to apply' : 'Agrega un producto de esta categoría para aplicar' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._categoryProductInCart === true">
                        <span class="product-note applied">
                          <br><Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                    <span v-if="temp_code.discount_products?.length" class="scope-info">
                      <br>{{ lang === 'en' ? 'On:' : 'En:' }} {{ temp_code.discount_products.map(p => p.name).join(', ') }}
                      <template v-if="store.applied_cuponera?._productScopeInCart === false">
                        <span class="product-note warning">
                          <br><Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add one of these products to apply' : 'Agrega uno de estos productos para aplicar' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._productScopeInCart === true">
                        <span class="product-note applied">
                          <br><Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                  </span>
                  <span class="discount-amount" v-else-if="temp_code.buy_m_pay_n">
                    <Icon name="mdi:package-variant" size="16" />
                    {{ lang === 'en' ? 'Buy' : 'Lleva' }} {{ temp_code.m }} {{ lang === 'en' ? 'pay' : 'paga' }} {{ temp_code.n }}
                    <span v-if="temp_code.discount_categories?.length" class="scope-info">
                      <br>{{ lang === 'en' ? 'On:' : 'En:' }} {{ temp_code.discount_categories.map(c => c.name).join(', ') }}
                      <template v-if="store.applied_cuponera?._buyMPayNNeedsMore">
                        <span class="product-note warning">
                          <br><Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add at least' : 'Agrega al menos' }} {{ temp_code.m }} {{ lang === 'en' ? 'of the same product to apply (e.g. 3 of the same)' : 'del mismo producto para aplicar (ej. 3 del mismo)' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._buyMPayNInCart">
                        <span class="product-note applied">
                          <br><Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                    <span v-else-if="temp_code.discount_products?.length" class="scope-info">
                      <br>{{ lang === 'en' ? 'On:' : 'En:' }} {{ temp_code.discount_products.map(p => p.name).join(', ') }}
                      <template v-if="store.applied_cuponera?._buyMPayNNeedsMore">
                        <span class="product-note warning">
                          <br><Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add at least' : 'Agrega al menos' }} {{ temp_code.m }} {{ lang === 'en' ? 'of the same product to apply (e.g. 3 of the same)' : 'del mismo producto para aplicar (ej. 3 del mismo)' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._buyMPayNInCart">
                        <span class="product-note applied">
                          <br><Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                    <span v-else class="scope-info">
                      <template v-if="store.applied_cuponera?._buyMPayNNeedsMore">
                        <span class="product-note warning">
                          <Icon name="mdi:alert" size="14" />
                          {{ lang === 'en' ? 'Add at least' : 'Agrega al menos' }} {{ temp_code.m }} {{ lang === 'en' ? 'of the same product to apply (e.g. 3 of the same)' : 'del mismo producto para aplicar (ej. 3 del mismo)' }}
                        </span>
                      </template>
                      <template v-else-if="store.applied_cuponera?._buyMPayNInCart">
                        <span class="product-note applied">
                          <Icon name="mdi:check" size="14" />
                          {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                        </span>
                      </template>
                    </span>
                  </span>
                  <span class="discount-amount" v-else-if="temp_code.buy_x_get_y_pct_off">
                    <Icon name="mdi:percent-outline" size="16" />
                    {{ lang === 'en' ? 'Buy' : 'Compra' }} {{ temp_code.buy_qty }} {{ lang === 'en' ? 'get' : 'lleva' }} {{ temp_code.get_qty }} {{ lang === 'en' ? 'more at' : 'más al' }} {{ temp_code.y_discount_pct }}% {{ lang === 'en' ? 'off' : 'de descuento' }}
                    <template v-if="store.applied_cuponera?._buyXGetYPctOffNeedsMore">
                      <span class="product-note warning">
                        <br><Icon name="mdi:alert" size="14" />
                        {{ lang === 'en' ? 'Add at least' : 'Agrega al menos' }} {{ temp_code.buy_qty + temp_code.get_qty }} {{ lang === 'en' ? 'of the same product to apply' : 'del mismo producto para aplicar' }}
                      </span>
                    </template>
                    <template v-else-if="store.applied_cuponera?._buyXGetYPctOffInCart">
                      <span class="product-note applied">
                        <br><Icon name="mdi:check" size="14" />
                        {{ lang === 'en' ? 'Applied!' : '¡Aplicado!' }}
                      </span>
                    </template>
                  </span>
                  <span v-if="temp_code.min_purchase != null && temp_code.min_purchase > 0" class="discount-condition">
                    {{ lang === 'en' ? 'Min. purchase' : 'Compra mín.' }}: <strong>{{ formatCOP(temp_code.min_purchase) }}</strong>
                  </span>
                  <span v-if="temp_code.max_discount_amount != null && temp_code.max_discount_amount > 0" class="discount-condition">
                    {{ lang === 'en' ? 'Max. discount' : 'Máx. descuento' }}: <strong>{{ formatCOP(temp_code.max_discount_amount) }}</strong>
                  </span>
                  <span v-if="temp_code.uses_remaining_today != null" class="uses-remaining">
                    {{ lang === 'en' ? 'You have' : 'Te quedan' }} <strong>{{ temp_code.uses_remaining_today }}</strong> {{ lang === 'en' ? 'uses left today' : 'usos hoy' }}
                  </span>
                </template>
                <template v-else>
                  <span>{{
                    temp_code.status === 'invalid_site'
                      ? (lang === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual')
                      : temp_code.status === 'min_purchase'
                      ? temp_code.detail
                      : (temp_code.detail || (lang === 'en' ? 'Invalid code' : 'Código no válido'))
                  }}</span>
                </template>
              </div>
            </div>
          </section>

          <section class="card form-section">
            <h2 class="section-title">Datos Personales</h2>

            <div class="form-row split">
              <div class="form-group">
                <label>{{ t('first_name') }} <span style="color: red;">*</span></label>
                <InputText type="text" class="input-modern" v-model="user.user.first_name" :placeholder="t('first_name')" />
              </div>
              <div class="form-group">
                <label>{{ t('last_name') }} <span style="color: red;">*</span></label>
                <InputText type="text" class="input-modern" v-model="user.user.last_name" :placeholder="t('last_name')" />
              </div>
            </div>

            <div class="form-row split">
              <div class="form-group">
                <label>{{ t('phone') }}</label>

                <div class="phone-control">
                  <div class="country-select" v-click-outside="() => (showCountryDropdown = false)">
                    <button type="button" class="country-trigger" @click="toggleCountryDropdown">
                      <img v-if="user.user.phone_code?.flag" :src="user.user.phone_code.flag" alt="flag" />
                      <span>{{ user.user.phone_code?.dialCode || '+57' }}</span>
                      <Icon name="mdi:chevron-down" size="14" />
                    </button>

                    <div v-if="showCountryDropdown" class="country-dropdown">
                      <InputText
                        type="text"
                        class="search-mini"
                        v-model="countryQuery"
                        :placeholder="t('search_country_or_code')"
                        ref="countryInputRef"
                        @input="onCountryInput"
                      />
                      <ul>
                        <li v-for="c in countrySuggestions" :key="c.code" @click="selectCountry(c)">
                          <img :src="c.flag" class="flag-mini" />
                          {{ c.name }} <small>({{ c.dialCode }})</small>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <InputText
                    type="tel"
                    class="input-modern input-phone"
                    v-model="user.user.phone_number"
                    @blur="formatPhoneOnBlur"
                    :placeholder="'300 000 0000'"
                  />
                </div>
                <span v-if="phoneError" class="field-error">{{ phoneError }}</span>
              </div>

              <div class="form-group">
                <label>{{ t('email') }} <span style="color: red;">*</span></label>
                <InputText 
                  type="email" 
                  class="input-modern" 
                  v-model="user.user.email" 
                  :placeholder="t('email')"
                  @blur="validateEmail"
                  @input="emailError = ''"
                />
                <span v-if="emailError" class="field-error">{{ emailError }}</span>
              </div>
            </div>
          </section>

          <section class="card form-section">
            <h2 class="section-title">
              {{
                [2, 6].includes(user.user.order_type?.id)
                  ? (user.user.order_type?.id === 6 ? 'En el Local' : t('site_recoger'))
                  : t('address')
              }}
            </h2>

            <div v-if="!user.user.order_type || ![2, 6].includes(user.user.order_type.id)" class="address-selector">
              <div
                class="address-card"
                :class="{ 'has-address': user.user.address, 'no-address': !user.user.address }"
                @click="openUnifiedModal"
              >
                <div class="icon-box-addr">
                  <Icon name="mdi:map-marker" />
                </div>

                <div class="addr-info">
                  <span v-if="user.user.address" class="addr-title">{{ user.user.address }}</span>
                  <span v-else class="addr-placeholder">{{ t('address_placeholder') }}</span>

                  <div v-if="user.user.address || siteStore.location?.neigborhood" class="addr-meta">
                     <span class="badge badge-neighborhood" v-if="siteStore.location?.neigborhood?.name">
                      {{ siteStore.location.neigborhood.name }}
                    </span>
                    <span class="badge badge-delivery">
                      {{
                        siteStore?.location?.neigborhood?.delivery_price != null
                          ? formatCOP(siteStore.location.neigborhood.delivery_price)
                          : (lang === 'en' ? 'Free Shipping' : 'Envío Gratis')
                      }}
                    </span>
                    <span v-if="siteStore?.location?.site?.site_name" class="site-name">
                      • {{ siteStore.location.site.site_name }}
                    </span>
                  </div>
                </div>

                <div class="action-arrow">
                  <Icon :name="user.user.address ? 'mdi:pencil' : 'mdi:plus'" />
                </div>
              </div>
            </div>

            <div v-else class="address-selector">
              <div class="address-card has-address" @click="siteStore.setVisible('currentSiteRecoger', true)">
                <div class="icon-box-addr pickup"><Icon name="mdi:store-marker" /></div>
                <div class="addr-info">
                  <span class="addr-title">{{ siteStore?.location?.site?.site_name || t('site_selector') }}</span>
                  <span class="addr-text">{{ siteStore?.location?.site?.site_address }}</span>
                </div>
                <div class="action-arrow"><Icon name="mdi:chevron-right" /></div>
              </div>

              <div
                v-if="[33, 35, 36].includes(siteStore.location?.site?.site_id) && user.user.order_type?.id === 2"
                class="form-group mt-3"
              >
                <label>{{ t('vehicle_plate') }}</label>
                <input type="text" class="input-modern" v-model="user.user.placa" placeholder="ABC-123" />
              </div>
            </div>
          </section>

          <section class="card form-section">
            <h2 class="section-title">Pago & Detalles</h2>

            <!-- ✅ CUPONES NORMALES - Solo se muestra si NO hay cuponera activa -->
            <div v-if="!store.applied_cuponera" class="coupon-wrapper">
              <div class="coupon-toggle" @click="toggleCouponUi">
                <div class="coupon-left">
                  <Icon name="mdi:ticket-percent-outline" size="20" />
                  <span>{{ t('code') }}</span>
                </div>
                <div class="switch" :class="{ 'on': have_discount }">
                  <div class="knob"></div>
                </div>
              </div>

              <div v-if="have_discount" class="coupon-content">
                <div class="coupon-input-row">
                  <input
                    type="text"
                    v-model="temp_discount"
                    :placeholder="t('code_placeholder')"
                    :disabled="temp_code?.status === 'active'"
                  />

                  <button
                    v-if="temp_code?.status === 'active'"
                    class="btn-coupon remove"
                    @click="clearCoupon"
                    type="button"
                  >
                    <Icon name="mdi:trash-can-outline" />
                  </button>

                  <button
                    v-else
                    class="btn-coupon apply"
                    @click="validateDiscount(temp_discount, { silent: false })"
                    :disabled="!temp_discount || isApplyingCoupon"
                    type="button"
                  >
                    {{ isApplyingCoupon ? (lang === 'en' ? 'Applying...' : 'Aplicando...') : (lang === 'en' ? 'Apply' : 'Aplicar') }}
                  </button>
                </div>

                <div
                  v-if="temp_code?.status"
                  class="coupon-feedback"
                  :class="temp_code.status === 'active' ? 'positive' : 'negative'"
                >
                  <Icon :name="temp_code.status === 'active' ? 'mdi:check-circle' : 'mdi:alert-circle'" size="18" />
                  <div class="feedback-info">
                    <template v-if="temp_code.status === 'active'">
                      <span class="discount-title">{{ temp_code.discount_name }}</span>
                      <span class="discount-amount" v-if="temp_code.free_item">
                        <Icon name="mdi:gift-outline" size="16" />
                        {{ lang === 'en' ? 'Free product' : 'Producto gratis' }}
                      </span>
                      <span class="discount-amount" v-else-if="temp_code.amount && temp_code.amount > 0">
                        Ahorras: <strong>{{ formatCOP(temp_code.amount) }}</strong>
                      </span>
                      <span class="discount-amount" v-else-if="temp_code.percent">
                        Ahorras: <strong>{{ temp_code.percent }}%</strong>
                      </span>
                      <span v-if="temp_code.min_purchase != null && temp_code.min_purchase > 0" class="discount-condition">
                        {{ lang === 'en' ? 'Min. purchase' : 'Compra mín.' }}: <strong>{{ formatCOP(temp_code.min_purchase) }}</strong>
                      </span>
                      <span v-if="temp_code.max_discount_amount != null && temp_code.max_discount_amount > 0" class="discount-condition">
                        {{ lang === 'en' ? 'Max. discount' : 'Máx. descuento' }}: <strong>{{ formatCOP(temp_code.max_discount_amount) }}</strong>
                      </span>
                      <span v-if="temp_code.uses_remaining_today != null" class="uses-remaining">
                        {{ lang === 'en' ? 'You have' : 'Te quedan' }} <strong>{{ temp_code.uses_remaining_today }}</strong> {{ lang === 'en' ? 'uses left today' : 'usos hoy' }}
                      </span>
                    </template>
                    <template v-else>
                      <span>
                        {{
                          temp_code.status === 'invalid_site'
                            ? (lang === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual')
                            : temp_code.status === 'min_purchase'
                            ? temp_code.detail
                            : (temp_code.detail || (lang === 'en' ? 'Invalid code' : 'Código no válido'))
                        }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group" v-if="computedPaymentOptions.length > 0">
              <label>{{ t('payment_method') }}</label>
              <Select
                v-model="user.user.payment_method_option"
                :options="computedPaymentOptions"
                optionLabel="name"
                placeholder="Selecciona una opción"
                class="pv-select pv-select-payment input-modern with-icon"
              />
            </div>

            <div class="form-group" style="margin-top: 1rem;">
              <label>{{ t('notes') }}</label>
              <Textarea
                class="input-modern"
                rows="3"
                v-model="store.order_notes"
                :placeholder="t('additional_notes')"
              ></Textarea>
            </div>
          </section>
        </div>

        <resumen />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import resumen from '../resumen.vue'
import { usecartStore, useSitesStore, useUserStore } from '#imports'
import { URI } from '~/service/conection'
import { redeemCuponeraCode, mapCuponeraDiscountToCoupon } from '~/service/cuponeraService'
import { buildCountryOptions } from '~/service/utils/countries'
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

/* ================= STORES & CONFIG ================= */
const user = useUserStore()
const siteStore = useSitesStore()
const store = usecartStore()
const runtimeConfig = useRuntimeConfig()

/* ================= v-click-outside ================= */
const vClickOutside = {
  mounted(el, binding) {
    el.__clickOutsideHandler__ = (evt) => {
      if (!el.contains(evt.target)) binding.value?.(evt)
    }
    document.addEventListener('click', el.__clickOutsideHandler__, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el.__clickOutsideHandler__, true)
    el.__clickOutsideHandler__ = null
  }
}

/* ================= Helpers ================= */
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'x-x-4-y-x'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16) })
}
const apiFetch = async (url) => (await fetch(url)).json()
const pickCoupon = (p) => (!p ? null : (Array.isArray(p.data) ? p.data[0] || null : (p.code ? p : null)))
const getErrorDetail = (p) => (!p ? null : (typeof p.detail==='string' ? p.detail : (p.message || null)))

/* ================= Config & State ================= */
const sitePaymentsComplete = ref([])
const MAIN_DOMAIN = 'salchimonster.com'
const isRedirecting = ref(false)
const targetSiteName = ref('')

/* ================= i18n ================= */
const lang = computed(() => (user?.lang?.name || 'es').toString().toLowerCase() === 'en' ? 'en' : 'es')
const DICT = {
  es: {
    finalize_purchase: 'Finalizar Compra',
    name: 'Nombre Completo',
    first_name: 'Nombre',
    last_name: 'Apellido',
    phone: 'Celular',
    site_recoger: 'Sede para Recoger',
    payment_method: 'Método de Pago',
    notes: 'Notas del pedido',
    code: '¿Tienes un cupón?',
    site_selector: 'Seleccionar ubicación',
    address_placeholder: 'Agregar dirección de entrega...',
    delivery_price: 'Costo Domicilio',
    email: 'Correo Electrónico',
    vehicle_plate: 'Placa del vehículo',
    additional_notes: 'Ej: Timbre dañado, dejar en portería...',
    search_country_or_code: 'Buscar país...',
    address: 'Dirección de Entrega',
    code_placeholder: 'Ingresa el código'
  },
  en: {
    finalize_purchase: 'Checkout',
    name: 'Full Name',
    first_name: 'First Name',
    last_name: 'Last Name',
    phone: 'Mobile Phone',
    site_recoger: 'Pickup Location',
    payment_method: 'Payment Method',
    notes: 'Order Notes',
    code: 'Have a coupon?',
    site_selector: 'Select Location',
    address_placeholder: 'Add delivery address...',
    delivery_price: 'Delivery Fee',
    email: 'Email',
    vehicle_plate: 'Vehicle Plate',
    additional_notes: 'Ex: Doorbell broken...',
    search_country_or_code: 'Search country...',
    address: 'Delivery Address',
    code_placeholder: 'Enter code'
  }
}
const t = (key) => DICT[lang.value]?.[key] || DICT.es[key] || key

const formatCOP = (v) => v === 0 ? 'Gratis' : new Intl.NumberFormat(lang.value === 'en' ? 'en-CO' : 'es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

/* ================= MODAL UNIFICADO ================= */
const openUnifiedModal = () => {
  // Simplemente le decimos al store que muestre el SiteDialog
  siteStore.setVisible('currentSite', true)
}

/* ================= Teléfono ================= */
const phoneError = ref('')
const countrySuggestions = ref([])
const countries = ref([])
const showCountryDropdown = ref(false)
const countryQuery = ref('')

/* ================= Email ================= */
const emailError = ref('')

// Función para validar email
const validateEmail = () => {
  const email = user.user.email?.toString().trim() || ''
  emailError.value = ''
  
  if (!email) {
    emailError.value = lang.value === 'en' ? 'Email is required' : 'El correo electrónico es obligatorio'
    return false
  }
  
  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    emailError.value = lang.value === 'en' ? 'Please enter a valid email address' : 'Por favor ingresa un correo electrónico válido'
    return false
  }
  
  return true
}

const norm = (s) => (s || '').toString().trim().toLowerCase()
const onlyDigits = (s) => (s || '').replace(/\D+/g, '')

const initCountries = () => {
  countries.value = buildCountryOptions(lang.value).map((c) => ({
    ...c,
    dialDigits: (c.dialCode || '').replace(/\D+/g, ''),
    flag: `https://flagcdn.com/h20/${c.code.toLowerCase()}.png`
  }))
  countrySuggestions.value = countries.value.slice(0, 50)
}

const onCountryInput = () => {
  const q = norm(countryQuery.value)
  const qDigits = onlyDigits(countryQuery.value)
  if (!q) { countrySuggestions.value = countries.value.slice(0, 50); return }
  countrySuggestions.value = countries.value.filter(c => (norm(c.name).includes(q) || norm(c.code).includes(q) || (qDigits && c.dialDigits.startsWith(qDigits)))).slice(0, 50)
}

const toggleCountryDropdown = () => {
  showCountryDropdown.value = !showCountryDropdown.value
  if(showCountryDropdown.value) countrySuggestions.value = countries.value.slice(0,50)
}

const selectCountry = (c) => {
  user.user.phone_code = c
  showCountryDropdown.value = false
  countryQuery.value = ''
}

const formatPhoneOnBlur = () => {
  const countryIso = user.user.phone_code?.code
  const phone = parsePhoneNumberFromString(user.user.phone_number || '', countryIso)
  if (phone && phone.isValid()) user.user.phone_number = phone.formatNational()
}

watch([() => user.user.phone_number, () => user.user.phone_code], ([num, country]) => {
  phoneError.value = ''
  if (!num) return
  const phone = parsePhoneNumberFromString((num || '').toString(), country?.code)
  if (phone && phone.isValid()) {
    user.user.phone_e164 = phone.number
  } else {
    user.user.phone_e164 = null
    phoneError.value = lang.value === 'en' ? 'Invalid phone number' : 'Número inválido'
  }
}, { immediate: true })

// Watch para validar email cuando cambia
watch(
  () => user.user.email,
  () => {
    if (user.user.email) {
      validateEmail()
    } else {
      emailError.value = ''
    }
  }
)

/* ================= Tipos de orden / pagos ================= */
const computedOrderTypesVisible = computed(() => {
  const siteId = siteStore.location?.site?.site_id
  if (!siteId || !sitePaymentsComplete.value.length) return []
  const siteConfig = sitePaymentsComplete.value.find((s) => String(s.site_id) === String(siteId))
  return siteConfig?.order_types?.filter((ot) => ot.methods && ot.methods.length > 0) || []
})

const orderTypeIdStr = computed({
  get: () => (user.user.order_type?.id ? String(user.user.order_type.id) : null),
  set: (idStr) => {
    const id = Number(idStr)
    const opt = computedOrderTypesVisible.value.find((o) => o.id === id)
    user.user.order_type = opt
  }
})

const computedPaymentOptions = computed(() => {
  const typeId = user.user.order_type?.id
  if (!typeId) return []
  const selectedOrderType = computedOrderTypesVisible.value.find((ot) => Number(ot.id) === Number(typeId))
  return selectedOrderType?.methods || []
})

const ensureValidOrderTypeForCurrentSite = () => {
  const list = computedOrderTypesVisible.value
  if (list.length === 0) { user.user.order_type = null; return }
  
  // Prioridad 1: Si hay un order_type del dispatcher en sitesStore, sincronizarlo
  const dispatcherOrderType = siteStore.location?.order_type
  if (dispatcherOrderType && dispatcherOrderType.id) {
    const isValidDispatcherType = list.some((o) => Number(o.id) === Number(dispatcherOrderType.id))
    if (isValidDispatcherType) {
      user.user.order_type = dispatcherOrderType
      return
    }
  }
  
  // Prioridad 2: Verificar si el order_type actual es válido
  const currentId = user.user.order_type?.id
  if (currentId && list.some((o) => Number(o.id) === Number(currentId))) {
    return // Ya es válido, no hacer nada
  }
  
  // Prioridad 3: Usar el primero disponible
  user.user.order_type = list[0]
}

watch(() => user.user.order_type, (newType, oldType) => {
  // Limpiar dirección cuando se cambia de delivery a pickup o viceversa
  const wasDelivery = oldType && ![2, 6].includes(oldType.id)
  const isPickup = newType && [2, 6].includes(newType.id)
  const wasPickup = oldType && [2, 6].includes(oldType.id)
  const isDelivery = newType && ![2, 6].includes(newType?.id)
  
  if ((wasDelivery && isPickup) || (wasPickup && isDelivery)) {
    // Limpiar dirección al cambiar entre delivery y pickup
    user.user.address = null
    user.user.lat = null
    user.user.lng = null
    user.user.place_id = null
    user.user.site = null
    // Resetear neighborhood pero mantener la estructura
    if (siteStore.location.neigborhood) {
      siteStore.location.neigborhood.delivery_price = 0
      siteStore.location.neigborhood.name = ''
      siteStore.location.neigborhood.neighborhood_id = null
    }
  }
  
  if (newType?.id === 2 || newType?.id === 6) {
    siteStore.location.neigborhood.delivery_price = 0
  } else {
    const cost = user.user.site?.delivery_cost_cop ?? siteStore?.delivery_price
    if (cost != null) siteStore.location.neigborhood.delivery_price = cost
  }
  
  // Limpiar método de pago si no aplica
  const currentMethodId = user.user.payment_method_option?.id
  const availableMethods = computedPaymentOptions.value
  if (!availableMethods.some((m) => m.id === currentMethodId)) {
    user.user.payment_method_option = null
  }
})

// Limpiar dirección cuando cambia la sede o el modo (barrios a google o viceversa)
watch(
  () => [siteStore.location?.site?.site_id, siteStore.location?.mode],
  ([newSiteId, newMode], [oldSiteId, oldMode]) => {
    // Si cambia la sede o el modo, limpiar dirección (solo si estamos en modo delivery)
    const isDelivery = user.user.order_type && ![2, 6].includes(user.user.order_type.id)
    if (isDelivery && (newSiteId !== oldSiteId || newMode !== oldMode)) {
      user.user.address = null
      user.user.lat = null
      user.user.lng = null
      user.user.place_id = null
      user.user.site = null
      // No limpiar completamente neigborhood, solo resetear delivery_price
      if (siteStore.location.neigborhood) {
        siteStore.location.neigborhood.delivery_price = null
      }
    }
  }
)

/* ================= CUPONES ================= */
const have_discount = computed({
  get: () => !!store.coupon_ui?.enabled,
  set: (v) => store.setCouponUi({ enabled: !!v })
})
const temp_discount = computed({
  get: () => store.applied_coupon?.code || store.coupon_ui?.draft_code || '',
  set: (v) => store.setCouponUi({ draft_code: (v || '').toString() })
})
const temp_code = ref({})
const isApplyingCoupon = ref(false)
const cuponeraCodeInput = ref('')
const cuponeraValidationErrors = ref([]) // ✅ Errores de validación de cuponera

const applyCuponeraFromTop = () => {
  validateCuponera(cuponeraCodeInput.value)
}

const clearCuponeraTop = () => {
  cuponeraCodeInput.value = ''
  temp_code.value = {}
  cuponeraValidationErrors.value = []
  store.removeCuponera()
  store.setCouponUi({ enabled: false, draft_code: '' })
}

// ===== VALIDACIÓN COMPLETA DE CUPONERA =====
const validateCuponera = async (code) => {
  const site = siteStore.location?.site
  if (!site) {
    temp_code.value = { status: 'error', detail: lang.value === 'en' ? 'Select a site first' : 'Selecciona una sede primero' }
    return
  }

  const finalCode = (code || '').toString().trim()
  if (!finalCode) return

  isApplyingCoupon.value = true
  cuponeraValidationErrors.value = []

  try {
    // 1) Llamar a la API de cuponera
    const redeemRes = await redeemCuponeraCode(finalCode, undefined, false, runtimeConfig.public?.cuponeraApi)
    
    if (!redeemRes?.success) {
      temp_code.value = { status: 'invalid', detail: redeemRes?.message || (lang.value === 'en' ? 'Invalid code' : 'Código no válido') }
      store.removeCuponera()
      isApplyingCoupon.value = false
      return
    }

    // 2) VALIDACIÓN DE SEDE
    const siteIds = redeemRes.cuponera_site_ids
    if (Array.isArray(siteIds) && siteIds.length > 0) {
      const siteIdNum = Number(site.site_id)
      if (!siteIds.some((id) => Number(id) === siteIdNum)) {
        temp_code.value = { status: 'invalid_site', detail: lang.value === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual' }
        cuponeraValidationErrors.value.push({ type: 'sede', message: temp_code.value.detail })
        store.removeCuponera()
        isApplyingCoupon.value = false
        return
      }
    }

    // 3) VALIDACIÓN DE USOS RESTANTES
    const usesRemaining = redeemRes.uses_remaining_today ?? 0
    if (usesRemaining <= 0) {
      temp_code.value = { status: 'no_uses', detail: lang.value === 'en' ? 'No uses remaining today' : 'No quedan usos para hoy' }
      cuponeraValidationErrors.value.push({ type: 'usos', message: temp_code.value.detail })
      store.removeCuponera()
      isApplyingCoupon.value = false
      return
    }

    // 4) AUTOCOMPLETAR DATOS DEL USUARIO
    if (redeemRes.user) {
      const u = redeemRes.user
      user.user.first_name = u.first_name || user.user.first_name || ''
      user.user.last_name = u.last_name || user.user.last_name || ''
      if (u.phone) user.user.phone_number = u.phone
      if (u.phone_code) {
        const matchingCountry = countries.value.find(c => c.dialCode === u.phone_code)
        if (matchingCountry) {
          user.user.phone_code = matchingCountry
        }
      }
      if (u.email) user.user.email = u.email
      if (u.address != null) user.user.address = u.address
    }

    // 5) MAPEAR DESCUENTO (solo CART_PERCENT_OFF o CART_AMOUNT_OFF)
    const cuponeraDiscount = mapCuponeraDiscountToCoupon(redeemRes, finalCode, site.site_id)
    
    if (!cuponeraDiscount) {
      // No hay descuento para hoy O el descuento no es válido para esta sede (site_ids del descuento)
      const hasDiscountsButNotForSite = redeemRes.discounts?.length > 0
      const detailMsg = hasDiscountsButNotForSite
        ? (lang.value === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual')
        : (redeemRes.message || (lang.value === 'en' ? 'No discount for today' : 'No hay descuento para hoy'))
      temp_code.value = { 
        status: hasDiscountsButNotForSite ? 'invalid_site' : 'no_discount', 
        detail: detailMsg,
        cuponera_name: redeemRes.cuponera_name,
        uses_remaining_today: usesRemaining
      }
      store.removeCuponera()
      isApplyingCoupon.value = false
      return
    }

    // 6) VALIDACIÓN DE MONTO MÍNIMO
    if (cuponeraDiscount.min_purchase != null && cuponeraDiscount.min_purchase > 0) {
      const subtotal = store.cartSubtotal
      if (subtotal < cuponeraDiscount.min_purchase) {
        const minPurchaseFormatted = formatCOP(cuponeraDiscount.min_purchase)
        temp_code.value = { 
          status: 'min_purchase', 
          detail: lang.value === 'en' ? `Minimum purchase required: ${minPurchaseFormatted}` : `El monto mínimo de compra es: ${minPurchaseFormatted}`, 
          min_purchase: cuponeraDiscount.min_purchase 
        }
        cuponeraValidationErrors.value.push({ type: 'min_purchase', message: temp_code.value.detail, min_purchase: cuponeraDiscount.min_purchase })
        store.removeCuponera()
        isApplyingCoupon.value = false
        return
      }
    }

    // 7) TODO OK - APLICAR CUPONERA
    const cuponeraData = {
      code: finalCode,
      ...cuponeraDiscount,
      uses_remaining_today: usesRemaining,
      cuponera_site_ids: siteIds,
      cuponera_name: redeemRes.cuponera_name,
      free_product: redeemRes.free_product || null
    }
    
    store.applyCuponera(cuponeraData)

    temp_code.value = { 
      ...cuponeraDiscount, 
      status: 'active', 
      discount_name: cuponeraDiscount.discount_name || redeemRes.cuponera_name || 'Cuponera', 
      uses_remaining_today: usesRemaining,
      free_product: redeemRes.free_product || null
    }

  } catch (e) {
    console.error('Error validando cuponera:', e)
    temp_code.value = { status: 'error', detail: lang.value === 'en' ? 'Connection error' : 'Error de conexión' }
    store.removeCuponera()
  } finally {
    isApplyingCoupon.value = false
  }
}

const toggleCouponUi = () => {
  const next = !have_discount.value
  if (!next) {
    have_discount.value = false
    temp_code.value = {}
    store.removeCoupon()
  } else {
    have_discount.value = true
  }
}

// Re-aplicar cuponera cuando cambian los items del carrito (agregar/quitar)
// Solo observar cambios estructurales, no cambios en propiedades como pedido_descuento
watch(
  () => store.cart.map(item => `${item.pedido_productoid || item.signature}-${item.pedido_cantidad}`).join('|'),
  () => {
    if (store.applied_cuponera) {
      store.applyCuponera(store.applied_cuponera)
      temp_code.value = {
        ...temp_code.value,
        _freeProductInCart: store.applied_cuponera._freeProductInCart,
        _requiresPurchaseNotMet: store.applied_cuponera._requiresPurchaseNotMet,
        _requiresPurchaseBuyX: store.applied_cuponera._requiresPurchaseBuyX,
        _categoryProductInCart: store.applied_cuponera._categoryProductInCart,
        _productScopeInCart: store.applied_cuponera._productScopeInCart,
        _buyMPayNInCart: store.applied_cuponera._buyMPayNInCart,
        _buyMPayNNeedsMore: store.applied_cuponera._buyMPayNNeedsMore,
        _buyXGetYPctOffInCart: store.applied_cuponera._buyXGetYPctOffInCart,
        _buyXGetYPctOffNeedsMore: store.applied_cuponera._buyXGetYPctOffNeedsMore,
        _totalDiscountApplied: store.applied_cuponera._totalDiscountApplied
      }
    }
  }
)

watch(() => store.applied_cuponera, (newCuponera) => {
  if (newCuponera && newCuponera.code) {
    cuponeraCodeInput.value = newCuponera.code
    temp_code.value = { 
      ...newCuponera, 
      status: 'active', 
      discount_name: newCuponera.discount_name || newCuponera.cuponera_name || 'Cuponera', 
      uses_remaining_today: newCuponera.uses_remaining_today 
    }
  } else {
    if (!store.applied_coupon) {
      temp_code.value = {}
      cuponeraCodeInput.value = ''
    }
  }
}, { immediate: true, deep: true })

// Revalidar cuponera contra la API cuando hay sede + código (obtiene uses_remaining_today actualizado; evita usar solo el valor persistido)
const lastRevalidatedCode = ref('')
const lastRevalidatedSiteId = ref(null)
watch(
  () => [siteStore.location?.site?.site_id, store.applied_cuponera?.code],
  ([siteId, code]) => {
    if (!siteId || !code) {
      lastRevalidatedCode.value = ''
      lastRevalidatedSiteId.value = null
      return
    }
    if (lastRevalidatedCode.value === code && lastRevalidatedSiteId.value === siteId) return
    lastRevalidatedCode.value = code
    lastRevalidatedSiteId.value = siteId
    validateCuponera(code)
  },
  { immediate: true }
)

watch(() => store.applied_coupon, (newCoupon) => {
  if (newCoupon && newCoupon.code) {
    store.setCouponUi({ enabled: true, draft_code: newCoupon.code })
    temp_code.value = { ...newCoupon, status: 'active', discount_name: newCoupon.discount_name || newCoupon.name || 'Descuento', uses_remaining_today: newCoupon.uses_remaining_today }
    if (newCoupon._fromCuponera) cuponeraCodeInput.value = newCoupon.code
  } else {
    if (!store.applied_cuponera) {
      temp_code.value = {}
      cuponeraCodeInput.value = ''
    }
  }
}, { immediate: true, deep: true })

const validateDiscount = async (code, opts = { silent: false }) => {
  const silent = !!opts?.silent
  const site = siteStore.location?.site
  if (!site) {
    temp_code.value = { status: 'error', detail: lang.value === 'en' ? 'Select a site first' : 'Selecciona una sede primero' }
    return
  }
  const finalCode = (code || '').toString().trim()
  if (!finalCode) return

  isApplyingCoupon.value = true
  try {
    // 1) Intentar primero cuponera vigente (API descuentos)
    let cuponeraUsed = false
    try {
      const redeemRes = await redeemCuponeraCode(finalCode, undefined, false, runtimeConfig.public?.cuponeraApi)
      if (redeemRes?.success) {
        const siteIds = redeemRes.cuponera_site_ids
        if (Array.isArray(siteIds) && siteIds.length > 0) {
          const siteIdNum = Number(site.site_id)
          if (!siteIds.some((id) => Number(id) === siteIdNum)) {
            temp_code.value = { status: 'invalid_site', detail: lang.value === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual' }
            store.removeCoupon()
            isApplyingCoupon.value = false
            return
          }
        }
        const usesRemaining = redeemRes.uses_remaining_today ?? 0
        if (usesRemaining < 0) {
          temp_code.value = { status: 'invalid', detail: lang.value === 'en' ? 'No uses remaining today' : 'No quedan usos para hoy' }
          store.removeCoupon()
          isApplyingCoupon.value = false
          return
        }
        if (redeemRes.user) {
          const u = redeemRes.user
          // El backend ya devuelve first_name y last_name separados
          user.user.first_name = u.first_name || user.user.first_name || ''
          user.user.last_name = u.last_name || user.user.last_name || ''
          if (u.phone) user.user.phone_number = u.phone
          // Actualizar phone_code si viene del backend
          if (u.phone_code) {
            const matchingCountry = countries.value.find(c => c.dialCode === u.phone_code)
            if (matchingCountry) {
              user.user.phone_code = matchingCountry
            }
          }
          if (u.email) user.user.email = u.email
          if (u.address != null) user.user.address = u.address
        }
        const coupon = mapCuponeraDiscountToCoupon(redeemRes, finalCode, site.site_id)
        if (coupon) {
          if (coupon.min_purchase != null && coupon.min_purchase > 0) {
            const subtotal = store.cartSubtotal
            if (subtotal < coupon.min_purchase) {
              const fmt = (v) => v === 0 ? 'Gratis' : new Intl.NumberFormat(lang.value === 'en' ? 'en-CO' : 'es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
              temp_code.value = { status: 'min_purchase', detail: lang.value === 'en' ? `Minimum purchase required: ${fmt(coupon.min_purchase)}` : `El monto mínimo de compra es: ${fmt(coupon.min_purchase)}`, min_purchase: coupon.min_purchase }
              store.removeCoupon()
              isApplyingCoupon.value = false
              return
            }
          }
          store.applyCoupon(coupon)
          temp_code.value = { ...coupon, status: 'active', discount_name: coupon.discount_name || coupon.name || 'Descuento', uses_remaining_today: redeemRes.uses_remaining_today }
          store.setCouponUi({ enabled: true, draft_code: coupon.code || finalCode })
          cuponeraUsed = true
        } else {
          // Descuento existe pero no es válido para esta sede (site_ids del descuento)
          const hasDiscountsButNotForSite = redeemRes.discounts?.length > 0
          const detailMsg = hasDiscountsButNotForSite
            ? (lang.value === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual')
            : (redeemRes.message || (lang.value === 'en' ? 'No discount for today' : 'No hay descuento para hoy'))
          temp_code.value = { status: hasDiscountsButNotForSite ? 'invalid_site' : 'no_discount', detail: detailMsg, cuponera_name: redeemRes.cuponera_name, uses_remaining_today: redeemRes.uses_remaining_today }
          store.removeCuponera()
          cuponeraUsed = true
        }
      }
    } catch (_) {}

    if (cuponeraUsed) {
      isApplyingCoupon.value = false
      return
    }

    // 2) Cupón normal (API principal)
    const r = await fetch(`${URI}/discount/get-discount-by-code/${encodeURIComponent(finalCode)}`)
    const payload = await r.json().catch(() => null)
    const backendDetail = getErrorDetail(payload)

    if (!r.ok || backendDetail) {
      temp_code.value = { status: 'invalid', detail: backendDetail || (lang.value === 'en' ? 'Invalid code' : 'Código no válido') }
      store.removeCoupon()
      return
    }

    const coupon = pickCoupon(payload)
    if (!coupon) {
      temp_code.value = { status: 'invalid', detail: lang.value === 'en' ? 'Invalid code' : 'Código no válido' }
      store.removeCoupon()
      return
    }
    if (Array.isArray(coupon.sites) && !coupon.sites.some((s) => String(s.site_id) === String(site.site_id))) {
      temp_code.value = { status: 'invalid_site', detail: lang.value === 'en' ? 'Not available for current site' : 'No está disponible para la sede actual' }
      store.removeCoupon()
      return
    }

    if (coupon.min_purchase != null && coupon.min_purchase > 0) {
      const subtotal = store.cartSubtotal
      if (subtotal < coupon.min_purchase) {
        const formatCOP = (v) => v === 0 ? 'Gratis' : new Intl.NumberFormat(lang.value === 'en' ? 'en-CO' : 'es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
        const minPurchaseFormatted = formatCOP(coupon.min_purchase)
        temp_code.value = { status: 'min_purchase', detail: lang.value === 'en' ? `Minimum purchase required: ${minPurchaseFormatted}` : `El monto mínimo de compra es: ${minPurchaseFormatted}`, min_purchase: coupon.min_purchase }
        store.removeCoupon()
        return
      }
    }

    store.applyCoupon(coupon)
    temp_code.value = { ...coupon, status: 'active', discount_name: coupon.discount_name || coupon.name || 'Descuento' }
    store.setCouponUi({ enabled: true, draft_code: coupon.code || finalCode })
  } catch (e) {
    temp_code.value = { status: 'error', detail: lang.value === 'en' ? 'Connection error' : 'Error de conexión' }
    if (!silent) store.removeCoupon()
  } finally {
    isApplyingCoupon.value = false
  }
}

const clearCoupon = () => {
  temp_code.value = {}
  store.removeCoupon()
  store.setCouponUi({ enabled: true, draft_code: '' })
}

/* ================= Mount ================= */
onMounted(async () => {
  initCountries()
  if (!user.user.phone_code) {
    const defaultCode = lang.value === 'en' ? 'US' : 'CO'
    user.user.phone_code = countries.value.find((c) => c.code === defaultCode)
  }

  try {
    const spData = await apiFetch(`${URI}/site-payments-complete`)
    sitePaymentsComplete.value = spData || []
    ensureValidOrderTypeForCurrentSite()
  } catch (e) {
    console.error('Error loading payment config', e)
  }

})

watch(lang, initCountries)
</script>

<style scoped>
.checkout-page {
  --primary: #000000;
  --bg-page: #f8f9fa;
  --bg-card: #ffffff;
  --text-main: #1f2937;
  --text-light: #6b7280;
  --border: #e5e7eb;
  --border-focus: #000000;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.03);
  --shadow-hover: 0 10px 25px rgba(0, 0, 0, 0.06);
  --success: #10b981;
  --error: #ef4444;

  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--text-main);
  background-color: var(--bg-page);
  min-height: 100vh;
}

/* Overlay simple */
.redirect-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; display: flex; align-items: center; justify-content: center; }
.redirect-content { text-align: center; }

/* Layout */
.checkout-layout { max-width: 1100px; margin: 0 auto; padding: 2rem .5rem; }
.page-header { text-align: center; margin-bottom: 2.5rem; }
.page-header h1 { font-weight: 800; font-size: 2rem; letter-spacing: -0.03em; margin: 0; }
.checkout-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
@media (min-width: 992px) { .checkout-grid { grid-template-columns: 1.4fr 1fr; gap: 2rem; align-items: start; } }

/* Cards */
.card { background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-card); transition: 0.2s; }
.section-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); color: #111; }
.loading-card { text-align: center; color: #999; display: flex; flex-direction: column; align-items: center; gap: 1rem; }

/* Tabs */
.card-tabs { padding: 0; background: #f1f5f9; border: none; }
.tabs-container { display: flex; background: #ffffff; border-radius: var(--radius-sm); }
.tab-item { flex: 1; text-align: center; padding: 0.75rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; color: #000; margin: 0; transition: 0.2s; position: relative; }
.tab-item.is-active { background: #000000; color: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
.hidden-radio { position: absolute; opacity: 0; width: 0; height: 0; }

/* Forms */
.form-row { margin-bottom: 1rem; }
.form-row.split { display: grid; grid-template-columns: 1fr; gap: 1rem; }
@media(min-width: 600px) { .form-row.split { grid-template-columns: 1fr 1fr; } }
label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; color: #374151; }
.input-modern { width: 100%; }
.input-modern:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(0,0,0,0.05); }

/* Address Card */
.address-selector { margin-bottom: 1rem; }
.address-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: 0.2s; background: #fff; }
.address-card:hover { border-color: #000; box-shadow: var(--shadow-card); }
.address-card.no-address { border-style: dashed; background: #f9fafb; }
.icon-box-addr { width: 40px; height: 40px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #666; }
.has-address .icon-box-addr, .pickup .icon-box-addr { background: #000; color: #fff; }
.addr-info { flex: 1; display: flex; flex-direction: column; }
.addr-title { font-weight: 600; font-size: 0.95rem; }
.addr-placeholder { color: var(--text-light); }
.addr-meta { font-size: 0.8rem; margin-top: 4px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.badge-delivery { background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.75rem; }
.badge-neighborhood { background: #eff6ff; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.75rem; }
.action-arrow { color: #9ca3af; }

/* Phone Control & Cupones (estilos reducidos para brevedad, mantener los originales del componente anterior) */
.phone-control { display: flex; gap: 0.5rem; }
.country-select { position: relative; }
.country-trigger { height: 100%; display: flex; align-items: center; gap: 0.4rem; padding: 0 0.8rem; background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; min-width: 90px; }
.country-trigger img { width: 20px; border-radius: 2px; }
.country-dropdown { position: absolute; top: 110%; left: 0; z-index: 50; background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm); width: 240px; box-shadow: var(--shadow-hover); padding: 0.5rem; }
.search-mini { width: 100%; padding: 0.4rem; margin-bottom: 0.5rem; border: 1px solid #eee; border-radius: 4px; font-size: 0.85rem; }
.country-dropdown ul { list-style: none; padding: 0; margin: 0; max-height: 200px; overflow-y: auto; }
.country-dropdown li { padding: 0.5rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; border-radius: 4px; }
.country-dropdown li:hover { background: #f3f4f6; }
.flag-mini { width: 18px; }

/* Coupon Wrapper */
/* Cuponera al inicio */
.cuponera-top .section-title { display: flex; align-items: center; gap: 0.5rem; }
.cuponera-subtitle { font-size: 0.9rem; color: var(--text-light); margin: -0.5rem 0 1rem 0; line-height: 1.4; }
.cuponera-input-row { display: flex; gap: 0.5rem; }
.cuponera-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; outline: none; font-size: 0.95rem; }
.cuponera-input:focus { border-color: var(--border-focus); }
.cuponera-feedback { margin-top: 0.75rem; }
.data-filled-msg { display: block; font-size: 0.9rem; color: #047857; margin-top: 4px; font-weight: 600; }

.coupon-wrapper { border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 1.5rem; }
.coupon-toggle { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1rem; background: #f9fafb; cursor: pointer; }
.coupon-left { display: flex; gap: 0.5rem; align-items: center; font-weight: 600; font-size: 0.9rem; }
.switch { width: 36px; height: 20px; background: #d1d5db; border-radius: 20px; position: relative; transition: 0.3s; }
.switch.on { background: #000; }
.knob { width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.3s; }
.switch.on .knob { transform: translateX(16px); }
.coupon-content { padding: 1rem; border-top: 1px solid var(--border); }
.coupon-input-row { display: flex; gap: 0.5rem; }
.coupon-input-row input { flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; outline: none; }
.btn-coupon { padding: 0 1rem; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
.apply { background: #000; color: #fff; }
.remove { background: #fee2e2; color: #ef4444; }
.coupon-feedback { margin-top: 0.8rem; font-size: 0.85rem; display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 500; padding: 0.6rem; border-radius: 6px; }
.coupon-feedback.positive { color: var(--success); background: #ecfdf5; }
.coupon-feedback.negative { color: var(--error); background: #fef2f2; }
.feedback-info { display: flex; flex-direction: column; }
.discount-title { font-weight: 700; color: #065f46; font-size: 0.9rem; text-transform: uppercase; }
.discount-amount { font-size: 0.85rem; color: #047857; margin-top: 2px; }
.product-note { font-size: 0.8rem; display: block; margin-top: 2px; }
.product-note.applied { color: #059669; font-weight: 600; }
.product-note.warning { color: #d97706; font-weight: 500; }
.scope-info { font-size: 0.75rem; color: #6b7280; font-weight: 400; }
.discount-condition { font-size: 0.85rem; color: #047857; margin-top: 2px; display: block; }
.uses-remaining { font-size: 0.85rem; color: #047857; margin-top: 4px; display: block; }

.mt-3 { margin-top: 1rem; }
</style>