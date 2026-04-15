# SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ECLIPSE BOUNDARIES link-in-bio site discoverable on search engines and social link previewers by server-injecting per-route meta tags and JSON-LD structured data via Vercel Edge Middleware, adding a new indexable `/event/:eventId` page, and emitting a dynamic sitemap — all derived automatically from existing Supabase fields.

**Architecture:** Three layers: (1) Vercel Edge Middleware rewrites static `index.html` per request with per-page meta/JSON-LD fetched live from Supabase (Edge-cached); (2) client-side `@unhead/vue` keeps meta correct during SPA navigation; (3) dynamic `sitemap.xml` Edge function + static `robots.txt`. Pure-function SEO builders (derivation + templates + serializers) are shared between the middleware and the client so there is a single source of truth.

**Tech Stack:** Vue 3 + Vite SPA, TypeScript, Vercel Edge Runtime, Supabase, `@unhead/vue`, `@vercel/edge`, Vitest (new).

**Spec:** `docs/superpowers/specs/2026-04-15-seo-optimization-design.md`

---

## File Structure

**New files:**

- `vitest.config.ts` — vitest config
- `src/lib/seo/types.ts` — shared `SeoEvent` type and tag/jsonld types
- `src/lib/seo/derive.ts` — pure helpers (city, truncation, date formatting, absolute URL)
- `src/lib/seo/templates.ts` — meta tag + JSON-LD builders
- `src/lib/seo/serialize.ts` — HTML string serializers for Edge middleware use
- `src/lib/seo/__tests__/derive.test.ts`
- `src/lib/seo/__tests__/templates.test.ts`
- `src/lib/seo/__tests__/serialize.test.ts`
- `src/views/EventDetailView.vue` — new public event page (canonical SEO target)
- `middleware.ts` — Vercel Edge Middleware at project root
- `api/sitemap.xml.ts` — Edge function, dynamic sitemap
- `public/robots.txt` — static robots file
- `docs/superpowers/runbooks/seo-post-deploy.md` — validation runbook

**Modified files:**

- `index.html` — `lang="en"`, default meta tags, font preload hints
- `src/styles.css` — global `@font-face` declarations
- `src/App.vue` — remove duplicated `@font-face`
- `src/components/EventCard.vue` — remove duplicated `@font-face`, link to `/event/:id`, `<article>` wrapper, descriptive alt text, image loading hints
- `src/views/HomeView.vue` — `<main>`/`<nav>` semantic upgrade, `useSeoMeta`
- `src/views/TicketShopView.vue` — `useSeoMeta` with noindex + canonical to `/event/:id`
- `src/views/TicketSuccessView.vue` — `useSeoMeta` with noindex
- `src/views/ViewTicketsView.vue` — `useSeoMeta` with noindex
- `src/router/index.ts` — add `/event/:eventId` route
- `src/main.ts` — register `@unhead/vue`
- `package.json` — add `@unhead/vue`, `@vercel/edge`, `vitest`, `jsdom`, test script
- `vercel.json` — (likely unchanged; edge middleware is autodetected from `middleware.ts`)

---

## Operational dependencies (out of code scope)

These are referenced by the code but must be handled operationally. Called out here so nothing surprises the engineer mid-plan:

- `public/og-default.jpg` — 1200×630 homepage Open Graph fallback image. Placeholder commit uses a temporary neutral image; real design follows later.
- `eclipseboundaries.ch` domain must be connected in Vercel before the Edge middleware has a canonical host to reference.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` already exist for the client. The Edge middleware needs the **same values** available as non-prefixed Edge environment variables: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Set these in Vercel project settings (Production + Preview).

---

## Task 1: Set up Vitest for SEO unit tests

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/lib/seo/__tests__/smoke.test.ts`

- [ ] **Step 1.1: Install Vitest**

Run:
```bash
yarn add -D vitest@^2.1.0 jsdom@^25.0.0
```

Expected: additions to `devDependencies` in `package.json`.

- [ ] **Step 1.2: Create `vitest.config.ts`**

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 1.3: Add `test` script to `package.json`**

Add to the `scripts` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.4: Write a smoke test**

Create `src/lib/seo/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('vitest smoke test', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 1.5: Verify the test runs**

Run:
```bash
yarn test
```

Expected: 1 passed test.

- [ ] **Step 1.6: Commit**

```bash
git add vitest.config.ts package.json yarn.lock src/lib/seo/__tests__/smoke.test.ts
git commit -m "chore(seo): add vitest for pure-function unit tests"
```

---

## Task 2: SEO derivation helpers (TDD)

**Files:**
- Create: `src/lib/seo/types.ts`
- Create: `src/lib/seo/derive.ts`
- Create: `src/lib/seo/__tests__/derive.test.ts`

- [ ] **Step 2.1: Write failing tests**

Replace `src/lib/seo/__tests__/smoke.test.ts` contents with `src/lib/seo/__tests__/derive.test.ts` (rename by creating new and deleting smoke):

```ts
import { describe, expect, it } from 'vitest'
import {
  extractCity,
  truncate,
  formatEventDateLong,
  formatEventDateShort,
  absoluteUrl,
} from '@/lib/seo/derive'

describe('extractCity', () => {
  it('returns first comma-separated segment, trimmed', () => {
    expect(extractCity('Luzern, Switzerland')).toBe('Luzern')
    expect(extractCity('  Zurich ,  CH ')).toBe('Zurich')
  })

  it('returns the full string when no comma', () => {
    expect(extractCity('Luzern')).toBe('Luzern')
  })

  it('returns empty string for empty input', () => {
    expect(extractCity('')).toBe('')
  })
})

describe('truncate', () => {
  it('returns input unchanged when short enough', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates with single ellipsis character at exact limit', () => {
    expect(truncate('abcdefghijk', 5)).toBe('abcd…')
    expect(truncate('abcdefghijk', 5).length).toBe(5)
  })

  it('prefers word boundary when one exists within 10 chars of the cap', () => {
    expect(truncate('hello world foo bar baz', 15)).toBe('hello world foo…')
  })
})

describe('formatEventDateLong', () => {
  it('formats ISO to long English form', () => {
    // 2026-04-20T22:00:00Z
    const out = formatEventDateLong('2026-04-20T22:00:00Z')
    expect(out).toMatch(/April/)
    expect(out).toMatch(/2026/)
  })
})

describe('formatEventDateShort', () => {
  it('formats ISO to compact English form', () => {
    const out = formatEventDateShort('2026-04-20T22:00:00Z')
    expect(out).toMatch(/Apr/)
    expect(out).toMatch(/20/)
  })
})

