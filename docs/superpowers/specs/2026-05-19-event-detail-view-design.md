# Event Detail View — Design

**Status:** Approved (2026-05-19)
**Author:** dario.krieger@finnofleet.ch

## Problem

The route `/event/:eventId` already exists and is server-rendered for SEO,
but no UI path leads to it. Tapping an event on the home page jumps
straight to the ticket shop, skipping the per-event landing page entirely.
The current `EventDetailView.vue` only shows title, location, date, and a
TICKETS button — no description, no lineup — even though the database
already stores both.

## Goal

When a user taps any event surface on the home page, route them to the
event's detail page. That page presents the lineup, the description, and a
TICKETS call-to-action whose behavior depends on how the event is sold
(internal ticket shop vs. external link).

## Non-Goals

- No CMS / admin UI. Events stay editable through Supabase Studio.
- No Markdown or rich text. Description is plain text with line breaks.
- No per-artist artwork, bios, or social links in this pass. Lineup is a
  flat list of names.
- No new database columns or tables. Everything we need is already on the
  `events` row.
- No change to how internal vs. external ticketing is detected. We
  continue branching on `ticket_link` presence (the unused
  `ticket_management` column is out of scope for this work).

## What Already Exists

- Route `/event/:eventId` → `EventDetailView.vue` (`src/router/index.ts`).
- Edge SSR pipeline that injects per-event meta and JSON-LD into the
  initial HTML (`src/lib/seo/`, including `edge-supabase.ts`).
- `buildEventMeta`, `buildEventJsonLd`, `buildBreadcrumbJsonLd` in
  `src/lib/seo/templates.ts`.
- `EventCard.vue` on the home page, which currently links each row
  directly to the ticket shop.

## Database (no changes)

The `events` table already has the columns we need:

| Column                | Type           | Used here? |
| --------------------- | -------------- | ---------- |
| `id`                  | uuid           | yes |
| `title`               | text           | yes |
| `description`         | text (nullable)| **yes (new use)** |
| `lineup`              | text[] not null| **yes (new use)** |
| `location`            | text           | yes |
| `event_date`          | timestamptz    | yes |
| `artwork_url`         | text           | yes |
| `ticket_link`         | text (nullable)| yes |
| `is_draft`, `is_archived` | bool       | filter |

`lineup` being non-nullable means it's always present but may be an empty
array. Treat empty `[]` as "no lineup section."

## Navigation Changes

`HomeView.vue` → `EventCard.vue`:

- The featured event card stops being a self-contained "ad + buy" widget.
  The whole card becomes a `<router-link>` to `/event/:eventId`.
- The TICKETS button is **removed from the home featured card**. The CTA
  now lives only on the detail view, so we don't double up.
- The "More upcoming shows" rows also change from "link to tickets" to
  "link to detail view." Each row becomes a `<router-link>` to
  `/event/:eventId` regardless of internal vs. external ticketing.

The visual look of the home card and rows stays the same — only the link
target changes.

## Detail View Layout

`EventDetailView.vue`, rendered inside the existing `.event-detail` shell
(max 500px, iris gradient + grain background from `App.vue`):

```
┌─────────────────────────────┐
│   16:9 cover artwork        │  ← existing
├─────────────────────────────┤
│   Event Title               │
│   Location                  │
│   Long date + time          │
│                             │
│   [   TICKETS   ]           │  ← primary CTA
│                             │
│   ┌─────────────────────┐   │  (only if description present;
│   │ pre-wrapped text    │   │   no heading, just a card)
│   └─────────────────────┘   │
│                             │
│   LINEUP                    │  (only if lineup non-empty)
│   • Artist 1                │
│   • Artist 2                │
│   • Artist 3                │
│                             │
│   ← Back to home            │
└─────────────────────────────┘
```

### TICKETS button behavior

| Condition                          | Action                                  |
| ---------------------------------- | --------------------------------------- |
| `ticket_link` present              | `window.open(ticket_link, '_blank', 'noopener,noreferrer')` |
| `ticket_link` null                 | `router.push({ name: 'ticket-shop', params: { eventId } })` |

