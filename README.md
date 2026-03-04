<p align="center">
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/License-Private-lightgrey?style=flat-square" alt="Private" />
</p>

<h1 align="center">🌿 Syvora Link in Bio 🌿</h1>

<p align="center">
  A sleek, animated link-in-bio landing page built for <strong>ECLIPSE BOUNDARIES</strong> &mdash; a music collective sharing mixes, radio episodes, and releases from a single beautiful page.
</p>

## 🌱 What is this?

**Syvora Link in Bio** is a lightweight, single-page application that serves as a central hub for all of a creator's important links. Think of it as a modern alternative to Linktree &mdash; fully self-hosted, blazing fast, and completely customizable.

The current deployment powers **ECLIPSE BOUNDARIES**, a music collective, connecting their audience to:

- SoundCloud mixes and radio episodes
- EP and playlist releases
- Social profiles across YouTube, Instagram, and TikTok
- Upcoming events with cover art, details, and ticket links

## 🌊 How It Works

```
        +------------------+       +----------------------+
        |   links.json     |       |  Supabase (events)   |
        +--------+---------+       +----------+-----------+
                 |                            |
                 v                            v
        +------------------+       +------------------+
        |     App.vue      |       |  EventCard.vue   |
        |                  +------>|                  |
        +--------+---------+       +--------+---------+
                 |                          |
                 v                          v
   +-------------+-------------+   +-------+-------+
   |                           |   | Event Card    |
   +------+------+   +--------+    | (conditional) |
   | Links List  |   | Social |    +---------------+
   | (dynamic)   |   | Links  |
   +-------------+   +--------+
```

### 🌳 Architecture

The app is intentionally minimal:

- **No routing** &mdash; it's a single page, so no Vue Router needed
- **No backend** &mdash; builds to pure static HTML/CSS/JS, deployable anywhere
- **Links** &mdash; stored in a static JSON file (`public/data/links.json`)
- **Events** &mdash; fetched live from a Supabase database (`events` table)

### 💧 Data Flow

1. The Vue app mounts and fetches `links.json`
2. The `EventCard` component queries Supabase for the soonest upcoming event (`is_draft=false`, `is_archived=false`, `event_date >= now`) &mdash; if found, it renders a card with cover image, title, location, date, and ticket link; otherwise it stays hidden
3. Links are rendered dynamically via `v-for` as styled button cards
4. Social media links are rendered as a separate section below
5. All external links open in a new tab with `rel="noopener noreferrer"`

## 🌸 Features

- **Event card** &mdash; optional, auto-hidden card showcasing an upcoming event with cover image, details, and ticket button
- **Animated gradient background** &mdash; smooth 12-second looping gradient from white to sky blue
- **Custom typography** &mdash; Matter font family (Heavy, SemiBold) for a distinctive brand feel
- **Hover interactions** &mdash; subtle shadow and color transitions on all interactive elements
- **Fully responsive** &mdash; optimized layout for mobile devices (breakpoint at 600px)
- **Fast builds** &mdash; Vite 7 for sub-second HMR and optimized production bundles
- **Type-safe** &mdash; full TypeScript support with `vue-tsc` type checking

## 🌿 Quick Start

### 🌾 Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- Yarn

### 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

| Variable               | Description                        |
|------------------------|------------------------------------|
| `VITE_SUPABASE_URL`    | Your Supabase project URL          |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key  |

For Vercel deployments, add these as environment variables in the project settings.

### 🌱 Development

```bash
# Install dependencies
yarn

# Start dev server with hot reload
yarn start
```

### 🌲 Production

```bash
# Type-check and build for production
yarn build

# Preview the production build locally
yarn preview
```

The production build outputs to `dist/` &mdash; a self-contained static site ready for deployment.

## 🍃 Customization

### 🔗 Updating Links

Edit `public/data/links.json` to add, remove, or reorder links:

```json
[
  {
    "title": "Your Link Title",
    "link": "https://example.com"
  }
]
```

### 🎤 Updating Events

Events are managed in the **syvora-erp** Supabase database. The `EventCard` automatically displays the soonest upcoming event where `is_draft = false` and `is_archived = false`. To hide the card, either archive the event or set it as a draft in the ERP system.

### 🌐 Updating Social Links

Social media links are defined directly in `src/App.vue` within the `social-section` template block.

### 🎨 Theming

The visual identity is controlled through CSS in `src/App.vue`:

| Element             | Property                     | Default                       |
|---------------------|------------------------------|-------------------------------|
| Background gradient | `linear-gradient` colors     | `white` to `#73c3fe`         |
| Animation speed     | `animation` duration         | `12s`                         |
| Title font          | `font-family`                | `Matter-Heavy`                |
| Button font         | `font-family`                | `Matter-SemiBold`             |
| Button background   | `background`                 | `rgba(255, 255, 255, 0.95)`  |
| Button shadow       | `box-shadow` color           | `rgba(115, 195, 254, 0.2)`   |

## 🌍 Deployment

This is a static site &mdash; deploy it anywhere:

| Platform         | Command / Notes                                      |
|------------------|------------------------------------------------------|
| **Vercel**       | Connect repo, framework preset: Vite                 |
| **Netlify**      | Build command: `yarn build`, publish dir: `dist`     |
| **GitHub Pages** | Deploy the `dist/` folder                            |
| **Cloudflare**   | Build command: `yarn build`, output dir: `dist`      |

## 🌻 Tech Stack

| Layer       | Technology                |
|-------------|---------------------------|
| Framework   | Vue 3 (Composition API)   |
| Language    | TypeScript 5.9            |
| Build Tool  | Vite 7                    |
| Fonts       | Matter (Heavy, SemiBold)  |
| Styling     | Scoped CSS with animations|
| Links data  | Static JSON               |
| Events data | Supabase                  |

## 🌾 Project Structure

```
syvora-linkinbio/
├── public/
│   ├── data/
│   │   └── links.json        # Link content (title + URL pairs)
│   └── fonts/                # Custom Matter font files (.otf)
├── src/
│   ├── App.vue               # Main layout component
│   ├── components/
│   │   └── EventCard.vue     # Event card component (fetches from Supabase, auto-hides when no event)
│   ├── supabase.ts           # Supabase client (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
│   ├── main.ts               # Vue app entry point
│   └── styles.css            # Global reset styles
├── .env.example              # Required environment variables template
├── index.html                # HTML shell
├── vite.config.ts            # Vite + Vue plugin config
├── tsconfig.json             # TypeScript project references
└── package.json              # Dependencies and scripts
```

---

<p align="center">
  🌎 Built by <strong>Syvora</strong> 🌎
</p>