describe('absoluteUrl', () => {
  it('joins with site origin', () => {
    expect(absoluteUrl('/event/abc')).toBe('https://eclipseboundaries.ch/event/abc')
    expect(absoluteUrl('/')).toBe('https://eclipseboundaries.ch/')
  })

  it('leaves absolute URLs untouched', () => {
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x')
  })
})
```

Delete `src/lib/seo/__tests__/smoke.test.ts`.

- [ ] **Step 2.2: Run tests to confirm they fail**

Run:
```bash
yarn test
```

Expected: failures because `src/lib/seo/derive.ts` does not yet exist.

- [ ] **Step 2.3: Create shared SEO types**

Create `src/lib/seo/types.ts`:

```ts
export interface SeoEvent {
    id: string
    title: string
    artwork_url: string
    location: string
    event_date: string // ISO 8601
    ticket_link: string | null
}

export interface MetaTag {
    /** 'name' for <meta name="..."> or 'property' for <meta property="..."> */
    keyAttr: 'name' | 'property'
    key: string
    content: string
}

export interface SeoMeta {
    title: string
    description: string
    canonical: string
    robots?: string
    tags: MetaTag[]
}

export type JsonLd = Record<string, unknown>

export const SITE_ORIGIN = 'https://eclipseboundaries.ch'
export const SITE_NAME = 'ECLIPSE BOUNDARIES'
```

- [ ] **Step 2.4: Implement derivation helpers**

Create `src/lib/seo/derive.ts`:

```ts
import { SITE_ORIGIN } from './types'

export function extractCity(location: string): string {
    if (!location) return ''
    const [first] = location.split(',')
    return first.trim()
}

/**
 * Truncate `text` so the result is at most `max` characters, including the
 * trailing ellipsis (…). Prefers a word boundary within the last 10 chars
 * before the cap. Returns the input unchanged when it already fits.
 */
export function truncate(text: string, max: number): string {
    if (text.length <= max) return text
    const hard = max - 1 // leave room for '…'
    const soft = Math.max(hard - 10, 1)
    const window = text.slice(0, hard)
    const lastSpace = window.lastIndexOf(' ')
    const cut = lastSpace >= soft ? lastSpace : hard
    return text.slice(0, cut).trimEnd() + '…'
}

export function formatEventDateLong(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function formatEventDateShort(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })
}

export function absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (pathOrUrl.startsWith('/')) return SITE_ORIGIN + pathOrUrl
    return `${SITE_ORIGIN}/${pathOrUrl}`
}
```

- [ ] **Step 2.5: Run tests to confirm green**

Run:
```bash
yarn test
```

Expected: all tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/seo/types.ts src/lib/seo/derive.ts src/lib/seo/__tests__/derive.test.ts
git rm src/lib/seo/__tests__/smoke.test.ts
git commit -m "feat(seo): add pure derivation helpers (city, truncate, dates)"
```

---

## Task 3: Meta tag template builders (TDD)

**Files:**
- Create: `src/lib/seo/templates.ts`
- Create: `src/lib/seo/__tests__/templates.test.ts`

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/seo/__tests__/templates.test.ts`:

```ts
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
})
```

- [ ] **Step 3.2: Run tests and confirm failures**

Run: `yarn test`
Expected: failures — module does not exist yet.

- [ ] **Step 3.3: Implement the template builders**

Create `src/lib/seo/templates.ts`:

```ts
import {
    absoluteUrl,
    extractCity,
    formatEventDateLong,
    formatEventDateShort,
    truncate,
} from './derive'
import {
    SITE_NAME,
    SITE_ORIGIN,
    type MetaTag,
    type SeoEvent,
    type SeoMeta,
} from './types'

const HOME_TITLE = `${SITE_NAME} — House Music Label in Lucerne`
const HOME_DESCRIPTION =
    `${SITE_NAME} is a house music label presenting underground events in Lucerne and beyond. Upcoming shows, tickets, radios, mixes.`
const HOME_OG_IMAGE = `${SITE_ORIGIN}/og-default.jpg`

const MAX_TITLE = 60
const MAX_DESCRIPTION = 155
const MAX_OG_DESCRIPTION = 200

export function buildHomeMeta(): SeoMeta {
    const title = truncate(HOME_TITLE, MAX_TITLE)
    const description = truncate(HOME_DESCRIPTION, MAX_DESCRIPTION)
    const ogDescription = truncate(
        'Electronic events in Lucerne & Switzerland.',
        MAX_OG_DESCRIPTION,
    )
    return {
        title,
        description,
        canonical: `${SITE_ORIGIN}/`,
        tags: [
            { keyAttr: 'property', key: 'og:type', content: 'website' },
            { keyAttr: 'property', key: 'og:site_name', content: SITE_NAME },
            { keyAttr: 'property', key: 'og:title', content: SITE_NAME },
            { keyAttr: 'property', key: 'og:description', content: ogDescription },
            { keyAttr: 'property', key: 'og:url', content: `${SITE_ORIGIN}/` },
            { keyAttr: 'property', key: 'og:image', content: HOME_OG_IMAGE },
            { keyAttr: 'property', key: 'og:locale', content: 'en_US' },
            { keyAttr: 'name', key: 'twitter:card', content: 'summary_large_image' },
            { keyAttr: 'name', key: 'twitter:title', content: SITE_NAME },
            { keyAttr: 'name', key: 'twitter:description', content: ogDescription },
            { keyAttr: 'name', key: 'twitter:image', content: HOME_OG_IMAGE },
        ],
    }
}

export function buildEventMeta(event: SeoEvent): SeoMeta {
    const city = extractCity(event.location) || event.location
    const dateShort = formatEventDateShort(event.event_date)
    const dateLong = formatEventDateLong(event.event_date)
    const canonical = `${SITE_ORIGIN}/event/${event.id}`
    const ogImage = absoluteUrl(event.artwork_url)

    const title = truncate(
        `${event.title} — ${city}, ${dateShort} | ${SITE_NAME}`,
        MAX_TITLE,
    )
    const description = truncate(
        `${event.title} live on ${dateLong} at ${event.location}. Electronic music presented by ${SITE_NAME}. Tickets available now.`,
        MAX_DESCRIPTION,
    )
    const ogDescription = truncate(
        `${event.title} on ${dateLong} at ${event.location}. Tickets available now.`,
        MAX_OG_DESCRIPTION,
    )
    const ogTitle = truncate(`${event.title} — ${city}, ${dateShort}`, MAX_TITLE)

    const tags: MetaTag[] = [
        { keyAttr: 'property', key: 'og:type', content: 'website' },
        { keyAttr: 'property', key: 'og:site_name', content: SITE_NAME },
        { keyAttr: 'property', key: 'og:title', content: ogTitle },
        { keyAttr: 'property', key: 'og:description', content: ogDescription },
        { keyAttr: 'property', key: 'og:url', content: canonical },
        { keyAttr: 'property', key: 'og:image', content: ogImage },
        { keyAttr: 'property', key: 'og:locale', content: 'en_US' },
        { keyAttr: 'name', key: 'twitter:card', content: 'summary_large_image' },
        { keyAttr: 'name', key: 'twitter:title', content: ogTitle },
        { keyAttr: 'name', key: 'twitter:description', content: ogDescription },
        { keyAttr: 'name', key: 'twitter:image', content: ogImage },
    ]

    return { title, description, canonical, tags }
}
```

- [ ] **Step 3.4: Run tests and confirm green**

Run: `yarn test`
Expected: all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/seo/templates.ts src/lib/seo/__tests__/templates.test.ts
git commit -m "feat(seo): add homepage and event meta-tag builders"
```

