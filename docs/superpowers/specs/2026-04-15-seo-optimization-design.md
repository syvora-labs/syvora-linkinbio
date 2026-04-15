# SEO Optimization — Design Spec

**Date:** 2026-04-15
**Status:** Design (pending implementation plan)
**Domain:** `eclipseboundaries.ch`
**Audience language/region:** English-only, Switzerland (primary city: Luzern; future: Zurich, Basel, Bern)

---

## 1. Goal

Make the ECLIPSE BOUNDARIES link-in-bio site fully discoverable and well-represented across:

- Search engines (Google, Bing, DuckDuckGo)
- Social link previewers (WhatsApp, Telegram, Slack, Discord, Instagram, Twitter/X, Facebook)
- Google Events / rich-result surfaces
- LLM crawlers (ChatGPT search, Perplexity, Claude — which largely rely on server-rendered HTML)

Target queries include brand queries ("eclipse boundaries"), event-specific queries, and generic regional queries ("techno Luzern", "electronic events Switzerland").

### Non-goals

- Backlink acquisition / off-page SEO (marketing activity)
- Blog / content-marketing infrastructure
- Multi-language / hreflang for other languages (site is English-only)
- Paid search

---

## 2. Baseline (what crawlers see today)

- `index.html` has only `<title>ECLIPSE BOUNDARIES</title>`, charset, viewport, favicon. No `lang`, no meta description, no OG / Twitter / canonical.
- All content (links, events, radios) is fetched client-side from Supabase/JSON *after* mount. Non-JS crawlers and all social previewers see only the empty `<div id="app">`.
- No `robots.txt`, no `sitemap.xml`.
- Route `/event/:eventId/tickets` is the only per-event URL; transactional, not content-oriented.
- Vercel SPA rewrite routes every URL to the same empty shell.

---

## 3. Architecture

Three layers with distinct responsibilities:

### Layer 1 — Vercel Edge Middleware (`middleware.ts`)

The SEO workhorse. Runs on every HTML request.

- Matches SEO-relevant routes: `/`, `/event/:eventId`.
- Fetches required event data from Supabase on cache miss (anon key, public data only).
- Rewrites the static `index.html` shell by injecting per-page `<title>`, meta description, canonical, OG tags, Twitter Card, JSON-LD structured data, and correct `<html lang="en">`.
- Emits `X-Robots-Tag: noindex, nofollow` on private/transactional routes.
- Ships the enriched HTML to crawler/user. SPA hydrates normally.

**Caching:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`. Typical request is sub-10ms at the edge; content stays within 5 minutes of Supabase truth.

### Layer 2 — Edge API routes

- **`/sitemap.xml`** — Edge function. Pulls current event list from Supabase, emits XML sitemap with image extension. Cached `s-maxage=3600, stale-while-revalidate=86400`.
- **`/robots.txt`** — static file in `public/`, served directly by Vercel.

### Layer 3 — Client SPA (`@unhead/vue`)

- Updates `<title>` and meta tags during in-app navigation (user experience only).
- Crawlers never reach this layer — they see Edge-rendered HTML on first load.

### Data flow

```
Request → Edge Middleware
   ├── cache hit → serve cached HTML (~5 ms)
   └── cache miss → fetch from Supabase (~150 ms) → rewrite HTML → cache → serve
