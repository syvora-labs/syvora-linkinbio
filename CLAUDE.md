# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page link-in-bio Vue 3 application for the ECLIPSE BOUNDARIES music collective. It renders dynamic links from a static JSON file with an animated gradient UI. The current event card is fetched live from a Supabase database. There is no routing and no state management — intentionally minimal.

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

The entire app is a single Vue component (`src/App.vue`) that fetches `/data/links.json` on mount and renders styled link buttons. Social links are hardcoded in the template. The `EventCard` component fetches the current event from Supabase.

- **Content**: `public/data/links.json` — array of `{ title, link }` objects
- **Events**: fetched from Supabase `events` table — the soonest non-draft, non-archived event with `event_date >= now` is shown in `EventCard`
- **Supabase client**: `src/supabase.ts` — initialized from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- **Social links**: defined directly in `src/App.vue` template (`social-section`)
- **Fonts**: custom Matter font family in `public/fonts/` (Heavy, SemiBold, Bold, Regular .otf files)
- **Styles**: scoped CSS in `App.vue` + global reset in `src/styles.css`. No CSS framework.
- **Entry**: `src/main.ts` → mounts `App.vue` to `#app`

## Key Conventions

- Vue 3 Composition API with `<script setup lang="ts">`
- Path alias: `@` → `src/` (configured in both vite.config.ts and tsconfig.app.json)
- All external links use `target="_blank"` with `rel="noopener noreferrer"`
- Build output goes to `dist/`
- Deployed to Vercel via GitHub Actions on push to `main`
- Node.js `^20.19.0` or `>=22.12.0` required
- Yarn as package manager
- Supabase env vars required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`)
