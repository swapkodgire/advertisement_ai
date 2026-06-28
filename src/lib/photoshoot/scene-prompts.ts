import { buildBrandContext } from "@/lib/cursor-server";
import { buildProductFramingPrompt } from "@/lib/image/product-framing";
import { getImageView } from "@/lib/data/image-views";
import { getPlatformPostType } from "@/lib/data/platform-post-types";
import { getScene } from "@/lib/data/scenes";
import { getBrandRulesText } from "@/lib/photoshoot/rules/brand-rules";
import { getGlobalRulesText } from "@/lib/photoshoot/rules/global-rules";
import { getNegativePromptsText } from "@/lib/photoshoot/rules/negative-prompts";
import { getPlatformRulesText } from "@/lib/photoshoot/rules/platform-rules";
import { getProductRulesText } from "@/lib/photoshoot/rules/product-rules";
import { PHOTOSHOOT_PIPELINE_STEPS } from "@/lib/photoshoot/pipeline-steps";
import {
  COMPOSITE_STEP_IDS,
  getMergedStepNegativeText,
  getStepNegativePromptText,
} from "@/lib/photoshoot/step-prompts";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";
import type { Scene } from "@/types";

export interface ProfessionalPromptContext {
  brandName: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  businessDNA: BusinessDNA;
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
}

function productSubjectPhrase(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("sunglass")) return "sunglasses frames and lenses";
  if (c.includes("lens") || c.includes("optical")) return "optical lenses and packaging";
  if (c.includes("bag") || c.includes("pouch") || c.includes("purse"))
    return "bag body, hardware, straps, and material surfaces";
  if (c.includes("eyewear") || c.includes("frame") || c.includes("glass"))
    return "optical frames — same frame shape, hinge geometry, lens cutouts, temple arms, material finish";
  return "product — same shape, materials, colors, labels, proportions, and every visible detail";
}

function cameraDirection(viewName: string, cameraAngle: string, aspectRatio: string): string {
  const v = viewName.toLowerCase();
  if (v.includes("top") || cameraAngle.includes("overhead"))
    return `strict overhead top-down camera angle for ${aspectRatio} vertical/horizontal composition`;
  if (v.includes("flat lay"))
    return `overhead flat-lay camera, 90° downward, centered composition for ${aspectRatio}`;
  if (v.includes("hero"))
    return `front hero camera at product eye-line, slight elevation, ${aspectRatio} advertising frame`;
  if (v.includes("profile"))
    return `side profile camera perpendicular to product, ${aspectRatio} format`;
  if (v.includes("macro") || v.includes("detail"))
    return `macro lens close-up with shallow depth of field, ${aspectRatio} crop`;
  return `${viewName} perspective — ${cameraAngle}, composed for ${aspectRatio} commercial delivery`;
}

function studioLightingBrief(scene: Scene): string {
  const { lighting, mood, colorPalette, backgroundType, sceneCategory } = scene;
  const base = `Lighting: ${lighting}. Mood: ${mood}. Palette: ${colorPalette}. Environment type: ${backgroundType}.`;

  const categoryNotes: Record<string, string> = {
    studio:
      "Use controlled studio key + fill + rim as needed; soft gradient falloff on seamless; specular control on reflective materials.",
    lifestyle:
      "Natural motivated light (window or practical); soft shadow transition; believable interior depth and color bounce.",
    outdoor:
      "Sun or golden-hour motivated direction; atmospheric perspective; realistic sky/ground color spill on surfaces.",
    luxury:
      "Quiet luxury: diffused directional light, tactile material emphasis, restrained contrast, premium editorial finish.",
    fashion:
      "Editorial fashion lighting — defined key, controlled shadow shape, high-end magazine quality.",
    seasonal:
      "Season-accurate color temperature and environmental cues without distracting props.",
    social:
      "Social-native lighting — direct flash or candid window light acceptable; authentic not over-retouched.",
    technical:
      "Clinical even illumination for optical accuracy; minimal glare; documentation-grade clarity.",
  };

  return `${base} ${categoryNotes[sceneCategory] ?? categoryNotes.studio}`;
}

