/**
 * Per-step prompt metadata for the 10-step studio pipeline.
 * Defines, for EACH step:
 *  - which engine executes it (Cursor AI vs on-device studio engine — both Cursor-key-only project)
 *  - the negative prompts that apply at that level
 *  - where the positive prompt text comes from (agent plan field or deterministic operation text)
 *  - which regenerate phase a per-step "rerun" maps to
 */

export type StepEngine = "cursor" | "studio";

export type StepPromptSource =
  | "operation"
  | "isolation"
  | "creativeBrief"
  | "sceneImage"
  | "composite"
  | "skip";

export type StepRerunPhase = "isolate" | "scene" | "composite" | null;

/** Which engine performs the step. `cursor` = Cursor API generateImage. `studio` = deterministic on-device image engine (no extra API key). */
export const STEP_ENGINE: Record<string, StepEngine> = {
  upscale: "studio",
  remove_bg: "studio",
  ai_photoshoot: "cursor",
  ai_backgrounds: "cursor",
  ai_edit: "cursor",
  shadows: "studio",
  light_color: "studio",
  blur_bg: "studio",
  fashion_model: "studio",
  final: "studio",
};

export function stepEngineLabel(stepId: string): string {
  return STEP_ENGINE[stepId] === "cursor"
    ? "Cursor AI"
    : "Studio engine · no extra key";
}

/** Negative prompts written at EACH level — constraints the step must never violate. */
export const STEP_NEGATIVE_PROMPTS: Record<string, string[]> = {
  upscale: [
    "oversharpening halos",
    "plastic over-smoothed texture",
    "loss of material grain",
    "introduced noise or grain",
    "jpeg blocking artifacts",
    "color shift from source",
    "hallucinated detail not in source",
  ],
  remove_bg: [
    "white or solid background fill",
    "leftover background pixels",
    "cropped or clipped temple arms",
    "cut-off product edges",
    "halo or fringing on edges",
    "jagged alpha matte",
    "removed product parts",
    "baked-in background shadow",
    "redesigned or replaced product",
    "turning eyeglasses into sunglasses",
  ],
  ai_photoshoot: [
    "vague art direction",
    "inconsistent camera angle",
    "physically impossible lighting plan",
    "props placed in hero zone",
    "product described as altered",
  ],
  ai_backgrounds: [
    "any product in frame",
    "eyewear, bags, bottles or merchandise",
    "people, hands, mannequins",
    "text, logos, watermark",
    "cluttered foreground",
    "objects in the hero compositing zone",
    "duplicated or warped horizon",
    "unrealistic perspective",
    "flat lifeless lighting",
  ],
  ai_edit: [
    "redesigned product",
    "altered product color or materials",
    "warped product geometry",
    "sticker / pasted-on look",
    "visible hard cut-out edge",
    "lighting mismatch between product and scene",
    "plastic fake composite",
    "product floating off the surface",
  ],
  shadows: [
    "shadow detached from product",
    "wrong shadow direction vs key light",
    "omnidirectional glow halo",
    "floating product with no contact",
    "double or conflicting shadows",
    "crushed pure-black shadow",
  ],
  light_color: [
    "color cast that changes product identity",
    "blown-out highlights",
    "muddy crushed shadows",
    "oversaturation",
    "unrealistic white balance",
    "banding from grading",
  ],
  blur_bg: [
    "blurred product",
    "blurred product edges",
    "tilt-shift miniature effect",
    "uneven or busy bokeh",
    "blur halo bleeding onto product",
  ],
  fashion_model: [
    "any human in product-only mode",
    "altered product on a model",
    "hands touching product",
  ],
  final: [
    "letterboxing or pillarboxing",
    "product cropped at export",
    "upscaling artifacts",
    "color banding",
    "compression blockiness",
    "wrong aspect ratio",
  ],
};

export function getStepNegativePrompts(stepId: string): string[] {
  return STEP_NEGATIVE_PROMPTS[stepId] ?? [];
}

export function getStepNegativePromptText(stepId: string): string {
  return getStepNegativePrompts(stepId).join(", ");
}

/** De-duplicated negatives merged across several steps (for prompts that span multiple steps). */
export function getMergedStepNegatives(stepIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of stepIds) {
    for (const neg of getStepNegativePrompts(id)) {
      const key = neg.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(neg);
      }
    }
  }
  return out;
}

export function getMergedStepNegativeText(stepIds: string[]): string {
  return getMergedStepNegatives(stepIds).join(", ");
}

/** Steps 5–10 negatives — used by the composite/finish prompts. */
export const COMPOSITE_STEP_IDS = ["ai_edit", "shadows", "light_color", "blur_bg", "final"];

/** For deterministic (studio-engine) steps, describe the exact operation performed. */
export const STEP_OPERATION_PROMPT: Record<string, string> = {
  upscale:
    "Studio engine operation: analyze source resolution, apply lanczos upscale to platform-native size, denoise sensor grain, and sharpen micro-detail on product edges while preserving true material texture. Deterministic — no generative model, product pixels unchanged.",
  remove_bg:
    "Studio engine operation: local alpha-matting computes a precise foreground mask and applies it to the ORIGINAL product pixels. The product is never redrawn — shape, proportions, colors, logos, and edges stay exactly as the source photo from any angle. Output is a transparent PNG cutout. Deterministic, on-device, no generative model.",
  shadows:
    "Studio engine operation: derive a directional cast + contact shadow from the product alpha using the scene key-light angle, squash + blur onto the ground/surface plane, and composite under the product. Anchors the product so it never floats.",
  light_color:
    "Studio engine operation: split grade — (a) harmonize the whole scene white balance and color temperature to the scene mood, then (b) apply a masked environmental light-wrap on the product region only (warm rim on the lit side) WITHOUT changing product identity.",
  blur_bg:
    "Studio engine operation: build an elliptical sharp mask around the product, gaussian-blur the environment behind it for natural depth-of-field, and recomposite the sharp product on top.",
  final:
    "Studio engine operation: lanczos resize to exact platform resolution with safe-margin padding (never crops the product), final unsharp pass, and PNG export at catalog quality.",
  fashion_model:
    "Skipped in product-only mode — no human model is introduced. The product remains the sole hero on an environment-only plate.",
};

/** Where the positive prompt text for a step comes from. */
export const STEP_PROMPT_SOURCE: Record<string, StepPromptSource> = {
  upscale: "operation",
  remove_bg: "operation",
  ai_photoshoot: "creativeBrief",
  ai_backgrounds: "sceneImage",
  ai_edit: "composite",
  shadows: "operation",
  light_color: "operation",
  blur_bg: "operation",
  fashion_model: "skip",
  final: "operation",
};

/** Map a per-step "rerun" button to the regenerate phase that reproduces it. */
export function stepRerunPhase(stepId: string): StepRerunPhase {
  switch (stepId) {
    case "upscale":
    case "remove_bg":
      return "isolate";
    case "ai_backgrounds":
      return "scene";
    case "ai_edit":
    case "shadows":
    case "light_color":
    case "blur_bg":
    case "final":
      return "composite";
    default:
      // ai_photoshoot (recompose handled by parent) and fashion_model (skipped)
      return null;
  }
}

/** Append step negatives to an AI prompt as an explicit NEGATIVE block. */
export function withStepNegatives(prompt: string, stepId: string): string {
  const neg = getStepNegativePromptText(stepId);
  if (!neg) return prompt;
  return `${prompt}\n\nNEGATIVE — Step "${stepId}" must avoid: ${neg}`;
}
