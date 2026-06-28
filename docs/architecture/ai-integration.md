# AI Integration Guide

## Overview

This guide describes how to connect AI services to the Advertisement AI platform for live image generation, product import, ad copy, and agent chat.

## Cursor API Integration (Implemented)

The app uses `@cursor/sdk` server-side for:

- **Ad AI Agent chat** — `/api/agent/chat` (SSE streaming)
- **Photoshoot / Campaign briefs** — `/api/generate/assets`
- **Key verification** — `/api/cursor/status`

Configure in `.env.local`:

```env
CURSOR_API_KEY=cursor_your_key_here
```

Get a key at [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations).

The key is never exposed to the browser — all calls go through Next.js API routes.

## Image Generation (Photoshoot)

### Recommended Models

| Provider | Model | Best For |
|----------|-------|----------|
| Google | Imagen 3 via Gemini API | Product lifestyle scenes, brand-consistent |
| OpenAI | gpt-image-1 | Studio shots, compositing |
| Stability AI | SDXL / SD3 | Custom fine-tuned product models |

### Prompt Construction

Combine Business DNA + Catalog item + Template into structured prompts:

```
Generate a {template.name} product photo.

Product: {catalog.name}
Description: {catalog.description}
Brand: {brand.businessName}
Brand colors: {brand.colors.map(c => c.hex).join(', ')}
Brand aesthetic: {brand.brandAesthetics.join(', ')}
Style: {template.description}
Aspect ratio: {template.aspectRatio}
Reference image: {catalog.rawPhotoUrl}

Requirements:
- Product must match reference exactly
- Apply brand color palette to scene/props
- No text overlays unless specified
- Photorealistic, commercial quality
```

### API Route Example (Next.js)

```typescript
// src/app/api/generate/photoshoot/route.ts
export async function POST(req: Request) {
  const { productId, templateId } = await req.json();
  // 1. Load product + brand from DB
  // 2. Build prompt from template
  // 3. Call image API with raw photo as reference
  // 4. Store result in generatedImages[]
  // 5. Return image URL
}
```

### Environment Variables

```env
GEMINI_API_KEY=
OPENAI_API_KEY=
IMAGE_STORAGE_BUCKET=   # S3 or Cloudinary
```

## Product Import (Catalog URL)

### Scraper Pipeline

1. User submits product URL
2. Backend fetches page (with SSRF protection)
3. Extract via:
   - Open Graph tags (`og:title`, `og:image`, `og:description`)
   - Schema.org Product JSON-LD
   - Fallback: LLM extraction from HTML snippet
4. Download primary image to storage
5. Create CatalogItem

### Recommended Tools

- **Cheerio / Playwright** for HTML parsing
- **LLM** (Gemini Flash) for unstructured page extraction
- **Cloudinary** for image hosting and transforms

## Campaign Copy Generation

### LLM Prompt for Ad Copy

```
Brand: {businessName}
Tone: {brandTone.join(', ')}
Product: {product.name}
Platform: {template.platforms}
Format: {template.format}

Generate:
- 5 headline variants (respect char limits)
- 3 primary text variants
- 2 CTA options
- 1 FAQ block (for AI search templates)
```

Use **Google Search Ad Copy**, **AI Brand Summary**, and **Facebook Single Image Ad** templates as output schemas.

## AI Agent Panel

The Pomelli-style agent guides users through Business DNA setup.

### Implementation Options

| Approach | Pros | Cons |
|----------|------|------|
| Gemini / OpenAI chat API | Flexible, conversational | Cost per message |
| Structured wizard | Predictable, no API cost | Less natural |
| Hybrid | Wizard + LLM for suggestions | Best UX |

### Suggested Flow

1. Agent asks for business name → suggests alternatives
2. Agent asks for category → pre-fills aesthetics/tone
3. Agent requests logo URL → extracts colors automatically
4. Agent confirms Business DNA → suggests next step (Catalog)

Connect to `/api/agent/chat` with streaming SSE response.

## Platform Export

### Google Merchant Center

Generate XML/CSV feed from Catalog + generated images:

```csv
id,title,description,link,image_link,brand,price,availability
sku-001,"Nordic Monk Pouch","...",https://...,https://...,Nordic Monk,29.99,in stock
```

### Meta Catalog

Use Meta Commerce API or manual CSV upload with same fields.

### AI Search

Export Product + FAQ JSON-LD files per SKU for website deployment.

## Job Queue Architecture

For batch generation (4 templates × N products):

```
User clicks "Looks Good"
  → Create generation job
  → Queue 4 image tasks
  → WebSocket/SSE progress updates
  → Store results in Assets
```

Recommended: **BullMQ** + Redis, or **Inngest** for serverless.

## Cost Estimation

| Operation | Approx. Cost |
|-----------|-------------|
| 1 photoshoot image (Imagen) | $0.02–0.08 |
| 1 ad copy set (GPT-4o mini) | $0.01 |
| URL scrape + extract | $0.005 |
| 4 templates × 10 products | $0.80–3.20 |

## Implementation Priority

1. **Gemini Imagen** for photoshoot (Google ecosystem alignment)
2. **URL scraper** with OG + JSON-LD extraction
3. **LLM ad copy** for campaign templates
4. **Agent chat** with Business DNA context
5. **Feed export** for Google + Meta

## Testing Checklist

- [ ] Generate image preserves product identity from raw photo
- [ ] Brand colors appear in scene styling
- [ ] URL import handles Shopify, WooCommerce, Amazon product pages
- [ ] Generated copy respects platform character limits
- [ ] JSON-LD validates in Google Rich Results Test
- [ ] Rate limiting prevents API abuse
