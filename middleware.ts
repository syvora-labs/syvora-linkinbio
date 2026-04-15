import {
    buildHomeMeta,
    buildMusicGroupJsonLd,
    buildEventMeta,
    buildEventJsonLd,
    buildBreadcrumbJsonLd,
} from './src/lib/seo/templates'
import { renderSeoHead } from './src/lib/seo/serialize'
import {
    fetchEventById,
    fetchUpcomingEvents,
} from './src/lib/seo/edge-supabase'
import type { SeoEvent } from './src/lib/seo/types'

export const config = {
    matcher: [
        '/',
        '/event/:eventId',
        '/event/:eventId/tickets',
        '/event/:eventId/tickets/success',
        '/tickets/order/:orderId',
    ],
}

const CACHE_HEADER = 'public, s-maxage=300, stale-while-revalidate=3600'

/**
 * Fetch the static `index.html` shell directly. In Vercel Edge middleware
 * for non-Next.js apps, `next()` returns a continuation signal rather than
 * a real Response with body — so modifying its body has no effect. Going
 * out via `fetch()` gives us the real HTML we can transform.
 *
 * `/index.html` is not listed in `config.matcher`, so this fetch does not
 * re-trigger the middleware.
 */
async function fetchStaticShell(requestUrl: string): Promise<string> {
    const shellUrl = new URL('/index.html', requestUrl).toString()
    const response = await fetch(shellUrl)
    return response.text()
}

function injectIntoHead(html: string, injected: string): string {
    return html.replace('</head>', `    ${injected}\n  </head>`)
}

function stripDefaultMeta(html: string): string {
    // The static shell ships with default homepage meta. For per-event
    // pages we want them gone so our per-event meta is authoritative.
    return html
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(/<meta name="description"[^>]*>/, '')
        .replace(/<link rel="canonical"[^>]*>/, '')
        .replace(/<meta property="og:[^"]*"[^>]*>/g, '')
        .replace(/<meta name="twitter:[^"]*"[^>]*>/g, '')
}

async function renderHome(requestUrl: string): Promise<Response> {
    const html = await fetchStaticShell(requestUrl)
    let events: SeoEvent[]
    try {
        events = await fetchUpcomingEvents(10)
    } catch {
        events = []
    }
    const meta = buildHomeMeta()
    const musicGroup = buildMusicGroupJsonLd(events)
    const headInjection = renderSeoHead(meta, [musicGroup])
    const rewritten = injectIntoHead(stripDefaultMeta(html), headInjection)
    return new Response(rewritten, {
        status: 200,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': CACHE_HEADER,
            'x-seo-middleware': 'home',
        },
    })
}

async function renderEvent(
    requestUrl: string,
    eventId: string,
): Promise<Response> {
    let event: SeoEvent | null
    try {
        event = await fetchEventById(eventId)
    } catch {
        return new Response('Temporary error', { status: 503 })
    }
    if (!event) {
        return new Response('Not found', {
            status: 404,
            headers: { 'x-robots-tag': 'noindex, nofollow' },
        })
    }
    const html = await fetchStaticShell(requestUrl)
    const meta = buildEventMeta(event)
    const eventLd = buildEventJsonLd(event)
    const crumbsLd = buildBreadcrumbJsonLd(event)
    const headInjection = renderSeoHead(meta, [eventLd, crumbsLd])
    const rewritten = injectIntoHead(stripDefaultMeta(html), headInjection)
    return new Response(rewritten, {
        status: 200,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': CACHE_HEADER,
            'x-seo-middleware': 'event',
        },
    })
}

async function renderPrivate(requestUrl: string): Promise<Response> {
    const html = await fetchStaticShell(requestUrl)
    return new Response(html, {
        status: 200,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-robots-tag': 'noindex, nofollow',
            'x-seo-middleware': 'private',
        },
    })
}

export default async function middleware(
    request: Request,
): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/') {
        return renderHome(request.url)
    }

    const eventMatch = path.match(/^\/event\/([^/]+)$/)
    if (eventMatch && eventMatch[1]) {
        return renderEvent(request.url, eventMatch[1])
    }

    // Private / transactional routes: serve the SPA shell but stamp
    // X-Robots-Tag so crawlers never index them.
    if (
        /^\/event\/[^/]+\/tickets(\/success)?$/.test(path) ||
        /^\/tickets\/order\//.test(path)
    ) {
        return renderPrivate(request.url)
    }

    // Fallback (shouldn't hit given the matcher).
    const html = await fetchStaticShell(request.url)
    return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
    })
}
