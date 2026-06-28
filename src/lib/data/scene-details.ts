import type { Scene, SceneCategory, SceneId } from "@/types";
import { SCENES, getScene } from "@/lib/data/scenes";
import { getPipelineWhatWeDo } from "@/lib/photoshoot/pipeline-steps";

export interface SceneDetails {
  description: string;
  whatWeDo: string[];
  environmentSetup: string;
  productPlacement: string;
  bestFor: string;
  highlights: string[];
}

export type ScenePreviewVisual =
  | "white_studio"
  | "marble"
  | "black_studio"
  | "glass_reflect"
  | "fashion_dramatic"
  | "beach"
  | "desert"
  | "urban"
  | "wood"
  | "leather"
  | "neon"
  | "runway"
  | "ecommerce"
  | "floating"
  | "crystal"
  | "stone"
  | "hotel"
  | "workspace"
  | "lab"
  | "optical_bench"
  | "lens_float"
  | "retail_display"
  | "travel"
  | "sand"
  | "gloss_black"
  | "gradient"
  | "macro_jewelry"
  | "tech"
  | "scandinavian"
  | "warm_neutral"
  | "linen"
  | "cafe"
  | "botanical"
  | "snow"
  | "dopamine"
  | "flash"
  | "rustic";

const LEGACY_VISUAL_MAP: Partial<Record<string, ScenePreviewVisual>> = {
  minimal_white_studio: "white_studio",
  luxury_marble_studio: "marble",
  matte_black_studio: "black_studio",
  glass_reflection_studio: "glass_reflect",
  fashion_editorial_studio: "fashion_dramatic",
  tropical_summer_beach: "beach",
  desert_golden_hour: "desert",
  urban_concrete_scene: "urban",
  minimal_wooden_table: "wood",
  luxury_leather_desk: "leather",
  neon_night_fashion: "neon",
  high_fashion_runway: "runway",
  editorial_magazine_scene: "fashion_dramatic",
  clean_ecommerce_studio: "ecommerce",
  floating_product_studio: "floating",
  crystal_reflection_studio: "crystal",
  minimal_stone_pedestal: "stone",
  luxury_hotel_desk: "hotel",
  modern_workspace: "workspace",
  optical_laboratory: "lab",
  precision_optical_bench: "optical_bench",
  floating_lens_studio: "lens_float",
  premium_sunglasses_display: "retail_display",
  travel_lifestyle_scene: "travel",
  minimal_sand_texture: "sand",
  high_gloss_black_surface: "gloss_black",
  minimal_gradient_background: "gradient",
  jewelry_style_macro: "macro_jewelry",
  futuristic_tech_scene: "tech",
  scandinavian_minimal_studio: "scandinavian",
};

