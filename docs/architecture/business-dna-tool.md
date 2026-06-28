# Business DNA Tool — Architecture

## Overview

The Advertisement AI platform is inspired by [Google Pomelli](https://labs.google.com/pomelli/about/) — an experimental tool that helps small businesses define their brand identity and generate marketing assets with AI.

Our implementation provides the same core workflow:

```
Business DNA → Catalog → Photoshoot / Campaigns → Platform Export
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App (Frontend)                   │
├──────────────┬──────────────────────────────┬───────────────┤
│  Business DNA│         Catalog              │  Generation   │
│  ├ Overview  │  ├ Add from URL              │  ├ Photoshoot │
│  ├ Catalog   │  ├ Add from Scratch          │  └ Campaigns  │
│  └ Assets    │  └ Product Cards             │               │
├──────────────┴──────────────────────────────┴───────────────┤
│              Zustand Store (localStorage persist)            │
├─────────────────────────────────────────────────────────────┤
│              AI Services (future integration)              │
│  ├ Image Gen (Gemini Imagen / DALL·E / SD)                  │
│  ├ URL Scraper (product import)                              │
│  ├ Copy Gen (LLM for ad copy, schema)                       │
│  └ Agent Chat (brand setup assistant)                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### BusinessDNA

```typescript
interface BusinessDNA {
  brandOverview: {
    businessName, tagline, logoUrl, fontFamily,
    colors[], brandValues[], brandAesthetics[],
    brandTone[], businessOverview
  };
  businessDetails: {
    location, phone, businessHours, keywords[],
    ctaLinks[], socialLinks{}, testimonials[]
  };
}
```

### CatalogItem

```typescript
interface CatalogItem {
  id, name, description, rawPhotoUrl,
  source: "url" | "scratch",
  sourceUrl?, createdAt,
  generatedImages[]
}
```

## Route Structure

| Route | Purpose |
|-------|---------|
| `/business-dna/overview` | Brand Overview + Business Details tabs |
| `/business-dna/catalog` | Product catalog management |
| `/business-dna/assets` | Brand asset library |
| `/photoshoot?product={id}` | Template selection for product images |
| `/campaigns?product={id}` | Campaign template selection |
| `/docs` | Platform viral strategy documentation |

## UI Design System

Inspired by Pomelli dark theme:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a0a0a` | Page background |
| `--card` | `#1a1a1a` | Cards, panels |
| `--accent` | `#c5d17e` | Active nav, CTAs |
| `--border` | `#2a2a2a` | Dividers, inputs |
| `--muted` | `#888888` | Secondary text |

Typography:
- **UI:** Geist Sans
- **Section headings:** Playfair Display (italic) — matches Pomelli serif headers

## Template System

### Photoshoot Templates

Organized by category (General, Consumables, Fashion, Beauty, Home, Amazon/E-commerce).

Each template specifies:
- Supported platforms
- Aspect ratio
- Visual description for AI prompt generation

### Campaign Templates

Organized by platform (Instagram, Google, Facebook, AI Search, Multi-Platform).

Each template specifies:
- Output format
- Platform targeting
- Asset requirements

## State Management

**Zustand** with `persist` middleware stores Business DNA and Catalog in `localStorage`.

Production should migrate to:
- PostgreSQL / Supabase for persistent multi-device storage
- S3 / Cloudinary for image assets
- Redis for generation job queues

## Recommended Backend Services (Phase 2)

| Service | Purpose |
|---------|---------|
| **Product Scraper API** | Extract name, images, description from URL |
| **Image Generation API** | Gemini Imagen 3, OpenAI gpt-image, Stability AI |
| **LLM API** | Ad copy, brand summary, FAQ schema generation |
| **Export API** | Meta Catalog, Google Merchant Center feed generation |

## Security Considerations

- Never store API keys client-side
- Validate and sanitize URL imports (SSRF prevention)
- Rate-limit generation endpoints
- User authentication before cloud persistence

## File Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── layout/             # Sidebar, cards, buttons
│   ├── business-dna/       # Overview, Catalog pages
│   ├── templates/          # Photoshoot/Campaign selector
│   └── agent/              # AI assistant panel
├── lib/
│   ├── store.ts            # Zustand state
│   ├── templates.ts        # Template definitions
│   └── utils.ts
├── types/
│   └── index.ts            # TypeScript interfaces
docs/                       # Markdown documentation
```

## Pomelli Feature Parity Matrix

| Pomelli Feature | Our Status |
|-----------------|------------|
| Business DNA Overview | ✅ Implemented |
| Brand colors/fonts/logo | ✅ Implemented |
| Business Details | ✅ Implemented |
| Catalog (URL + scratch) | ✅ Implemented (URL scrape simulated) |
| Assets library | ✅ UI scaffold |
| Photoshoot templates | ✅ Implemented |
| Campaign templates | ✅ Implemented |
| AI Agent panel | ✅ UI scaffold |
| Brand Book | 🔲 Placeholder route |
| Websites | 🔲 Placeholder route |
| Live AI generation | 🔲 Requires API integration |
