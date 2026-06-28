import type { ImageView } from "@/types";

export const IMAGE_VIEWS: ImageView[] = [
  { id: "front_hero_view", viewName: "Front Hero View", cameraAngle: "straight front", category: "standard" },
  { id: "left_profile_view", viewName: "Left Profile View", cameraAngle: "left side profile", category: "standard" },
  { id: "right_profile_view", viewName: "Right Profile View", cameraAngle: "right side profile", category: "standard" },
  { id: "top_view", viewName: "Top View", cameraAngle: "overhead top-down", category: "standard" },
  { id: "bottom_view", viewName: "Bottom View", cameraAngle: "underside view", category: "standard" },
  { id: "45_degree_angle", viewName: "45 Degree Angle", cameraAngle: "angled perspective", category: "standard" },
  { id: "lifestyle_perspective", viewName: "Lifestyle Perspective", cameraAngle: "natural angle", category: "creative" },
  { id: "close_macro_detail", viewName: "Close Macro Detail", cameraAngle: "macro close-up", category: "detail" },
  { id: "lens_detail_view", viewName: "Lens Detail View", cameraAngle: "macro optical detail", category: "detail" },
  { id: "frame_detail_view", viewName: "Frame Detail View", cameraAngle: "hinge close-up", category: "detail" },
  { id: "bag_texture_detail", viewName: "Bag Texture Detail", cameraAngle: "material close-up", category: "detail" },
  { id: "strap_detail_view", viewName: "Strap Detail View", cameraAngle: "strap connection view", category: "detail" },
  { id: "floating_product_view", viewName: "Floating Product View", cameraAngle: "floating perspective", category: "creative" },
  { id: "hero_advertising_angle", viewName: "Hero Advertising Angle", cameraAngle: "dramatic angle", category: "creative" },
  { id: "flat_lay_composition", viewName: "Flat Lay Composition", cameraAngle: "flat lay", category: "catalog" },
  { id: "side_elevated_view", viewName: "Side Elevated View", cameraAngle: "slight elevation", category: "standard" },
  { id: "retail_display_view", viewName: "Retail Display View", cameraAngle: "display perspective", category: "catalog" },
  { id: "reflection_studio_view", viewName: "Reflection Studio View", cameraAngle: "reflection angle", category: "creative" },
  { id: "product_grid_view", viewName: "Product Grid View", cameraAngle: "catalog layout", category: "catalog" },
  { id: "technical_lens_view", viewName: "Technical Lens View", cameraAngle: "optical precision angle", category: "detail" },
];

export const VIEW_CATEGORIES = ["standard", "detail", "creative", "catalog"] as const;

export function getImageView(id: string) {
  return IMAGE_VIEWS.find((v) => v.id === id);
}