```

### Key properties

- No build-time prerender. No Supabase → Vercel rebuild webhook. Freshness comes from short Edge caches.
- Site remains a Vue 3 + Vite SPA. No framework migration.
- Additive rollout: if middleware fails, static shell is served (same as today).

---

## 4. Route-by-route strategy

### 4.1 Route inventory

| Route | Indexable | Purpose |
|-------|-----------|---------|
| `/` | Yes | Homepage — brand + upcoming events overview |
| `/event/:eventId` **(new)** | Yes | Per-event content page — canonical SEO target |
| `/event/:eventId/tickets` | **noindex** | Internal checkout (transactional) |
| `/event/:eventId/tickets/success` | **noindex** | Post-purchase (private) |
| `/tickets/order/:orderId` | **noindex** | Ticket wallet (private) |

### 4.2 Introduce `/event/:eventId`

New Vue view `EventDetailView.vue` serving as the canonical public event page for both internally and externally sold events.

- Shows event artwork, title, formatted date, location, and a primary "TICKETS" CTA that either routes to `/event/:id/tickets` (internal shop) or redirects to `event.ticket_link` (external).
- This route replaces `/event/:eventId/tickets` as the target for:
  - Home-page event card links
  - Sitemap entries
  - Social shares
- `/event/:eventId/tickets` still exists as the checkout page but becomes `noindex` with a canonical pointing back to `/event/:eventId`.

### 4.3 Internal link updates

- `EventCard.vue`: featured event CTA and upcoming-row links route to `/event/:eventId` (not `/event/:eventId/tickets`).
- External-ticket events (`ticket_link` present) still open externally from *inside* the event detail page, not from the home list — so every event has an internal landing page.

---

## 5. Meta tag & structured data templates

All values derived automatically from existing Supabase fields: `id`, `title`, `artwork_url`, `location`, `event_date`, `ticket_link`. **No new columns. No manual SEO entry.**

### 5.1 Template variables

- `{title}` ← `event.title`
- `{date_short}` ← `formatCompactDate(event.event_date)` (e.g., "Fri Apr 20")
- `{date_long}` ← `formatEventDate(event.event_date)` (e.g., "Friday, April 20, 2026 at 22:00")
- `{date_iso}` ← `event.event_date` (ISO 8601)
- `{location}` ← `event.location`
- `{city}` ← first segment of `event.location` before comma, trimmed (e.g., "Luzern")
- `{ticket_url}` ← `event.ticket_link ?? "https://eclipseboundaries.ch/event/{id}/tickets"`

### 5.2 Length limits (enforced by ellipsis truncation)

- `<title>` ≤ 60 chars
- `<meta name="description">` ≤ 155 chars
- `<meta property="og:description">` ≤ 200 chars

### 5.3 Homepage (`/`)

```html
<html lang="en">
<title>ECLIPSE BOUNDARIES — Underground Electronic Events in Luzern & Switzerland</title>
<meta name="description" content="ECLIPSE BOUNDARIES is a Swiss electronic-music collective presenting underground events in Luzern and beyond. Upcoming shows, tickets, radios, mixes." />
<link rel="canonical" href="https://eclipseboundaries.ch/" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="ECLIPSE BOUNDARIES" />
<meta property="og:title" content="ECLIPSE BOUNDARIES" />
<meta property="og:description" content="Underground electronic events in Luzern & Switzerland." />
<meta property="og:url" content="https://eclipseboundaries.ch/" />
<meta property="og:image" content="https://eclipseboundaries.ch/og-default.jpg" />
<meta property="og:locale" content="en_US" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="ECLIPSE BOUNDARIES" />
<meta name="twitter:description" content="Underground electronic events in Luzern & Switzerland." />
<meta name="twitter:image" content="https://eclipseboundaries.ch/og-default.jpg" />
```

Homepage JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "name": "ECLIPSE BOUNDARIES",
  "url": "https://eclipseboundaries.ch",
  "genre": ["Electronic", "Techno"],
  "sameAs": [
    "https://www.instagram.com/eclipse_boundaries/",
    "https://www.youtube.com/@eclipse_boundaries",
    "https://tiktok.com/@eclipse_boundaries"
  ],
  "event": [ /* ItemList of up to 10 upcoming Event objects, same shape as §5.4 */ ]
}
```

### 5.4 Event page (`/event/:eventId`)

```html
<title>{title} — {location}, {date_short} | ECLIPSE BOUNDARIES</title>
<meta name="description" content="{title} live on {date_long} at {location}. Underground electronic music presented by ECLIPSE BOUNDARIES. Tickets available now." />
<link rel="canonical" href="https://eclipseboundaries.ch/event/{id}" />

<meta property="og:type" content="website" />
<meta property="og:title" content="{title} — {city}, {date_short}" />
<meta property="og:description" content="{title} on {date_long} at {location}. Tickets available now." />
<meta property="og:image" content="{event.artwork_url}" />
<meta property="og:url" content="https://eclipseboundaries.ch/event/{id}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="{event.artwork_url}" />
```

