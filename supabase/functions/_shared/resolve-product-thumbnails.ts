import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Returns a map of product_id -> signed thumbnail URL for the primary image
// (lowest sort_order) of each product, via the ERP-owned webshop-public-images
// function. Signed URLs expire in ~5 minutes. Best-effort: returns {} on any
// failure so callers can render without thumbnails.
export async function resolveProductThumbnails(
  supabase: ReturnType<typeof createClient>,
  mandatorId: string,
  productIds: string[],
): Promise<Record<string, string>> {
  if (productIds.length === 0) return {}

  try {
    const { data: images } = await supabase
      .from('product_images')
      .select('id, product_id, sort_order')
      .eq('mandator_id', mandatorId)
      .in('product_id', productIds)
      .order('sort_order', { ascending: true })

    const primaryByProduct: Record<string, string> = {}
    for (const img of (images ?? []) as { id: string; product_id: string }[]) {
      if (!(img.product_id in primaryByProduct)) primaryByProduct[img.product_id] = img.id
    }

    const imageIds = Object.values(primaryByProduct)
    if (imageIds.length === 0) {
      console.warn(`thumbnails: no product_images for ${productIds.length} product(s) under mandator ${mandatorId}`)
      return {}
    }

    // Present the ANON key — the functions gateway accepts it as the public
    // JWT for this unauthenticated function (exactly what the browser sends).
    // The service-role key is NOT a gateway-valid JWT here and is rejected with
    // "Invalid JWT format". The anon key is auto-provided to edge functions.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const res = await fetch(`${supabaseUrl}/functions/v1/webshop-public-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ mandator_id: mandatorId, image_ids: imageIds }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`thumbnails: webshop-public-images returned ${res.status} for ${imageIds.length} id(s): ${errText.slice(0, 200)}`)
      return {}
    }
    const { urls } = await res.json() as { urls: Record<string, string> }
    console.log(`thumbnails: requested ${imageIds.length} id(s), got ${Object.keys(urls ?? {}).length} url(s)`)

    const byProduct: Record<string, string> = {}
    for (const [productId, imageId] of Object.entries(primaryByProduct)) {
      if (urls?.[imageId]) byProduct[productId] = urls[imageId]
    }
    return byProduct
  } catch (e) {
    console.error('Thumbnail resolve error:', e)
    return {}
  }
}
