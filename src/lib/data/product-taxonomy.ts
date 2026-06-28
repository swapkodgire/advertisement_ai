import type { ImageViewId, ProductCategoryId, ProductTypeId } from "@/types";

export interface ProductTypeDef {
  id: ProductTypeId;
  label: string;
}

export interface ProductCategoryDef {
  id: ProductCategoryId;
  label: string;
  types: ProductTypeDef[];
}

export const PRODUCT_CATEGORIES: ProductCategoryDef[] = [
  {
    id: "eyewear",
    label: "Eyewear",
    types: [
      { id: "optical_frames", label: "Optical Frames" },
      { id: "reading_glasses", label: "Reading Glasses" },
      { id: "blue_light_glasses", label: "Blue Light Glasses" },
    ],
  },
  {
    id: "sunglasses",
    label: "Sunglasses",
    types: [
      { id: "classic_sunglasses", label: "Classic Sunglasses" },
      { id: "sport_sunglasses", label: "Sport Sunglasses" },
      { id: "luxury_sunglasses", label: "Luxury Sunglasses" },
    ],
  },
  {
    id: "bags",
    label: "Bags",
    types: [
      { id: "handbag", label: "Handbag" },
      { id: "tote_bag", label: "Tote Bag" },
      { id: "backpack", label: "Backpack" },
      { id: "crossbody_bag", label: "Crossbody Bag" },
    ],
  },
  {
    id: "pouches",
    label: "Pouches",
    types: [
      { id: "cosmetic_pouch", label: "Cosmetic Pouch" },
      { id: "glasses_pouch", label: "Glasses Pouch" },
      { id: "small_pouch", label: "Small Pouch" },
    ],
  },
  {
    id: "eyewear_accessories",
    label: "Eyewear Accessories",
    types: [
      { id: "hard_case", label: "Hard Case" },
      { id: "soft_case", label: "Soft Case" },
      { id: "cleaning_kit", label: "Cleaning Kit" },
      { id: "chain_strap", label: "Chain / Strap" },
      { id: "clip_on", label: "Clip-On" },
    ],
  },
  {
    id: "eye_lens",
    label: "Eye Lens",
    types: [
      { id: "contact_lens", label: "Contact Lens" },
      { id: "colored_lens", label: "Colored Lens" },
      { id: "prescription_lens", label: "Prescription Lens" },
    ],
  },
];

const EYEWEAR_VIEWS: ImageViewId[] = [
  "front_hero_view",
  "left_profile_view",
  "right_profile_view",
  "top_view",
  "bottom_view",
  "45_degree_angle",
  "side_elevated_view",
  "lifestyle_perspective",
  "close_macro_detail",
  "lens_detail_view",
  "frame_detail_view",
  "floating_product_view",
  "hero_advertising_angle",
  "reflection_studio_view",
  "retail_display_view",
  "product_grid_view",
  "technical_lens_view",
];

const SUNGLASSES_VIEWS: ImageViewId[] = [
  "front_hero_view",
  "left_profile_view",
  "right_profile_view",
  "top_view",
  "45_degree_angle",
  "side_elevated_view",
  "lifestyle_perspective",
  "close_macro_detail",
  "lens_detail_view",
  "frame_detail_view",
  "floating_product_view",
  "hero_advertising_angle",
  "reflection_studio_view",
  "retail_display_view",
  "product_grid_view",
];

const BAG_VIEWS: ImageViewId[] = [
  "front_hero_view",
  "left_profile_view",
  "right_profile_view",
  "top_view",
  "45_degree_angle",
  "side_elevated_view",
  "lifestyle_perspective",
  "close_macro_detail",
  "bag_texture_detail",
  "strap_detail_view",
  "floating_product_view",
  "hero_advertising_angle",
  "flat_lay_composition",
  "retail_display_view",
  "product_grid_view",
];

const POUCH_VIEWS: ImageViewId[] = [
  "front_hero_view",
  "top_view",
  "45_degree_angle",
  "lifestyle_perspective",
  "close_macro_detail",
  "bag_texture_detail",
  "strap_detail_view",
  "floating_product_view",
  "flat_lay_composition",
  "retail_display_view",
  "product_grid_view",
];