Event-page JSON-LD (`Event` + `BreadcrumbList`):

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "{title}",
  "startDate": "{date_iso}",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "{location}",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "{city}",
      "addressCountry": "CH"
    }
  },
  "image": ["{event.artwork_url}"],
  "organizer": {
    "@type": "Organization",
    "name": "ECLIPSE BOUNDARIES",
    "url": "https://eclipseboundaries.ch"
  },
  "offers": {
    "@type": "Offer",
    "url": "{ticket_url}",
    "availability": "https://schema.org/InStock",
    "validFrom": "{now_iso}"
  }
}
```

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://eclipseboundaries.ch/" },
    { "@type": "ListItem", "position": 2, "name": "{title}", "item": "https://eclipseboundaries.ch/event/{id}" }
  ]
}
```

### 5.5 Private / transactional routes

- `X-Robots-Tag: noindex, nofollow` emitted from Edge.
- `<link rel="canonical">` points to the public page where applicable (`/event/:id/tickets` → `/event/:id`).
- Excluded from sitemap.
- Minimal meta tags — these pages are not indexed.

### 5.6 Fallback behavior

- Supabase unreachable from Edge: serve static homepage defaults; return `503` on event URLs so crawlers retry instead of indexing a broken page.
- Event ID not found / drafted / archived: return `404` with `X-Robots-Tag: noindex`.

---

## 6. Sitemap & robots

