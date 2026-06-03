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

// Returns the shipping cost in cents for a destination, or null if we don't
// ship there (the caller should block checkout in that case).
export function shippingCentsForCountry(country: string): number | null {
    return RATE_BY_COUNTRY[country] ?? null
}
