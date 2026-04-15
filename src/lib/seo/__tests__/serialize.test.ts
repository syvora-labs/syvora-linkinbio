import { describe, expect, it } from 'vitest'
import {
    escapeHtml,
    metaToHtml,
    jsonLdToScriptTag,
    renderSeoHead,
} from '@/lib/seo/serialize'
import { buildEventMeta, buildEventJsonLd } from '@/lib/seo/templates'
import type { SeoEvent } from '@/lib/seo/types'

const event: SeoEvent = {
    id: 'abc-123',
    title: 'Test Event',
    artwork_url: 'https://cdn.example.com/a.jpg',
    location: 'Luzern',
    event_date: '2026-04-20T22:00:00Z',
    ticket_link: null,
}

describe('escapeHtml', () => {
    it('escapes quotes and angle brackets', () => {
        expect(escapeHtml('<script>"x"</script>')).toBe(
            '&lt;script&gt;&quot;x&quot;&lt;/script&gt;',
        )
    })
})

describe('metaToHtml', () => {
    it('renders meta tags and canonical from an SeoMeta object', () => {
        const html = metaToHtml(buildEventMeta(event))
        expect(html).toContain('<title>')
        expect(html).toContain('<link rel="canonical" href="https://eclipseboundaries.ch/event/abc-123">')
        expect(html).toContain('<meta property="og:image"')
    })

    it('emits noindex robots meta when robots is set', () => {
        const html = metaToHtml({
            title: 'x',
            description: 'x',
            canonical: 'https://eclipseboundaries.ch/x',
            robots: 'noindex, nofollow',
            tags: [],
        })
        expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
    })
})

describe('jsonLdToScriptTag', () => {
    it('wraps JSON-LD payload in a typed script tag', () => {
        const html = jsonLdToScriptTag(buildEventJsonLd(event))
        expect(html).toMatch(
            /^<script type="application\/ld\+json">\{.*\}<\/script>$/s,
        )
    })

    it('escapes </script in nested strings to prevent breakout', () => {
        const html = jsonLdToScriptTag({ evil: '</script><x>' })
        expect(html).not.toContain('</script><x>')
        expect(html).toContain('<\\/script>')
    })
})

describe('renderSeoHead', () => {
    it('composes meta html + multiple json-ld blocks', () => {
        const meta = buildEventMeta(event)
        const head = renderSeoHead(meta, [buildEventJsonLd(event)])
        expect(head).toContain('<title>')
        expect(head).toContain('application/ld+json')
    })
})
