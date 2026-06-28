import type { PlatformPostType } from "@/types";

export const PLATFORM_POST_TYPES: PlatformPostType[] = [
  { id: "instagram_post", platformName: "Instagram Feed Post", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "Instagram" },
  { id: "instagram_carousel", platformName: "Instagram Carousel", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "Instagram" },
  { id: "instagram_story", platformName: "Instagram Story", aspectRatio: "9:16", resolution: "2160x3840", platformGroup: "Instagram" },
  { id: "instagram_reel", platformName: "Instagram Reel Cover", aspectRatio: "9:16", resolution: "2160x3840", platformGroup: "Instagram" },
  { id: "facebook_post", platformName: "Facebook Feed Post", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "Facebook" },
  { id: "facebook_story", platformName: "Facebook Story", aspectRatio: "9:16", resolution: "2160x3840", platformGroup: "Facebook" },
  { id: "pinterest_pin", platformName: "Pinterest Pin", aspectRatio: "2:3", resolution: "2048x3072", platformGroup: "Pinterest" },
  { id: "linkedin_post", platformName: "LinkedIn Feed Post", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "LinkedIn" },
  { id: "linkedin_banner", platformName: "LinkedIn Company Banner", aspectRatio: "4:1", resolution: "4096x1024", platformGroup: "LinkedIn" },
  { id: "twitter_post", platformName: "Twitter / X Post", aspectRatio: "16:9", resolution: "4096x2304", platformGroup: "Twitter / X" },
  { id: "youtube_thumbnail", platformName: "YouTube Thumbnail", aspectRatio: "16:9", resolution: "4096x2304", platformGroup: "YouTube" },
  { id: "youtube_short", platformName: "YouTube Shorts Cover", aspectRatio: "9:16", resolution: "2160x3840", platformGroup: "YouTube" },
  { id: "website_product", platformName: "Ecommerce Product Image", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "Website" },
  { id: "website_banner", platformName: "Website Hero Banner", aspectRatio: "16:9", resolution: "4096x2304", platformGroup: "Website" },
  { id: "amazon_listing", platformName: "Amazon Product Listing", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "Amazon" },
  { id: "shopify_product", platformName: "Shopify Product Image", aspectRatio: "1:1", resolution: "4096x4096", platformGroup: "Shopify" },
  { id: "catalog_print", platformName: "Print Catalog Image", aspectRatio: "3:2", resolution: "4500x3000", platformGroup: "Print" },
  { id: "billboard_ad", platformName: "Outdoor Billboard", aspectRatio: "16:9", resolution: "7680x4320", platformGroup: "Outdoor" },
  { id: "email_marketing", platformName: "Email Marketing Banner", aspectRatio: "4:3", resolution: "2400x1800", platformGroup: "Email" },
  { id: "mobile_app_banner", platformName: "Mobile App Banner", aspectRatio: "9:16", resolution: "2160x3840", platformGroup: "Mobile" },
];

export const PLATFORM_GROUPS = [...new Set(PLATFORM_POST_TYPES.map((p) => p.platformGroup))];

export function getPlatformPostType(id: string) {
  return PLATFORM_POST_TYPES.find((p) => p.id === id);
}
