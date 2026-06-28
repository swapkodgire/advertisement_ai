import { getImageView } from "@/lib/data/image-views";
import { getPlatformPostType } from "@/lib/data/platform-post-types";
import { getScene } from "@/lib/data/scenes";
import { GLOBAL_RULES } from "@/lib/photoshoot/rules/global-rules";
import { NEGATIVE_PROMPTS } from "@/lib/photoshoot/rules/negative-prompts";
import { PLATFORM_RULES } from "@/lib/photoshoot/rules/platform-rules";
import { getProductRulesForCategory } from "@/lib/photoshoot/rules/product-rules";
import { getBrandRulesText } from "@/lib/photoshoot/rules/brand-rules";
import { PHOTOSHOOT_PIPELINE_STEPS } from "@/lib/photoshoot/pipeline-steps";
import {
  buildProfessionalCreativeBrief,
  buildProfessionalFullPrompt,
  buildProfessionalIsolationPrompt,
  buildProfessionalNegativePrompt,
  buildProfessionalSceneBackgroundPrompt,
  buildProfessionalSceneImagePrompt,
  buildProfessionalCompositePrompt,
  type ProfessionalPromptContext,
} from "@/lib/photoshoot/scene-prompts";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";

export interface PhotoshootPromptInput {
  brandName: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  businessDNA: BusinessDNA;
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
}

export interface BuiltPhotoshootPrompts {
  creativeBrief: string;
  isolationPrompt: string;
  sceneBackgroundPrompt: string;
  compositePrompt: string;
  /** Short prompt optimized for Cursor generateImage */
  sceneImagePrompt: string;
  fullPrompt: string;
  negativePrompt: string;
  pipelineSteps: typeof PHOTOSHOOT_PIPELINE_STEPS;
  selectionDetails: PhotoshootSelectionDetails;
}

export interface PhotoshootSelectionDetails {
  platform: {
    id: string;
    name: string;
    aspectRatio: string;
    resolution: string;
    rules: string[];
  };
  view: {
    id: string;
    name: string;
    cameraAngle: string;
    category: string;
  };
  scene: {
    id: string;
    name: string;
    description: string;
    lighting: string;
    mood: string;
    colorPalette: string;
    backgroundType: string;
    props: string;
  };
  product: {
    name: string;
    category: string;
    rules: string[];
  };
  brand: {
    name: string;
    rules: string[];
  };
  globalRules: string[];
  negativePrompts: string[];
  pipelineSteps: { order: number; label: string; description: string }[];
  prompts: {
    isolation: string;
    sceneBackground: string;
    sceneImage: string;
    composite: string;
    full: string;
    negative: string;
  };
}

function toProfessionalContext(input: PhotoshootPromptInput): ProfessionalPromptContext {
  return {
    brandName: input.brandName,
    productName: input.productName,
    productCategory: input.productCategory,
    productDescription: input.productDescription,
    businessDNA: input.businessDNA,
    platformPostTypeId: input.platformPostTypeId,
    viewId: input.viewId,
    sceneId: input.sceneId,
  };
}

export function buildPhotoshootPrompts(input: PhotoshootPromptInput): BuiltPhotoshootPrompts {
  const platform = getPlatformPostType(input.platformPostTypeId)!;
  const view = getImageView(input.viewId)!;
  const scene = getScene(input.sceneId)!;
  const ctx = toProfessionalContext(input);

  const creativeBrief = buildProfessionalCreativeBrief(ctx);
  const isolationPrompt = buildProfessionalIsolationPrompt(ctx);
  const sceneBackgroundPrompt = buildProfessionalSceneBackgroundPrompt(ctx);
  const compositePrompt = buildProfessionalCompositePrompt(ctx);
  const sceneImagePrompt = buildProfessionalSceneImagePrompt(ctx);
  const fullPrompt = buildProfessionalFullPrompt(ctx);
  const negativePrompt = buildProfessionalNegativePrompt();

  const selectionDetails: PhotoshootSelectionDetails = {
    platform: {
      id: platform.id,
      name: platform.platformName,
      aspectRatio: platform.aspectRatio,
      resolution: platform.resolution,
      rules: PLATFORM_RULES[input.platformPostTypeId] ?? [],
    },
    view: {
      id: view.id,
      name: view.viewName,
      cameraAngle: view.cameraAngle,
      category: view.category,
    },
    scene: {
      id: scene.id,
      name: scene.sceneName,
      description: scene.sceneDescription,
      lighting: scene.lighting,
      mood: scene.mood,
      colorPalette: scene.colorPalette,
      backgroundType: scene.backgroundType,
      props: scene.props,
    },
    product: {
      name: input.productName,
      category: input.productCategory,
      rules: getProductRulesForCategory(input.productCategory),
    },
    brand: {
      name: input.brandName,
      rules: getBrandRulesText(input.brandName, input.brandName)
        .split("\n")
        .map((r) => r.replace(/^-\s*/, "")),
    },
    globalRules: GLOBAL_RULES.map((r) => r.text),
    negativePrompts: NEGATIVE_PROMPTS,
    pipelineSteps: PHOTOSHOOT_PIPELINE_STEPS.map((s) => ({
      order: s.order,
      label: s.label,
      description: s.description,
    })),
    prompts: {
      isolation: isolationPrompt,
      sceneBackground: sceneBackgroundPrompt,
      sceneImage: sceneImagePrompt,
      composite: compositePrompt,
      full: fullPrompt,
      negative: negativePrompt,
    },
  };

  return {
    creativeBrief,
    isolationPrompt,
    sceneBackgroundPrompt,
    compositePrompt,
    sceneImagePrompt,
    fullPrompt,
    negativePrompt,
    pipelineSteps: PHOTOSHOOT_PIPELINE_STEPS,
    selectionDetails,
  };
}

/** @deprecated Use buildProfessionalSceneImagePrompt via buildPhotoshootPrompts */
export function buildConciseSceneImagePrompt(input: {
  sceneName: string;
  sceneDescription: string;
  backgroundType: string;
  lighting: string;
  mood: string;
  colorPalette: string;
  props: string;
  viewName: string;
  cameraAngle: string;
  platformName: string;
  aspectRatio: string;
}): string {
  return `EMPTY professional photoshoot environment for ${input.platformName} (${input.aspectRatio}).

Scene: ${input.sceneName} — ${input.sceneDescription}
Environment: ${input.backgroundType} | Lighting: ${input.lighting} | Mood: ${input.mood}
Colors: ${input.colorPalette} | Env props only: ${input.props}
Camera: ${input.viewName}, ${input.cameraAngle}

NO products, NO eyewear, NO bags, NO people, NO hands, NO text, NO logos.
Lower-center negative space for compositing. Photorealistic commercial studio quality.
Natural DOF / bokeh in deep background. New environment — not a desk or office photo.`;
}
