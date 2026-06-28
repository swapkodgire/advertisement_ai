import type { PlatformPostTypeId } from "@/types";

export interface PlatformDetails {
  description: string;
  safeArea: string;
  recommendedLayout: string;
  backgroundStyle: "lifestyle" | "minimal" | "studio";
  outputPurpose: string;
  highlights: string[];
}

export const PLATFORM_DETAILS: Record<PlatformPostTypeId, PlatformDetails> = {
  instagram_post: {
    description: "Square feed post optimized for product visibility in the Instagram grid.",
    safeArea: "Center — keep product in middle 80%",
    recommendedLayout: "Centered product",
    backgroundStyle: "lifestyle",
    outputPurpose: "Social media feed",
    highlights: ["1:1 square crop", "Space for caption overlay", "Grid thumbnail clarity"],
  },
  instagram_carousel: {
    description: "Multi-slide carousel — consistent style across slides, one angle per slide.",
    safeArea: "Center on each slide",
    recommendedLayout: "Centered product per slide",
    backgroundStyle: "lifestyle",
    outputPurpose: "Social media carousel",
    highlights: ["4 images per carousel set", "Consistent lighting across slides", "Detail close-ups supported"],
  },
  instagram_story: {
    description: "Full-screen vertical story — mobile-first, thumb-zone aware.",
    safeArea: "Center-top — avoid top/bottom UI chrome",
    recommendedLayout: "Vertical product placement",
    backgroundStyle: "lifestyle",
    outputPurpose: "Stories & ephemeral content",
    highlights: ["9:16 vertical", "Safe zone for stickers", "Bold product focus"],
  },
  instagram_reel: {
    description: "Reel cover thumbnail — must read at small size in Reels grid.",
    safeArea: "Center",
    recommendedLayout: "Vertical hero product",
    backgroundStyle: "lifestyle",
    outputPurpose: "Reel cover image",
    highlights: ["High contrast at small size", "Vertical 9:16", "Cover-safe composition"],
  },
  facebook_post: {
    description: "Square Facebook feed image for shares and engagement.",
    safeArea: "Center",
    recommendedLayout: "Centered product",
    backgroundStyle: "lifestyle",
    outputPurpose: "Facebook feed",
    highlights: ["1:1 square", "Clean uncluttered scene", "Link preview friendly"],
  },
  facebook_story: {
    description: "Full-screen Facebook story format, similar to Instagram Stories.",
    safeArea: "Center-top",
    recommendedLayout: "Vertical product",
    backgroundStyle: "lifestyle",
    outputPurpose: "Facebook stories",
    highlights: ["9:16 vertical", "Mobile safe margins", "Immersive full-screen"],
  },
  pinterest_pin: {
    description: "Tall pin optimized for discovery and saves in Pinterest feeds.",
    safeArea: "Upper-center — product above fold",
    recommendedLayout: "Vertical layout, product upper third",
    backgroundStyle: "lifestyle",
    outputPurpose: "Pinterest discovery",
    highlights: ["2:3 tall format", "Scroll-stopping vertical", "Lifestyle context"],
  },
  linkedin_post: {
    description: "Professional square post for B2B brand and product announcements.",
    safeArea: "Center",
    recommendedLayout: "Clean centered product",
    backgroundStyle: "minimal",
    outputPurpose: "Professional social",
    highlights: ["Minimal background", "Corporate-appropriate", "1:1 professional crop"],
  },
  linkedin_banner: {
    description: "Wide company page banner — account for profile picture overlap.",
    safeArea: "Center horizontal band",
    recommendedLayout: "Wide layout, product left-of-center",
    backgroundStyle: "minimal",
    outputPurpose: "Company page banner",
    highlights: ["4:1 cinematic wide", "Profile pic safe zone right", "Brand-forward"],
  },
  twitter_post: {
    description: "Horizontal timeline image optimized for Twitter/X feed.",
    safeArea: "Center",
    recommendedLayout: "Centered product in 16:9",
    backgroundStyle: "lifestyle",
    outputPurpose: "Social timeline",
    highlights: ["16:9 landscape", "Readable in timeline preview", "High contrast"],
  },
  youtube_thumbnail: {
    description: "Bold thumbnail — product must pop at small YouTube grid size.",
    safeArea: "Center-right (avoid timestamp overlay)",
    recommendedLayout: "Hero centered, high contrast",
    backgroundStyle: "studio",
    outputPurpose: "Video thumbnail",
    highlights: ["16:9 bold composition", "Studio lighting", "Small-size legibility"],
  },
  youtube_short: {
    description: "Vertical Shorts cover image for mobile video discovery.",
    safeArea: "Center",
    recommendedLayout: "Vertical product hero",
    backgroundStyle: "lifestyle",
    outputPurpose: "Shorts cover",
    highlights: ["9:16 vertical", "Mobile-first", "Title-safe zones"],
  },
  website_product: {
    description: "Clean ecommerce PDP image — product is the sole focus.",
    safeArea: "Center with balanced margins",
    recommendedLayout: "Centered on white/studio",
    backgroundStyle: "studio",
    outputPurpose: "Ecommerce product page",
    highlights: ["Ultra-clean studio", "White/minimal BG", "Zoom-ready detail"],
  },
  website_banner: {
    description: "Homepage hero banner — wide cinematic campaign layout.",
    safeArea: "Center horizontal",
    recommendedLayout: "Hero layout with product center-left",
    backgroundStyle: "lifestyle",
    outputPurpose: "Website hero",
    highlights: ["16:9 wide hero", "Campaign mood", "Text overlay space"],
  },
  amazon_listing: {
    description: "Marketplace main image — pure white background, product fills frame.",
    safeArea: "Center — product 85%+ of frame",
    recommendedLayout: "Centered on white",
    backgroundStyle: "studio",
    outputPurpose: "Amazon listing",
    highlights: ["Pure white BG required", "No props", "Product dominates frame"],
  },
  shopify_product: {
    description: "Standard Shopify product image for collection and PDP grids.",
    safeArea: "Center",
    recommendedLayout: "Centered product on clean BG",
    backgroundStyle: "studio",
    outputPurpose: "Shopify storefront",
    highlights: ["1:1 grid consistency", "Clean studio look", "Collection tile ready"],
  },
  catalog_print: {
    description: "High-resolution print catalog — sharp detail for physical media.",
    safeArea: "Center",
    recommendedLayout: "Centered product with margin",
    backgroundStyle: "studio",
    outputPurpose: "Print catalog",
    highlights: ["3:2 print ratio", "Ultra resolution", "CMYK-ready clarity"],
  },
  billboard_ad: {
    description: "Outdoor billboard — simplified bold composition readable from distance.",
    safeArea: "Center horizontal",
    recommendedLayout: "Wide bold hero product",
    backgroundStyle: "lifestyle",
    outputPurpose: "Outdoor advertising",
    highlights: ["16:9 ultra-wide", "Minimal detail", "Distance-readable"],
  },
  email_marketing: {
    description: "Email campaign header — survives client-side cropping.",
    safeArea: "Center",
    recommendedLayout: "Centered with margin",
    backgroundStyle: "minimal",
    outputPurpose: "Email marketing",
    highlights: ["4:3 email header", "Crop-safe margins", "Quick-load clarity"],
  },
  mobile_app_banner: {
    description: "In-app promotional banner — vertical mobile layout.",
    safeArea: "Center — avoid notch & nav bar",
    recommendedLayout: "Vertical mobile hero",
    backgroundStyle: "lifestyle",
    outputPurpose: "Mobile app promo",
    highlights: ["9:16 in-app banner", "Mobile UI safe zones", "Thumb-reachable CTA area"],
  },
};

