# Advertisement AI

E-commerce advertisement platform inspired by [Google Pomelli](https://labs.google.com/pomelli/about/). Define your **Business DNA**, manage a product **Catalog**, and generate AI-powered **Photoshoots** and **Campaigns** for Instagram, Google, Facebook, and AI agentic search.

## Features

### Multi-Brand Architecture

- **Brands** — Manage multiple brands from `/brands` or the sidebar switcher
- Each brand has its own **Business DNA** and **Product catalog**
- Products include: name, category, description, raw photo

### Generation System

**Platform Post Types** (20 formats):
`instagram_post`, `instagram_carousel`, `instagram_story`, `instagram_reel`, `facebook_post`, `facebook_story`, `pinterest_pin`, `linkedin_post`, `linkedin_banner`, `twitter_post`, `youtube_thumbnail`, `youtube_short`, `website_product`, `website_banner`, `amazon_listing`, `shopify_product`, `catalog_print`, `billboard_ad`, `email_marketing`, `mobile_app_banner`

**Image Views** (20 camera angles):
Front Hero, Profile, Top/Bottom, 45°, Macro details, Flat Lay, Floating, etc.

**Scenes** (30 environments):
Studio, lifestyle, fashion, and technical scenes with lighting, mood, and props metadata.

### Business DNA (per brand)
- **Overview** — Brand name, logo, fonts, colors, tagline, values, aesthetics, tone, business overview
- **Business Details** — Location, phone, hours, keywords, CTAs, social links, testimonials
- **Catalog** — Add products from URL or scratch (raw photo, name, description)
- **Assets** — Brand asset library with upload and photoshoot CTA

### Generation Tools
- **Photoshoot** — Select up to 4 templates (Studio, Lifestyle, Fashion, Beauty, Amazon, etc.) filtered by platform
- **Campaigns** — Platform-specific templates for Instagram, Google, Facebook, and AI search

### Documentation
Deep-dive viral strategy guides in `docs/` and browsable at `/docs`:
- Brand showcase × 4 platforms
- Product showcase × 4 platforms
- Architecture and AI integration guides

## Cursor API Integration

The app uses the [Cursor SDK](https://cursor.com/docs/sdk/typescript) for AI-powered chat and asset generation. The API key stays **server-side only**.

### Setup

1. Get a key at [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations)
2. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

3. Set your key:

```env
CURSOR_API_KEY=cursor_your_key_here
```

4. Restart the dev server:

```bash
npm run dev
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cursor/status` | GET | Verify API key is configured and valid |
| `/api/agent/chat` | POST | Streaming brand agent chat (SSE) |
| `/api/generate/assets` | POST | Generate photoshoot/campaign creative briefs |

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to Business DNA Overview.

## Project Structure

```
advertisement_ai/
├── docs/                          # Platform strategy documentation
│   ├── brand-showcase/            # Instagram, Google, AI Search, Facebook
│   ├── product-showcase/
│   └── architecture/
├── src/
│   ├── app/                       # Next.js App Router
│   ├── components/                # UI components
│   ├── lib/                       # Store, templates, utils
│   └── types/                     # TypeScript interfaces
└── README.md
```

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **Zustand** (persisted client state)
- **Lucide React** (icons)
- **@cursor/sdk** (AI agent — server-side only)

## Workflow

1. Complete **Business DNA → Overview** (brand + business details)
2. Add products in **Catalog**
3. Run **Photoshoot** or **Campaign** from catalog card or sidebar
4. Select templates by platform (Instagram, Google, Facebook, AI Search)
5. Read platform guides in **Documentation** for viral best practices

## Next Steps (AI Integration)

See `docs/architecture/ai-integration.md` for connecting:
- Gemini Imagen / OpenAI for image generation
- LLM for ad copy and schema export
- URL scraper for catalog import
- Meta + Google feed export

## License

Private — swapkodgire/advertisement_ai
