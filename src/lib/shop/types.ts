// Condensed public-shop view of the webshop schema. Only the fields the
// browser is allowed to read are modelled here — storage paths, SKUs and
// fulfilment columns are intentionally absent.

export interface ProductCategory {
    id: string
    name: string
    slug: string
    description: string | null
    sort_order: number
}

export interface Product {
    id: string
    category_id: string | null
    title: string
    slug: string
    description: string | null
    price_cents: number
    currency: string
    sort_order: number
}

export interface ProductVariant {
    id: string
    product_id: string
    size: string
    // null = unlimited / made-to-order, 0 = sold out, > 0 = available
    stock: number | null
    sort_order: number
}

export interface ProductImage {
    id: string
    product_id: string
    alt_text: string | null
    width: number | null
    height: number | null
    sort_order: number
}

// A single line in the cart. Display fields are snapshotted so the cart can
// render without re-fetching; quantities and prices are always re-validated
// server-side at checkout.
export interface CartItem {
    product_id: string
    variant_id: string
    quantity: number
    title: string
    slug: string
    size: string
    price_cents: number
    currency: string
    image_id: string | null
}
