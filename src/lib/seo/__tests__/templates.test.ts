import { describe, expect, it } from 'vitest'
import { buildHomeMeta, buildEventMeta } from '@/lib/seo/templates'
import type { SeoEvent } from '@/lib/seo/types'

const sampleEvent: SeoEvent = {
    id: 'abc-123',
    title: 'SYVORA PRESENTS — DARKNESS & LIGHT',
    artwork_url: 'https://cdn.example.com/artwork.jpg',
    location: 'Luzern, Switzerland',
    event_date: '2026-04-20T22:00:00Z',
    ticket_link: null,
}

describe('buildHomeMeta', () => {
    it('produces homepage title, description, canonical, OG, Twitter', () => {
        const meta = buildHomeMeta()
        expect(meta.title.length).toBeLessThanOrEqual(60)
        expect(meta.title).toContain('ECLIPSE BOUNDARIES')
        expect(meta.description.length).toBeLessThanOrEqual(155)
        expect(meta.canonical).toBe('https://eclipseboundaries.ch/')
        const props = meta.tags.map((t) => `${t.keyAttr}:${t.key}`)
        expect(props).toContain('property:og:type')
        expect(props).toContain('property:og:title')
        expect(props).toContain('property:og:image')
        expect(props).toContain('name:twitter:card')
    })
})

describe('buildEventMeta', () => {
    it('derives title from event title + location + date', () => {
        const meta = buildEventMeta(sampleEvent)
        expect(meta.title).toContain('SYVORA')
        expect(meta.title).toContain('Luzern')
        expect(meta.title).toContain('ECLIPSE BOUNDARIES')
        expect(meta.title.length).toBeLessThanOrEqual(60)
    })

    it('uses event artwork as OG image', () => {
        const meta = buildEventMeta(sampleEvent)
        const ogImage = meta.tags.find(
            (t) => t.keyAttr === 'property' && t.key === 'og:image',
        )
        expect(ogImage?.content).toBe('https://cdn.example.com/artwork.jpg')
    })

    it('sets canonical to https://eclipseboundaries.ch/event/{id}', () => {
        const meta = buildEventMeta(sampleEvent)
        expect(meta.canonical).toBe('https://eclipseboundaries.ch/event/abc-123')
    })

    it('truncates overlong description to 155 chars', () => {
        const longEvent: SeoEvent = {
            ...sampleEvent,
            title: 'A'.repeat(200),
            location: 'B'.repeat(100),
        }
        const meta = buildEventMeta(longEvent)
        expect(meta.description.length).toBeLessThanOrEqual(155)
    })

    it('handles events where the suffix exceeds the title budget', () => {
        const longLocationEvent: SeoEvent = {
            ...sampleEvent,
            location: 'Extraordinarily Long City Name Here, Switzerland',
        }
        const meta = buildEventMeta(longLocationEvent)
        expect(meta.title.length).toBeLessThanOrEqual(60)
    })
})

import {
    buildMusicGroupJsonLd,
    buildEventJsonLd,
    buildBreadcrumbJsonLd,
} from '@/lib/seo/templates'

describe('buildMusicGroupJsonLd', () => {
    it('emits a MusicGroup node with sameAs socials', () => {
        const ld = buildMusicGroupJsonLd([])
        expect(ld['@type']).toBe('MusicGroup')
        expect(ld.name).toBe('ECLIPSE BOUNDARIES')
        expect(Array.isArray(ld.sameAs)).toBe(true)
        expect((ld.sameAs as string[]).some((u) => u.includes('instagram'))).toBe(true)
    })

    it('embeds an event list from provided events', () => {
        const ld = buildMusicGroupJsonLd([sampleEvent])
        const list = ld.event as unknown[]
        expect(list).toHaveLength(1)
    })
})

describe('buildEventJsonLd', () => {
    it('emits Event with startDate, location, organizer, offers', () => {
        const ld = buildEventJsonLd(sampleEvent)
        expect(ld['@type']).toBe('Event')
        expect(ld.startDate).toBe(sampleEvent.event_date)
        expect((ld.location as Record<string, unknown>)['@type']).toBe('Place')
        expect((ld.organizer as Record<string, unknown>).name).toBe(
            'ECLIPSE BOUNDARIES',
        )
        expect((ld.offers as Record<string, unknown>)['@type']).toBe('Offer')
    })

    it('uses internal ticket URL when ticket_link is null', () => {
        const ld = buildEventJsonLd(sampleEvent)
        const offer = ld.offers as Record<string, unknown>
        expect(offer.url).toBe(
            'https://eclipseboundaries.ch/event/abc-123/tickets',
        )
    })

    it('uses external ticket URL when ticket_link is set', () => {
        const ld = buildEventJsonLd({
            ...sampleEvent,
            ticket_link: 'https://externalshop.com/x',
        })
        const offer = ld.offers as Record<string, unknown>
        expect(offer.url).toBe('https://externalshop.com/x')
    })
})

describe('buildBreadcrumbJsonLd', () => {
    it('emits Home → Event breadcrumb', () => {
        const ld = buildBreadcrumbJsonLd(sampleEvent)
        expect(ld['@type']).toBe('BreadcrumbList')
        const list = ld.itemListElement as Record<string, unknown>[]
        expect(list).toHaveLength(2)
        expect(list[0].name).toBe('Home')
        expect(list[1].name).toBe(sampleEvent.title)
    })
})
