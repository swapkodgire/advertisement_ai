import { PHOTOSHOOT_PIPELINE_STEPS } from "@/lib/photoshoot/pipeline-steps";
import type { GenerationProgressHandler, GenerationProgressPhase } from "@/lib/photoshoot/generation-progress";

export type PipelineStepStatus = "start" | "done" | "skip" | "error";

function legacyPhase(stepId: string, status: PipelineStepStatus): GenerationProgressPhase {
  const step = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === stepId);
  const phase = step?.runtimePhase ?? "composite";
  if (status === "done" || status === "skip") {
    if (phase === "compose") return "compose_done";
    if (phase === "isolate") return "isolate_done";
    if (phase === "scene") return "scene_done";
    if (phase === "post") return "finish_done";
    return "composite_done";
  }
  if (phase === "compose") return "compose_start";
  if (phase === "isolate") return "isolate_start";
  if (phase === "scene") return "scene_start";
  if (phase === "post") return "finish_start";
  return "composite_start";
}

function defaultMessage(stepId: string, status: PipelineStepStatus): string {
  const step = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === stepId);
  if (!step) return stepId;
  if (status === "skip") return `${step.label} — skipped`;
  if (status === "start") return `Step ${step.order}: ${step.label}…`;
  if (status === "error") return `${step.label} failed`;
  return `Step ${step.order}: ${step.label} complete`;
}

/** Emit granular progress for one of the 10 studio pipeline steps */
export function emitPipelineStep(
  emit: GenerationProgressHandler | undefined,
  stepId: string,
  status: PipelineStepStatus,
  opts?: {
    message?: string;
    detail?: string;
    previewUrl?: string;
    method?: string;
  }
): void {
  const step = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === stepId);
  if (!step || !emit) return;

  emit({
    phase: legacyPhase(stepId, status),
    stepId: step.id,
    stepOrder: step.order,
    stepLabel: step.label,
    stepStatus: status,
    message: opts?.message ?? defaultMessage(stepId, status),
    detail: opts?.detail ?? (status === "skip" ? "Skipped in product-only mode" : step.description),
    previewUrl: opts?.previewUrl,
    method: opts?.method,
  });
}

export function getStepByOrder(order: number) {
  return PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.order === order);
}
