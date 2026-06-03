<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {useSeoMeta, useHead} from '@unhead/vue'
import {supabase} from '@/supabase'
import {MANDATOR_ID} from '@/lib/shop/config'
import {resolveImageUrls} from '@/lib/shop/images'
import {formatPrice} from '@/lib/shop/format'
import {useCart} from '@/composables/useCart'
import type {Product, ProductCategory} from '@/lib/shop/types'

useSeoMeta({
    title: 'Shop | ECLIPSE BOUNDARIES',
    description: 'Official ECLIPSE BOUNDARIES merch.',
})

useHead({
    link: [{rel: 'canonical', href: 'https://eclipseboundaries.ch/shop'}],
})

const {count: cartCount} = useCart()

const categories = ref<ProductCategory[]>([])
const products = ref<Product[]>([])
const imageUrls = ref<Record<string, string>>({})
const primaryImageByProduct = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref<string | null>(null)

// Products grouped by category, in category sort order, with an "Other"
// bucket for products that have no category.
const grouped = computed(() => {
    const byCategory = new Map<string | null, Product[]>()
    for (const product of products.value) {
        const key = product.category_id
        if (!byCategory.has(key)) byCategory.set(key, [])
        byCategory.get(key)!.push(product)
    }
    const sections: {id: string; name: string; products: Product[]}[] = []
    for (const category of categories.value) {
        const items = byCategory.get(category.id)
        if (items?.length) sections.push({id: category.id, name: category.name, products: items})
    }
    const uncategorised = byCategory.get(null)
    if (uncategorised?.length) {
        sections.push({id: 'uncategorised', name: 'More', products: uncategorised})
    }
    return sections
})

onMounted(async () => {
    try {
        const [categoriesRes, productsRes] = await Promise.all([
            supabase
                .from('product_categories')
                .select('id, name, slug, description, sort_order')
                .eq('mandator_id', MANDATOR_ID)
                .eq('is_published', true)
                .order('sort_order', {ascending: true}),
            supabase
                .from('products')
                .select('id, category_id, title, slug, description, price_cents, currency, sort_order')
                .eq('mandator_id', MANDATOR_ID)
                .eq('is_published', true)
                .order('sort_order', {ascending: true}),
        ])

        if (productsRes.error) {
            error.value = 'Could not load the shop.'
            return
        }

        categories.value = categoriesRes.data ?? []
        products.value = productsRes.data ?? []

        // Attach the primary image (lowest sort_order) per product, then
        // resolve all of them in a single signed-URL request.
        if (products.value.length) {
            const {data: images} = await supabase
                .from('product_images')
                .select('id, product_id, sort_order')
                .eq('mandator_id', MANDATOR_ID)
                .in('product_id', products.value.map(p => p.id))
                .order('sort_order', {ascending: true})

            const primary: Record<string, string> = {}
            for (const img of images ?? []) {
                if (!(img.product_id in primary)) primary[img.product_id] = img.id
            }
            primaryImageByProduct.value = primary

            const ids = Object.values(primary)
            if (ids.length) imageUrls.value = await resolveImageUrls(ids)
        }
    } catch {
        error.value = 'Something went wrong. Please try again.'
    } finally {
        loading.value = false
    }
})

function primaryUrl(productId: string): string | undefined {
    const imageId = primaryImageByProduct.value[productId]
    return imageId ? imageUrls.value[imageId] : undefined
}
</script>

<template>
    <div class="container">
        <div class="shop-header">
            <router-link to="/" class="back-link">ECLIPSE BOUNDARIES</router-link>
            <router-link to="/shop/cart" class="cart-link" aria-label="Cart">
                Cart
                <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
            </router-link>
        </div>

        <div v-if="loading" class="state-card">
            <p class="state-text">Loading shop...</p>
        </div>

        <div v-else-if="error" class="state-card">
            <p class="state-text">{{ error }}</p>
            <router-link to="/" class="back-button">Back to home</router-link>
        </div>

        <div v-else-if="products.length === 0" class="state-card">
            <p class="state-text">No products available right now. Check back soon.</p>
            <router-link to="/" class="back-button">Back to home</router-link>
        </div>

        <template v-else>
            <section v-for="section in grouped" :key="section.id" class="category-section">
                <h2 class="section-heading">{{ section.name }}</h2>
                <div class="product-grid">
                    <router-link
                        v-for="product in section.products"
                        :key="product.id"
                        :to="{name: 'shop-product', params: {slug: product.slug}}"
                        class="product-card"
                    >
                        <div class="product-image-wrap">
                            <img
                                v-if="primaryUrl(product.id)"
                                :src="primaryUrl(product.id)"
                                :alt="product.title"
                                class="product-image"
                                loading="lazy"
                            />
                            <div v-else class="product-image-placeholder"></div>
                        </div>
                        <div class="product-meta">
                            <span class="product-title">{{ product.title }}</span>
                            <span class="product-price">{{ formatPrice(product.price_cents, product.currency) }}</span>
                        </div>
                    </router-link>
                </div>
            </section>
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
}

.shop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.back-link {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 3px;
    color: white;
    text-decoration: none;
    text-transform: uppercase;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
    transition: opacity 0.3s ease;
}

.back-link:hover {
    opacity: 0.8;
}

.cart-link {
    position: relative;
    flex-shrink: 0;
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    color: #1a1a1a;
    text-decoration: none;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    transition: box-shadow 0.3s ease;
}

.cart-link:hover {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}

.cart-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: #1a1a1a;
    color: white;
    font-size: 0.75rem;
    line-height: 20px;
    text-align: center;
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

.category-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.section-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    padding-bottom: 12px;
    letter-spacing: 2px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.4);
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
}

.product-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
}

.product-card {
    /* Grow to share a row (up to two per row at this max-width), but a lone
       card stays centered at a sensible width instead of filling half the row. */
    flex: 1 1 240px;
    max-width: 332px;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    text-decoration: none;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    transition: box-shadow 0.3s ease, transform 0.2s ease;
}

.product-card:hover {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
    transform: translateY(-2px);
}

.product-image-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #f0f0f3;
}

.product-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.product-image-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #ece9fb, #f6f5fc);
}

.product-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
}

.product-title {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
}

.product-price {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.9rem;
    color: #555;
}

@media (max-width: 600px) {
    .back-link {
        font-size: 1.3rem;
    }

    .product-grid {
        gap: 12px;
    }

    .product-title {
        font-size: 0.9rem;
    }
}
</style>
