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

The app uses Vue Router with three routes: home (`/`), ticket shop (`/event/:eventId/tickets`), and ticket success (`/event/:eventId/tickets/success`).

- **Entry**: `src/main.ts` → mounts `App.vue` (router shell with gradient background) to `#app`
- **Router**: `src/router/index.ts` — Vue Router with history mode
- **Views**: `src/views/HomeView.vue` (links, events, radios, socials), `TicketShopView.vue` (ticket purchase), `TicketSuccessView.vue` (post-payment)
- **Content**: `public/data/links.json` — array of `{ title, link }` objects
- **Events**: fetched from Supabase `events` table — the soonest non-draft, non-archived event with `event_date >= now` is shown in `EventCard`
- **Ticket Sales**: `EventCard` routes to the internal ticket shop when `ticket_link` is null; otherwise links externally
- **Supabase client**: `src/supabase.ts` — initialized from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- **Supabase Edge Functions**: `supabase/functions/` — server-side ticket logic (see below)
- **Social links**: defined directly in `HomeView.vue` template (`social-section`)
- **Fonts**: custom Matter font family in `public/fonts/` (Heavy, SemiBold, Bold, Regular .otf files)
- **Styles**: scoped CSS in components + global reset in `src/styles.css`. No CSS framework.
- **SPA routing**: `vercel.json` rewrites all paths to `index.html` for client-side routing

## Supabase Edge Functions

Located in `supabase/functions/`. Deployed separately via `supabase functions deploy`.

- **`get-ticket-phases`**: Returns available ticket phases for an event (filters by active status and sale window, enriches with sold count and remaining availability)
- **`create-checkout`**: Validates ticket selection, creates a pending order + ticket records in the database, creates a Stripe Checkout Session, returns the checkout URL
- **`stripe-webhook`**: Handles Stripe webhook events (`checkout.session.completed`, `checkout.session.expired`, `charge.refunded`). Updates order status and ticket records accordingly.

Edge functions use the service role key (auto-available as `SUPABASE_SERVICE_ROLE_KEY`). Stripe keys are stored in the `mandators` table and looked up per-event.

Required Supabase secrets (set via `supabase secrets set`):
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically
- Stripe keys are read from the `mandators` table (no additional secrets needed)

## Database Tables (ticket sales)

- **`ticket_phases`**: Pricing tiers per event (name, price_cents, currency, quantity, sale window, sort_order, is_active)
- **`ticket_orders`**: Purchase transactions (buyer info, status, Stripe session/payment IDs, totals)
- **`tickets`**: Individual tickets per order (qr_token for door scanning, status, check-in tracking)
- **`mandators`**: Extended with `stripe_secret_key` and `stripe_webhook_secret`

## Key Conventions

- Vue 3 Composition API with `<script setup lang="ts">`
- Path alias: `@` → `src/` (configured in both vite.config.ts and tsconfig.app.json)
- All external links use `target="_blank"` with `rel="noopener noreferrer"`
- Build output goes to `dist/`
- Deployed to Vercel via GitHub Actions on push to `main`
- Node.js `^20.19.0` or `>=22.12.0` required
- Yarn as package manager
- Supabase env vars required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`)