function sceneEnvironmentDetail(scene: Scene): string {
  const propsLine =
    scene.props === "none"
      ? "No physical props in frame — pristine empty surface and environment only."
      : `Environmental styling only (no products): ${scene.props} — softly out of focus or at frame edge, never competing with hero placement zone.`;

  return `${scene.sceneDescription}. ${propsLine} Camera style reference: ${scene.cameraStyle.replace(/_/g, " ")}. Complexity: ${scene.complexity} set build.`;
}

function brandAccentGuidance(brandName: string, businessDNA: BusinessDNA): string {
  const ctx = buildBrandContext(businessDNA);
  const rules = getBrandRulesText(brandName, brandName);
  return `Brand: ${brandName}. ${ctx}\nBrand rules (environment/mood only — never alter product):\n${rules}\nIntroduce restrained brand color accents in ambient light, edge tone, or reflection glints only — not as physical branded objects on the product.`;
}

function buildOutdoorForegroundGuidance(scene: Scene): string {
  if (scene.sceneCategory !== "outdoor") return "";

  return `OUTDOOR GROUND PLANE (CRITICAL for compositing):
- Lower 35–45% of frame MUST show a clear, flat foreground surface (${scene.props !== "none" ? scene.props : "natural ground texture"}) where a product will rest
- Foreground surface is empty, unoccupied, and in sharp focus — ready for product placement on the ground
- Horizon line sits in upper half; sky/background above, textured ground/sand/surface below
- Sun direction: upper-left — design scene so cast shadows fall to lower-right on the foreground plane
- Do NOT place hero objects, rocks, or props in the center lower-third compositing zone`;
}

function buildCompositeIntegrationGuidance(scene: Scene): string {
  const profile =
    scene.sceneCategory === "outdoor"
      ? "Product sits ON the ground plane in lower third — not floating in sky. Directional sun shadow on surface."
      : scene.backgroundType.toLowerCase().includes("table") ||
          scene.props.toLowerCase().includes("marble")
        ? "Product rests ON the surface — contact shadow at base, matched window/studio light."
        : "Product anchored with realistic contact shadow — matched scene key light direction.";

  return `COMPOSITING INTEGRATION:
- ${profile}
- Lighting: ${scene.lighting} — add warm rim on sun-facing edges, cool fill in shadow side (environment only)
- Product identity unchanged — but allow environmental light wrap, edge highlights, and ground shadow`;
}

export function buildProfessionalIsolationPrompt(ctx: ProfessionalPromptContext): string {
  const subject = productSubjectPhrase(ctx.productCategory);
  const productRules = getProductRulesText(ctx.productCategory);
  const globalRules = getGlobalRulesText();
  const upscale = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === "upscale")!;
  const removeBg = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === "remove_bg")!;

  return `[PIPELINE: Step ${upscale.order} ${upscale.label} + Step ${removeBg.order} ${removeBg.label}]

Using the attached source photograph as the single source of truth, perform studio-grade product isolation on the ${ctx.productName} (${ctx.productCategory}).

SUBJECT TO PRESERVE (pixel-faithful — do NOT replace, redesign, recolor, enhance, or substitute):
${subject}

PRODUCT RULES:
${productRules}

STEP ${upscale.order} — ${upscale.label}:
${upscale.description} Target: commercial catalog sharpness on edges, hinges, logos, and material micro-texture.

STEP ${removeBg.order} — ${removeBg.label}:
Remove the entire background cleanly — all surfaces, clutter, furniture, environment, and shadows cast BY the background only. Retain natural product edge definition with accurate anti-aliasing (no halos, no fringing). Preserve authentic contact shadows and micro-shadows that belong to the product itself if present in source. Output a cutout of the original product on transparent background (alpha), ready for compositing.

GLOBAL INTEGRITY:
${globalRules}

NEGATIVE (avoid at isolation): ${getStepNegativePromptText("remove_bg")}

OUTPUT: Transparent PNG cutout — identical item, identical colors, identical shape, identical material finish as source photo.`;
}

