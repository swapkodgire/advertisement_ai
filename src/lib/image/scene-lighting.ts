import type { SceneCategory } from "@/types";

export interface SceneLightingProfile {
  /** Shadow cast direction in degrees (0=right, 90=down, 135=lower-right) */
  shadowAngleDeg: number;
  /** 0–1 vertical anchor — where product base sits on canvas */
  groundAnchorY: number;
  isOutdoor: boolean;
  isTableSurface: boolean;
  /** Cast shadow length as fraction of product height */
  castShadowLength: number;
  contactShadowOpacity: number;
  castShadowOpacity: number;
  ambientWarmth: number;
  sunDescription: string;
}

function isOutdoorScene(sceneCategory: SceneCategory, backgroundType: string): boolean {
  if (sceneCategory === "outdoor") return true;
  const bg = backgroundType.toLowerCase();
  return /desert|beach|garden|park|street|outdoor|sand|dune|nature|forest|mountain/.test(bg);
}

function isTableOrSurfaceScene(backgroundType: string, props: string): boolean {
  const text = `${backgroundType} ${props}`.toLowerCase();
  return /table|marble|desk|counter|surface|café|cafe|shelf|tray|wood|stone slab/.test(text);
}

export function getSceneLightingProfile(input: {
  lighting: string;
  mood: string;
  sceneCategory: SceneCategory;
  backgroundType: string;
  props?: string;
}): SceneLightingProfile {
  const text = `${input.lighting} ${input.mood} ${input.backgroundType}`.toLowerCase();
  const outdoor = isOutdoorScene(input.sceneCategory, input.backgroundType);
  const table = isTableOrSurfaceScene(input.backgroundType, input.props ?? "");

  let shadowAngleDeg = 125;
  let sunDescription = "soft key light from upper-left, fill from ambient";

  if (text.includes("golden") || text.includes("sunset") || text.includes("sunrise")) {
    shadowAngleDeg = 135;
    sunDescription = "golden-hour sun from upper-left — warm rim, long cast shadow to lower-right on ground";
  } else if (text.includes("midday") || text.includes("harsh sun")) {
    shadowAngleDeg = 110;
    sunDescription = "overhead sun — short contact shadow, moderate cast to lower-right";
  } else if (text.includes("window") || text.includes("north light")) {
    shadowAngleDeg = 115;
    sunDescription = "large window key from left — soft gradient shadow to lower-right";
  } else if (text.includes("studio") || text.includes("softbox")) {
    shadowAngleDeg = 120;
    sunDescription = "studio key from upper-left — controlled contact shadow below-right";
  } else if (outdoor) {
    shadowAngleDeg = 132;
    sunDescription = "natural outdoor sun from upper-left — cast shadow on ground plane lower-right";
  }

  return {
    shadowAngleDeg,
    groundAnchorY: outdoor ? 0.64 : table ? 0.52 : 0.44,
    isOutdoor: outdoor,
    isTableSurface: table,
    castShadowLength: outdoor ? 0.55 : table ? 0.28 : 0.22,
    contactShadowOpacity: outdoor ? 0.32 : 0.38,
    castShadowOpacity: outdoor ? 0.42 : 0.3,
    ambientWarmth: text.includes("golden") || text.includes("warm") ? 1.08 : 1.03,
    sunDescription,
  };
}
