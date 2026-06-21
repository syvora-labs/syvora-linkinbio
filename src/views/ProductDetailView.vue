<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {useSeoMeta} from '@unhead/vue'
import {marked} from 'marked'
import {supabase} from '@/supabase'
import {MANDATOR_ID} from '@/lib/shop/config'
import {resolveImageUrls} from '@/lib/shop/images'
import {formatPrice} from '@/lib/shop/format'
import {useCart} from '@/composables/useCart'
import type {Product, ProductImage, ProductVariant} from '@/lib/shop/types'

const route = useRoute()
const slug = route.params.slug as string

const {addItem} = useCart()

const product = ref<Product | null>(null)
const variants = ref<ProductVariant[]>([])
const images = ref<ProductImage[]>([])
const imageUrls = ref<Record<string, string>>({})
const selectedVariantId = ref<string | null>(null)
const activeImageId = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const added = ref(false)

useSeoMeta({
    title: computed(() => product.value ? `${product.value.title} | ECLIPSE BOUNDARIES` : 'Shop | ECLIPSE BOUNDARIES'),
    description: computed(() => product.value?.description?.slice(0, 160) ?? 'Official ECLIPSE BOUNDARIES merch.'),
})

const descriptionHtml = computed(() =>
    product.value?.description ? marked.parse(product.value.description) as string : '',
)

const selectedVariant = computed(() =>
    variants.value.find(v => v.id === selectedVariantId.value) ?? null,
)

function isSoldOut(variant: ProductVariant): boolean {
    return variant.stock === 0
}

const canAdd = computed(() => {
    const v = selectedVariant.value
    return !!v && !isSoldOut(v)
})

onMounted(async () => {
    try {
        const {data: productData, error: productError} = await supabase
            .from('products')
            .select('id, category_id, title, slug, description, price_cents, currency, sort_order, shipping_fee_cents')
            .eq('mandator_id', MANDATOR_ID)
            .eq('slug', slug)
            .eq('is_published', true)
            .maybeSingle()

        if (productError || !productData) {
            error.value = 'Product not found.'
            return
        }
        product.value = productData

        const [variantsRes, imagesRes] = await Promise.all([
            supabase
                .from('product_variants')
                .select('id, product_id, size, stock, sort_order')
                .eq('mandator_id', MANDATOR_ID)
                .eq('product_id', productData.id)
                .eq('is_active', true)
                .order('sort_order', {ascending: true}),
            supabase
                .from('product_images')
                .select('id, product_id, alt_text, width, height, sort_order')
                .eq('mandator_id', MANDATOR_ID)
                .eq('product_id', productData.id)
                .order('sort_order', {ascending: true}),
        ])

        variants.value = variantsRes.data ?? []
        images.value = imagesRes.data ?? []

        // Default selection: first variant that isn't sold out, else the first.
        const firstAvailable = variants.value.find(v => !isSoldOut(v))
        selectedVariantId.value = (firstAvailable ?? variants.value[0])?.id ?? null

        if (images.value.length) {
            activeImageId.value = images.value[0]!.id
            imageUrls.value = await resolveImageUrls(images.value.map(i => i.id))
        }
    } catch {
        error.value = 'Something went wrong. Please try again.'
    } finally {
        loading.value = false
    }
})

function selectVariant(variant: ProductVariant) {
    if (isSoldOut(variant)) return
    selectedVariantId.value = variant.id
}

function handleAdd() {
    const v = selectedVariant.value
    if (!product.value || !v || isSoldOut(v)) return
    addItem({
        product_id: product.value.id,
        variant_id: v.id,
        title: product.value.title,
        slug: product.value.slug,
        size: v.size,
        price_cents: product.value.price_cents,
        currency: product.value.currency,
        image_id: images.value.length ? images.value[0]!.id : null,
        shipping_fee_cents: product.value.shipping_fee_cents,
    })
    added.value = true
    setTimeout(() => {
        added.value = false
    }, 2000)
}
</script>

