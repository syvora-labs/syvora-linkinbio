# Event Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing `/event/:eventId` route in the UI so users can land on a real event detail page that shows description, lineup, and a tickets CTA — without any database changes.

**Architecture:** Frontend-only. Expand the existing Supabase `select` calls to include `description` and `lineup` (`text[]`), extend `SeoEvent` to carry them, expand the SEO templates to use them, render the new sections in `EventDetailView`, and turn the home `EventCard` rows into router-links pointing at `/event/:eventId` instead of jumping straight to tickets.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Vue Router 5, Supabase JS, `@unhead/vue` for meta, Vitest for unit tests. Path alias `@` → `src/`.

**Spec:** `docs/superpowers/specs/2026-05-19-event-detail-view-design.md`

---

## File Map

| File | Action | Why |
| ---- | ------ | --- |
| `src/lib/seo/types.ts` | Modify | Add optional `description` and `lineup` to `SeoEvent`. |
| `src/lib/seo/edge-supabase.ts` | Modify | Expand server-side `select` so SSR meta matches client. |
| `src/lib/seo/templates.ts` | Modify | Use `description` in meta; emit `description` + `performer[]` in JSON-LD. |
| `src/lib/seo/__tests__/templates.test.ts` | Modify | Add coverage for the new template behavior. |
| `src/views/EventDetailView.vue` | Modify | Expand select; render description + lineup sections. |
| `src/components/EventCard.vue` | Modify | Featured card and upcoming rows become router-links to `/event/:eventId`; remove inline TICKETS button on featured card. |

No router changes. No new files. No DB migrations.

---

## Task 1: Extend SeoEvent type with description and lineup

**Files:**
- Modify: `src/lib/seo/types.ts`

- [ ] **Step 1: Add optional fields to `SeoEvent`**

Replace the `SeoEvent` interface in `src/lib/seo/types.ts` with:

```ts
export interface SeoEvent {
    id: string
    title: string
    /**
     * Promo artwork URL. May be null for events with no external promo
     * (typically internally-managed ticket sales) — consumers must fall
     * back to a default image.
     */
    artwork_url: string | null
    location: string
    event_date: string // ISO 8601
    ticket_link: string | null
    /** Editorial long-form text. Plain text with newlines. */
    description?: string | null
    /** Ordered list of performing acts (artist names). */
    lineup?: string[]
}
```

- [ ] **Step 2: Verify the existing SEO tests still pass**

Run: `yarn test src/lib/seo`
Expected: PASS — the existing tests do not provide `description`/`lineup`, and the fields are optional.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/types.ts
git commit -m "feat(seo): add description and lineup to SeoEvent"
```

---

## Task 2: Expand server-side event select in edge-supabase

**Files:**
- Modify: `src/lib/seo/edge-supabase.ts:3`

- [ ] **Step 1: Add `description` and `lineup` to `EVENT_COLUMNS`**

In `src/lib/seo/edge-supabase.ts`, change line 3:

```ts
const EVENT_COLUMNS = 'id,title,artwork_url,location,event_date,ticket_link,description,lineup'
```

- [ ] **Step 2: Run type-check**

Run: `yarn type-check`
Expected: PASS — `SeoEvent` already accepts the new optional fields.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/edge-supabase.ts
git commit -m "feat(seo): include description and lineup in edge event select"
```

---

## Task 3: Use event description in `buildEventMeta`

**Files:**
- Modify: `src/lib/seo/templates.ts:36`
- Modify: `src/lib/seo/__tests__/templates.test.ts`

- [ ] **Step 1: Add a failing test for description override**

Add this `it` block inside the existing `describe('buildEventMeta', ...)` in `src/lib/seo/__tests__/templates.test.ts`:

