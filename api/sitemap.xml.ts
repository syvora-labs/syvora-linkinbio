import { fetchRecentAndUpcomingEvents } from '../src/lib/seo/edge-supabase'
import { escapeHtml } from '../src/lib/seo/serialize'
import { SITE_ORIGIN } from '../src/lib/seo/types'

export const config = { runtime: 'edge' }

function xmlUrl(loc: string, opts: {
    lastmod?: string
    priority: number
    changefreq: string
    image?: { loc: string; title: string }
}): string {
    const lines: string[] = []
    lines.push('  <url>')
    lines.push(`    <loc>${escapeHtml(loc)}</loc>`)
    if (opts.lastmod) lines.push(`    <lastmod>${opts.lastmod}</lastmod>`)
    lines.push(`    <changefreq>${opts.changefreq}</changefreq>`)
    lines.push(`    <priority>${opts.priority.toFixed(1)}</priority>`)
    if (opts.image) {
        lines.push('    <image:image>')
        lines.push(`      <image:loc>${escapeHtml(opts.image.loc)}</image:loc>`)
        lines.push(`      <image:title>${escapeHtml(opts.image.title)}</image:title>`)
        lines.push('    </image:image>')
    }
    lines.push('  </url>')
    return lines.join('\n')
}

export default async function handler(): Promise<Response> {
    let events: Awaited<ReturnType<typeof fetchRecentAndUpcomingEvents>> = []
    try {
        events = await fetchRecentAndUpcomingEvents()
    } catch {
        // Fall back to a homepage-only sitemap on outages — better than 500.
    }

    const now = Date.now()
    const body: string[] = []
    body.push('<?xml version="1.0" encoding="UTF-8"?>')
    body.push(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">',
    )
    body.push(
        xmlUrl(`${SITE_ORIGIN}/`, { priority: 1.0, changefreq: 'weekly' }),
    )
    for (const e of events) {
        const eventTs = new Date(e.event_date).getTime()
        const isFuture = eventTs >= now
        body.push(
            xmlUrl(`${SITE_ORIGIN}/event/${e.id}`, {
                lastmod: e.event_date,
                priority: isFuture ? 0.8 : 0.5,
                changefreq: isFuture ? 'weekly' : 'monthly',
                image: e.artwork_url
                    ? { loc: e.artwork_url, title: e.title }
                    : undefined,
            }),
        )
    }
    body.push('</urlset>')

    return new Response(body.join('\n'), {
        status: 200,
        headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
    })
}