---

## Task 4: JSON-LD builders (TDD)

**Files:**
- Modify: `src/lib/seo/templates.ts`
- Modify: `src/lib/seo/__tests__/templates.test.ts`

- [ ] **Step 4.1: Append failing tests**

Append to `src/lib/seo/__tests__/templates.test.ts`:

```ts
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
```

- [ ] **Step 4.2: Run tests and confirm failures**

Run: `yarn test`
Expected: failures — new functions not exported.

- [ ] **Step 4.3: Implement JSON-LD builders**

Append to `src/lib/seo/templates.ts`:

```ts
import type { JsonLd } from './types'

const SOCIAL_LINKS = [
    'https://www.instagram.com/eclipse_boundaries/',
    'https://www.youtube.com/@eclipse_boundaries',
    'https://tiktok.com/@eclipse_boundaries',
]

const GENRES = ['Electronic', 'House', 'Drum and Bass']

export function buildEventJsonLd(event: SeoEvent): JsonLd {
    const city = extractCity(event.location) || event.location
    const canonical = `${SITE_ORIGIN}/event/${event.id}`
    const ticketUrl = event.ticket_link ?? `${canonical}/tickets`
    const ogImage = absoluteUrl(event.artwork_url)
    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        startDate: event.event_date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: event.location,
            address: {
                '@type': 'PostalAddress',
                addressLocality: city,
                addressCountry: 'CH',
            },
        },
        image: [ogImage],
        organizer: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_ORIGIN,
        },
        offers: {
            '@type': 'Offer',
            url: ticketUrl,
            availability: 'https://schema.org/InStock',
            validFrom: new Date().toISOString(),
        },
        url: canonical,
    }
}

export function buildMusicGroupJsonLd(events: SeoEvent[]): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'MusicGroup',
        name: SITE_NAME,
        url: SITE_ORIGIN,
        genre: GENRES,
        sameAs: SOCIAL_LINKS,
        event: events.map((e) => {
            const ld = buildEventJsonLd(e) as Record<string, unknown>
            // strip redundant @context inside nested items
            const { ['@context']: _ctx, ...rest } = ld
            return rest
        }),
    }
}

export function buildBreadcrumbJsonLd(event: SeoEvent): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: `${SITE_ORIGIN}/`,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: event.title,
                item: `${SITE_ORIGIN}/event/${event.id}`,
            },
        ],
    }
}
```

- [ ] **Step 4.4: Run tests and confirm green**

Run: `yarn test`
Expected: all tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/seo/templates.ts src/lib/seo/__tests__/templates.test.ts
git commit -m "feat(seo): add MusicGroup, Event, and Breadcrumb JSON-LD builders"
```

---

## Task 5: HTML string serializers (TDD)

These serializers produce the exact strings the Edge middleware will splice into `index.html`. Keeping them pure and tested is the reason the Edge code can stay tiny.

**Files:**
- Create: `src/lib/seo/serialize.ts`
- Create: `src/lib/seo/__tests__/serialize.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `src/lib/seo/__tests__/serialize.test.ts`:

```ts
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
```

- [ ] **Step 5.2: Run and confirm failures**

Run: `yarn test`
Expected: failures — module missing.

- [ ] **Step 5.3: Implement serializers**

Create `src/lib/seo/serialize.ts`:

```ts
import type { JsonLd, SeoMeta } from './types'

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function metaToHtml(meta: SeoMeta): string {
    const parts: string[] = []
    parts.push(`<title>${escapeHtml(meta.title)}</title>`)
    parts.push(
        `<meta name="description" content="${escapeHtml(meta.description)}">`,
    )
    parts.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`)
    if (meta.robots) {
        parts.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`)
    }
    for (const tag of meta.tags) {
        parts.push(
            `<meta ${tag.keyAttr}="${escapeHtml(tag.key)}" content="${escapeHtml(
                tag.content,
            )}">`,
        )
    }
    return parts.join('\n    ')
}