```ts
    it('uses event description (truncated) when present', () => {
        const eventWithDescription: SeoEvent = {
            ...sampleEvent,
            description:
                'A night of immersive electronic music featuring two live acts and a closing DJ set on the rooftop terrace.',
        }
        const meta = buildEventMeta(eventWithDescription)
        expect(meta.description).toContain('immersive electronic music')
        expect(meta.description.length).toBeLessThanOrEqual(155)
        const ogDescription = meta.tags.find(
            (t) => t.keyAttr === 'property' && t.key === 'og:description',
        )
        expect(ogDescription?.content).toContain('immersive electronic music')
    })

    it('falls back to generated description when event description is empty', () => {
        const blank: SeoEvent = { ...sampleEvent, description: '   ' }
        const meta = buildEventMeta(blank)
        expect(meta.description).toContain('Tickets available now')
    })
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `yarn test src/lib/seo`
Expected: FAIL — the two new cases fail because `buildEventMeta` ignores `description`.

- [ ] **Step 3: Implement the description override**

In `src/lib/seo/templates.ts`, replace the body of `buildEventMeta` between the `const ogImage = ...` line and the `const tags: MetaTag[] = [` line with:

```ts
    const titleSuffix = ` — ${city}, ${dateShort} | ${SITE_NAME}`;
    const maxEventTitle = MAX_TITLE - titleSuffix.length;
    const title = maxEventTitle > 1 ? truncate(event.title, maxEventTitle) + titleSuffix : truncate(event.title + titleSuffix, MAX_TITLE);

    const editorial = event.description?.trim();
    const description = editorial
        ? truncate(editorial, MAX_DESCRIPTION)
        : truncate(`${event.title} live on ${dateLong} at ${event.location}. Electronic music presented by ${SITE_NAME}. Tickets available now.`, MAX_DESCRIPTION);
    const ogDescription = editorial
        ? truncate(editorial, MAX_OG_DESCRIPTION)
        : truncate(`${event.title} on ${dateLong} at ${event.location}. Tickets available now.`, MAX_OG_DESCRIPTION);
    const ogTitle = truncate(`${event.title} — ${city}, ${dateShort}`, MAX_TITLE);
```

This replaces the previous `title`, `description`, `ogDescription`, `ogTitle` declarations. Leave the rest of the function (the `tags` array and `return` statement) untouched.

- [ ] **Step 4: Run tests and verify all pass**

Run: `yarn test src/lib/seo`
Expected: PASS — both new cases plus all preexisting cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/templates.ts src/lib/seo/__tests__/templates.test.ts
git commit -m "feat(seo): use event description in meta when present"
```

---

## Task 4: Emit description and performer[] in `buildEventJsonLd`

**Files:**
- Modify: `src/lib/seo/templates.ts:74`
- Modify: `src/lib/seo/__tests__/templates.test.ts`

- [ ] **Step 1: Add failing tests for the JSON-LD additions**

Add these `it` blocks inside the existing `describe('buildEventJsonLd', ...)`:

```ts
    it('emits description when event.description is present', () => {
        const ld = buildEventJsonLd({
            ...sampleEvent,
            description: 'Immersive rooftop set with two live acts.',
        })
        expect(ld.description).toBe(
            'Immersive rooftop set with two live acts.',
        )
    })

    it('omits description when event.description is blank or absent', () => {
        const ldA = buildEventJsonLd(sampleEvent)
        expect('description' in ldA).toBe(false)
        const ldB = buildEventJsonLd({ ...sampleEvent, description: '  ' })
        expect('description' in ldB).toBe(false)
    })

    it('emits performer[] from lineup as PerformingGroup', () => {
        const ld = buildEventJsonLd({
            ...sampleEvent,
            lineup: ['Artist One', 'Artist Two'],
        })
        const performers = ld.performer as Record<string, unknown>[]
        expect(performers).toHaveLength(2)
        expect(performers[0]).toEqual({
            '@type': 'PerformingGroup',
            name: 'Artist One',
        })
        expect(performers[1].name).toBe('Artist Two')
    })

    it('omits performer when lineup is empty or absent', () => {
        const ldA = buildEventJsonLd(sampleEvent)
        expect('performer' in ldA).toBe(false)
        const ldB = buildEventJsonLd({ ...sampleEvent, lineup: [] })
        expect('performer' in ldB).toBe(false)
    })
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `yarn test src/lib/seo`
Expected: FAIL — the four new cases fail.

- [ ] **Step 3: Update `buildEventJsonLd`**

In `src/lib/seo/templates.ts`, replace the existing `buildEventJsonLd` function with:

```ts
export function buildEventJsonLd(event: SeoEvent): JsonLd {
    const city = extractCity(event.location) || event.location;
    const canonical = `${SITE_ORIGIN}/event/${event.id}`;
    const ticketUrl = event.ticket_link ?? `${canonical}/tickets`;
    // Same fallback logic as buildEventMeta: schema.org Event recommends
    // an image for rich results, so always emit one.
    const ogImage = absoluteUrl(event.artwork_url) ?? HOME_OG_IMAGE;

    const ld: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: event.event_date,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
            "@type": "Place",
            name: event.location,
            address: {
                "@type": "PostalAddress",
                addressLocality: city,
                addressCountry: "CH",
            },
        },
        image: [ogImage],
        organizer: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_ORIGIN,
        },
        offers: {
            "@type": "Offer",
            url: ticketUrl,
            availability: "https://schema.org/InStock",
            validFrom: new Date().toISOString(),
        },
        url: canonical,
    };

    const editorial = event.description?.trim();
    if (editorial) {
        ld.description = editorial;
    }

    if (event.lineup && event.lineup.length > 0) {
        ld.performer = event.lineup.map((name) => ({
            "@type": "PerformingGroup",
            name,
        }));
    }

    return ld;
}
```

- [ ] **Step 4: Run tests and verify all pass**

Run: `yarn test src/lib/seo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/templates.ts src/lib/seo/__tests__/templates.test.ts
git commit -m "feat(seo): emit description and performer[] in event JSON-LD"
```

---

## Task 5: Render description and lineup in EventDetailView

**Files:**
- Modify: `src/views/EventDetailView.vue`

- [ ] **Step 1: Expand the local `EventRow` and the select**

In `src/views/EventDetailView.vue`, replace this block (around lines 13 and 27–43):

```ts
interface EventRow extends SeoEvent {}
```

with:

```ts
interface EventRow extends SeoEvent {}