export function getPlatformDetails(id: PlatformPostTypeId): PlatformDetails {
  return PLATFORM_DETAILS[id];
}

/** Layout hint for preview mockup positioning */
export type PreviewLayout =
  | "square_center"
  | "vertical_story"
  | "tall_pin"
  | "wide_banner"
  | "landscape"
  | "white_studio"
  | "email_header";

export function getPreviewLayout(id: PlatformPostTypeId): PreviewLayout {
  const map: Partial<Record<PlatformPostTypeId, PreviewLayout>> = {
    instagram_post: "square_center",
    instagram_carousel: "square_center",
    instagram_story: "vertical_story",
    instagram_reel: "vertical_story",
    facebook_post: "square_center",
    facebook_story: "vertical_story",
    pinterest_pin: "tall_pin",
    linkedin_post: "square_center",
    linkedin_banner: "wide_banner",
    twitter_post: "landscape",
    youtube_thumbnail: "landscape",
    youtube_short: "vertical_story",
    website_product: "white_studio",
    website_banner: "wide_banner",
    amazon_listing: "white_studio",
    shopify_product: "white_studio",
    catalog_print: "landscape",
    billboard_ad: "wide_banner",
    email_marketing: "email_header",
    mobile_app_banner: "vertical_story",
  };
  return map[id] ?? "square_center";
}

export function getPlatformBrandColor(group: string): string {
  const colors: Record<string, string> = {
    Instagram: "#E1306C",
    Facebook: "#1877F2",
    Pinterest: "#E60023",
    LinkedIn: "#0A66C2",
    "Twitter / X": "#000000",
    YouTube: "#FF0000",
    Website: "#5856D6",
    Amazon: "#FF9900",
    Shopify: "#96BF48",
    Print: "#6E6E73",
    Outdoor: "#34C759",
    Email: "#007AFF",
    Mobile: "#5856D6",
  };
  return colors[group] ?? "#007AFF";
}
