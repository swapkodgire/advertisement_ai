import { PHOTOSHOOT_PIPELINE_STEPS } from "@/lib/photoshoot/pipeline-steps";
import type { GenerationProgressPhase } from "@/lib/photoshoot/generation-progress";
import type { PipelineStepStatus } from "@/lib/photoshoot/pipeline-progress";

export type PromptTabId =
  | "brief"
  | "pipeline"
  | "isolation"
  | "sceneBg"
  | "sceneImage"
  | "composite"
  | "negative"
  | "full";

export type PreviewKind = "isolated" | "scene" | "final";

/** Prompt tab that matches the prompt actively sent to the AI for each pipeline step */
export const STEP_TO_PROMPT_TAB: Record<string, PromptTabId> = {
  upscale: "isolation",
  remove_bg: "isolation",
  ai_photoshoot: "brief",
  ai_backgrounds: "sceneImage",
  ai_edit: "composite",
  shadows: "composite",
  light_color: "composite",
  blur_bg: "composite",
  fashion_model: "brief",
  final: "composite",
};

export const STEP_TO_PREVIEW: Record<string, PreviewKind | null> = {
  upscale: "isolated",
  remove_bg: "isolated",
  ai_backgrounds: "scene",
  ai_edit: "final",
  shadows: "final",
  light_color: "final",
  blur_bg: "final",
  final: "final",
};

/** Legacy phase events superseded by granular stepId events during full pipeline runs */
export const REDUNDANT_PROGRESS_PHASES = new Set<GenerationProgressPhase>([
  "compose_start",
  "scene_start",
  "composite_start",
  "finish_start",
  "finish_done",
  "composite_done",
]);

export function isPreviewLoading(
  preview: PreviewKind,
  activeStepId: string | undefined,
  regenerating: "isolate" | "scene" | "composite" | null
): boolean {
  if (preview === "isolated" && regenerating === "isolate") return true;
  if (preview === "scene" && regenerating === "scene") return true;
  if (preview === "final" && regenerating === "composite") return true;
  if (!activeStepId) return false;

  if (preview === "isolated") {
    return activeStepId === "upscale" || activeStepId === "remove_bg";
  }
  if (preview === "scene") {
    return activeStepId === "ai_backgrounds";
  }
  return ["ai_edit", "shadows", "light_color", "blur_bg", "final"].includes(activeStepId);
}

export function previewSubtitle(
  preview: PreviewKind,
  activeStepId: string | undefined,
  defaultSubtitle: string
): string {
  if (!activeStepId) return defaultSubtitle;
  const step = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === activeStepId);
  const target = STEP_TO_PREVIEW[activeStepId];
  if (!step || target !== preview) return defaultSubtitle;
  return `Step ${step.order} · ${step.label}…`;
}

export function shouldLogProgressActivity(
  data: {
    stepId?: string;
    stepStatus?: PipelineStepStatus;
    phase?: GenerationProgressPhase;
    message?: string;
  },
  mode: "full" | "isolate" | "scene" | "composite"
): boolean {
  if (data.stepId && data.stepStatus) {
    return data.stepStatus === "start" || data.stepStatus === "done" || data.stepStatus === "error";
  }
  if (mode === "full" && data.phase && REDUNDANT_PROGRESS_PHASES.has(data.phase)) {
    return false;
  }
  return Boolean(data.message);
}

export function activityLogEntry(data: {
  stepId?: string;
  stepOrder?: number;
  stepLabel?: string;
  stepStatus?: PipelineStepStatus;
  message?: string;
  detail?: string;
}): { message: string; detail?: string } {
  if (data.stepId && data.stepStatus) {
    const label = data.stepLabel ?? data.stepId;
    if (data.stepStatus === "start") {
      return {
        message: `Step ${data.stepOrder ?? "?"} · ${label}`,
        detail: data.detail ?? data.message,
      };
    }
    if (data.stepStatus === "done") {
      return {
        message: `Step ${data.stepOrder ?? "?"} · ${label} complete`,
        detail: data.detail ?? data.message,
      };
    }
    if (data.stepStatus === "skip") {
      return { message: `Step ${data.stepOrder ?? "?"} · ${label} skipped`, detail: data.detail };
    }
    return { message: `${label} failed`, detail: data.detail ?? data.message };
  }
  return { message: data.message ?? "Update", detail: data.detail };
}

export function resolvePreviewFromProgress(data: {
  stepId?: string;
  stepStatus?: PipelineStepStatus;
  phase?: GenerationProgressPhase;
  previewUrl?: string;
}): PreviewKind | null {
  if (!data.previewUrl) return null;

  if (data.stepId && data.stepStatus === "done") {
    return STEP_TO_PREVIEW[data.stepId] ?? null;
  }

  if (data.phase === "isolate_done") return "isolated";
  if (data.phase === "scene_done") return "scene";
  if (data.phase === "complete" || data.phase === "finish_done" || data.phase === "composite_done") {
    return "final";
  }

  return null;
}

export function initPipelineForGeneration(): {
  id: string;
  order: number;
  label: string;
  description: string;
  status: "pending" | "active";
}[] {
  return PHOTOSHOOT_PIPELINE_STEPS.map((s) => ({
    id: s.id,
    order: s.order,
    label: s.label,
    description: s.description,
    status: s.order === 1 ? ("active" as const) : ("pending" as const),
  }));
}