export function jsonLdToScriptTag(ld: JsonLd): string {
    // JSON.stringify can emit </script in string values; escape the slash.
    const body = JSON.stringify(ld).replace(/<\//g, '<\\/')
    return `<script type="application/ld+json">${body}</script>`
}

export function renderSeoHead(meta: SeoMeta, jsonLd: JsonLd[]): string {
    const metaHtml = metaToHtml(meta)
    const ldHtml = jsonLd.map(jsonLdToScriptTag).join('\n    ')
    return `${metaHtml}\n    ${ldHtml}`
}
```

- [ ] **Step 5.4: Run and confirm green**

Run: `yarn test`
Expected: all pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/seo/serialize.ts src/lib/seo/__tests__/serialize.test.ts
git commit -m "feat(seo): add HTML serializers for edge middleware injection"
```

---

## Task 6: Fix `index.html` baseline (lang, default meta, font preload)

**Files:**
- Modify: `index.html`
- Create (empty placeholder): `public/og-default.jpg`

- [ ] **Step 6.1: Replace `index.html` contents**

Overwrite `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <link rel="preload" href="/fonts/Matter-Heavy.otf" as="font" type="font/otf" crossorigin>
    <link rel="preload" href="/fonts/Matter-SemiBold.otf" as="font" type="font/otf" crossorigin>

    <title>ECLIPSE BOUNDARIES — House Music Label in Lucerne</title>
    <meta name="description" content="ECLIPSE BOUNDARIES is a house music label presenting underground events in Lucerne and beyond. Upcoming shows, tickets, radios, mixes.">
    <link rel="canonical" href="https://eclipseboundaries.ch/">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ECLIPSE BOUNDARIES">
    <meta property="og:title" content="ECLIPSE BOUNDARIES">
    <meta property="og:description" content="Electronic events in Lucerne & Switzerland.">
    <meta property="og:url" content="https://eclipseboundaries.ch/">
    <meta property="og:image" content="https://eclipseboundaries.ch/og-default.jpg">
    <meta property="og:locale" content="en_US">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="ECLIPSE BOUNDARIES">
    <meta name="twitter:description" content="Electronic events in Lucerne & Switzerland.">
    <meta name="twitter:image" content="https://eclipseboundaries.ch/og-default.jpg">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6.2: Add an `og-default.jpg` placeholder**

Until design delivers the real 1200×630 image, copy the favicon-sized PNG as a stopgap so OG tags resolve:

Run (bash):
```bash
cp public/favicon.svg public/og-default.jpg.placeholder
```

Then create a real (but temporary) 1200×630 JPEG. If no image tooling is available, commit an empty placeholder file and TODO in the Vercel deploy notes — but OG previews will be broken until a real image is present.

Preferred: if ImageMagick is available, generate a plain-brand placeholder:
```bash
magick -size 1200x630 xc:"#73c3fe" -font Arial -pointsize 80 -gravity center -fill white -annotate 0 "ECLIPSE BOUNDARIES" public/og-default.jpg
```

If not available, skip and leave a TODO comment in the PR description. The middleware's homepage fallback will still point here; OG previewers will 404 on image fetch. Known issue until design lands.

- [ ] **Step 6.3: Visually verify**

Run:
```bash
yarn start
```

Open the site. View source on the homepage: the new `<meta>`, `<link rel="canonical">`, and `<link rel="preload">` tags must all be present.

Stop the dev server.

- [ ] **Step 6.4: Commit**

```bash
git add index.html public/og-default.jpg
git commit -m "feat(seo): set lang=en and add default homepage meta + font preload"
```

---

## Task 7: Consolidate `@font-face` into global `styles.css`

Right now `@font-face` declarations live in both `App.vue` and `EventCard.vue` scoped CSS — the browser rediscovers them per component, delaying first paint. Move them to the global stylesheet so the preload hints in `index.html` actually help LCP.

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.vue`
- Modify: `src/components/EventCard.vue`

- [ ] **Step 7.1: Extend `src/styles.css`**

Replace contents with:

```css
@font-face {
    font-family: 'Matter-Heavy';
    src: url('/fonts/Matter-Heavy.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Matter-SemiBold';
    src: url('/fonts/Matter-SemiBold.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Matter-Bold';
    src: url('/fonts/Matter-Bold.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Matter-Regular';
    src: url('/fonts/Matter-Regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html,
body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
}

#app {
    width: 100%;
    height: 100%;
}
```

- [ ] **Step 7.2: Remove `@font-face` from `src/App.vue`**

Delete the two `@font-face` blocks at the top of the `<style scoped>` section (lines 8–20 in the current file). Keep the rest of the styles unchanged.

- [ ] **Step 7.3: Remove `@font-face` from `src/components/EventCard.vue`**

Delete the two `@font-face` blocks at the top of its `<style scoped>` section.

- [ ] **Step 7.4: Verify the site still renders with fonts**

Run:
```bash
yarn start
```

Open the homepage. Confirm "ECLIPSE BOUNDARIES" still renders in the Matter-Heavy face and the event card uses Matter-SemiBold. Stop dev server.

- [ ] **Step 7.5: Commit**

```bash
git add src/styles.css src/App.vue src/components/EventCard.vue
git commit -m "perf(seo): hoist @font-face to global styles for preload-friendliness"
```

---

## Task 8: Install `@unhead/vue` and wire it into `main.ts`

**Files:**
- Modify: `package.json`
- Modify: `src/main.ts`

- [ ] **Step 8.1: Install**

Run:
```bash
yarn add @unhead/vue@^1.11.0
```

- [ ] **Step 8.2: Wire into `main.ts`**

Overwrite `src/main.ts` with:

```ts
import { createApp } from 'vue'
import { createHead } from '@unhead/vue'
import App from './App.vue'
import router from './router'
import './styles.css'

const head = createHead()

createApp(App).use(head).use(router).mount('#app')
```

- [ ] **Step 8.3: Verify no boot errors**

Run:
```bash
yarn start
```

Open the site and confirm it loads and navigates (no console errors). Stop dev server.

- [ ] **Step 8.4: Commit**

```bash
git add package.json yarn.lock src/main.ts
git commit -m "feat(seo): register @unhead/vue for per-route title and meta"
```

---

## Task 9: Add `/event/:eventId` route and `EventDetailView.vue`

**Files:**
- Create: `src/views/EventDetailView.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 9.1: Create `EventDetailView.vue`**

Create `src/views/EventDetailView.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeoMeta, useHead } from '@unhead/vue'
import { supabase } from '@/supabase'
import {
    buildEventMeta,
    buildEventJsonLd,
    buildBreadcrumbJsonLd,
} from '@/lib/seo/templates'
import type { SeoEvent } from '@/lib/seo/types'

interface EventRow extends SeoEvent {}

const route = useRoute()
const router = useRouter()
const eventId = route.params.eventId as string

const event = ref<EventRow | null>(null)
const loading = ref(true)
const notFound = ref(false)

const seo = computed(() =>
    event.value ? buildEventMeta(event.value) : null,
)

onMounted(async () => {
    const { data, error } = await supabase
        .from('events')
        .select('id, title, artwork_url, location, event_date, ticket_link')
        .eq('id', eventId)
        .eq('is_draft', false)
        .eq('is_archived', false)
        .maybeSingle()

    if (error || !data) {
        notFound.value = true
        loading.value = false
        return
    }

    event.value = data as EventRow
    loading.value = false
})

useSeoMeta(
    computed(() => {
        if (!seo.value) {
            return {
                title: 'Loading… | ECLIPSE BOUNDARIES',
                robots: 'noindex',
            }
        }
        return {
            title: seo.value.title,
            description: seo.value.description,
            ogType: 'website',
            ogTitle: seo.value.tags.find(
                (t) => t.keyAttr === 'property' && t.key === 'og:title',
            )?.content,
            ogDescription: seo.value.tags.find(
                (t) => t.keyAttr === 'property' && t.key === 'og:description',
            )?.content,
            ogImage: seo.value.tags.find(
                (t) => t.keyAttr === 'property' && t.key === 'og:image',
            )?.content,
            ogUrl: seo.value.canonical,
            twitterCard: 'summary_large_image',
            twitterImage: seo.value.tags.find(
                (t) => t.keyAttr === 'name' && t.key === 'twitter:image',
            )?.content,
        }
    }),
)

useHead(
    computed(() => ({
        link: seo.value
            ? [{ rel: 'canonical', href: seo.value.canonical }]
            : [],
        script: event.value
            ? [
                  {
                      type: 'application/ld+json',
                      innerHTML: JSON.stringify(buildEventJsonLd(event.value)),
                  },
                  {
                      type: 'application/ld+json',
                      innerHTML: JSON.stringify(
                          buildBreadcrumbJsonLd(event.value),
                      ),
                  },
              ]
            : [],
    })),
)