function hasDescription(e: EventRow | null): boolean {
    return !!e?.description && e.description.trim().length > 0
}

function hasLineup(e: EventRow | null): boolean {
    return !!e?.lineup && e.lineup.length > 0
}
```

Then change the existing `select(...)` call to include the new columns. Replace:

```ts
    const { data, error } = await supabase
        .from('events')
        .select('id, title, artwork_url, location, event_date, ticket_link')
        .eq('id', eventId)
        .eq('is_draft', false)
        .eq('is_archived', false)
        .maybeSingle()
```

with:

```ts
    const { data, error } = await supabase
        .from('events')
        .select('id, title, artwork_url, location, event_date, ticket_link, description, lineup')
        .eq('id', eventId)
        .eq('is_draft', false)
        .eq('is_archived', false)
        .maybeSingle()
```

- [ ] **Step 2: Render the description and lineup sections in the template**

In the same file, replace the inner `<article v-else-if="event" class="event-card">…</article>` block with:

```vue
        <article v-else-if="event" class="event-card">
            <img
                v-if="event.artwork_url"
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
            </div>
        </article>

        <section
            v-if="event && hasDescription(event)"
            class="event-description-card"
            aria-label="Event description"
        >
            <p class="event-description-text">{{ event.description }}</p>
        </section>

        <section
            v-if="event && hasLineup(event)"
            class="event-lineup"
            aria-labelledby="lineup-heading"
        >
            <h2 id="lineup-heading" class="lineup-heading">LINEUP</h2>
            <ul class="lineup-list">
                <li
                    v-for="artist in event.lineup"
                    :key="artist"
                    class="lineup-item"
                >
                    {{ artist }}
                </li>
            </ul>
        </section>

        <router-link v-if="event" to="/" class="back-link standalone-back">
            ← Back to home
        </router-link>
```

The back-link has moved from inside the `<article>` to a standalone element after the lineup section. The article in this replacement intentionally no longer contains it, so the move is complete after this replacement — no additional deletion needed.

- [ ] **Step 3: Add the styles for the new sections**

In the `<style scoped>` block of the same file, append:

```css
.event-description-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.event-description-text {
    margin: 0;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.98rem;
    line-height: 1.55;
    color: #1a1a1a;
    white-space: pre-wrap;
}

.event-lineup {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.lineup-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: white;
    margin: 4px 0 2px;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
}

