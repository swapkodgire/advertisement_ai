import {
  buildBrandContext,
  composePhotoshootPromptWithCursor,
  researchPhotoshootContextWithCursor,
  isCursorConfigured,
} from "@/lib/cursor-server";
import { buildPhotoshootPrompts, type PhotoshootSelectionDetails } from "@/lib/photoshoot/prompt-builder";
import { PHOTOSHOOT_PIPELINE_STEPS } from "@/lib/photoshoot/pipeline-steps";
import {
  buildSceneBackgroundPrompt,
  getCursorImageModelLabel,
  ISOLATION_PROMPT,
} from "@/lib/image/cursor-image";
import { getImageView } from "@/lib/data/image-views";
import { getPlatformPostType } from "@/lib/data/platform-post-types";
import { getScene } from "@/lib/data/scenes";
import type {
  BusinessDNA,
  ImageViewId,
  PlatformPostTypeId,
  SceneId,
} from "@/types";

export interface PhotoshootWizardInput {
  brandName: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  businessDNA: BusinessDNA;
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
}

export interface PhotoshootAgentStep {
  id: string;
  order: number;
  label: string;
  detail?: string;
}

export type PhotoshootPromptMethod = "cursor-agent" | "template";

export interface PhotoshootAgentPlan {
  creativeBrief: string;
  /** Full plan for display */
  imageEditPrompt: string;
  isolationPrompt: string;
  sceneBackgroundPrompt: string;
  compositePrompt?: string;
  sceneImagePrompt?: string;
  negativePrompt?: string;
  selectionDetails?: PhotoshootSelectionDetails;
  promptMethod: PhotoshootPromptMethod;
  imageModel: string;
  agentSteps: PhotoshootAgentStep[];
}

/** Deep research brief used by Pro mode to inform the art-direction prompts. */
export async function researchPhotoshootContext(
  input: PhotoshootWizardInput
): Promise<string | null> {
  if (!isCursorConfigured()) return null;
  const platform = getPlatformPostType(input.platformPostTypeId)!;
  const view = getImageView(input.viewId)!;
  const scene = getScene(input.sceneId)!;

  const message = `## Product
- Name: ${input.productName}
- Category: ${input.productCategory}
- Description: ${input.productDescription || "From uploaded source"}

## Brand: ${input.brandName}
${buildBrandContext(input.businessDNA)}

## Target platform: ${platform.platformName} (${platform.aspectRatio}, ${platform.resolution})
## Camera view: ${view.viewName} — ${view.cameraAngle}
## Scene direction: ${scene.sceneName} — ${scene.sceneDescription} (lighting: ${scene.lighting}, mood: ${scene.mood}, palette: ${scene.colorPalette})`;

  try {
    const research = await researchPhotoshootContextWithCursor(message);
    return research.trim() || null;
  } catch (err) {
    console.warn("Photoshoot research agent failed:", err);
    return null;
  }
}

function buildStructuredUserMessage(
  input: PhotoshootWizardInput,
  research?: string | null
): string {
  const platform = getPlatformPostType(input.platformPostTypeId)!;
  const view = getImageView(input.viewId)!;
  const scene = getScene(input.sceneId)!;
  const pipelineList = PHOTOSHOOT_PIPELINE_STEPS.map(
    (s) => `${s.order}. ${s.label} — ${s.description}`
  ).join("\n");

  const researchBlock = research
    ? `\n\n## RESEARCH BRIEF (incorporate these findings into the prompts)\n${research}`
    : "";

  return `Compose a world-class 10-step studio photoshoot plan. Runtime executes: compose → isolate → scene → composite (steps 5–10 are composite/finish intent).${researchBlock}

PIPELINE:
${pipelineList}

Wizard inputs:

## Product (identify from source photo — never replace or redesign)
- Name: ${input.productName}
- Category: ${input.productCategory}
- Description: ${input.productDescription || "From uploaded source"}

## Brand DNA (scene/mood/lighting only — never on product)
Brand: ${input.brandName}
${buildBrandContext(input.businessDNA)}

## Platform: ${platform.platformName} (${platform.aspectRatio}, ${platform.resolution})
## View: ${view.viewName} — ${view.cameraAngle} (${view.category})
## Scene: ${scene.sceneName}
Description: ${scene.sceneDescription}
Environment: ${scene.backgroundType}
Lighting: ${scene.lighting}
Mood: ${scene.mood}
Palette: ${scene.colorPalette}
Props (environment only): ${scene.props}
Camera style: ${scene.cameraStyle}`;
}

function parseAgentJsonResponse(text: string): {
  creativeBrief?: string;
  isolationPrompt?: string;
  sceneBackgroundPrompt?: string;
  compositePrompt?: string;
  imageEditPrompt?: string;
} {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        // continue
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // continue
      }
    }
  }
  return {};
}

function buildScenePromptForInput(input: PhotoshootWizardInput): string {
  const platform = getPlatformPostType(input.platformPostTypeId)!;
  const view = getImageView(input.viewId)!;
  const scene = getScene(input.sceneId)!;
  return buildSceneBackgroundPrompt({
    sceneName: scene.sceneName,
    sceneDescription: scene.sceneDescription,
    lighting: scene.lighting,
    mood: scene.mood,
    colorPalette: scene.colorPalette,
    backgroundType: scene.backgroundType,
    props: scene.props,
    viewName: view.viewName,
    cameraAngle: view.cameraAngle,
    platformName: platform.platformName,
    aspectRatio: platform.aspectRatio,
  });
}

