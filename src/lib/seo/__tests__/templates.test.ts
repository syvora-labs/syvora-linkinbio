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
