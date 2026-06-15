# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A link-in-bio Vue 3 application for the ECLIPSE BOUNDARIES music collective. It renders dynamic links from a static JSON file with an animated gradient UI. The current event card is fetched live from a Supabase database. Ticket sales are handled via an integrated ticket shop with Stripe Checkout, powered by Supabase Edge Functions.

## Commands

```bash
yarn start        # Dev server with HMR
yarn build        # Type-check + production build (parallel)
yarn build-only   # Vite build without type checking
yarn type-check   # vue-tsc --build
yarn preview      # Preview production build locally
```

No test runner or linter is configured.

## Architecture

The app uses Vue Router. Key routes: home (`/`), ticket shop (`/event/:eventId/tickets`), ticket success (`/event/:eventId/tickets/success`), and the merch shop (`/shop`, `/shop/product/:slug`, `/shop/cart`, `/shop/success`, `/shop/order/:orderId`).

- **Entry**: `src/main.ts` → mounts `App.vue` (router shell with gradient background) to `#app`
- **Router**: `src/router/index.ts` — Vue Router with history mode
- **Views**: `src/views/HomeView.vue` (links, events, radios, socials), `TicketShopView.vue` (ticket purchase), `TicketSuccessView.vue` (post-payment)
- **Content**: `public/data/links.json` — array of `{ title, link }` objects
- **Events**: fetched from Supabase `events` table — the soonest non-draft, non-archived event with `event_date >= now` is shown in `EventCard`
- **Ticket Sales**: `EventCard` routes to the internal ticket shop when `ticket_link` is null; otherwise links externally
- **Supabase client**: `src/supabase.ts` — initialized from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- **Supabase Edge Functions**: `supabase/functions/` — server-side ticket logic (see below)
- **Merch shop**: public-facing shop on top of the Syvora ERP catalogue. Views `ShopView.vue` (catalogue), `ProductDetailView.vue`, `CartView.vue`, `ShopSuccessView.vue`. Shared logic in `src/lib/shop/` (config, types, price formatting, signed-image resolution) and a localStorage-backed cart in `src/composables/useCart.ts`. Every catalogue query must filter by `VITE_MANDATOR_ID`. Product images are resolved to short-lived signed URLs via the ERP-owned `webshop-public-images` edge function (not in this repo).
- **About Us**: `AboutView.vue` (`/about`) — lists publicly-visible team members (picture, name, roles, description) from the ERP-owned `team_members` table, filtered by `VITE_MANDATOR_ID` + `is_publicly_visible`
- **Social links**: defined directly in `HomeView.vue` template (`social-section`)
- **Fonts**: custom Matter font family in `public/fonts/` (Heavy, SemiBold, Bold, Regular .otf files)
- **Styles**: scoped CSS in components + global reset in `src/styles.css`. No CSS framework.
- **SPA routing**: `vercel.json` rewrites all paths to `index.html` for client-side routing

## Supabase Edge Functions

Located in `supabase/functions/`. Deployed separately via `supabase functions deploy`.

- **`get-ticket-phases`**: Returns available ticket phases for an event (filters by active status and sale window, enriches with sold count and remaining availability)
- **`create-checkout`**: Validates ticket selection, creates a pending order + ticket records in the database, creates a Stripe Checkout Session, returns the checkout URL
- **`stripe-webhook`**: Handles Stripe webhook events (`checkout.session.completed`, `checkout.session.expired`, `charge.refunded`). Updates order status and ticket records accordingly.
- **`webshop-create-checkout`**: Merch-shop counterpart to `create-checkout`. Re-validates cart prices/stock/publish state server-side (scoped by mandator), creates a `pending` `product_orders` row, and mints a Stripe Checkout Session (cart round-tripped in metadata).
- **`webshop-stripe-webhook`**: On `checkout.session.completed`, idempotently decrements stock via the `webshop_decrement_stock_for_order` RPC, inserts `product_order_items` (with snapshots), and marks the order `paid`. Refunds automatically on stock contention. Verifies signatures with its own `WEBSHOP_STRIPE_WEBHOOK_SECRET` (a separate Stripe endpoint from the ticket webhook, so a distinct signing secret); the Stripe API key is still read from `mandators.stripe_secret_key`.
- **`webshop-order-status`**: Returns minimal order status (+ order id) by Stripe session id for the shop success page to poll.
- **`webshop-order-details`**: Returns full buyer-safe order details (id, email, total, line items with signed thumbnails, tracking number) by order id, for the order-details page (`/shop/order/:orderId`).

Edge functions use the service role key (auto-available as `SUPABASE_SERVICE_ROLE_KEY`). Stripe keys are stored in the `mandators` table and looked up per-event.

Required Supabase secrets (set via `supabase secrets set`):
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically
- Stripe keys are read from the `mandators` table (no additional secrets needed)

## Database Tables (ticket sales)

- **`ticket_phases`**: Pricing tiers per event (name, price_cents, currency, quantity, sale window, sort_order, is_active)
- **`ticket_orders`**: Purchase transactions (buyer info, status, Stripe session/payment IDs, totals)
- **`tickets`**: Individual tickets per order (qr_token for door scanning, status, check-in tracking)
- **`mandators`**: Extended with `stripe_secret_key` and `stripe_webhook_secret`

## Database Tables (merch shop)

Owned by the Syvora ERP (schema lives there); the public shop reads/writes a subset:

- **`product_categories`** / **`products`** / **`product_variants`** / **`product_images`**: catalogue (read-only via anon key, filtered by `mandator_id` + published/active flags). `product_variants.stock`: `NULL` = unlimited, `0` = sold out, `> 0` = available.
- **`product_orders`** / **`product_order_items`**: written server-side (service role) by the webshop edge functions. The public shop only writes `pending` → `paid` / `refunded`; the ERP admin owns `fulfilled` / `cancelled`.

## Key Conventions

- Vue 3 Composition API with `<script setup lang="ts">`
- Path alias: `@` → `src/` (configured in both vite.config.ts and tsconfig.app.json)
- All external links use `target="_blank"` with `rel="noopener noreferrer"`
- Build output goes to `dist/`
- Deployed to Vercel via GitHub Actions on push to `main`
- Node.js `^20.19.0` or `>=22.12.0` required
- Yarn as package manager
- Supabase env vars required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`)
