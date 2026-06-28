import type { ImageViewId } from "@/types";

export interface ViewDetails {
  description: string;
  framing: string;
  lighting: string;
  bestFor: string;
  highlights: string[];
}

export type ViewPreviewAngle =
  | "front"
  | "left_profile"
  | "right_profile"
  | "top_down"
  | "bottom_up"
  | "three_quarter"
  | "lifestyle"
  | "macro"
  | "lens_macro"
  | "frame_macro"
  | "texture_macro"
  | "strap_macro"
  | "floating"
  | "hero_low"
  | "flat_lay"
  | "elevated_side"
  | "retail_display"
  | "reflection"
  | "grid"
  | "technical";

export const VIEW_DETAILS: Record<ImageViewId, ViewDetails> = {
  front_hero_view: {
    description: "Straight-on hero shot — the primary catalog and ad angle with symmetrical framing.",
    framing: "Centered, full product visible",
    lighting: "Even studio key light",
    bestFor: "Homepage heroes & listings",
    highlights: ["Symmetrical composition", "Maximum product clarity", "Default e-commerce angle"],
  },
  left_profile_view: {
    description: "Left side profile showing temple depth, hinge, and frame thickness.",
    framing: "Side-on, product fills height",
    lighting: "Rim light on edge",
    bestFor: "Frame depth & fit",
    highlights: ["Temple arm visible", "Shows frame profile", "Pairs with front hero"],
  },
  right_profile_view: {
    description: "Right side profile — mirror of left for asymmetric products or carousel variety.",
    framing: "Side-on, mirrored layout",
    lighting: "Rim light on edge",
    bestFor: "Alternate side detail",
    highlights: ["Opposite temple view", "Carousel slide variety", "Asymmetric product features"],
  },
  top_view: {
    description: "Overhead top-down view revealing lens shape and frame geometry from above.",
    framing: "Bird's-eye, centered",
    lighting: "Soft overhead diffuse",
    bestFor: "Shape & lens outline",
    highlights: ["Lens shape visible", "Frame width clear", "Flat-lay adjacent angle"],
  },
  bottom_view: {
    description: "Underside view showing nose pads, bridge underside, and weight distribution.",
    framing: "Low angle from below",
    lighting: "Fill from below",
    bestFor: "Comfort & construction",
    highlights: ["Nose pad detail", "Bridge underside", "Build quality proof"],
  },
  "45_degree_angle": {
    description: "Classic 3/4 perspective — adds depth while keeping both lenses readable.",
    framing: "3/4 turn, slight elevation",
    lighting: "45° key with soft fill",
    bestFor: "Versatile marketing shots",
    highlights: ["Depth without losing detail", "Natural perspective", "Most-used ad angle"],
  },
  lifestyle_perspective: {
    description: "Natural, in-context angle as if casually placed on a desk or vanity.",
    framing: "Off-center, environmental",
    lighting: "Window light, soft shadows",
    bestFor: "Social & lifestyle ads",
    highlights: ["Relatable context", "Soft natural shadows", "Less studio, more real"],
  },
  close_macro_detail: {
    description: "Tight macro crop on surface finish, logo, or craftsmanship detail.",
    framing: "Extreme close-up crop",
    lighting: "Specular highlight control",
    bestFor: "Quality & material story",
    highlights: ["Texture visible", "Logo legibility", "Premium craft signal"],
  },
  lens_detail_view: {
    description: "Macro optical detail — lens tint, coating reflection, and edge polish.",
    framing: "Single lens fill frame",
    lighting: "Controlled specular on glass",
    bestFor: "Lens technology marketing",
    highlights: ["Coating reflection", "Tint clarity", "Optical quality focus"],
  },
  frame_detail_view: {
    description: "Hinge and joint close-up showing build quality and metal accents.",
    framing: "Hinge area macro",
    lighting: "Side raking light",
    bestFor: "Durability & premium build",
    highlights: ["Hinge mechanism", "Metal accents", "Joinery quality"],
  },
  bag_texture_detail: {
    description: "Material texture close-up — leather grain, fabric weave, or case finish.",
    framing: "Texture fills frame",
    lighting: "Raking light for grain",
    bestFor: "Material & accessory quality",
    highlights: ["Grain pattern visible", "Touch-quality signal", "Accessory storytelling"],
  },
  strap_detail_view: {
    description: "Connection point detail — strap, chain, or temple tip attachment.",
    framing: "Hardware connection macro",
    lighting: "Highlight on metal",
    bestFor: "Hardware & attachment quality",
    highlights: ["Connection hardware", "Stitch or weld detail", "Durability close-up"],
  },
  floating_product_view: {
    description: "Product suspended in space with soft drop shadow — clean, modern ad look.",
    framing: "Centered, negative space",
    lighting: "Even with soft shadow below",
    bestFor: "Digital ads & app stores",
    highlights: ["No surface distraction", "Drop shadow depth", "Clean modern aesthetic"],
  },
  hero_advertising_angle: {
    description: "Dramatic low-angle hero shot — product feels bold, premium, and commanding.",
    framing: "Low camera, upward tilt",
    lighting: "Strong key, deep shadow",
    bestFor: "Billboards & campaign heroes",
    highlights: ["Dramatic perspective", "Premium brand feel", "High impact at scale"],
  },
  flat_lay_composition: {
    description: "Top-down flat lay with complementary props arranged around the product.",
    framing: "Overhead, styled layout",
    lighting: "Even overhead softbox",
    bestFor: "Editorial & Instagram grids",
    highlights: ["Styled props", "Grid-friendly layout", "Editorial storytelling"],
  },
  side_elevated_view: {
    description: "Slightly elevated side angle — between profile and 3/4 for subtle depth.",
    framing: "Side with 15° elevation",
    lighting: "Soft side key",
    bestFor: "Subtle dimension shots",
    highlights: ["Gentle depth cue", "Less dramatic than 45°", "Catalog variety"],
  },
  retail_display_view: {
    description: "Product on display stand or shelf — mimics in-store presentation.",
    framing: "Display context, eye-level",
    lighting: "Retail spot + ambient",
    bestFor: "In-store & wholesale",
    highlights: ["Display stand context", "Retail-ready presentation", "B2B sales support"],
  },
  reflection_studio_view: {
    description: "Glossy surface reflection beneath product — luxury studio aesthetic.",
    framing: "Centered on reflective plane",
    lighting: "Softbox with mirror bounce",
    bestFor: "Luxury & premium lines",
    highlights: ["Mirror reflection", "High-end studio look", "Premium positioning"],
  },
  product_grid_view: {
    description: "Multi-angle grid layout — several views of the same product in one frame.",
    framing: "2×2 or 3-up grid",
    lighting: "Consistent across cells",
    bestFor: "Catalog pages & lookbooks",
    highlights: ["Multiple angles at once", "Consistent lighting", "Catalog efficiency"],
  },
  technical_lens_view: {
    description: "Precision optical angle — clean, clinical framing for spec and tech marketing.",
    framing: "Lens axis aligned to camera",
    lighting: "Clinical even light",
    bestFor: "Spec sheets & tech pages",
    highlights: ["Optical axis alignment", "Minimal distortion", "Technical documentation"],
  },
};

export function getViewDetails(id: ImageViewId): ViewDetails {
  return VIEW_DETAILS[id];
}

export function getViewPreviewAngle(id: ImageViewId): ViewPreviewAngle {
  const map: Record<ImageViewId, ViewPreviewAngle> = {
    front_hero_view: "front",
    left_profile_view: "left_profile",
    right_profile_view: "right_profile",
    top_view: "top_down",
    bottom_view: "bottom_up",
    "45_degree_angle": "three_quarter",
    lifestyle_perspective: "lifestyle",
    close_macro_detail: "macro",
    lens_detail_view: "lens_macro",
    frame_detail_view: "frame_macro",
    bag_texture_detail: "texture_macro",
    strap_detail_view: "strap_macro",
    floating_product_view: "floating",
    hero_advertising_angle: "hero_low",
    flat_lay_composition: "flat_lay",
    side_elevated_view: "elevated_side",
    retail_display_view: "retail_display",
    reflection_studio_view: "reflection",
    product_grid_view: "grid",
    technical_lens_view: "technical",
  };
  return map[id];
}

export function getViewCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    standard: "#007AFF",
    detail: "#FF9500",
    creative: "#AF52DE",
    catalog: "#34C759",
  };
  return colors[category] ?? "#007AFF";
}