function buildPipelineAgentSteps(
  input: PhotoshootWizardInput,
  promptMethod: PhotoshootPromptMethod,
  imageModel: string
): PhotoshootAgentStep[] {
  const platform = getPlatformPostType(input.platformPostTypeId);
  const view = getImageView(input.viewId);
  const scene = getScene(input.sceneId);

  const steps: PhotoshootAgentStep[] = PHOTOSHOOT_PIPELINE_STEPS.map((s) => ({
    id: s.id,
    order: s.order,
    label: s.label,
    detail:
      s.id === "ai_backgrounds"
        ? scene?.sceneName
        : s.id === "remove_bg"
          ? input.productName
          : s.id === "fashion_model"
            ? "Skipped — product-only"
            : s.runtimePhase === "compose" && s.id === "ai_photoshoot"
              ? view ? `${view.viewName} · ${platform?.aspectRatio}` : undefined
              : undefined,
  }));

  steps.push({
    id: "prompt_method",
    order: 11,
    label: promptMethod === "cursor-agent" ? "Cursor agent composed prompts" : "Professional template prompts",
    detail: imageModel,
  });

  return steps;
}

function templatePlan(input: PhotoshootWizardInput): PhotoshootAgentPlan {
  const imageModel = getCursorImageModelLabel();
  const rulesPrompts = buildPhotoshootPrompts(input);
  const sceneBackgroundPrompt =
    rulesPrompts.sceneBackgroundPrompt || buildScenePromptForInput(input);

  return {
    creativeBrief: rulesPrompts.creativeBrief,
    isolationPrompt: rulesPrompts.isolationPrompt || ISOLATION_PROMPT,
    sceneBackgroundPrompt,
    compositePrompt: rulesPrompts.compositePrompt,
    sceneImagePrompt: rulesPrompts.sceneImagePrompt,
    negativePrompt: rulesPrompts.negativePrompt,
    selectionDetails: rulesPrompts.selectionDetails,
    imageEditPrompt: rulesPrompts.fullPrompt,
    promptMethod: "template",
    imageModel,
    agentSteps: buildPipelineAgentSteps(input, "template", imageModel),
  };
}

function planFromParsed(
  input: PhotoshootWizardInput,
  parsed: {
    creativeBrief?: string;
    isolationPrompt?: string;
    sceneBackgroundPrompt?: string;
    compositePrompt?: string;
    imageEditPrompt?: string;
  },
  promptMethod: PhotoshootPromptMethod
): PhotoshootAgentPlan {
  const imageModel = getCursorImageModelLabel();
  const platform = getPlatformPostType(input.platformPostTypeId);
  const rulesPrompts = buildPhotoshootPrompts(input);
  const sceneBackgroundPrompt =
    parsed.sceneBackgroundPrompt?.trim() || rulesPrompts.sceneBackgroundPrompt;
  const isolationPrompt = parsed.isolationPrompt?.trim() || rulesPrompts.isolationPrompt;
  const compositePrompt = parsed.compositePrompt?.trim() || rulesPrompts.compositePrompt;

  const brief =
    parsed.creativeBrief?.trim() ||
    rulesPrompts.creativeBrief ||
    `Professional 10-step photoshoot for ${input.productName} on ${platform?.platformName ?? "selected platform"}. Product preserved via compositing.`;

  const fullPrompt =
    parsed.imageEditPrompt?.trim() ||
    rulesPrompts.fullPrompt ||
    `ISOLATION:\n${isolationPrompt}\n\nSCENE (empty background, no product):\n${sceneBackgroundPrompt}\n\nCOMPOSITE:\n${rulesPrompts.compositePrompt}`;

  return {
    creativeBrief: brief,
    isolationPrompt,
    sceneBackgroundPrompt,
    compositePrompt,
    sceneImagePrompt: rulesPrompts.sceneImagePrompt,
    negativePrompt: rulesPrompts.negativePrompt,
    selectionDetails: rulesPrompts.selectionDetails,
    imageEditPrompt: fullPrompt,
    promptMethod,
    imageModel,
    agentSteps: buildPipelineAgentSteps(input, promptMethod, imageModel),
  };
}

export async function composePhotoshootAgentPlan(
  input: PhotoshootWizardInput,
  options?: { research?: string | null }
): Promise<PhotoshootAgentPlan> {
  if (isCursorConfigured()) {
    try {
      const raw = await composePhotoshootPromptWithCursor(
        buildStructuredUserMessage(input, options?.research)
      );
      const parsed = parseAgentJsonResponse(raw);
      if (parsed.sceneBackgroundPrompt?.trim() || parsed.isolationPrompt?.trim()) {
        return planFromParsed(input, parsed, "cursor-agent");
      }
      console.warn("Cursor agent returned incomplete prompts, using template");
    } catch (err) {
      console.warn("Cursor photoshoot agent failed, using template:", err);
    }
  }

  return templatePlan(input);
}