### 6.1 `public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /event/*/tickets
Disallow: /event/*/tickets/success
Disallow: /tickets/order/
Disallow: /api/

Sitemap: https://eclipseboundaries.ch/sitemap.xml
```

`X-Robots-Tag: noindex` from Edge is the belt-and-braces complement — `Disallow` alone doesn't deindex pages reached via external links.

### 6.2 `/sitemap.xml` (dynamic, Edge)

- Fetches non-draft, non-archived events from Supabase.
- Emits `urlset` with the homepage and each `/event/:id`.
- Includes `image:image` extension for each event's `artwork_url`.
- Cache: `s-maxage=3600, stale-while-revalidate=86400`.

### 6.3 Retention policy

| Event state | Event page (200/404) | Sitemap entry |
|-------------|----------------------|---------------|
| Upcoming | 200, `priority=0.8`, `changefreq=weekly` | Yes |
| Past ≤ 6 months | 200, `priority=0.5`, `changefreq=monthly` | Yes |
| Past > 6 months | 200 (still resolves) | No |
| Drafted | 404 + noindex | No |
| Archived | 404 + noindex | No |

Past-event pages remain reachable to preserve backlinks. Archived = explicitly removed by operator and becomes a 404.

### 6.4 Example sitemap output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">
  <url>
    <loc>https://eclipseboundaries.ch/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://eclipseboundaries.ch/event/abc-123</loc>
    <lastmod>{event.updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>{event.artwork_url}</image:loc>
      <image:title>{event.title}</image:title>
    </image:image>
  </url>
</urlset>
```

---

## 7. On-page content & semantic HTML

### 7.1 HTML fixes

- `<html lang="">` → `<html lang="en">` (Edge middleware also enforces this).
- `HomeView.vue` root `<div class="container">` → `<main>` with nested `<header>` (brand) and `<nav aria-label="Social media">` (socials).
- `EventCard.vue`: featured card → `<article>`; "More upcoming shows" → `<section aria-labelledby="upcoming-heading">` with proper `id` on the heading.
- New `EventDetailView.vue`: structured as `<main><article>`.

### 7.2 Heading hierarchy

- Home: `<h1>ECLIPSE BOUNDARIES</h1>`, `<h2>{featured.title}</h2>`, `<h2 id="upcoming-heading">More upcoming shows</h2>`.
- Event page: `<h1>{event.title}</h1>`, `<h2>` sub-sections where warranted.

### 7.3 Internal linking

- Home featured event card links → `/event/:id`.
- Home upcoming-row links → `/event/:id`.
- The internal/external ticket choice lives on the event detail page, not on the home list.

### 7.4 Image treatment

- Alt text: descriptive, derived. Featured: `{title} event artwork — {date_short} at {location}`.
- Featured event artwork: `fetchpriority="high"`, `loading="eager"` — likely LCP element.
- Upcoming thumbnails: `loading="lazy"`.
- If Supabase Storage image transforms are available, pass `?width=1200&quality=80` for the featured artwork and `?width=112&quality=80` for thumbnails.

### 7.5 Font loading

- Move all `@font-face` declarations from scoped component CSS to `src/styles.css` (global).
- Add `<link rel="preload" as="font" type="font/otf" crossorigin>` in `index.html` for Matter-Heavy and Matter-SemiBold (the two above-the-fold fonts).

### 7.6 Static assets to add

- `public/og-default.jpg` — 1200×630, homepage OG fallback. One-time design task, outside this SEO work.
- `public/apple-touch-icon.png` — 180×180 (optional iOS polish).

---

## 8. Performance & Core Web Vitals

### 8.1 Edge middleware budget

- Cold start: ~50 ms (Vercel Edge = V8 isolates).
- Cached: < 10 ms added latency.
- Cache miss: ~150–250 ms (Supabase round-trip from EU edge region).
- `stale-while-revalidate` means real traffic rarely waits for cache miss.

### 8.2 Supabase query hygiene

Confirm during implementation that an index covers `events(is_draft, is_archived, event_date)`. The existing client query and the new Edge queries both filter/sort by these. Add the index if missing.

### 8.3 Core Web Vitals targets

| Metric | Target | Mitigation |
|--------|--------|------------|
| LCP | < 2.5 s | `fetchpriority="high"` on hero, font preload, Supabase image transforms |
| CLS | < 0.1 | `aspect-ratio: 16/9` already set on hero; verify no jump on data load |
| INP | < 200 ms | No heavy JS present |

### 8.4 Monitoring

- **Vercel Analytics** (Web Vitals) — enable at deploy.
- **Google Search Console** — index coverage, queries, CTR.
- **Bing Webmaster Tools** — catches Bing-specific issues Google misses.

---

## 9. Post-deploy runbook

Executed once after first production deploy; validation steps repeated after any middleware change.

1. Deploy to production (`main` branch pushed → Vercel auto-deploys).
2. `curl -A "Googlebot" https://eclipseboundaries.ch/` — verify response HTML contains real `<title>`, meta description, OG tags, JSON-LD.
3. `curl -A "Googlebot" https://eclipseboundaries.ch/event/{known-id}` — same verification for event page.
4. `curl https://eclipseboundaries.ch/sitemap.xml` — validate XML, correct URLs, image entries.
5. `curl https://eclipseboundaries.ch/robots.txt` — verify disallow rules and sitemap pointer.
6. **Google Rich Results Test** (https://search.google.com/test/rich-results) — event URL must validate `Event` schema with zero errors.
7. **Schema Markup Validator** (https://validator.schema.org) — second-opinion validation.
8. **OpenGraph.xyz** or **metatags.io** — preview WhatsApp / Slack / Twitter rendering.
9. **Facebook Sharing Debugger** (https://developers.facebook.com/tools/debug/) — force OG cache refresh if needed.
10. **Twitter Card Validator** (https://cards-dev.twitter.com/validator).
11. **PageSpeed Insights** (https://pagespeed.web.dev) — confirm "Good" Core Web Vitals for `/` and one event page on both mobile and desktop.
12. Submit `sitemap.xml` in Google Search Console.
13. Submit `sitemap.xml` in Bing Webmaster Tools.
14. Verify domain ownership in both (DNS TXT or HTML file).
15. Request indexing in Search Console for `/` and 1–2 key event URLs to kickstart discovery.

---

## 10. Rollback plan

- Middleware is additive. If it fails, the static `index.html` is served unchanged and the SPA keeps working — worst case equals today's behavior.
- `vercel rollback` reverts to the previous deployment in seconds.

---

## 11. Future-proofing

Design reserves space for future additions without rework:

- `/about`, `/press` — static pages; will need their own `Organization` / `WebPage` JSON-LD and sitemap entries.
- `/archive` — past-shows archive. Will reintroduce past events (> 6 months) into sitemap with `priority=0.4`.
- Optional `description`, `slug`, `end_date` columns on `events` table — middleware will automatically prefer them when present. Slug addition would change canonical URL format to `/event/:slug`; middleware must handle both old UUID URLs (301 redirect to slug) and new slug URLs.

Out of scope for this spec but explicitly planned around.

---

## 12. Open operational dependencies

Not blocking the design, but must happen before or during implementation:

- Confirm `eclipseboundaries.ch` domain is connected in Vercel.
- One-time design of `og-default.jpg` (1200×630).
- Decide on analytics: Vercel Analytics (simple) vs. Plausible / Umami (self-hosted). Not in scope here but affects `<script>` tags added to `index.html`.