function inferVisualFromScene(scene: Scene): ScenePreviewVisual {
  const id = scene.id.toLowerCase();
  const text = `${id} ${scene.backgroundType} ${scene.colorPalette} ${scene.props}`.toLowerCase();

  if (LEGACY_VISUAL_MAP[scene.id]) return LEGACY_VISUAL_MAP[scene.id]!;

  if (text.includes("beach") || text.includes("pool") || text.includes("yacht") || text.includes("coastal"))
    return "beach";
  if (text.includes("desert") || text.includes("golden hour") || text.includes("terrace"))
    return "desert";
  if (text.includes("snow") || text.includes("frost") || text.includes("winter") || text.includes("ski"))
    return "snow";
  if (text.includes("cafe") || text.includes("bistro") || text.includes("kitchen") || text.includes("coffee"))
    return "cafe";
  if (text.includes("linen") || text.includes("bedscape") || text.includes("textile") || text.includes("boucle"))
    return "linen";
  if (text.includes("forest") || text.includes("grove") || text.includes("floral") || text.includes("spring") || text.includes("eco"))
    return "botanical";
  if (text.includes("marble") || text.includes("travertine") || text.includes("terrazzo"))
    return "marble";
  if (text.includes("neon") || text.includes("dopamine") || text.includes("y2k") || text.includes("chrome"))
    return "dopamine";
  if (text.includes("flash") || text.includes("ugc") || text.includes("handheld") || text.includes("street"))
    return "flash";
  if (text.includes("lab") || text.includes("optical") || text.includes("grid") || text.includes("clinical"))
    return "lab";
  if (scene.sceneCategory === "technical") return "lab";
  if (text.includes("glass") || text.includes("reflect") || text.includes("gloss"))
    return "glass_reflect";
  if (text.includes("black") || text.includes("runway") || text.includes("streetwear"))
    return "black_studio";
  if (text.includes("gradient") || text.includes("mesh"))
    return "gradient";
  if (text.includes("sand"))
    return "sand";
  if (text.includes("wood") || text.includes("rattan") || text.includes("chalet") || text.includes("market"))
    return "rustic";
  if (text.includes("travel") || text.includes("airport") || text.includes("mountain") || text.includes("alpine"))
    return "travel";
  if (scene.sceneCategory === "outdoor") return "travel";
  if (scene.sceneCategory === "luxury") return "linen";
  if (scene.sceneCategory === "social") return "flash";
  if (scene.sceneCategory === "seasonal") return "botanical";
  if (scene.sceneCategory === "fashion") return "fashion_dramatic";
  if (text.includes("cloud") || text.includes("warm off") || text.includes("warm neutral"))
    return "warm_neutral";
  if (scene.sceneCategory === "studio") return "white_studio";
  if (scene.sceneCategory === "lifestyle") return "wood";
  return "white_studio";
}

function buildDefaultSceneDetails(scene: Scene): SceneDetails {
  const productLabel =
    scene.recommendedProducts.length > 0
      ? scene.recommendedProducts.map((p) => p.replace(/_/g, " ")).join(", ")
      : "all product types";

  return {
    description: scene.sceneDescription,
    whatWeDo: getPipelineWhatWeDo(scene.backgroundType),
    environmentSetup: `${scene.backgroundType} · ${scene.colorPalette}`,
    productPlacement: `Center frame · ${scene.cameraStyle.replace(/_/g, " ")}`,
    bestFor: productLabel,
    highlights: [
      scene.trending ? "Trending 2026 aesthetic" : `${scene.sceneCategory} category`,
      scene.lighting,
      scene.mood,
    ],
  };
}

export function getSceneDetails(id: SceneId): SceneDetails {
  const scene = getScene(id);
  if (!scene) {
    return {
      description: "",
      whatWeDo: [],
      environmentSetup: "",
      productPlacement: "Center frame",
      bestFor: "Product marketing",
      highlights: [],
    };
  }
  return buildDefaultSceneDetails(scene);
}

export function getScenePreviewVisual(id: SceneId): ScenePreviewVisual {
  const scene = getScene(id);
  if (!scene) return "white_studio";
  return inferVisualFromScene(scene);
}

export function getSceneCategoryColor(category: SceneCategory | string): string {
  const colors: Record<string, string> = {
    studio: "#5856D6",
    lifestyle: "#34C759",
    outdoor: "#30B0C7",
    luxury: "#C9A227",
    fashion: "#AF52DE",
    seasonal: "#FF9500",
    social: "#FF2D55",
    technical: "#007AFF",
  };
  return colors[category] ?? "#007AFF";
}

export function getSceneComplexityLabel(complexity: string): string {
  return complexity.charAt(0).toUpperCase() + complexity.slice(1);
}

export function filterScenesByProductLabel(productLabel: string) {
  const normalized = productLabel.toLowerCase();
  if (!normalized) return SCENES;
  return SCENES.filter(
    (s) =>
      s.recommendedProducts.some(
        (p) => normalized.includes(p) || p.includes(normalized.split(" ")[0] ?? "")
      ) || s.sceneCategory === "studio"
  );
}