function formatLong(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function onBuyTickets() {
    if (!event.value) return
    if (event.value.ticket_link) {
        window.open(event.value.ticket_link, '_blank', 'noopener,noreferrer')
        return
    }
    router.push({
        name: 'ticket-shop',
        params: { eventId: event.value.id },
    })
}
</script>

<template>
    <main class="event-detail">
        <div v-if="loading" class="state">Loading…</div>
        <div v-else-if="notFound" class="state">
            <h1>Event not found</h1>
            <router-link to="/">Back to home</router-link>
        </div>
        <article v-else-if="event" class="event-card">
            <img
                :src="event.artwork_url"
                :alt="`${event.title} event artwork — ${event.location}`"
                class="event-cover"
                fetchpriority="high"
                loading="eager"
            />
            <div class="event-details">
                <h1 class="event-title">{{ event.title }}</h1>
                <p class="event-location">{{ event.location }}</p>
                <p class="event-date">{{ formatLong(event.event_date) }}</p>
                <button type="button" class="ticket-button" @click="onBuyTickets">
                    TICKETS
                </button>
                <router-link to="/" class="back-link">
                    ← Back to home
                </router-link>
            </div>
        </article>
    </main>
</template>

<style scoped>
.event-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 500px;
    gap: 24px;
}

.state {
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    text-align: center;
    padding: 40px 0;
}

.event-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
}

.event-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
}

.event-details {
    padding: 20px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.event-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
}

.event-location,
.event-date {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    color: #555;
    margin: 0;
}

.ticket-button {
    display: block;
    margin-top: 12px;
    padding: 14px;
    background: #1a1a1a;
    border: none;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    text-align: center;
    cursor: pointer;
    transition: background 0.3s ease;
}

.ticket-button:hover {
    background: #333;
}

.back-link {
    margin-top: 8px;
    color: #555;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.9rem;
    text-decoration: none;
}

.back-link:hover {
    text-decoration: underline;
}
</style>
```

- [ ] **Step 9.2: Register the route**

Modify `src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/event/:eventId',
            name: 'event-detail',
            component: () => import('@/views/EventDetailView.vue'),
        },
        {
            path: '/event/:eventId/tickets',
            name: 'ticket-shop',
            component: () => import('@/views/TicketShopView.vue'),
        },
        {
            path: '/event/:eventId/tickets/success',
            name: 'ticket-success',
            component: () => import('@/views/TicketSuccessView.vue'),
        },
        {
            path: '/tickets/order/:orderId',
            name: 'view-tickets',
            component: () => import('@/views/ViewTicketsView.vue'),
        },
    ],
})

export default router
```

- [ ] **Step 9.3: Type-check**

Run:
```bash
yarn type-check
```

Expected: success, no errors.

- [ ] **Step 9.4: Verify in dev**

Run: `yarn start`

Navigate to `/event/<an-existing-event-id>` in the browser. The page must:
- Render artwork, title, date, location, and a TICKETS button
- Have a `<title>` matching the expected template (check devtools)
- Contain a `<script type="application/ld+json">` block with the Event schema (inspect the `<head>`)

Stop dev server.

- [ ] **Step 9.5: Commit**

```bash
git add src/views/EventDetailView.vue src/router/index.ts
git commit -m "feat(seo): add public /event/:eventId detail page with meta + JSON-LD"
```

---

## Task 10: Update `EventCard.vue` — internal links, semantic HTML, alt text, image hints

Home-page event links should point at the new `/event/:id` (not `/event/:id/tickets`). This also gives us a chance to tighten alt text and add image loading hints for LCP.

**Files:**
- Modify: `src/components/EventCard.vue`

- [ ] **Step 10.1: Replace template block**

In `EventCard.vue`, replace the entire `<template>` block with:

```vue
<template>
    <section v-if="featured" class="events" aria-labelledby="featured-event-heading">
        <article class="event-card">
            <router-link
                :to="{ name: 'event-detail', params: { eventId: featured.id } }"
                class="event-card-link"
            >
                <img
                    :src="featured.artwork_url"
                    :alt="`${featured.title} event artwork — ${formatCompactDate(featured.event_date)} at ${featured.location}`"
                    class="event-cover"
                    fetchpriority="high"
                    loading="eager"
                />
                <div class="event-details">
                    <h2 id="featured-event-heading" class="event-title">
                        {{ featured.title }}
                    </h2>
                    <p class="event-location">{{ featured.location }}</p>
                    <p class="event-date">{{ formatEventDate(featured.event_date) }}</p>
                    <span class="ticket-button">TICKETS</span>
                </div>
            </router-link>
        </article>

        <section v-if="upcoming.length" class="upcoming-list" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" class="upcoming-heading">More upcoming shows</h2>
            <router-link
                v-for="event in upcoming"
                :key="event.id"
                :to="{ name: 'event-detail', params: { eventId: event.id } }"
                class="upcoming-row"
            >
                <img
                    :src="event.artwork_url"
                    :alt="`${event.title} — ${formatCompactDate(event.event_date)} at ${event.location}`"
                    class="upcoming-thumb"
                    loading="lazy"
                />
                <div class="upcoming-info">
                    <p class="upcoming-title">{{ event.title }}</p>
                    <p class="upcoming-meta">
                        {{ formatCompactDate(event.event_date) }} · {{ event.location }}
                    </p>
                </div>
                <span class="upcoming-chevron" aria-hidden="true">→</span>
            </router-link>
        </section>
    </section>
</template>
```

- [ ] **Step 10.2: Add `.event-card-link` styling**

In the `<style scoped>` block, add right after the `.event-card` rule:

```css
.event-card-link {
    display: block;
    color: inherit;
    text-decoration: none;
}
```

- [ ] **Step 10.3: Type-check and run**

Run:
```bash
yarn type-check
yarn start
```

Verify:
- Featured card is a link to `/event/:id` (right-click → copy link)
- Upcoming rows link to `/event/:id`
- Clicking through lands on `EventDetailView`
- Inspect `<img>` tags: featured has `fetchpriority="high"`, upcoming have `loading="lazy"`
- Alt text shows descriptive template

Stop dev server.

- [ ] **Step 10.4: Commit**

```bash
git add src/components/EventCard.vue
git commit -m "feat(seo): link home cards to /event/:id with semantic HTML + image hints"
```

---

## Task 11: Upgrade `HomeView.vue` — `<main>`, `<nav>`, and client-side `useSeoMeta`

**Files:**
- Modify: `src/views/HomeView.vue`

- [ ] **Step 11.1: Replace `<script setup>` block**

Replace the `<script setup lang="ts">` block with:

```ts
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSeoMeta, useHead } from '@unhead/vue'
import EventCard from '@/components/EventCard.vue'
import RadioList from '@/components/RadioList.vue'
import { buildHomeMeta, buildMusicGroupJsonLd } from '@/lib/seo/templates'

