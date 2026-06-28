import type { PhotoshootAgentPlan } from "@/lib/photoshoot/prompt-agent";
import type { PipelineStepStatus } from "@/lib/photoshoot/pipeline-progress";

export type GenerationProgressPhase =
  | "compose_start"
  | "compose_done"
  | "isolate_start"
  | "isolate_done"
  | "scene_start"
  | "scene_done"
  | "composite_start"
  | "composite_done"
  | "finish_start"
  | "finish_done"
  | "complete";

export interface GenerationProgressEvent {
  phase: GenerationProgressPhase;
  message: string;
  detail?: string;
  previewUrl?: string;
  method?: string;
  /** Granular 10-step pipeline tracking */
  stepId?: string;
  stepOrder?: number;
  stepLabel?: string;
  stepStatus?: PipelineStepStatus;
  agentPlan?: PhotoshootAgentPlan;
  prompts?: {
    isolationPrompt: string;
    sceneBackgroundPrompt: string;
    sceneImagePrompt: string;
    compositePrompt: string;
    negativePrompt: string;
    creativeBrief: string;
    fullPrompt: string;
  };
}

export type GenerationProgressHandler = (event: GenerationProgressEvent) => void;