export function buildProfessionalSceneBackgroundPrompt(ctx: ProfessionalPromptContext): string {
  const platform = getPlatformPostType(ctx.platformPostTypeId)!;
  const view = getImageView(ctx.viewId)!;
  const scene = getScene(ctx.sceneId)!;
  const platformRules = getPlatformRulesText(ctx.platformPostTypeId);
  const negativePrompt = `${getStepNegativePromptText("ai_backgrounds")}, ${getNegativePromptsText()}`;
  const aiBg = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === "ai_backgrounds")!;
  const blurBg = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === "blur_bg")!;

  const camera = cameraDirection(view.viewName, view.cameraAngle, platform.aspectRatio);
  const lighting = studioLightingBrief(scene);
  const environment = sceneEnvironmentDetail(scene);
  const brand = brandAccentGuidance(ctx.brandName, ctx.businessDNA);
  const framing = buildProductFramingPrompt({
    platformPostTypeId: ctx.platformPostTypeId,
    viewId: ctx.viewId,
    productCategory: ctx.productCategory,
    productName: ctx.productName,
  });
  const outdoorForeground = buildOutdoorForegroundGuidance(scene);
  const compositingZone =
    scene.sceneCategory === "outdoor"
      ? "lower-third ground plane — unoccupied foreground surface for product resting on sand/ground"
      : "center / upper-middle for portrait formats";

  return `[PIPELINE: Step ${aiBg.order} ${aiBg.label} + Step ${blurBg.order} ${blurBg.shortLabel} prep]

Generate an EMPTY ${scene.sceneName} environment background plate for ${platform.platformName} (${platform.aspectRatio}, ${platform.resolution}). This is Step ${aiBg.order} of the professional AI photoshoot pipeline — background plate ONLY.

CRITICAL — EMPTY SCENE (non-negotiable):
The scene contains NO products, NO ${ctx.productCategory} items, NO eyewear, NO bags, NO bottles, NO packaging heroes, NO people, NO hands, NO mannequins, NO text, NO logos, NO watermarks, and NO sellable merchandise anywhere in frame. The real product from the source upload will be composited in later — do not invent or include any product.

${framing}
${outdoorForeground}

CAMERA & COMPOSITION:
${camera}
View category: ${view.category}. Reserve the compositing safe zone: ${compositingZone}. Compose for ${platform.aspectRatio} safe margins with NO objects in the hero zone.

SCENE DIRECTOR BRIEF — ${scene.sceneName}:
${environment}

STUDIO LIGHTING & MOOD:
${lighting}

PLATFORM RULES:
${platformRules}

BRAND CONTEXT (environment only):
${brand}

DEPTH & LENS CHARACTER (Step ${blurBg.order} prep):
Design natural depth-of-field hierarchy — environment may carry subtle bokeh and atmospheric softness toward background planes while keeping the compositing zone sharp-ready. Premium commercial lens character (85mm–105mm product photography equivalent).

FINISH:
Photorealistic, high-end commercial photography and advertising quality. Shallow environmental depth where appropriate. Surface is pristine and unoccupied at the hero placement zone. Must look completely different from a desk photo or generic office — a purpose-built ${scene.backgroundType} environment.

NEGATIVE (avoid): ${negativePrompt}`;
}

export function buildProfessionalCreativeBrief(ctx: ProfessionalPromptContext): string {
  const platform = getPlatformPostType(ctx.platformPostTypeId)!;
  const view = getImageView(ctx.viewId)!;
  const scene = getScene(ctx.sceneId)!;

  return `Professional AI photoshoot brief for ${ctx.productName} (${ctx.productCategory}) on ${platform.platformName} (${platform.aspectRatio}, ${platform.resolution}).

Creative direction: ${view.viewName} (${view.cameraAngle}) in ${scene.sceneName} — ${scene.sceneDescription}. Mood: ${scene.mood}. Lighting: ${scene.lighting}. Palette: ${scene.colorPalette}.

Workflow: 10-step studio pipeline — upscale source → remove background → AI photoshoot plan → AI background plate → AI edit → shadows → light/color harmony → background depth → (optional model context skipped for product-only) → final export.

The product is isolated unchanged from the source upload and composited onto an empty ${scene.backgroundType} environment. Brand accents from ${ctx.brandName} appear in scene lighting and atmosphere only — never altering the product itself. Deliver catalog-grade, editorial-quality commercial photography.`;
}