interface Link {
    title: string
    link: string
}

const links = ref<Link[]>([])

onMounted(async () => {
    try {
        const response = await fetch('/data/links.json')
        links.value = await response.json()
    } catch (error) {
        console.error('Error loading links:', error)
    }
})

const homeMeta = buildHomeMeta()

useSeoMeta({
    title: homeMeta.title,
    description: homeMeta.description,
    ogType: 'website',
    ogSiteName: 'ECLIPSE BOUNDARIES',
    ogTitle: 'ECLIPSE BOUNDARIES',
    ogDescription: 'Electronic events in Lucerne & Switzerland.',
    ogUrl: homeMeta.canonical,
    ogImage: 'https://eclipseboundaries.ch/og-default.jpg',
    ogLocale: 'en_US',
    twitterCard: 'summary_large_image',
    twitterTitle: 'ECLIPSE BOUNDARIES',
    twitterDescription: 'Electronic events in Lucerne & Switzerland.',
    twitterImage: 'https://eclipseboundaries.ch/og-default.jpg',
})

useHead({
    link: [{ rel: 'canonical', href: homeMeta.canonical }],
    script: [
        {
            type: 'application/ld+json',
            // Client-side homepage JSON-LD is the lightweight brand-only form.
            // The richer ItemList of events is injected by the Edge middleware.
            innerHTML: JSON.stringify(buildMusicGroupJsonLd([])),
        },
    ],
})
</script>
```

- [ ] **Step 11.2: Replace `<template>`**

Replace the template with:

```vue
<template>
    <main class="container">
        <header>
            <h1 class="title">ECLIPSE BOUNDARIES</h1>
        </header>

        <EventCard />

        <nav aria-label="External links" class="links-section">
            <a
                v-for="link in links"
                :key="link.link"
                :href="link.link"
                target="_blank"
                rel="noopener noreferrer"
                class="link-button"
            >
                {{ link.title }}
            </a>
        </nav>

        <RadioList />

        <nav aria-label="Social media" class="social-section">
            <a
                href="https://www.youtube.com/@eclipse_boundaries"
                target="_blank"
                rel="noopener noreferrer"
                class="social-link"
            >
                YouTube
            </a>
            <a
                href="https://www.instagram.com/eclipse_boundaries/"
                target="_blank"
                rel="noopener noreferrer"
                class="social-link"
            >
                Instagram
            </a>
            <a
                href="https://tiktok.com/@eclipse_boundaries"
                target="_blank"
                rel="noopener noreferrer"
                class="social-link"
            >
                TikTok
            </a>
        </nav>
    </main>
</template>
```

(Keep the `<style scoped>` block as-is.)

- [ ] **Step 11.3: Type-check and run**

Run:
```bash
yarn type-check
yarn start
```

Verify:
- Homepage renders the same visually
- DOM inspector shows `<main>`, `<header>`, two `<nav>` elements
- Devtools `<head>` contains the homepage `<title>`, meta description, OG tags, and one `<script type="application/ld+json">` block with MusicGroup

Stop dev server.

- [ ] **Step 11.4: Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(seo): semantic HTML + useSeoMeta on home view"
```

---

## Task 12: Noindex private / transactional views via `useSeoMeta`

**Files:**
- Modify: `src/views/TicketShopView.vue`
- Modify: `src/views/TicketSuccessView.vue`
- Modify: `src/views/ViewTicketsView.vue`

For each of the three views below, add — at the top of its existing `<script setup lang="ts">`:

```ts
import { useRoute } from 'vue-router'
import { useSeoMeta, useHead } from '@unhead/vue'
```

- [ ] **Step 12.1: `TicketShopView.vue`**

In `src/views/TicketShopView.vue`, inside `<script setup>` but at a top-level spot (not inside any handler), add:

