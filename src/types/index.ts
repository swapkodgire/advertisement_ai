export interface BrandColor {
  name: string;
  hex: string;
}

export interface BrandOverview {
  businessName: string;
  tagline: string;
  logoUrl: string;
  fontFamily: string;
  colors: BrandColor[];
  brandValues: string[];
  brandAesthetics: string[];
  brandTone: string[];
  businessOverview: string;
}

export interface BusinessDetails {
  location: string;
  phone: string;
  businessHours: string;
  keywords: string[];
  ctaLinks: CTALink[];
  socialLinks: SocialLinks;
  testimonials: Testimonial[];
}

export interface CTALink {
  label: string;
  url: string;
}

export interface SocialLinks {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
  youtube: string;
  pinterest: string;
}

export interface Testimonial {
  id: string;
  author: string;
  text: string;
  rating: number;
}

export interface BusinessDNA {
  brandOverview: BrandOverview;
  businessDetails: BusinessDetails;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  rawPhotoUrl: string;
  redesignedPhotoUrl?: string;
  source: "url" | "scratch" | "upload";
  sourceUrl?: string;
  createdAt: string;
  generatedImages: GeneratedImage[];
}

export interface Brand {
  id: string;
  name: string;
  createdAt: string;
  businessDNA: BusinessDNA;
  products: Product[];
}

export interface GeneratedImage {
  id: string;
  platformPostTypeId?: PlatformPostTypeId;
  viewId?: ImageViewId;
  sceneId?: SceneId;
  url: string;
  type: "photoshoot" | "campaign";
  createdAt?: string;
  resolution?: string;
}

export type PlatformPostTypeId =
  | "instagram_post"
  | "instagram_carousel"
  | "instagram_story"
  | "instagram_reel"
  | "facebook_post"
  | "facebook_story"
  | "pinterest_pin"
  | "linkedin_post"
  | "linkedin_banner"
  | "twitter_post"
  | "youtube_thumbnail"
  | "youtube_short"
  | "website_product"
  | "website_banner"
  | "amazon_listing"
  | "shopify_product"
  | "catalog_print"
  | "billboard_ad"
  | "email_marketing"
  | "mobile_app_banner";

export interface PlatformPostType {
  id: PlatformPostTypeId;
  platformName: string;
  aspectRatio: string;
  resolution: string;
  platformGroup: string;
}

export type ImageViewId =
  | "front_hero_view"
  | "left_profile_view"
  | "right_profile_view"
  | "top_view"
  | "bottom_view"
  | "45_degree_angle"
  | "lifestyle_perspective"
  | "close_macro_detail"
  | "lens_detail_view"
  | "frame_detail_view"
  | "bag_texture_detail"
  | "strap_detail_view"
  | "floating_product_view"
  | "hero_advertising_angle"
  | "flat_lay_composition"
  | "side_elevated_view"
  | "retail_display_view"
  | "reflection_studio_view"
  | "product_grid_view"
  | "technical_lens_view";

export interface ImageView {
  id: ImageViewId;
  viewName: string;
  cameraAngle: string;
  category: "standard" | "detail" | "creative" | "catalog";
}

/** Scene slug — see SCENES catalog in src/lib/data/scenes.ts */
export type SceneId = string;

export type SceneCategory =
  | "studio"
  | "lifestyle"
  | "outdoor"
  | "luxury"
  | "fashion"
  | "seasonal"
  | "social"
  | "technical";

export interface Scene {
  id: SceneId;
  sceneName: string;
  sceneDescription: string;
  lighting: string;
  mood: string;
  colorPalette: string;
  cameraStyle: string;
  props: string;
  backgroundType: string;
  sceneCategory: SceneCategory;
  recommendedProducts: string[];
  complexity: "simple" | "moderate" | "complex";
  /** 2026 trending aesthetics — quiet luxury, UGC, dopamine, Cloud Dancer, etc. */
  trending?: boolean;
}

export interface GenerationSelection {
  platformPostTypeIds: PlatformPostTypeId[];
  viewIds: ImageViewId[];
  sceneIds: SceneId[];
}

export type ProductCategoryId =
  | "eyewear"
  | "sunglasses"
  | "bags"
  | "pouches"
  | "eyewear_accessories"
  | "eye_lens";

export type ProductTypeId =
  | "optical_frames"
  | "reading_glasses"
  | "blue_light_glasses"
  | "classic_sunglasses"
  | "sport_sunglasses"
  | "luxury_sunglasses"
  | "handbag"
  | "tote_bag"
  | "backpack"
  | "crossbody_bag"
  | "cosmetic_pouch"
  | "glasses_pouch"
  | "small_pouch"
  | "hard_case"
  | "soft_case"
  | "cleaning_kit"
  | "chain_strap"
  | "clip_on"
  | "contact_lens"
  | "colored_lens"
  | "prescription_lens";

export interface ProductProfile {
  categoryId: ProductCategoryId;
  typeId: ProductTypeId;
  confidence: number;
  source: "auto" | "manual" | "default";
  label: string;
  detectedAt: string;
}
