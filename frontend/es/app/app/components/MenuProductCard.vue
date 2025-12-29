<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useUserStore } from '#imports'
import { formatoPesosColombianos } from '~/service/utils/formatoPesos'

const props = defineProps({
  product: { type: Object, required: true },
  categoryId: { type: [Number, String], required: true },
  imageBaseUrl: { type: String, required: true },
  setProductRef: { type: Function, required: true }
})

const emit = defineEmits(['click', 'add-to-cart'])

const userStore = useUserStore()

const rootEl = ref(null)
const imgRef = ref(null)
const imgLoaded = ref(false)

// === Idioma desde store ===
const langKey = computed(() =>
  String(
    userStore.lang?.name ||
      userStore.user?.lang?.name ||
      'es'
  ).toLowerCase()
)
const isEnglish = computed(() => langKey.value === 'en')

// === Utils ===
const normalizeSpaces = (str) =>
  String(str || '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/([\p{L}\p{N}])\+([\p{L}\p{N}])/gu, '$1 + $2')
    .replace(/ {2,}/g, ' ')
    .replace(/ \,/g, ',')
    .trim()

// ✅ Todo texto a minúscula desde JS (para que CSS capitalize haga el trabajo visual)
const toLower = (str) => String(str || '').toLocaleLowerCase()

const normalizeLower = (str) => toLower(normalizeSpaces(str))

// ✅ EN: usa inglés si existe, si no ES | ES: usa ES si existe, si no EN
const pickByLang = (esValue, enValue) => {
  const es = String(esValue || '')
  const en = String(enValue || '')
  return isEnglish.value ? (en || es) : (es || en)
}

// ✅ Textos UI del card (en minúscula)
const ui = computed(() => {
  if (isEnglish.value) {
    return {
      no_description: 'no description',
      combo: 'combo',
      off: 'off',
      flavor_suffix: 'flav.'
    }
  }
  return {
    no_description: 'sin descripción',
    combo: 'combo',
    off: 'off',
    flavor_suffix: 'sab.'
  }
})

// === Nombre / Descripción con fallback ES/EN (en minúscula) ===
const displayName = computed(() => {
  const p = props.product || {}

  const esName =
    p.productogeneral_descripcion ||
    p.productogeneral_descripcionweb ||
    p.product_name ||
    ''

  const enName =
    p.english_name ||
    p.product_name ||
    ''

  return normalizeLower(pickByLang(esName, enName))
})

const rawDescription = computed(() => {
  const p = props.product || {}

  const esDesc =
    p.productogeneral_descripcionadicional ||
    p.productogeneral_descripcionweb ||
    ''

  const enDesc =
    p.english_description ||
    ''

  const picked = pickByLang(esDesc, enDesc) || (p.productogeneral_descripcionweb || '')
  return toLower(picked)
})

const truncatedDescription = computed(() => {
  const desc = String(rawDescription.value || '')
  if (!desc) return ui.value.no_description
  return desc.length > 100 ? desc.substring(0, 100) + '...' : desc
})

// === Precios y lógica ===
const discountAmount = computed(() => Number(props.product?.discount_amount || 0))
const discountPercent = computed(() => Number(props.product?.discount_percent || 0))
const hasDiscount = computed(() => discountAmount.value > 0 && discountPercent.value > 0)

const basePrice = computed(() => {
  const p = props.product || {}
  const presentationPrice = Number(p.lista_presentacion?.[0]?.producto_precio ?? 0)
  if (presentationPrice > 0) return presentationPrice

  const generalPrice = Number(p.productogeneral_precio ?? 0)
  if (generalPrice > 0) return generalPrice

  return Number(p.price ?? 0)
})

const finalPrice = computed(() => {
  const base = basePrice.value
  const disc = discountAmount.value
  return (base - disc) > 0 ? (base - disc) : base
})

const showOriginalPrice = computed(() => hasDiscount.value && basePrice.value > 0)

const isCombo = computed(() =>
  props.product?.is_combo != null
    ? !!props.product.is_combo
    : String(props.product?.productogeneral_escombo || '') === '1'
)

const maxFlavor = computed(() => Number(props.product?.max_flavor || 0))

const discountLabel = computed(() => {
  if (!hasDiscount.value) return ''
  // en minúscula, luego CSS capitalize lo muestra “bonito”
  return isEnglish.value
    ? toLower(`${discountPercent.value}% ${ui.value.off}`)
    : toLower(`-${discountPercent.value}%`)
})

const flavorsLabel = computed(() => {
  if (!(maxFlavor.value > 1)) return ''
  return toLower(`${maxFlavor.value} ${ui.value.flavor_suffix}`)
})

// === Imagen ===
const imageSrc = computed(() => {
  const p = props.product || {}
  if (p.productogeneral_urlimagen) return `https://img.restpe.com/${p.productogeneral_urlimagen}`
  if (p.image_url?.startsWith('http')) return p.image_url
  if (p.image_url) return `${props.imageBaseUrl}/${p.image_url}`
  if (p.img_identifier) return `${props.imageBaseUrl}/read-photo-product/${p.img_identifier}/400`
  return `${props.imageBaseUrl}/placeholder.png`
})

const imageSrcSet = computed(() => {
  const p = props.product || {}
  if (!p.img_identifier || p.productogeneral_urlimagen || p.image_url) return ''
  return `
    ${props.imageBaseUrl}/read-photo-product/${p.img_identifier}/200 200w,
    ${props.imageBaseUrl}/read-photo-product/${p.img_identifier}/400 400w,
    ${props.imageBaseUrl}/read-photo-product/${p.img_identifier}/600 600w
  `
})

const onImgLoad = () => { imgLoaded.value = true }

const onImgError = (event) => {
  imgLoaded.value = true
  event.target?.removeAttribute?.('srcset')
  event.target.src = `${props.imageBaseUrl}/placeholder.png`
}

// === Handlers ===
const handleClick = () => emit('click')
const handleKeyUp = (event) => { if (event.key === 'Enter') emit('click') }

onMounted(() => {
  if (rootEl.value) props.setProductRef(props.product.id, props.categoryId, rootEl.value)

  if (imgRef.value && imgRef.value.complete) {
    if (imgRef.value.naturalWidth > 0) onImgLoad()
    else imgLoaded.value = true
  }
})

onBeforeUnmount(() => {
  props.setProductRef(props.product.id, props.categoryId, null)
})
</script>

<template>
  <article
    ref="rootEl"
    class="menu-product-card"
    role="button"
    tabindex="0"
    @click="handleClick"
    @keyup="handleKeyUp"
  >
    <div class="menu-product-card__image-wrapper" :class="{ 'is-loaded': imgLoaded }">
      <img
        ref="imgRef"
        class="menu-product-card__image"
        :src="imageSrc"
        :srcset="imageSrcSet"
        sizes="(max-width: 600px) 200px, (max-width: 1200px) 400px, 600px"
        :alt="displayName"
        loading="lazy"
        decoding="async"
        @load="onImgLoad"
        @error="onImgError"
      />
    </div>

    <div class="menu-product-card__body">
      <h3 class="menu-product-card__name">{{ displayName }}</h3>
      <p class="menu-product-card__desc">{{ truncatedDescription }}</p>

      <div class="menu-product-card__footer">
        <div class="menu-product-card__price-block">
          <span v-if="showOriginalPrice" class="menu-product-card__price menu-product-card__price--old">
            {{ formatoPesosColombianos(basePrice) }}
          </span>
          <span class="menu-product-card__price">
            {{ formatoPesosColombianos(finalPrice) }}
          </span>
        </div>

        <div class="menu-product-card__badges">
          <span v-if="hasDiscount" class="menu-product-card__tag menu-product-card__tag--discount">
            {{ discountLabel }}
          </span>

          <span v-else-if="isCombo" class="menu-product-card__tag menu-product-card__tag--combo">
            {{ ui.combo }}
          </span>

          <span v-else-if="maxFlavor > 1" class="menu-product-card__tag menu-product-card__tag--flavors">
            {{ flavorsLabel }}
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* ✅ Capitalize visual para TODO el texto del componente */
.menu-product-card {
  text-transform: capitalize;

  background: #ffffff;
  border-radius: 0.3rem;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 190px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.menu-product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}

/* === OPTIMIZACIÓN SKELETON === */
.menu-product-card__image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #f3f4f6;
  background-image: linear-gradient(90deg, #f3f4f6 0px, #e5e7eb 50%, #f3f4f6 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Cuando carga, quitamos fondo y animación */
.menu-product-card__image-wrapper.is-loaded {
  animation: none;
  background-image: none;
  background: transparent;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.menu-product-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.3s ease-in;
}

.menu-product-card__image-wrapper.is-loaded .menu-product-card__image {
  opacity: 1;
}

.menu-product-card__body { padding: 0.7rem; display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
.menu-product-card__name { margin: 0; font-size: 0.95rem; font-weight: 600; color: #111; }
.menu-product-card__desc { margin: 0; font-size: 0.78rem; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.menu-product-card__footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; }
.menu-product-card__price { font-weight: 700; color: #b91c1c; }
.menu-product-card__price--old { font-size: 0.8rem; color: #888; text-decoration: line-through; margin-right: 5px; }
.menu-product-card__badges { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.menu-product-card__tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; border: 1px solid #ddd; background: #eee; }
.menu-product-card__tag--discount { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }
.menu-product-card__tag--combo { background: #dcfce7; border-color: #bbf7d0; color: #166534; }
.menu-product-card__tag--flavors { background: #dbeafe; border-color: #bfdbfe; color: #1d4ed8; }

@media (max-width: 768px) {
  .menu-product-card { min-height: 0; }
}
</style>
