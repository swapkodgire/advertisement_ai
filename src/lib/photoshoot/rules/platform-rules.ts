/** Platform-specific rules (PRL001–PRL053) */
export const PLATFORM_RULES: Record<string, string[]> = {
  instagram_post: [
    "Use square composition optimized for instagram feed",
    "Ensure product remains clearly visible in the center",
    "Leave space for potential text overlays",
  ],
  instagram_carousel: [
    "Maintain consistent visual style across carousel slides",
    "Highlight unique product details per slide",
  ],
  instagram_story: [
    "Use vertical composition optimized for mobile story format",
    "Keep important product details within safe area away from UI overlays",
  ],
  instagram_reel: [
    "Vertical composition for reel cover thumbnail",
    "Ensure product readable at small thumbnail size",
  ],
  facebook_post: [
    "Square composition optimized for facebook feed",
    "Avoid clutter to maintain engagement",
  ],
  facebook_story: [
    "Vertical full-screen story layout",
    "Keep product in safe area",
  ],
  pinterest_pin: [
    "Tall vertical composition for scrolling discovery",
    "Place product slightly above center",
  ],
  linkedin_post: [
    "Professional clean composition",
    "Avoid informal or casual styling",
  ],
  linkedin_banner: [
    "Wide horizontal banner layout",
    "Account for profile picture overlay areas",
  ],
  twitter_post: [
    "Horizontal feed display optimization",
    "Ensure visibility at small preview sizes",
  ],
  youtube_thumbnail: [
    "Bold high-contrast centered composition",
    "Clear even at small thumbnail sizes",
  ],
  youtube_short: [
    "Vertical composition with safe zones",
  ],
  website_product: [
    "Clean minimal composition with balanced margins",
    "Avoid distracting lifestyle backgrounds",
    "Product clearly visible against background",
  ],
  website_banner: [
    "Wide cinematic composition",
    "Product placed centrally to prevent cropping",
  ],
  amazon_listing: [
    "Clean white or minimal background suitable for ecommerce",
    "Product occupies majority of frame",
    "No unnecessary props or decorative elements",
  ],
  shopify_product: [
    "Balanced product photography",
    "Product clearly visible against background",
  ],
  catalog_print: [
    "High resolution and sharpness for print",
  ],
  billboard_ad: [
    "Bold simplified composition recognizable from distance",
  ],
  email_marketing: [
    "Balanced layout visible after email client cropping",
  ],
  mobile_app_banner: [
    "Vertical mobile-first layout",
    "Account for mobile UI elements",
  ],
};

export function getPlatformRulesText(platformId: string): string {
  const rules = PLATFORM_RULES[platformId] ?? [
    "Center the product in frame",
    "Professional commercial photography quality",
  ];
  return rules.map((r) => `- ${r}`).join("\n");
}