<template>
    <div class="container">
        <router-link to="/shop" class="page-back">← Shop</router-link>

        <div v-if="loading" class="state-card">
            <p class="state-text">Loading...</p>
        </div>

        <div v-else-if="error || !product" class="state-card">
            <p class="state-text">{{ error ?? 'Product not found.' }}</p>
            <router-link to="/shop" class="back-button">Back to shop</router-link>
        </div>

        <template v-else>
            <div class="product-layout">
                <div class="gallery">
                    <div class="gallery-main">
                        <img
                            v-if="activeImageId && imageUrls[activeImageId]"
                            :src="imageUrls[activeImageId]"
                            :alt="product.title"
                            class="gallery-main-image"
                        />
                        <div v-else class="gallery-placeholder"></div>
                    </div>
                    <div v-if="images.length > 1" class="gallery-thumbs">
                        <button
                            v-for="img in images"
                            :key="img.id"
                            type="button"
                            class="gallery-thumb"
                            :class="{active: img.id === activeImageId}"
                            @click="activeImageId = img.id"
                        >
                            <img
                                v-if="imageUrls[img.id]"
                                :src="imageUrls[img.id]"
                                :alt="img.alt_text ?? product.title"
                                loading="lazy"
                            />
                        </button>
                    </div>
                </div>

                <div class="product-info">
                    <h1 class="product-title">{{ product.title }}</h1>
                    <p class="product-price">{{ formatPrice(product.price_cents, product.currency) }}</p>

                    <div v-if="variants.length" class="variants">
                        <span class="variants-label">Size</span>
                        <div class="variant-buttons">
                            <button
                                v-for="variant in variants"
                                :key="variant.id"
                                type="button"
                                class="variant-button"
                                :class="{
                                    selected: variant.id === selectedVariantId,
                                    'sold-out': isSoldOut(variant),
                                }"
                                :disabled="isSoldOut(variant)"
                                @click="selectVariant(variant)"
                            >
                                {{ variant.size }}
                                <span v-if="isSoldOut(variant)" class="sold-out-tag">Sold out</span>
                            </button>
                        </div>
                    </div>

                    <button
                        class="add-button"
                        :disabled="!canAdd"
                        @click="handleAdd"
                    >
                        {{ added ? 'Added to cart' : canAdd ? 'Add to cart' : 'Sold out' }}
                    </button>

                    <!-- Description is authored as Markdown on the admin side. -->
                    <div
                        v-if="descriptionHtml"
                        class="product-description"
                        v-html="descriptionHtml"
                    ></div>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
@font-face {
    font-family: 'Matter-Heavy';
    src: url('/fonts/Matter-Heavy.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Matter-SemiBold';
    src: url('/fonts/Matter-SemiBold.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Matter-Regular';
    src: url('/fonts/Matter-Regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

.container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 720px;
    gap: 24px;
    padding-top: clamp(16px, 4vh, 48px);
}

.state-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 32px 24px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.state-text {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #555;
    margin: 0 0 16px;
}

.back-button {
    display: inline-block;
    padding: 12px 24px;
    background: #1a1a1a;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    transition: background 0.3s ease;
}

.back-button:hover {
    background: #333;
}

.product-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    align-items: start;
}

.gallery {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.gallery-main {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.gallery-main-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.gallery-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #ece9fb, #f6f5fc);
}

.gallery-thumbs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.gallery-thumb {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    background: #f0f0f3;
    cursor: pointer;
    padding: 0;
}

.gallery-thumb.active {
    border-color: #6C5CE7;
}

.gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.product-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.product-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.5rem;
    color: #1a1a1a;
    margin: 0;
}

.product-price {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.2rem;
    color: #1a1a1a;
    margin: 0;
}

.variants {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.variants-label {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.85rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.variant-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.variant-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: 2px solid #1a1a1a;
    border-radius: 8px;
    background: transparent;
    color: #1a1a1a;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.variant-button.selected {
    background: #1a1a1a;
    color: white;
}

.variant-button.sold-out {
    opacity: 0.4;
    cursor: not-allowed;
    text-decoration: line-through;
}

.sold-out-tag {
    font-size: 0.7rem;
    text-decoration: none;
}

.add-button {
    width: 100%;
    padding: 16px;
    background: #1a1a1a;
    border: none;
    border-radius: 8px;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.05rem;
    cursor: pointer;
    transition: background 0.3s ease;
}

.add-button:hover:not(:disabled) {
    background: #333;
}

.add-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.product-description {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #444;
}

.product-description :deep(p) {
    margin: 0 0 12px;
}

.product-description :deep(ul),
.product-description :deep(ol) {
    margin: 0 0 12px;
    padding-left: 20px;
}

.product-description :deep(a) {
    color: #6C5CE7;
}

@media (max-width: 600px) {
    .product-layout {
        grid-template-columns: 1fr;
        gap: 20px;
    }

    .product-title {
        font-size: 1.3rem;
    }
}
</style>
