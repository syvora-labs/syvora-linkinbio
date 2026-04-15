# SEO Post-Deploy Runbook

Run this the first time after the SEO stack lands in production, and whenever the Edge middleware changes meaningfully.

## Prerequisites

- Production domain `eclipseboundaries.ch` connected in Vercel.
- Environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` set on **Production and Preview** — note the un-prefixed names (the Edge runtime can't read `VITE_*` vars). Use the same values as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `public/og-default.jpg` is a real 1200×630 JPEG (placeholder is acceptable for indexing — only blocks rich link previews on the homepage).

## Checklist

1. **Deploy to production.**
2. **Verify middleware runs:**
   ```bash
   curl -I https://eclipseboundaries.ch/ | grep -i x-seo-middleware
   ```
   Expected: `x-seo-middleware: home`. If absent, the middleware is not running — check Vercel project settings (framework preset must be Vite or "Other"; Next.js preset treats `middleware.ts` differently) and Vercel deploy logs.

3. **Verify homepage HTML as a crawler sees it:**
   ```bash
   curl -sA "Googlebot" https://eclipseboundaries.ch/
   ```
   Must contain:
   - Real `<title>ECLIPSE BOUNDARIES — House Music Label in Lucerne</title>`
   - `<meta name="description">` with the homepage description
   - `<link rel="canonical" href="https://eclipseboundaries.ch/">`
   - All `og:*` and `twitter:*` meta tags
   - One `<script type="application/ld+json">` block containing `"@type":"MusicGroup"` with an `"event":` array of upcoming events

4. **Verify event page HTML.** Pick a known event ID (e.g., `c8a36940-2d66-4438-92ae-d5ec9ce488a9`):
   ```bash
   curl -sA "Googlebot" https://eclipseboundaries.ch/event/<id>
   ```
   Must contain:
   - Event-specific `<title>` matching `{title} — {city}, {date} | ECLIPSE BOUNDARIES`
   - `og:image` pointing at the event's `artwork_url` (or the homepage default if null)
   - One JSON-LD with `"@type":"Event"` (full event schema)
   - One JSON-LD with `"@type":"BreadcrumbList"`
   - Header: `x-seo-middleware: event`

5. **Verify noindex on private routes:**
   ```bash
   curl -I https://eclipseboundaries.ch/event/<id>/tickets | grep -i x-robots-tag
   curl -I https://eclipseboundaries.ch/tickets/order/<id> | grep -i x-robots-tag
   ```
   Both expected: `X-Robots-Tag: noindex, nofollow`.

6. **Sitemap:**
   ```bash
   curl -s https://eclipseboundaries.ch/sitemap.xml
   ```
   Valid XML; homepage entry; one `<url>` per non-draft, non-archived event from the last 6 months and all upcoming; `<image:image>` blocks present for events with `artwork_url`.

7. **Robots:**
   ```bash
   curl -s https://eclipseboundaries.ch/robots.txt
   ```
   Sitemap pointer + disallow rules visible.

8. **Google Rich Results Test** — paste an event URL into <https://search.google.com/test/rich-results>. Expected: `Event` schema detected, **zero errors**.

9. **Schema Markup Validator** — second-opinion check at <https://validator.schema.org>.

10. **Social previews:**
    - <https://www.opengraph.xyz/> — paste homepage + event URL.
    - <https://developers.facebook.com/tools/debug/> — force a fresh scrape for both. (First scrape may show 404 for og-default.jpg until that asset is placed.)
    - <https://cards-dev.twitter.com/validator> — same.

11. **PageSpeed Insights** — <https://pagespeed.web.dev>. Confirm "Good" Core Web Vitals (LCP / CLS / INP) for `/` and one event URL on **mobile**.

12. **Submit sitemap + verify ownership:**
    - **Google Search Console**: add property for `eclipseboundaries.ch`, verify via DNS TXT or HTML file, submit sitemap.
    - **Bing Webmaster Tools**: same.

13. **Request indexing** in Search Console for `/` and 1–2 key event URLs to kickstart discovery (Google will crawl the rest from the sitemap automatically).

## Rollback

If the middleware misbehaves after deploy, `vercel rollback` reverts to the previous deployment in seconds. With the middleware absent, the static shell is served unchanged and the SPA still works — worst-case behavior matches pre-SEO state.

## Confirm an events index exists

To keep Edge fetch latency predictable, confirm (or add) a Supabase index for the most common query shape:

```sql
create index if not exists events_public_upcoming_idx
    on events (event_date)
    where is_draft = false and is_archived = false;
```

Without this, Edge requests slow down as the events table grows. Run once via the Supabase SQL editor.