export function buildProfessionalSceneImagePrompt(ctx: ProfessionalPromptContext): string {
  const platform = getPlatformPostType(ctx.platformPostTypeId)!;
  const view = getImageView(ctx.viewId)!;
  const scene = getScene(ctx.sceneId)!;
  const framing = buildProductFramingPrompt({
    platformPostTypeId: ctx.platformPostTypeId,
    viewId: ctx.viewId,
    productCategory: ctx.productCategory,
    productName: ctx.productName,
  });
  const outdoorForeground = buildOutdoorForegroundGuidance(scene);

  return `EMPTY professional photoshoot environment for ${platform.platformName} (${platform.aspectRatio}).

Scene: ${scene.sceneName} — ${scene.sceneDescription}
Environment: ${scene.backgroundType} | Lighting: ${scene.lighting} | Mood: ${scene.mood}
Colors: ${scene.colorPalette} | Env props only: ${scene.props}
Camera: ${view.viewName}, ${view.cameraAngle}

NO products, NO eyewear, NO bags, NO people, NO hands, NO text, NO logos.
${outdoorForeground}
Reserve empty compositing safe zone per framing rules below — unoccupied hero area only.
${framing}
Photorealistic commercial studio quality. Natural DOF / bokeh in deep background.

NEGATIVE (avoid): ${getStepNegativePromptText("ai_backgrounds")}`;
}

export function buildProfessionalCompositePrompt(ctx: ProfessionalPromptContext): string {
  const platform = getPlatformPostType(ctx.platformPostTypeId)!;
  const view = getImageView(ctx.viewId)!;
  const scene = getScene(ctx.sceneId)!;
  const steps = PHOTOSHOOT_PIPELINE_STEPS.filter((s) =>
    ["ai_edit", "shadows", "light_color", "blur_bg", "final"].includes(s.id)
  );
  const framing = buildProductFramingPrompt({
    platformPostTypeId: ctx.platformPostTypeId,
    viewId: ctx.viewId,
    productCategory: ctx.productCategory,
    productName: ctx.productName,
  });
  const integration = buildCompositeIntegrationGuidance(scene);

  const stepBlock = steps
    .map((s) => `Step ${s.order} — ${s.label}: ${s.description}`)
    .join("\n");

  return `[PIPELINE: Steps 5–10 Composite & Final Export]

Composite the isolated ${ctx.productName} (unchanged pixels from source) onto the empty ${scene.sceneName} background plate.

${framing}

${integration}

PLACEMENT REFERENCE:
- Use draft composite image #3 as scale and position guide — product on ground/surface, NOT floating in sky
- ${view.viewName} camera angle — product fully visible, never clipped by frame edges
- Scale product DOWN rather than crop — entire product must fit inside safe margins for ${platform.aspectRatio}
- Match ${scene.lighting}: directional cast shadow on ground/surface toward lower-right

${stepBlock}

Platform output: ${platform.platformName} ${platform.resolution} (${platform.aspectRatio}).
Match scene key light direction for contact shadow. Harmonize product white balance to ${scene.lighting} / ${scene.colorPalette}.
Product must remain pixel-faithful — no redesign, no replacement, no color shift on product materials.
Do NOT zoom, reframe, or crop the product out of frame during relight or export.

NEGATIVE (avoid across steps 5–10): ${getMergedStepNegativeText(COMPOSITE_STEP_IDS)}`;
}

export function buildProfessionalFullPrompt(ctx: ProfessionalPromptContext): string {
  const isolation = buildProfessionalIsolationPrompt(ctx);
  const scene = buildProfessionalSceneBackgroundPrompt(ctx);
  const composite = buildProfessionalCompositePrompt(ctx);
  const pipelineOverview = PHOTOSHOOT_PIPELINE_STEPS.map(
    (s) => `${s.order}. ${s.label} — ${s.description}`
  ).join("\n");

  return `=== PROFESSIONAL AI PHOTOSHOOT — 10-STEP PIPELINE ===
${pipelineOverview}

=== CREATIVE BRIEF ===
${buildProfessionalCreativeBrief(ctx)}

=== ${isolation.split("\n")[0]} ===
${isolation}

=== ${scene.split("\n")[0]} ===
${scene}

=== COMPOSITE & FINAL ===
${composite}`;
}

export function buildProfessionalNegativePrompt(): string {
  return getNegativePromptsText();
}