```ts
const _route = useRoute()
const _eventId = _route.params.eventId as string

useSeoMeta({
    title: 'Tickets | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})

useHead({
    link: [
        {
            rel: 'canonical',
            href: `https://eclipseboundaries.ch/event/${_eventId}`,
        },
    ],
})
```

If the file already defines a `route` variable, remove the underscored alias and reuse that name — do not duplicate.

- [ ] **Step 12.2: `TicketSuccessView.vue`**

In `src/views/TicketSuccessView.vue`, inside `<script setup>` top-level:

```ts
useSeoMeta({
    title: 'Order confirmed | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})
```

- [ ] **Step 12.3: `ViewTicketsView.vue`**

In `src/views/ViewTicketsView.vue`, inside `<script setup>` top-level:

```ts
useSeoMeta({
    title: 'Your tickets | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})
```

- [ ] **Step 12.4: Type-check and run**

Run:
```bash
yarn type-check
yarn start
```

Navigate to each of the three routes in the browser (test with a real or fake event ID — errors on the page are fine, we only care about meta). For each, view page source and confirm:
- `<meta name="robots" content="noindex, nofollow">`
- Appropriate `<title>`
- TicketShopView: `<link rel="canonical" href="https://eclipseboundaries.ch/event/<id>">`

Stop dev server.

- [ ] **Step 12.5: Commit**

```bash
git add src/views/TicketShopView.vue src/views/TicketSuccessView.vue src/views/ViewTicketsView.vue
git commit -m "feat(seo): apply noindex + canonical on private ticket flow views"
```

---

## Task 13: Create `public/robots.txt`

**Files:**
- Create: `public/robots.txt`

- [ ] **Step 13.1: Write the file**

Create `public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /event/*/tickets
Disallow: /event/*/tickets/success
Disallow: /tickets/order/
Disallow: /api/

Sitemap: https://eclipseboundaries.ch/sitemap.xml
```

- [ ] **Step 13.2: Verify Vite serves it**

Run: `yarn start`

Open `http://localhost:5173/robots.txt`. Confirm the file content is served verbatim.

Stop dev server.

- [ ] **Step 13.3: Commit**

```bash
git add public/robots.txt
git commit -m "feat(seo): add robots.txt with disallow rules and sitemap pointer"
```

---

## Task 14: Edge Middleware skeleton (route matcher + pass-through)

Vercel detects `middleware.ts` at the project root and runs it on requests matching the declared `config.matcher`. We start with a no-op that verifies the middleware actually runs in production, then add real behavior in later tasks.

**Files:**
- Create: `middleware.ts`
- Modify: `package.json` (add `@vercel/edge` dep)

- [ ] **Step 14.1: Install `@vercel/edge`**

Run:
```bash
yarn add @vercel/edge@^1.2.0
```

- [ ] **Step 14.2: Create the middleware**

Create `middleware.ts` at the project root:

```ts
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
```

- [ ] **Step 14.3: Verify via build**

Run:
```bash
yarn build
```

Expected: build succeeds.

- [ ] **Step 14.4: Commit**

```bash
git add middleware.ts package.json yarn.lock
git commit -m "feat(seo): add Vercel Edge middleware skeleton with route matcher"
```

- [ ] **Step 14.5: Deploy to preview and verify header**

Deploy to a Vercel preview environment (push to a branch or `vercel` CLI). Then:

```bash
curl -I https://<preview-url>/
```

Expected: response includes `x-seo-middleware: pass-through`. If absent, the middleware is not running — check Vercel logs and the project's framework preset (must be Vite or "Other"; Next.js preset treats `middleware.ts` differently).

Do not proceed to Task 15 until this header appears.

---

## Task 15: Edge-side Supabase event fetchers

These run inside the Edge runtime — we cannot use `@supabase/supabase-js` here because it pulls in Node APIs. Use the Supabase REST endpoint directly via `fetch`, respecting RLS via the anon key.

**Files:**
- Create: `src/lib/seo/edge-supabase.ts`

- [ ] **Step 15.1: Write the module**

Create `src/lib/seo/edge-supabase.ts`:

```ts
import type { SeoEvent } from './types'

const EVENT_COLUMNS = 'id,title,artwork_url,location,event_date,ticket_link'

interface EdgeSupabaseEnv {
    url: string
    anonKey: string
}

function readEnv(): EdgeSupabaseEnv | null {
    // Vercel Edge runtime exposes env vars on the global `process.env`
    // shim for Vite apps. Fall back to globalThis for other shapes.
    const env =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (typeof process !== 'undefined' ? (process as any).env : undefined) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).env
    if (!env) return null
    const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
    const anonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    return { url, anonKey }
}

async function restGet(path: string): Promise<unknown> {
    const env = readEnv()
    if (!env) throw new Error('Supabase env missing on edge')
    const res = await fetch(`${env.url}/rest/v1/${path}`, {
        headers: {
            apikey: env.anonKey,
            authorization: `Bearer ${env.anonKey}`,
            accept: 'application/json',
        },
    })
    if (!res.ok) throw new Error(`Supabase REST ${res.status}`)
    return res.json()
}

export async function fetchEventById(id: string): Promise<SeoEvent | null> {
    // PostgREST filter syntax; .single not used — we want null on 0 rows.
    const rows = (await restGet(
        `events?select=${EVENT_COLUMNS}&id=eq.${encodeURIComponent(
            id,
        )}&is_draft=eq.false&is_archived=eq.false&limit=1`,
    )) as SeoEvent[]
    return rows[0] ?? null
}

export async function fetchUpcomingEvents(limit = 10): Promise<SeoEvent[]> {
    const nowIso = new Date().toISOString()
    return (await restGet(
        `events?select=${EVENT_COLUMNS}&is_draft=eq.false&is_archived=eq.false&event_date=gte.${encodeURIComponent(
            nowIso,
        )}&order=event_date.asc&limit=${limit}`,
    )) as SeoEvent[]
}

export async function fetchRecentAndUpcomingEvents(): Promise<SeoEvent[]> {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 6)
    return (await restGet(
        `events?select=${EVENT_COLUMNS}&is_draft=eq.false&is_archived=eq.false&event_date=gte.${encodeURIComponent(
            cutoff.toISOString(),
        )}&order=event_date.asc`,
    )) as SeoEvent[]
}
```

- [ ] **Step 15.2: Type-check**

Run:
```bash
yarn type-check
```

Expected: no errors.

- [ ] **Step 15.3: Commit**

```bash
git add src/lib/seo/edge-supabase.ts
git commit -m "feat(seo): add edge-runtime Supabase event fetchers"
```

---

## Task 16: Edge middleware — inject homepage meta + JSON-LD

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 16.1: Replace middleware contents**

Overwrite `middleware.ts`:

```ts
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
    // The static shell ships with default homepage meta (Task 6). For
    // event pages we want them gone so our per-event meta is authoritative.
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

export default async function middleware(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/') {
        const res = await next()
        return handleHome(res)
    }

    return next()
}
```

- [ ] **Step 16.2: Type-check**

Run: `yarn type-check`
Expected: success.

- [ ] **Step 16.3: Deploy to preview and verify**

Deploy and:

```bash
curl -sA "Googlebot" https://<preview-url>/ | grep -Eo '(<title>[^<]+|og:image[^>]+|MusicGroup)' | head -20
```

Expected:
- `<title>ECLIPSE BOUNDARIES — House Music Label in Lucerne</title>`
- `og:image` content present
- `MusicGroup` string inside a JSON-LD script tag

Also confirm `x-seo-middleware: home` in `curl -I`.

- [ ] **Step 16.4: Commit**

```bash
git add middleware.ts
git commit -m "feat(seo): edge-inject homepage meta and MusicGroup JSON-LD"
```

---

## Task 17: Edge middleware — inject event page meta + JSON-LD

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 17.1: Add event handler**

In `middleware.ts`, add above the `export default` function:

```ts
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
```

- [ ] **Step 17.2: Extend the dispatcher**

Replace the `export default` block with:

```ts
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
```

- [ ] **Step 17.3: Deploy to preview and verify**

Deploy, then with a known event ID:

```bash
curl -sA "Googlebot" https://<preview-url>/event/<id> | grep -Eo '(<title>[^<]+|"@type":"Event"|"@type":"BreadcrumbList")'
```

Expected: all three captures present.

Also run the URL through the [Rich Results Test](https://search.google.com/test/rich-results) — it must report `Event` detected, zero errors.

- [ ] **Step 17.4: Commit**

```bash
git add middleware.ts
git commit -m "feat(seo): edge-inject event page meta, Event JSON-LD, BreadcrumbList"
```

---

## Task 18: Edge middleware — X-Robots-Tag for private routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 18.1: Add private-route branch**

Still inside `middleware.ts`, extend the dispatcher:

```ts
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

    // Private / transactional routes: let the SPA render but stamp headers
    // so crawlers never index them (belt-and-braces with the Disallow rules
    // in robots.txt and the in-app useSeoMeta robots meta).
    if (
        /^\/event\/[^/]+\/tickets(\/success)?$/.test(path) ||
        /^\/tickets\/order\//.test(path)
    ) {
        const res = await next()
        const headers = new Headers(res.headers)
        headers.set('x-robots-tag', 'noindex, nofollow')
        headers.set('x-seo-middleware', 'private')
        return new Response(res.body, {
            status: res.status,
            headers,
        })
    }

    return next()
}
```

- [ ] **Step 18.2: Deploy and verify**

Deploy, then:

```bash
curl -I https://<preview-url>/event/<id>/tickets | grep -i x-robots-tag
curl -I https://<preview-url>/tickets/order/<id> | grep -i x-robots-tag
```

Expected: `X-Robots-Tag: noindex, nofollow` for both.

- [ ] **Step 18.3: Commit**

```bash
git add middleware.ts
git commit -m "feat(seo): emit X-Robots-Tag noindex on private ticket routes"
```

---

## Task 19: Dynamic `/sitemap.xml` Edge function

**Files:**
- Create: `api/sitemap.xml.ts`
- Modify: `vercel.json`

- [ ] **Step 19.1: Create the Edge function**

Create `api/sitemap.xml.ts`:

```ts
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
                image: { loc: e.artwork_url, title: e.title },
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
```

- [ ] **Step 19.2: Update `vercel.json` for the route**

Replace `vercel.json` with:

```json
{
    "rewrites": [
        { "source": "/sitemap.xml", "destination": "/api/sitemap.xml" },
        { "source": "/(.*)", "destination": "/index.html" }
    ]
}
```

Order matters — the sitemap rewrite must precede the SPA catch-all.

- [ ] **Step 19.3: Deploy and verify**

Deploy, then:

```bash
curl -s https://<preview-url>/sitemap.xml | head -20
```

Expected: XML with `<urlset>`, homepage entry, and `<url>` per event with `<image:image>` tags.

Also open the URL in a browser — Chrome renders sitemaps readably. No red validation errors.

- [ ] **Step 19.4: Commit**

```bash
git add api/sitemap.xml.ts vercel.json
git commit -m "feat(seo): serve dynamic sitemap.xml with image extension + retention"
```

---

## Task 20: Post-deploy runbook

**Files:**
- Create: `docs/superpowers/runbooks/seo-post-deploy.md`

- [ ] **Step 20.1: Create the runbook**

Create `docs/superpowers/runbooks/seo-post-deploy.md`:

```markdown
# SEO Post-Deploy Runbook

Run this the first time after the SEO stack lands in production, and whenever the Edge middleware changes meaningfully.

## Prerequisites

- Production domain `eclipseboundaries.ch` connected in Vercel.
- Environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` set on Production and Preview.
- `public/og-default.jpg` is a real 1200×630 JPEG (not a placeholder).

## Checklist

1. Deploy to production.
2. Verify middleware runs:
   ```
   curl -I https://eclipseboundaries.ch/ | grep -i x-seo-middleware
   ```
   Expected: `x-seo-middleware: home`.
3. Verify homepage HTML as a crawler sees it:
   ```
   curl -sA "Googlebot" https://eclipseboundaries.ch/
   ```
   Must contain: real `<title>`, `<meta name="description">`, OG tags, JSON-LD `MusicGroup`, and `<link rel="canonical">`.
4. Pick a known event ID, then:
   ```
   curl -sA "Googlebot" https://eclipseboundaries.ch/event/<id>
   ```
   Must contain: event-specific `<title>`, Event JSON-LD, BreadcrumbList JSON-LD.
5. Verify noindex on private routes:
   ```
   curl -I https://eclipseboundaries.ch/event/<id>/tickets | grep -i x-robots-tag
   ```
   Expected: `X-Robots-Tag: noindex, nofollow`.
6. Sitemap:
   ```
   curl -s https://eclipseboundaries.ch/sitemap.xml
   ```
   Valid XML; homepage + event entries; `<image:image>` present.
7. Robots:
   ```
   curl -s https://eclipseboundaries.ch/robots.txt
   ```
   Sitemap pointer + disallow rules.
8. Google Rich Results Test — paste an event URL into
   https://search.google.com/test/rich-results — expect `Event` detected, zero errors.
9. Schema Markup Validator — second check at https://validator.schema.org .
10. Social previews:
    - https://www.opengraph.xyz/ — paste homepage + event URL.
    - https://developers.facebook.com/tools/debug/ — force a fresh scrape for both.
    - https://cards-dev.twitter.com/validator — same.
11. PageSpeed Insights — https://pagespeed.web.dev — "Good" LCP/CLS/INP for `/` and one event URL on mobile.
12. Submit sitemap + verify ownership:
    - Google Search Console: add property for `eclipseboundaries.ch`, submit sitemap.
    - Bing Webmaster Tools: same.
13. Request indexing in Search Console for `/` and 1–2 key event URLs to kickstart discovery.

## Rollback

If the middleware misbehaves, `vercel rollback` reverts in seconds. With middleware absent, the static shell is served (same as pre-SEO behavior) and the SPA still works — worst-case graceful degradation.

## Confirm an events index exists

To keep Edge fetch latency predictable, confirm (or add) a Supabase index:

```
create index if not exists events_public_upcoming_idx
    on events (event_date)
    where is_draft = false and is_archived = false;
```
```

- [ ] **Step 20.2: Commit**

```bash
git add docs/superpowers/runbooks/seo-post-deploy.md
git commit -m "docs(seo): add post-deploy validation runbook"
```

---

## Task 21: Final verification pass

**Files:** none (validation only).

- [ ] **Step 21.1: Full test run**

Run:
```bash
yarn test
yarn type-check
yarn build
```

Expected: all three succeed.

- [ ] **Step 21.2: Local smoke of the shipped shell**

Run:
```bash
yarn preview
```

Open `http://localhost:4173/`. The middleware does not run in `vite preview` — that's fine. Confirm:
- Title and default meta are present in HTML source (set by `index.html` + `useSeoMeta`)
- `/event/<a-real-id>` renders the new detail page
- `/robots.txt` and `/sitemap.xml` work (sitemap is the dev version, won't include DB events here — that's expected)

Stop preview.

- [ ] **Step 21.3: Deploy to preview and walk the runbook**

Execute every step in `docs/superpowers/runbooks/seo-post-deploy.md` against the Vercel preview URL (substitute `<preview-url>` for `eclipseboundaries.ch` in the curl commands). Every check must pass.

- [ ] **Step 21.4: Promote to production**

Merge to `main`. After the production deploy completes, re-run the runbook steps against `https://eclipseboundaries.ch`.

Then execute the Google Search Console + Bing Webmaster submissions (steps 12–13 of the runbook) — these are one-time UI actions.

- [ ] **Step 21.5: Close out**

Nothing to commit. The SEO feature is live.

---

## Appendix — open design follow-ups

These are documented in the spec but explicitly out of scope for this plan. No tasks are written for them — they're parked for later planning cycles:

- Real 1200×630 `og-default.jpg` designed and replaced
- `/about`, `/press` static pages (will need new meta entries and sitemap handlers)
- `/archive` past-shows page (re-introduces events > 6 months into sitemap)
- Optional `description`, `slug`, `end_date` columns on `events` — middleware will auto-prefer them once added, but the adapter code will need a small touchup
- Analytics choice (Vercel Analytics vs. Plausible/Umami) and `<script>` wiring
