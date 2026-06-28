# Product Showcase — AI Agentic Search (ChatGPT, Claude, Gemini)

## Goal

Ensure your products are **recommended, compared, and linked** when users ask AI assistants shopping questions like *"best vegan leather pouch under $50"* or *"alternatives to [competitor product]"*.

## How AI Recommends Products

AI agents evaluate products using:

1. **Structured product feeds** (Merchant Center, OpenAI Commerce, partner APIs)
2. **Web content** with Product schema and clear specs
3. **Review consensus** across G2, Amazon, Reddit, YouTube
4. **Price/availability accuracy** at query time
5. **Brand entity strength** (see Brand Showcase — AI Search doc)

## Best Approach for Product Visibility

### 1. Machine-Readable Product Cards

Each catalog item should export:

```json
{
  "@type": "Product",
  "name": "Nordic Monk Cosmetic Pouch",
  "description": "Premium vegan leather pouch, 8x5 inches, water-resistant lining...",
  "brand": { "@type": "Brand", "name": "Nordic Monk" },
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "image": ["studio.jpg", "lifestyle.jpg"],
  "aggregateRating": { "ratingValue": "4.8", "reviewCount": "127" }
}
```

Generate via **AI Search Product Card** campaign template in the tool.

### 2. Description Writing for AI Extraction

Product descriptions in Catalog should follow:

**Paragraph 1:** What it is + primary use case (1–2 sentences)
**Paragraph 2:** Key specs (materials, dimensions, compatibility)
**Paragraph 3:** Who it's for + comparison positioning
**Bullets:** 5 feature/benefit pairs

**Avoid:** Superlatives without proof ("best ever")
**Include:** Comparable alternatives, price tier, shipping/returns

### 3. FAQ Schema Per Product

Add 5–10 Q&As AI users commonly ask:

- "Is [Product] waterproof?"
- "How does [Product] compare to [Competitor]?"
- "What's included in the box?"
- "Is [Product] worth it at $X?"

Use **AI FAQ Schema Pack** template — one pack per hero SKU.

### 4. Multi-Platform Feed Sync

| Platform | Feed Source |
|----------|-------------|
| Google Gemini | Google Merchant Center |
| ChatGPT | OpenAI Commerce / partner integrations |
| Claude | Web retrieval + structured site data |
| Perplexity | Indexed pages + shopping partners |

**Minimum:** Website Product schema + Google Merchant Center
**Ideal:** All feeds synced from Catalog with identical titles/descriptions/prices

### 5. Comparison Content Strategy

Publish (on site or blog):
- "[Your Product] vs [Competitor A] vs [Competitor B]" — factual tables
- "Best [category] for [use case]" — include your product with honest pros/cons
- Buying guides with criteria AI can cite

AI strongly favors **structured comparisons** over marketing pages.

### 6. Social Proof for AI Confidence

AI weighs review signals:
- **Amazon/eBay ratings** (if sold there)
- **Trustpilot / Google reviews** mentioning product name
- **Reddit threads** with authentic user experiences
- **YouTube reviews** with product name in title

Add testimonials in Business Details; map to product pages.

### 7. Image Requirements for AI Shopping UI

When AI displays product cards:
- **Square hero image** (1:1, min 800px) — Studio or White BG
- **Lifestyle secondary** — context for "who is this for"
- Alt text: `[Brand] [Product Name] - [color] - [key feature]`

Generate via Photoshoot: **Studio Shot** + **Ingredient/Lifestyle** or category-specific template.

### 8. Query Coverage Audit

Monthly, test these query patterns in ChatGPT, Claude, Gemini:

- "Best [your category] products"
- "[Your product type] under $[price]"
- "[Competitor product] alternative"
- "Is [Your Brand] [Product] good?"
- "[Product] reviews"

Document which queries surface your product. Fill content gaps.

## Metrics (Emerging)

- Referral traffic from AI domains
- Product page views with `utm_source=chatgpt`
- Inclusion rate in manual query audits
- Feed health score in Merchant Center

## Integration with Advertisement AI Tool

1. **Catalog → Add from scratch** with detailed description
2. **Photoshoot:** Studio + lifestyle templates
3. **Campaign:** AI Product Card + AI FAQ Schema Pack
4. Sync Business DNA brand name exactly in product `brand` field
5. Export JSON-LD for website deployment

## Common Mistakes

- Thin product descriptions (<100 words)
- Missing price/availability in structured data
- No reviews or social proof
- Different product names in feed vs. website
- Stock images without brand context
- Not updating AI feeds when price/stock changes

## Future: Agentic Checkout

Prepare for AI agents completing purchases on behalf of users:
- Real-time inventory API
- Standardized product identifiers (GTIN, SKU)
- Return policy and shipping clearly structured
- Business DNA CTA links as fallback purchase paths
