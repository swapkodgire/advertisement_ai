/** Professional AI photoshoot pipeline — studio-grade workflow shown in UI and prompts */

export interface PhotoshootPipelineStep {
  id: string;
  order: number;
  label: string;
  shortLabel: string;
  description: string;
  /** Maps to runtime phase when applicable */
  runtimePhase?: "compose" | "isolate" | "scene" | "composite" | "post";
}

export const PHOTOSHOOT_PIPELINE_STEPS: PhotoshootPipelineStep[] = [
  {
    id: "upscale",
    order: 1,
    label: "Improve quality & upscale",
    shortLabel: "Upscale",
    description:
      "Analyze source resolution, denoise sensor grain, sharpen micro-detail on product edges, and upscale to platform-native resolution while preserving true material texture.",
    runtimePhase: "compose",
  },
  {
    id: "remove_bg",
    order: 2,
    label: "Remove background",
    shortLabel: "Remove BG",
    description:
      "Precise background removal with pixel-faithful product cutout, clean alpha edges, and preserved authentic product contact shadows.",
    runtimePhase: "isolate",
  },
  {
    id: "ai_photoshoot",
    order: 3,
    label: "AI Photoshoot",
    shortLabel: "Photoshoot",
    description:
      "Orchestrate the full studio shoot plan: camera angle, lens character, lighting diagram, and compositing intent for the selected platform format.",
    runtimePhase: "compose",
  },
  {
    id: "ai_backgrounds",
    order: 4,
    label: "AI backgrounds",
    shortLabel: "AI BG",
    description:
      "Generate a photorealistic empty environment plate — no products — matching scene mood, palette, and camera perspective for later compositing.",
    runtimePhase: "scene",
  },
  {
    id: "ai_edit",
    order: 5,
    label: "AI Edit",
    shortLabel: "AI Edit",
    description:
      "Retouch the composite: clean dust, refine edges, balance local contrast, and polish surfaces without altering product identity.",
    runtimePhase: "composite",
  },
  {
    id: "shadows",
    order: 6,
    label: "Add shadows",
    shortLabel: "Shadows",
    description:
      "Add physically accurate contact shadow, ambient occlusion, and directional cast shadow matching scene key light.",
    runtimePhase: "composite",
  },
  {
    id: "light_color",
    order: 7,
    label: "Fix light and colors",
    shortLabel: "Light & color",
    description:
      "Harmonize product white balance with scene illumination, match color temperature, and apply subtle grade for commercial consistency.",
    runtimePhase: "composite",
  },
  {
    id: "blur_bg",
    order: 8,
    label: "Blur background",
    shortLabel: "BG blur",
    description:
      "Apply natural depth-of-field separation — sharp hero product, gently softened environment bokeh for premium lens character.",
    runtimePhase: "composite",
  },
  {
    id: "fashion_model",
    order: 9,
    label: "AI fashion model",
    shortLabel: "Model",
    description:
      "Optional lifestyle context: when enabled, place product in believable human-scale scene (product remains unchanged; model is environment-only plate). Product-only mode skips this step.",
    runtimePhase: "post",
  },
  {
    id: "final",
    order: 10,
    label: "Final image generation",
    shortLabel: "Final",
    description:
      "Export at target resolution and aspect ratio with catalog-grade sharpness, correct ICC color, and platform-safe margins.",
    runtimePhase: "post",
  },
];

export function getPipelineStepLabels(): string[] {
  return PHOTOSHOOT_PIPELINE_STEPS.map((s) => s.label);
}

export function getPipelineWhatWeDo(sceneContext: string): string[] {
  return PHOTOSHOOT_PIPELINE_STEPS.map((step) => {
    if (step.id === "ai_backgrounds") {
      return `${step.label} — empty ${sceneContext} environment plate (no product in frame)`;
    }
    if (step.id === "remove_bg") {
      return `${step.label} — source product cutout, unchanged pixels`;
    }
    if (step.id === "fashion_model") {
      return `${step.label} — skipped in product-only pipeline (environment plate only)`;
    }
    return `${step.label} — ${step.description.split(".")[0]}`;
  });
}

/** Live generate UI — grouped runtime phases */
export const GENERATE_RUNTIME_STEPS = [
  { id: "compose", label: "Compose prompts", description: "Studio brief + 10-step pipeline instructions" },
  { id: "isolate", label: "Upscale & isolate", description: "Source enhance → Cursor AI cutout" },
  { id: "scene", label: "AI backgrounds", description: "Cursor empty scene — 3 retries, correct aspect ratio" },
  { id: "composite", label: "AI composite & finish", description: "Cursor relight → polish, color, DOF, export" },
] as const;
