// Flat shipping rates by destination zone, in cents.
//
// IMPORTANT: this table is duplicated in
// supabase/functions/webshop-create-checkout/index.ts, which recomputes
// shipping server-side as the authoritative charge. Keep the two in sync —
// the cart only *displays* this; the edge function is what the buyer pays.
const CH_RATE_CENTS = 700
const EU_RATE_CENTS = 1500

const RATE_BY_COUNTRY: Record<string, number> = {
    CH: CH_RATE_CENTS,
    DE: EU_RATE_CENTS,
    AT: EU_RATE_CENTS,
    FR: EU_RATE_CENTS,
    IT: EU_RATE_CENTS,
}

// Returns the zone shipping cost in cents for a destination, or null if we
// don't ship there (the caller should block checkout in that case).
export function shippingCentsForCountry(country: string): number | null {
    return RATE_BY_COUNTRY[country] ?? null
}

// The shipping fee that applies to a single product line. A per-product custom
// fee (products.shipping_fee_cents) takes precedence over the zone rate; only
// products without a custom fee fall back to the destination zone rate.
export function applicableShippingCents(
    customFeeCents: number | null | undefined,
    country: string,
): number | null {
    if (customFeeCents != null) return customFeeCents
    return shippingCentsForCountry(country)
}

// The shipping charged for an entire order. The order is treated as one
// shipment, so we charge the single highest applicable fee across its items
// (a heavy item's custom fee is honoured without stacking on top of others).
// Returns null when we don't ship to the country AND no item carries a custom
// fee — i.e. there is no figure to charge, so the caller must block checkout.
export function orderShippingCents(
    items: { shipping_fee_cents: number | null }[],
    country: string,
): number | null {
    if (items.length === 0) return 0
    let max: number | null = null
    for (const item of items) {
        const fee = applicableShippingCents(item.shipping_fee_cents, country)
        // No custom fee and we don't ship to this zone → this item is
        // unshippable; the whole order is blocked.
        if (fee === null) return null
        if (max === null || fee > max) max = fee
    }
    return max
}