const ACCESSORY_VIEWS: ImageViewId[] = [
  "front_hero_view",
  "top_view",
  "45_degree_angle",
  "lifestyle_perspective",
  "close_macro_detail",
  "bag_texture_detail",
  "strap_detail_view",
  "floating_product_view",
  "flat_lay_composition",
  "retail_display_view",
  "product_grid_view",
];

const LENS_VIEWS: ImageViewId[] = [
  "front_hero_view",
  "close_macro_detail",
  "lens_detail_view",
  "technical_lens_view",
  "floating_product_view",
  "reflection_studio_view",
  "product_grid_view",
  "hero_advertising_angle",
];

const VIEWS_BY_CATEGORY: Record<ProductCategoryId, ImageViewId[]> = {
  eyewear: EYEWEAR_VIEWS,
  sunglasses: SUNGLASSES_VIEWS,
  bags: BAG_VIEWS,
  pouches: POUCH_VIEWS,
  eyewear_accessories: ACCESSORY_VIEWS,
  eye_lens: LENS_VIEWS,
};

/** Type-level refinements — extra views for specific subtypes */
const TYPE_VIEW_OVERRIDES: Partial<Record<ProductTypeId, ImageViewId[]>> = {
  sport_sunglasses: ["hero_advertising_angle", "lifestyle_perspective", "45_degree_angle"],
  chain_strap: ["strap_detail_view", "close_macro_detail", "lifestyle_perspective"],
  cleaning_kit: ["flat_lay_composition", "top_view", "close_macro_detail"],
  contact_lens: ["technical_lens_view", "lens_detail_view", "close_macro_detail"],
};

export function getCategoryDef(id: ProductCategoryId): ProductCategoryDef | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.id === id);
}

export function getTypeDef(typeId: ProductTypeId): ProductTypeDef | undefined {
  for (const cat of PRODUCT_CATEGORIES) {
    const t = cat.types.find((x) => x.id === typeId);
    if (t) return t;
  }
  return undefined;
}

export function getCategoryForType(typeId: ProductTypeId): ProductCategoryId | undefined {
  for (const cat of PRODUCT_CATEGORIES) {
    if (cat.types.some((t) => t.id === typeId)) return cat.id;
  }
  return undefined;
}

export function getProductTypeLabel(typeId: ProductTypeId): string {
  return getTypeDef(typeId)?.label ?? typeId;
}

export function getProductCategoryLabel(categoryId: ProductCategoryId): string {
  return getCategoryDef(categoryId)?.label ?? categoryId;
}

export function isValidProductType(categoryId: ProductCategoryId, typeId: ProductTypeId): boolean {
  const cat = getCategoryDef(categoryId);
  return cat?.types.some((t) => t.id === typeId) ?? false;
}

export function getRecommendedViewsForType(typeId: ProductTypeId): ImageViewId[] {
  const categoryId = getCategoryForType(typeId);
  if (!categoryId) return EYEWEAR_VIEWS;

  const base = [...VIEWS_BY_CATEGORY[categoryId]];
  const extras = TYPE_VIEW_OVERRIDES[typeId] ?? [];

  const merged = [...base];
  for (const v of extras) {
    if (!merged.includes(v)) merged.unshift(v);
  }
  return merged;
}

export function getDefaultViewForType(typeId: ProductTypeId): ImageViewId {
  const views = getRecommendedViewsForType(typeId);
  return views[0] ?? "front_hero_view";
}

export function getAllValidTypeIds(): ProductTypeId[] {
  return PRODUCT_CATEGORIES.flatMap((c) => c.types.map((t) => t.id));
}

export function buildDetectionPromptCatalog(): string {
  return PRODUCT_CATEGORIES.map(
    (c) =>
      `- ${c.id} (${c.label}): ${c.types.map((t) => `${t.id} (${t.label})`).join(", ")}`
  ).join("\n");
}
