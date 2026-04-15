import { next } from '@vercel/edge'
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

async function handleHome(response: Response): Promise<Response> {
    const html = await response.text()
    let events
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
            ...Object.fromEntries(response.headers),
            'content-type': 'text/html; charset=utf-8',
            'cache-control': CACHE_HEADER,
            'x-seo-middleware': 'home',
        },
    })
}

async function handleEvent(
    response: Response,
    eventId: string,
): Promise<Response> {
    let event
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
    const html = await response.text()
    const meta = buildEventMeta(event)
    const eventLd = buildEventJsonLd(event)
    const crumbsLd = buildBreadcrumbJsonLd(event)
    const headInjection = renderSeoHead(meta, [eventLd, crumbsLd])
    const rewritten = injectIntoHead(stripDefaultMeta(html), headInjection)
    return new Response(rewritten, {
        status: 200,
        headers: {
            ...Object.fromEntries(response.headers),
            'content-type': 'text/html; charset=utf-8',
            'cache-control': CACHE_HEADER,
            'x-seo-middleware': 'event',
        },
    })
}

export default async function middleware(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/') {
        const res = await next()
        return handleHome(res)
    }

    const eventMatch = path.match(/^\/event\/([^/]+)$/)
    if (eventMatch) {
        const res = await next()
        return handleEvent(res, eventMatch[1])
    }

    return next()
}