If a future event has neither tickets configured nor a link, hide the
button rather than showing a dead CTA. (Today this state shouldn't occur,
but treating it as "no CTA" is cheaper than throwing.)

### Description block

Rendered only when `description` is non-empty after trim. Styled inside a
white card matching the existing `.event-card` look, with
`white-space: pre-wrap` so editorial newlines survive. No HTML parsing.

### Lineup block

Rendered only when `lineup.length > 0`. Heading "LINEUP" using the same
uppercase Matter-Heavy treatment as the existing "More upcoming shows"
heading. Below it: a simple stacked list of artist names — one per row,
each in its own pill/card matching the visual rhythm of the upcoming-shows
list. Order is whatever order the array stores (the source of truth is
the column itself; we don't re-sort).

### Loading and error states

The existing three states (`loading`, `notFound`, loaded) stay. The
description and lineup sections are simply absent until the row arrives.

## SEO

Extend `SeoEvent` (`src/lib/seo/types.ts`) with two optional fields:

```ts
description?: string | null
lineup?: string[]
```

`buildEventMeta` (`templates.ts`):

- If `description` is non-empty, use its first 155 chars (truncated with
  the existing `truncate` helper) for `description` and the first 200
  for `og:description` / `twitter:description`. Otherwise fall back to
  the current generated template.

`buildEventJsonLd`:

- Add `description` when present.
- Add a `performer` array when `lineup` is non-empty: each entry
  `{ "@type": "PerformingGroup", "name": <artist> }`. (PerformingGroup
  matches DJ collectives / live acts better than Person and avoids
  guessing each artist's category.)

Edge SSR (`src/lib/seo/edge-supabase.ts`):

- Add `description, lineup` to the `select(...)` for the event-detail
  path so server-rendered meta and JSON-LD stay consistent with what the
  client would render after hydration.

`EventDetailView.vue`:

- Add `description, lineup` to its `select(...)`.
- Pass them through to the SEO builders via the existing `seo` computed.

## Components Touched

| File                                          | Change                                   |
| --------------------------------------------- | ---------------------------------------- |
| `src/components/EventCard.vue`                | Featured card and upcoming rows become router-links to detail view; remove inline TICKETS button from featured card. |
| `src/views/EventDetailView.vue`               | Expand select; render description + lineup; add TICKETS button behavior with internal/external branching. |
| `src/lib/seo/types.ts`                        | Add optional `description`, `lineup` to `SeoEvent`. |
| `src/lib/seo/templates.ts`                    | Use `description` in meta; emit `description` + `performer` in JSON-LD. |
| `src/lib/seo/edge-supabase.ts`                | Expand server-side select to include `description, lineup`. |
| `src/lib/seo/__tests__/templates.test.ts`     | Add cases covering the description fallback and `performer` array. |

No router changes. No new components. No new dependencies.

## Risks / Open Questions

- **Description length**: the SEO meta truncates to 155 chars. If
  editorial copy is much longer than that, social previews will trail
  off. That's acceptable and standard for SEO descriptions.
- **`performer` schema**: PerformingGroup vs. Person is a guess.
  PerformingGroup is the safer default for electronic-music acts; if
  needed, a future migration can split the array into typed entries.
- **`ticket_link` absent + no phases configured**: today this shouldn't
  exist in production, but the detail view should not crash. Hiding the
  button is the chosen fallback.

## Acceptance

- Tapping any event entry on `/` routes to `/event/:eventId`.
- The detail view shows description and lineup when present, omits the
  sections cleanly when absent.
- TICKETS button opens the external link in a new tab for externally
  managed events; routes to the internal shop otherwise.
- View-source on `/event/:eventId` (server-rendered) includes the
  expanded `og:description` (from the event description when present)
  and a `performer` array inside the Event JSON-LD.
- No console errors on home → detail → tickets navigation flow.
