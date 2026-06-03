import {MANDATOR_ID, SUPABASE_ANON_KEY, SUPABASE_URL} from './config'

// Product images live in a private R2 bucket. We never receive raw R2 URLs;
// instead we batch image ids and ask the ERP-owned `webshop-public-images`
// edge function for short-lived (5 min) signed URLs. Cross-mandator ids are
// silently omitted from the response, so the returned map may be sparse.
//
// Max 200 ids per request. Because URLs expire, only cache the result for the
// lifetime of a page — never in localStorage or across navigations.
export async function resolveImageUrls(imageIds: string[]): Promise<Record<string, string>> {
    const ids = [...new Set(imageIds.filter(Boolean))]
    if (ids.length === 0) return {}

    // The Supabase functions gateway verifies a JWT by default, so even though
    // the function itself is logically unauthenticated we must present the anon
    // key (otherwise the gateway returns 401 before the function ever runs).
    const res = await fetch(`${SUPABASE_URL}/functions/v1/webshop-public-images`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({mandator_id: MANDATOR_ID, image_ids: ids}),
    })
    if (!res.ok) throw new Error(`Image resolve failed: ${res.status}`)

    const json = await res.json() as {urls: Record<string, string>; expires_in: number}
    return json.urls ?? {}
}
