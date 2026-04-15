import { next } from '@vercel/edge'

export const config = {
    // Match the SEO-relevant routes plus the private routes that need
    // X-Robots-Tag headers. Keep this list tight — the middleware runs on
    // every matching request.
    matcher: [
        '/',
        '/event/:eventId',
        '/event/:eventId/tickets',
        '/event/:eventId/tickets/success',
        '/tickets/order/:orderId',
    ],
}

export default async function middleware(request: Request): Promise<Response> {
    const response = await next()
    // Stamp a header so we can verify the middleware is actually running.
    response.headers.set('x-seo-middleware', 'pass-through')
    return response
}