.lineup-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.lineup-item {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    padding: 14px 20px;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.standalone-back {
    align-self: center;
    margin-top: 4px;
}
```

- [ ] **Step 4: Run type-check**

Run: `yarn type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/EventDetailView.vue
git commit -m "feat(web): render description and lineup on event detail view"
```

---

## Task 6: Make EventCard rows route to the detail view

**Files:**
- Modify: `src/components/EventCard.vue`

- [ ] **Step 1: Replace the entire `<template>` block**

In `src/components/EventCard.vue`, replace the entire `<template>…</template>` block with:

```vue
<template>
    <section v-if="featured" class="events" aria-labelledby="featured-event-heading">
        <router-link
            :to="{ name: 'event-detail', params: { eventId: featured.id } }"
            class="event-card-link"
        >
            <article class="event-card">
                <img
                    v-if="featured.artwork_url"
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
                </div>
            </article>
        </router-link>

        <section v-if="upcoming.length" class="upcoming-list" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" class="upcoming-heading">More upcoming shows</h2>
            <router-link
                v-for="event in upcoming"
                :key="event.id"
                :to="{ name: 'event-detail', params: { eventId: event.id } }"
                class="upcoming-row"
            >
                <img
                    v-if="event.artwork_url"
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

Notes on what changed:
- The featured `<article>` is wrapped in a `<router-link>` named `event-card-link`.
- The inline `<a v-if="featured.ticket_link">` / `<router-link v-else>` TICKETS button is **removed** from the featured card.
- Each upcoming row is now a single `<router-link>` to `event-detail`, replacing the previous `<template>` branch between external `<a>` and internal `<router-link>` pointing at tickets.

- [ ] **Step 2: Add the `.event-card-link` style and drop the obsolete `.ticket-button` rule**

In the `<style scoped>` block, add this near the existing `.event-card` rule:

```css
.event-card-link {
    display: block;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.25s ease, transform 0.25s ease;
    border-radius: 12px;
}

.event-card-link:hover .event-card {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}
```

Then delete the entire `.ticket-button { … }` and `.ticket-button:hover { … }` blocks — they are no longer referenced from this component. (The `.ticket-button` rules in `EventDetailView.vue` are separate scoped styles and stay.)

- [ ] **Step 3: Run type-check**

Run: `yarn type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/EventCard.vue
git commit -m "feat(web): route event card and upcoming rows to detail view"
```

---

## Task 7: Manual smoke test in the browser

**Files:** none

- [ ] **Step 1: Start the dev server**

Run: `yarn start`
Expected: Vite dev server starts on its default port. Note the URL it prints.

- [ ] **Step 2: Verify home navigates to detail view**

Open the URL in a browser. Confirm:
- The featured event card is visually unchanged but the whole card is clickable.
- Clicking the featured card navigates to `/event/<id>` (the URL in the address bar updates).
- Clicking any "More upcoming shows" row also navigates to `/event/<id>` (not `/event/<id>/tickets`).

- [ ] **Step 3: Verify detail view rendering for an event with description and lineup**

On the detail page, confirm:
- Cover image, title, location, date all render.
- TICKETS button is visible.
- If `description` is set on the event, a white card with the description text appears below the main card.
- If `lineup` is non-empty, a "LINEUP" section appears with one card per artist, in the array order.

- [ ] **Step 4: Verify detail view degrades gracefully**

Pick an event whose `description` is null and whose `lineup` is `[]`. Confirm:
- No description card appears.
- No "LINEUP" section appears.
- The page still renders title, date, location, TICKETS, and back link.

- [ ] **Step 5: Verify the TICKETS button behavior**

For an event with `ticket_link` set: click TICKETS. Expected: a new tab opens to the external URL; the detail page stays open in the original tab.

For an event with `ticket_link` null: click TICKETS. Expected: the in-app router navigates to `/event/<id>/tickets`.

- [ ] **Step 6: Verify the back link returns to home**

From the detail page, click "← Back to home". Expected: `/` loads with the home layout intact.

- [ ] **Step 7: Production build**

Stop the dev server. Run: `yarn build`
Expected: PASS — both `yarn type-check` and `yarn build-only` complete with no errors.

- [ ] **Step 8: Final commit (only if smoke testing surfaced any fixes)**

If no fixes were needed, skip this step. Otherwise, commit the fixes with a message describing what changed.

---

## Self-Review Notes

**Spec coverage:**
- Data model (no DB changes) — Tasks 1, 2 expose the existing columns.
- Navigation change (home → detail) — Task 6.
- Detail view layout (cover, title/location/date, TICKETS, description, lineup, back link) — Task 5.
- TICKETS button branching — preserved from existing `onBuyTickets()` (no change needed; verified in Task 7 step 5).
- SEO description override — Task 3.
- SEO `performer[]` — Task 4.
- Edge SSR select expansion — Task 2.
- Graceful degradation when description/lineup absent — Tasks 3, 4, 5 (opt-in renders only when truthy / non-empty); verified in Task 7 step 4.

**Type consistency:**
- `SeoEvent.description?: string | null` — consumed as `event.description?.trim()` in templates and `hasDescription` helper.
- `SeoEvent.lineup?: string[]` — consumed via length check and array iteration; PerformingGroup `name` is the string itself.
- `EventRow extends SeoEvent` in `EventDetailView` automatically inherits the new fields.

**Placeholder scan:** all code blocks contain runnable code. No "TODO"/"TBD". No "similar to Task N" references — Task 6 repeats the upcoming-row template even though it resembles Task 5's pattern.
