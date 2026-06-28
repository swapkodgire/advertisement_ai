"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Download,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  Zap,
  AlertCircle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  X,
  Maximize2,
  Pencil,
  Send,
} from "lucide-react";
import { PrimaryButton } from "@/components/layout/DashboardLayout";
import type { PhotoshootAgentPlan } from "@/lib/photoshoot/prompt-agent";
import type { GenerationProgressPhase } from "@/lib/photoshoot/generation-progress";
import { PHOTOSHOOT_PIPELINE_STEPS } from "@/lib/photoshoot/pipeline-steps";
import type { PipelineStepStatus } from "@/lib/photoshoot/pipeline-progress";
import {
  activityLogEntry,
  initPipelineForGeneration,
  isPreviewLoading,
  resolvePreviewFromProgress,
  shouldLogProgressActivity,
} from "@/lib/photoshoot/pipeline-ui-sync";
import {
  getStepNegativePromptText,
  stepEngineLabel,
  STEP_ENGINE,
  STEP_OPERATION_PROMPT,
  STEP_PROMPT_SOURCE,
  stepRerunPhase,
} from "@/lib/photoshoot/step-prompts";
import { extractProductIdFromFileUrl } from "@/lib/photoshoot/product-id";
import type {
  BusinessDNA,
  GeneratedImage,
  ImageViewId,
  PlatformPostTypeId,
  SceneId,
} from "@/types";
import { cn } from "@/lib/utils";

interface PhotoshootConfig {
  cursorAgent: boolean;
  cursorImage: boolean;
  imageModel: string;
}

type PipelineMode = "standard" | "pro";

type StepStatus = "pending" | "active" | "complete" | "error";

interface PipelineStepState {
  id: string;
  order: number;
  label: string;
  description: string;
  status: StepStatus;
  detail?: string;
  previewUrl?: string;
  skipped?: boolean;
}

interface PromptBundle {
  creativeBrief: string;
  isolationPrompt: string;
  sceneBackgroundPrompt: string;
  compositePrompt: string;
  sceneImagePrompt: string;
  negativePrompt: string;
  fullPrompt: string;
}

interface PhotoshootGenerateStepProps {
  brandId: string;
  productId: string;
  brandName: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  businessDNA: BusinessDNA;
  platformId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
  originalUrl: string | null;
  agentPlan: PhotoshootAgentPlan | null;
  planLoading: boolean;
  config: PhotoshootConfig | null;
  platformLabel: string;
  platformMeta: string;
  viewLabel: string;
  sceneLabel: string;
  sceneMeta: string;
  generatedResults: GeneratedImage[];
  onGenerated: (image: GeneratedImage, message: string) => void;
  onError: (msg: string | null) => void;
  onAgentPlanUpdate: (plan: PhotoshootAgentPlan) => void;
}

const TOTAL_STEPS = PHOTOSHOOT_PIPELINE_STEPS.length;

const STEP_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  PHOTOSHOOT_PIPELINE_STEPS.map((s) => [s.id, s.shortLabel])
);

const META_PROMPT_TABS = [
  { id: "brief", label: "Brief" },
  { id: "plan", label: "10-step plan" },
  { id: "full", label: "Full prompt" },
] as const;

type RegeneratePhase = "isolate" | "scene" | "composite";

/** Resolve the positive prompt text for a single pipeline step. */
function resolveStepPositive(
  stepId: string,
  prompts: PromptBundle | null
): string {
  const source = STEP_PROMPT_SOURCE[stepId] ?? "operation";
  if (source === "operation") return STEP_OPERATION_PROMPT[stepId] ?? "";
  if (source === "skip") return STEP_OPERATION_PROMPT.fashion_model ?? "";
  if (!prompts) return "";
  switch (source) {
    case "isolation":
      return prompts.isolationPrompt;
    case "creativeBrief":
      return prompts.creativeBrief;
    case "sceneImage":
      return prompts.sceneImagePrompt || prompts.sceneBackgroundPrompt;
    case "composite":
      return prompts.compositePrompt;
    default:
      return "";
  }
}

interface PipelineSession {
  genId: string;
  sceneBgFilename: string;
}

/**
 * Steps shown as cards in "Step-by-step output". Only steps that produce a
 * distinct, meaningful visual are kept — the rest (planning + finishing passes
 * like shadows/light/blur/final) are redundant here; the final image lives in
 * the "Final Design" section below.
 */
const OUTPUT_STEP_IDS = ["upscale", "remove_bg", "ai_backgrounds", "ai_edit"];

const QUICK_FLOW_STEPS = [
  { id: "brief", label: "AI brief", sub: "LLM prompt" },
  { id: "generate", label: "AI generate", sub: "Single-shot scene" },
  { id: "finish", label: "Finish & export", sub: "Polish + platform size" },
] as const;

type QuickFlowPhase = "idle" | "brief" | "generate" | "finish" | "done";

/** Compact minimal rail shown in Standard (quick) mode. */
function QuickFlowRail({
  phase,
}: {
  phase: QuickFlowPhase;
}) {
  const phaseOrder: QuickFlowPhase[] = ["brief", "generate", "finish"];
  const activeIdx = phase === "done" ? 3 : Math.max(0, phaseOrder.indexOf(phase));

  return (
    <div className="flex items-stretch gap-2">
      {QUICK_FLOW_STEPS.map((step, i) => {
        const done = phase === "done" || i < activeIdx;
        const active = phase !== "done" && phaseOrder[activeIdx] === step.id;
        return (
          <div key={step.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all",
                active
                  ? "border-accent/40 bg-accent/5"
                  : done
                    ? "border-[var(--success)]/30 bg-[var(--success-bg)]/40"
                    : "border-border/40 bg-white/40"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  active
                    ? "bg-accent text-white shadow-md shadow-accent/30"
                    : done
                      ? "bg-[var(--success-bg)] text-[var(--success)]"
                      : "bg-white/70 text-muted"
                )}
              >
                {active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold leading-tight">{step.label}</p>
                <p className="truncate text-[9px] text-muted">{step.sub}</p>
              </div>
            </div>
            {i < QUICK_FLOW_STEPS.length - 1 && (
              <span className="hidden h-0.5 w-4 shrink-0 rounded bg-border/50 sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function initTenStepPipeline(activeOrder = 0): PipelineStepState[] {
  return PHOTOSHOOT_PIPELINE_STEPS.map((s) => ({
    id: s.id,
    order: s.order,
    label: s.label,
    description: s.description,
    status:
      activeOrder > 0
        ? s.order < activeOrder
          ? "complete"
          : s.order === activeOrder
            ? "active"
            : "pending"
        : "pending",
  }));
}

function promptsFromPlan(plan: PhotoshootAgentPlan | null): PromptBundle | null {
  if (!plan) return null;
  return {
    creativeBrief: plan.creativeBrief,
    isolationPrompt: plan.isolationPrompt,
    sceneBackgroundPrompt: plan.sceneBackgroundPrompt,
    compositePrompt: plan.compositePrompt ?? "",
    sceneImagePrompt: plan.sceneImagePrompt ?? "",
    negativePrompt: plan.negativePrompt ?? "",
    fullPrompt: plan.imageEditPrompt,
  };
}

export function PhotoshootGenerateStep({
  brandId,
  productId,
  brandName,
  productName,
  productCategory,
  productDescription,
  businessDNA,
  platformId,
  viewId,
  sceneId,
  originalUrl,
  agentPlan,
  planLoading,
  config,
  platformLabel,
  platformMeta,
  viewLabel,
  sceneLabel,
  sceneMeta,
  generatedResults,
  onGenerated,
  onError,
  onAgentPlanUpdate,
}: PhotoshootGenerateStepProps) {
  const [generating, setGenerating] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStepState[]>(() => initTenStepPipeline(0));
  const [activityLog, setActivityLog] = useState<{ time: string; message: string; detail?: string }[]>([]);
  const [promptView, setPromptView] = useState<string>("upscale");
  const [prompts, setPrompts] = useState<PromptBundle | null>(() => promptsFromPlan(agentPlan));
  const [isolatedPreview, setIsolatedPreview] = useState<string | null>(null);
  const [scenePreview, setScenePreview] = useState<string | null>(null);
  const [finalPreview, setFinalPreview] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<PipelineSession | null>(null);
  const [regeneratingPhase, setRegeneratingPhase] = useState<RegeneratePhase | null>(null);
  const [compositeStale, setCompositeStale] = useState(false);
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("standard");
  const [quickFlowPhase, setQuickFlowPhase] = useState<QuickFlowPhase>("idle");
  const [isolationMethod, setIsolationMethod] = useState<string | null>(null);
  const [compositeMethod, setCompositeMethod] = useState<string | null>(null);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyText, setModifyText] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const effectiveProductId = useMemo(
    () => extractProductIdFromFileUrl(originalUrl) || productId,
    [originalUrl, productId]
  );

  useEffect(() => {
    if (!brandId || !effectiveProductId) return;
    let cancelled = false;

    async function loadExistingAssets() {
      try {
        const res = await fetch(`/api/photoshoot/${brandId}/${effectiveProductId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();

        if (data.isolatedUrl && !isolatedPreview) {
          setIsolatedPreview(data.isolatedUrl);
        }

        const latestGen = data.generations?.[0];
        if (latestGen?.id) {
          const genId = latestGen.id as string;
          const sceneBgFilename = `${genId}-scene-bg.png`;
          setSession((prev) => prev ?? { genId, sceneBgFilename });
          if (!finalPreview) setFinalPreview(latestGen.url);

          const fileUrl = (folder: "raw" | "generated", name: string) =>
            `/api/files/${brandId}/${effectiveProductId}/${folder}/${name}`;
          const sceneUrl = fileUrl("generated", sceneBgFilename);

          // Restore each step's output thumbnail from disk so the strip survives reloads
          const stepFiles: Record<string, string> = {
            upscale: fileUrl("raw", "source-enhanced.png"),
            remove_bg: data.isolatedUrl ?? fileUrl("raw", "product-isolated.png"),
            ai_backgrounds: sceneUrl,
            ai_edit: fileUrl("generated", `${genId}-step-ai_edit.png`),
            shadows: fileUrl("generated", `${genId}-step-shadows.png`),
            light_color: fileUrl("generated", `${genId}-step-light_color.png`),
            blur_bg: fileUrl("generated", `${genId}-step-blur_bg.png`),
            final: latestGen.url ?? fileUrl("generated", `${genId}.png`),
          };

          const checks = await Promise.all(
            Object.entries(stepFiles).map(async ([id, url]) => {
              try {
                const r = await fetch(url, { method: "HEAD" });
                return [id, r.ok ? url : null] as const;
              } catch {
                return [id, null] as const;
              }
            })
          );
          if (cancelled) return;
          const available = Object.fromEntries(checks) as Record<string, string | null>;

          if (!scenePreview && available.ai_backgrounds) setScenePreview(available.ai_backgrounds);

          setPipeline((prev) =>
            prev.map((s) => {
              if (s.id === "fashion_model") {
                return { ...s, status: "complete" as StepStatus, skipped: true };
              }
              const restored =
                available[s.id] ?? (s.id === "upscale" ? originalUrl ?? undefined : undefined);
              return {
                ...s,
                status: "complete" as StepStatus,
                previewUrl: restored ?? s.previewUrl,
              };
            })
          );
        }
      } catch {
        // ignore — fresh session
      }
    }

    void loadExistingAssets();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, effectiveProductId]);

  useEffect(() => {
    if (agentPlan) setPrompts(promptsFromPlan(agentPlan));
  }, [agentPlan]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activityLog]);

  const promptPanel = useMemo(() => {
    // Meta views
    if (promptView === "brief") {
      return { title: "Creative brief", positive: prompts?.creativeBrief ?? "", negative: "", engine: null as string | null };
    }
    if (promptView === "plan") {
      const positive =
        agentPlan?.agentSteps
          .filter((s) => s.order <= 10)
          .map((s) => `${s.order}. ${s.label}${s.detail ? `\n   ${s.detail}` : ""}`)
          .join("\n\n") ?? "";
      return { title: "10-step plan", positive, negative: "", engine: null };
    }
    if (promptView === "full") {
      return { title: "Full prompt", positive: prompts?.fullPrompt ?? "", negative: prompts?.negativePrompt ?? "", engine: null };
    }
    // Per-step view
    const step = PHOTOSHOOT_PIPELINE_STEPS.find((s) => s.id === promptView);
    if (!step) return { title: "Prompt", positive: "", negative: "", engine: null };
    return {
      title: `Step ${step.order} · ${step.label}`,
      positive: resolveStepPositive(step.id, prompts),
      negative: getStepNegativePromptText(step.id),
      engine: stepEngineLabel(step.id),
    };
  }, [promptView, prompts, agentPlan?.agentSteps]);

  const copyText = useMemo(() => {
    const neg = promptPanel.negative ? `\n\nNEGATIVE (avoid):\n${promptPanel.negative}` : "";
    return `${promptPanel.positive}${neg}`.trim();
  }, [promptPanel]);

  const activeStep = pipeline.find((s) => s.status === "active");
  const completedSteps = pipeline.filter((s) => s.status === "complete" || s.skipped).length;
  const progressPct =
    generating || agentPlan
      ? Math.round((completedSteps / TOTAL_STEPS) * 100)
      : 0;

  const pushLog = (message: string, detail?: string) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setActivityLog((prev) => [...prev.slice(-20), { time, message, detail }]);
  };

  const updateTenStepPipeline = useCallback((data: {
    stepId?: string;
    stepOrder?: number;
    stepStatus?: PipelineStepStatus;
    detail?: string;
    message?: string;
    previewUrl?: string;
  }) => {
    if (!data.stepId || !data.stepStatus) return null;

    let nextActiveStepId: string | null = null;

    setPipeline((prev) =>
      prev.map((step) => {
        if (step.id === data.stepId) {
          const status: StepStatus =
            data.stepStatus === "start"
              ? "active"
              : data.stepStatus === "done"
                ? "complete"
                : data.stepStatus === "skip"
                  ? "complete"
                  : "error";
          if (status === "active") nextActiveStepId = step.id;
          return {
            ...step,
            status,
            skipped: data.stepStatus === "skip",
            detail: data.detail ?? data.message ?? step.detail,
            previewUrl: data.previewUrl ?? step.previewUrl,
          };
        }

        if (data.stepOrder && data.stepStatus === "start" && step.order < data.stepOrder) {
          if (step.status === "pending" || step.status === "active") {
            return { ...step, status: "complete" as StepStatus };
          }
        }

        if (step.status === "active" && data.stepStatus === "start" && step.id !== data.stepId) {
          return { ...step, status: "complete" as StepStatus };
        }

        return step;
      })
    );

    return nextActiveStepId ?? data.stepId;
  }, []);

  const applyPreviewFromProgress = useCallback(
    (data: {
      stepId?: string;
      stepStatus?: PipelineStepStatus;
      phase?: GenerationProgressPhase;
      previewUrl?: string;
      method?: string;
    }) => {
      const target = resolvePreviewFromProgress({
        stepId: data.stepId,
        stepStatus: data.stepStatus,
        phase: data.phase,
        previewUrl: data.previewUrl,
      });
      if (!target || !data.previewUrl) return;

      if (target === "isolated") {
        setIsolatedPreview(data.previewUrl);
        if (data.method) setIsolationMethod(String(data.method));
      } else if (target === "scene") {
        setScenePreview(data.previewUrl);
      } else if (target === "final") {
        setFinalPreview(data.previewUrl);
        if (data.method) setCompositeMethod(String(data.method));
      }
    },
    []
  );

  const handleProgressEvent = useCallback(
    (
      data: {
        stepId?: string;
        stepOrder?: number;
        stepLabel?: string;
        stepStatus?: PipelineStepStatus;
        phase?: GenerationProgressPhase;
        message?: string;
        detail?: string;
        previewUrl?: string;
        method?: string;
        agentPlan?: PhotoshootAgentPlan;
        prompts?: PromptBundle;
      },
      mode: "full" | RegeneratePhase
    ) => {
      if (data.stepId && data.stepStatus) {
        const activeId = updateTenStepPipeline(data);

        if (data.stepStatus === "start") {
          setPromptView(data.stepId);
        }

        if (data.stepStatus === "start" && activeId === "remove_bg" && mode === "isolate") {
          setCompositeStale(true);
        }
        if (data.stepStatus === "start" && activeId === "ai_backgrounds" && mode === "scene") {
          setCompositeStale(true);
        }
      }

      applyPreviewFromProgress(data);

      if (data.phase === "isolate_done" && data.previewUrl) {
        setIsolatedPreview(data.previewUrl);
        if (data.method) setIsolationMethod(String(data.method));
        if (mode === "isolate") setCompositeStale(true);
      }
      if (data.phase === "scene_done" && data.previewUrl) {
        setScenePreview(data.previewUrl);
        if (mode === "scene") setCompositeStale(true);
      }
      if (
        data.previewUrl &&
        (data.phase === "composite_done" || data.phase === "finish_done" || data.phase === "complete")
      ) {
        setFinalPreview(data.previewUrl);
        if (mode === "composite" || mode === "full") setCompositeStale(false);
      }
      if (data.method && (data.phase === "composite_done" || data.phase === "complete")) {
        setCompositeMethod(String(data.method));
      }

      if (shouldLogProgressActivity(data, mode)) {
        const entry = activityLogEntry(data);
        pushLog(entry.message, entry.detail);
      }

      if (data.agentPlan) onAgentPlanUpdate(data.agentPlan);
      if (data.prompts) setPrompts(data.prompts);

      if (pipelineMode === "standard") {
        if (data.phase === "compose_start") setQuickFlowPhase("brief");
        else if (data.phase === "compose_done") setQuickFlowPhase("generate");
        else if (data.phase === "composite_start") setQuickFlowPhase("generate");
        else if (data.phase === "finish_start") setQuickFlowPhase("finish");
        else if (data.phase === "complete") setQuickFlowPhase("done");
      }
    },
    [applyPreviewFromProgress, onAgentPlanUpdate, updateTenStepPipeline, pipelineMode]
  );

  const processStream = async (res: Response, mode: "full" | RegeneratePhase) => {
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error ?? "Generation failed");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Streaming not supported");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const chunk of lines) {
        const line = chunk.trim();
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));

        if (data.type === "progress") {
          handleProgressEvent(data, mode);
        }

        if (data.type === "done") {
          pushLog("Done!", data.message);
          setGenMessage(data.message);

          if (data.genId && data.sceneBgFilename) {
            setSession({ genId: data.genId, sceneBgFilename: data.sceneBgFilename });
          } else if (data.id && data.meta?.filename) {
            const genId = data.id as string;
            setSession({ genId, sceneBgFilename: `${genId}-scene-bg.png` });
          }

          if (data.agentPlan) onAgentPlanUpdate(data.agentPlan);
          if (data.isolatedUrl) setIsolatedPreview(data.isolatedUrl);
          if (data.sceneBgUrl) setScenePreview(data.sceneBgUrl);

          if (data.url) {
            setFinalPreview(data.url);
            setCompositeStale(false);

            const image: GeneratedImage = {
              id: data.id,
              url: data.url,
              platformPostTypeId: platformId,
              viewId,
              sceneId,
              type: "photoshoot",
              createdAt: data.meta?.createdAt ?? new Date().toISOString(),
              resolution: data.meta?.resolution,
            };
            onGenerated(image, data.message);
          }

          if (mode === "full") {
            setPipeline((prev) => prev.map((s) => ({ ...s, status: "complete" as StepStatus })));
          }
        }

        if (data.type === "error") {
          throw new Error(data.error);
        }
      }
    }
  };

  const buildPayload = () => ({
    brandId,
    productId: effectiveProductId,
    brandName,
    productName,
    productCategory,
    productDescription,
    businessDNA,
    platformPostTypeId: platformId,
    viewId,
    sceneId,
    pipelineMode,
    stream: true,
    genId: session?.genId,
    sceneBgFilename: session?.sceneBgFilename,
    sceneImagePrompt: prompts?.sceneImagePrompt,
    agentPlan: agentPlan ?? undefined,
  });

  const canGenerateStandard = Boolean(config?.cursorImage);
  const canGeneratePro = Boolean(config?.cursorImage);
  const canGenerate =
    pipelineMode === "pro" ? canGeneratePro : canGenerateStandard;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !effectiveProductId) return;
    setGenerating(true);
    setRegeneratingPhase(null);
    onError(null);
    setGenMessage(null);
    setIsolatedPreview(null);
    setScenePreview(null);
    setFinalPreview(null);
    setCompositeStale(false);
    setActivityLog([]);
    if (pipelineMode === "pro") {
      setPipeline(initPipelineForGeneration());
      setPromptView("upscale");
    } else {
      setQuickFlowPhase("brief");
    }

    pushLog(`Starting ${pipelineMode === "pro" ? "Pro" : "Standard"} pipeline…`);

    try {
      const res = await fetch("/api/photoshoot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      await processStream(res, "full");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      onError(msg);
      pushLog("Error", msg);
      setPipeline((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
      );
    } finally {
      setGenerating(false);
    }
  }, [
    brandId,
    effectiveProductId,
    brandName,
    productName,
    productCategory,
    productDescription,
    businessDNA,
    platformId,
    viewId,
    sceneId,
    config?.cursorImage,
    session,
    prompts?.sceneImagePrompt,
    agentPlan,
    pipelineMode,
    onError,
    onGenerated,
    onAgentPlanUpdate,
  ]);

  const handleRegenerate = useCallback(
    async (phase: RegeneratePhase, modifyInstruction?: string) => {
      if (!effectiveProductId) return;
      if (phase !== "isolate" && !config?.cursorImage) return;
      if (phase === "composite" && !session) {
        onError("Run a full generation first, or regenerate the scene before compositing.");
        return;
      }
      if (phase === "scene" && !agentPlan && !prompts?.sceneImagePrompt) {
        onError("Prompts not ready — wait for composition to finish.");
        return;
      }

      setRegeneratingPhase(phase);
      onError(null);
      pushLog(
        modifyInstruction ? "Applying modification…" : `Regenerating ${phase}…`,
        modifyInstruction ?? "Same platform, view & scene — new variation"
      );

      try {
        const res = await fetch("/api/photoshoot/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...buildPayload(), phase, modifyInstruction }),
        });
        await processStream(res, phase);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Regeneration failed";
        onError(msg);
        pushLog("Error", msg);
      } finally {
        setRegeneratingPhase(null);
      }
    },
    [
      effectiveProductId,
      config?.cursorImage,
      session,
      agentPlan,
      prompts?.sceneImagePrompt,
      onError,
      brandId,
      brandName,
      productName,
      productCategory,
      productDescription,
      businessDNA,
      platformId,
      viewId,
      sceneId,
      pipelineMode,
      onGenerated,
      onAgentPlanUpdate,
    ]
  );

  const stepRerunReady = useCallback(
    (stepId: string): boolean => {
      const phase = stepRerunPhase(stepId);
      if (!phase) return false;
      if (phase === "isolate") return Boolean(originalUrl);
      if (phase === "scene") return Boolean(config?.cursorImage && agentPlan);
      return Boolean(session && isolatedPreview && scenePreview);
    },
    [originalUrl, config?.cursorImage, agentPlan, session, isolatedPreview, scenePreview]
  );

  const handleStepRerun = useCallback(
    (stepId: string) => {
      const phase = stepRerunPhase(stepId);
      if (phase) void handleRegenerate(phase);
    },
    [handleRegenerate]
  );

  const handleApplyModify = useCallback(() => {
    const text = modifyText.trim();
    if (!text) return;
    setShowFinalModal(false);
    setModifyOpen(false);
    void handleRegenerate("composite", text);
    setModifyText("");
  }, [modifyText, handleRegenerate]);

  const stepContextLabel = useCallback(
    (stepId: string): string | null => {
      switch (stepId) {
        case "remove_bg":
          return productName;
        case "ai_photoshoot":
          return `${viewLabel} · ${platformMeta}`;
        case "ai_backgrounds":
          return sceneLabel;
        case "fashion_model":
          return "Skipped — product-only";
        case "final":
          return platformMeta;
        default:
          return null;
      }
    },
    [productName, viewLabel, platformMeta, sceneLabel]
  );

  const copyPrompt = async () => {
    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayFinal = finalPreview ?? generatedResults[0]?.url ?? null;
  const busy = generating || regeneratingPhase !== null;

  return (
    <section className="space-y-5">
      {/* ===== HERO HEADER ===== */}
      <div className="glass-card overflow-hidden !p-0">
        <div className="border-b border-border/30 bg-gradient-to-br from-accent/8 via-transparent to-[#5856d6]/8 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#5856d6] text-white shadow-lg shadow-accent/25">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold leading-tight tracking-tight">Generate Photoshoot</h2>
                  <p className="text-[11px] text-muted">
                    {pipelineMode === "pro"
                      ? "Pro · Deep agentic research + full 10-step studio pipeline"
                      : "Standard · Quick LLM single-shot generation"}
                  </p>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <SummaryChip label={platformLabel} sub={platformMeta} />
                <SummaryChip label={sceneLabel} sub={sceneMeta} />
                <SummaryChip label="Product" sub="Kept exactly as shot" />
                {isolationMethod && <SummaryChip label="Isolation" sub={isolationMethod} />}
                {compositeMethod && <SummaryChip label="Composite" sub={compositeMethod} />}
              </div>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:min-w-[260px]">
              {config && (
                <div className="flex flex-wrap justify-end gap-2">
                  <StatusPill ok={config.cursorAgent} label="Cursor agent" />
                  <StatusPill ok={config.cursorImage} label={config.imageModel} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <ModeToggle
                  active={pipelineMode === "standard"}
                  onClick={() => setPipelineMode("standard")}
                  label="Standard"
                  sub="Quick · LLM"
                />
                <ModeToggle
                  active={pipelineMode === "pro"}
                  onClick={() => setPipelineMode("pro")}
                  label="Pro"
                  sub="Research + studio"
                  disabled={!config?.cursorImage}
                />
              </div>
              <PrimaryButton
                onClick={handleGenerate}
                disabled={
                  busy ||
                  !canGenerate ||
                  (pipelineMode === "pro" && (planLoading || !agentPlan))
                }
                className="justify-center py-3 text-sm shadow-lg shadow-accent/20"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running pipeline…
                  </>
                ) : planLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing prompts…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Photoshoot
                  </>
                )}
              </PrimaryButton>
              {!canGenerate && (
                <p className="text-right text-[10px] text-warning">
                  Add CURSOR_API_KEY to .env.local — the only key required
                </p>
              )}
              {genMessage && (
                <p className="flex items-center justify-end gap-1 text-right text-[10px] text-[var(--success)]">
                  <CheckCircle2 className="h-3 w-3" />
                  {genMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline / quick-flow rail */}
        <div className="px-6 py-4">
          <div className="mb-2.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted">
            <span>
              {pipelineMode === "pro"
                ? generating && activeStep
                  ? `Step ${activeStep.order}/${TOTAL_STEPS} · ${activeStep.label}`
                  : "Deep research + 10-step studio pipeline"
                : "Quick generate · minimal steps"}
            </span>
            <span>
              {pipelineMode === "pro" && generating
                ? `${completedSteps}/${TOTAL_STEPS} · ${progressPct}%`
                : generating
                  ? "Generating…"
                  : agentPlan
                    ? "Ready"
                    : planLoading
                      ? "Preparing…"
                      : "—"}
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-border/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-[#5856d6] transition-all duration-700 ease-out"
              style={{
                width: `${
                  pipelineMode === "pro"
                    ? generating
                      ? Math.max(progressPct, 8)
                      : agentPlan
                        ? 100
                        : planLoading
                          ? 15
                          : 0
                    : generating
                      ? 66
                      : agentPlan
                        ? 100
                        : planLoading
                          ? 15
                          : 0
                }%`,
              }}
            />
          </div>
          {pipelineMode === "pro" ? (
            <StepRail pipeline={pipeline} selectedId={promptView} onSelect={setPromptView} />
          ) : (
            <QuickFlowRail phase={quickFlowPhase} />
          )}
        </div>
      </div>

      {/* ===== PROMPTS (full width, synced to pipeline rail) ===== */}
      <div className="glass-card p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Wand2 className="h-4 w-4 text-accent" />
              Prompts sent to AI
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                {promptPanel.title}
              </span>
              {promptPanel.engine && (
                <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[9px] font-medium text-muted-light">
                  {promptPanel.engine}
                </span>
              )}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted">
              Select a step in the 10-step pipeline above to see its prompt ·{" "}
              {agentPlan?.promptMethod === "cursor-agent" ? "Composed by Cursor agent" : "Built from templates"}
              {agentPlan?.imageModel ? ` · ${agentPlan.imageModel}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {META_PROMPT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPromptView(tab.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors",
                  promptView === tab.id
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:bg-white/40 hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
            {prompts && (
              <button
                type="button"
                onClick={copyPrompt}
                className="glass-chip flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        </div>

        {planLoading && !prompts ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
            Composing detailed prompts…
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-light">
                Prompt
              </p>
              <pre className="glass-input h-[260px] overflow-auto rounded-xl p-3 text-[11px] leading-relaxed text-muted whitespace-pre-wrap">
                {promptPanel.positive || "—"}
              </pre>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
                <AlertCircle className="h-3 w-3" />
                Negative — avoid at this step
              </p>
              <pre className="h-[260px] overflow-auto rounded-xl border border-warning/25 bg-warning-bg/40 p-3 text-[11px] leading-relaxed text-muted whitespace-pre-wrap">
                {promptPanel.negative || "No specific negatives for this step."}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* ===== STEP OUTPUTS + ACTIVITY ===== */}
      <div className={cn("grid gap-5", pipelineMode === "pro" && "xl:grid-cols-3")}>
        {pipelineMode === "pro" && (
          <div className="glass-card p-5 xl:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4 text-accent" />
                Step-by-step output
              </h3>
              <span className="text-[10px] text-muted">Output + rerun for key steps</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pipeline
                .filter((step) => OUTPUT_STEP_IDS.includes(step.id))
                .map((step) => (
                  <StepOutputCard
                    key={step.id}
                    step={step}
                    shortLabel={STEP_SHORT_LABELS[step.id]}
                    contextLabel={stepContextLabel(step.id)}
                    engine={STEP_ENGINE[step.id]}
                    selected={promptView === step.id}
                    hasRerun={Boolean(stepRerunPhase(step.id))}
                    rerunReady={stepRerunReady(step.id)}
                    busy={busy}
                    onSelect={() => setPromptView(step.id)}
                    onRerun={() => handleStepRerun(step.id)}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="glass-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-accent" />
            Activity
          </h3>
          <div className="max-h-[360px] space-y-2 overflow-y-auto text-[11px]">
            {activityLog.length === 0 ? (
              <p className="text-muted">
                {planLoading ? "Composing prompts…" : "Press Generate to start the pipeline."}
              </p>
            ) : (
              activityLog.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-muted-light">{entry.time}</span>
                  <div>
                    <span className="text-foreground">{entry.message}</span>
                    {entry.detail && <p className="text-muted">{entry.detail}</p>}
                  </div>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ===== FINAL DESIGN ===== */}
      <div
        className={cn(
          "glass-card overflow-hidden !p-0 ring-1",
          compositeStale ? "ring-warning/30" : "ring-accent/20"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 bg-gradient-to-r from-accent/5 via-transparent to-[#5856d6]/5 px-5 py-3.5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-accent" />
              Final Design
            </h3>
            <p className="mt-0.5 text-[11px] text-muted">
              {compositeStale
                ? "Upstream changed — regenerate to refresh"
                : `${platformLabel} · ${platformMeta}${compositeMethod ? ` · ${compositeMethod}` : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FinalActionButton
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              label="Zoom"
              onClick={() => setShowFinalModal(true)}
              disabled={!displayFinal}
            />
            <FinalActionButton
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Modify"
              onClick={() => setModifyOpen((v) => !v)}
              disabled={busy || !session || !isolatedPreview || !scenePreview}
              active={modifyOpen}
            />
            <FinalActionButton
              icon={
                regeneratingPhase === "composite" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )
              }
              label="Regenerate"
              onClick={() => handleRegenerate("composite")}
              disabled={busy || !session || !isolatedPreview || !scenePreview}
            />
            {displayFinal && (
              <a
                href={displayFinal}
                download
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </div>
        </div>

        {modifyOpen && (
          <div className="border-b border-border/30 bg-white/30 px-5 py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-light">
              Describe a change — scene, lighting, placement, mood (product stays identical)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={modifyText}
                onChange={(e) => setModifyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyModify()}
                placeholder="e.g. warmer golden light, move product slightly left, softer background blur…"
                className="glass-input flex-1 rounded-xl px-3 py-2 text-sm"
                disabled={busy}
              />
              <button
                type="button"
                onClick={handleApplyModify}
                disabled={busy || !modifyText.trim()}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-opacity",
                  busy || !modifyText.trim()
                    ? "cursor-not-allowed bg-muted/20 text-muted"
                    : "bg-accent text-white hover:opacity-90"
                )}
              >
                <Send className="h-3.5 w-3.5" />
                Apply
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => displayFinal && setShowFinalModal(true)}
          className="relative flex min-h-[320px] w-full cursor-zoom-in items-center justify-center bg-white/20"
        >
          {isPreviewLoading("final", activeStep?.id, regeneratingPhase) ? (
            <div className="flex flex-col items-center gap-2 py-20 text-muted">
              <Loader2 className="h-7 w-7 animate-spin text-accent" />
              <span className="text-[11px]">Compositing & finishing…</span>
            </div>
          ) : displayFinal ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayFinal}
                alt="Final design"
                className="max-h-[600px] w-auto max-w-full object-contain p-4"
              />
              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[10px] font-medium text-white">
                <ZoomIn className="h-3 w-3" /> Click to zoom
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-20 text-muted/40">
              <Layers className="h-10 w-10" />
              <span className="text-[11px]">Run the pipeline to produce your final design</span>
            </div>
          )}
        </button>
      </div>

      {/* Gallery */}
      {generatedResults.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold">Previous generations</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {generatedResults.map((g) => (
              <div
                key={g.id}
                className="glass-tile group overflow-hidden !p-0 transition-transform hover:!translate-y-[-2px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt="Generated"
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <div className="flex items-center justify-between p-3">
                  <span className="text-[10px] text-muted">{g.resolution}</span>
                  <a href={g.url} download className="flex items-center gap-1 text-[10px] text-accent hover:underline">
                    <Download className="h-3 w-3" /> Save
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFinalModal && displayFinal && (
        <FinalDesignModal
          url={displayFinal}
          caption={`${platformLabel} · ${platformMeta}`}
          busy={busy}
          regenerating={regeneratingPhase === "composite"}
          regenerateDisabled={busy || !session || !isolatedPreview || !scenePreview}
          modifyText={modifyText}
          onModifyTextChange={setModifyText}
          onApplyModify={handleApplyModify}
          onRegenerate={() => handleRegenerate("composite")}
          onClose={() => setShowFinalModal(false)}
        />
      )}
    </section>
  );
}

function FinalActionButton({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "glass-chip flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/60",
        active && "bg-accent/15 text-accent ring-1 ring-accent/40"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FinalDesignModal({
  url,
  caption,
  busy,
  regenerating,
  regenerateDisabled,
  modifyText,
  onModifyTextChange,
  onApplyModify,
  onRegenerate,
  onClose,
}: {
  url: string;
  caption: string;
  busy: boolean;
  regenerating: boolean;
  regenerateDisabled: boolean;
  modifyText: string;
  onModifyTextChange: (v: string) => void;
  onApplyModify: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-white">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Final Design</p>
          <p className="truncate text-[11px] text-white/60">{caption}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
          >
            Reset
          </button>
          <a
            href={url}
            download
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
          >
            <Download className="h-4 w-4" /> Download
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Final design"
          style={{ transform: `scale(${zoom})` }}
          className="max-h-full max-w-full origin-center object-contain transition-transform"
        />
      </div>

      <div className="border-t border-white/10 bg-black/40 px-5 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
          Modify — describe a change (product stays identical)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={modifyText}
            onChange={(e) => onModifyTextChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onApplyModify()}
            placeholder="e.g. warmer golden light, softer shadow, move product slightly right…"
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={onApplyModify}
            disabled={busy || !modifyText.trim()}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium",
              busy || !modifyText.trim()
                ? "cursor-not-allowed bg-white/10 text-white/40"
                : "bg-accent text-white hover:opacity-90"
            )}
          >
            <Send className="h-3.5 w-3.5" /> Apply
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white",
              regenerateDisabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/10"
            )}
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRail({
  pipeline,
  selectedId,
  onSelect,
}: {
  pipeline: PipelineStepState[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-0.5 overflow-x-auto pb-1">
      {pipeline.map((step, i) => {
        const done = step.status === "complete" || step.skipped;
        const active = step.status === "active";
        const selected = selectedId === step.id;
        const isLast = i === pipeline.length - 1;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            title={`Step ${step.order} · ${step.label}`}
            className="group flex min-w-[56px] flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  i === 0 ? "opacity-0" : done || active ? "bg-accent/40" : "bg-border/50"
                )}
              />
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all",
                  step.skipped
                    ? "bg-muted/15 text-muted"
                    : step.status === "error"
                      ? "bg-danger-bg text-danger"
                      : done
                        ? "bg-[var(--success-bg)] text-[var(--success)]"
                        : active
                          ? "bg-accent text-white shadow-md shadow-accent/30 ring-4 ring-accent/15"
                          : "bg-white/70 text-muted group-hover:bg-white",
                  selected && !active && "ring-2 ring-accent/40"
                )}
              >
                {done && !step.skipped ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  step.order
                )}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  isLast ? "opacity-0" : done ? "bg-accent/40" : "bg-border/50"
                )}
              />
            </div>
            <span
              className={cn(
                "line-clamp-2 px-0.5 text-center text-[9px] leading-tight",
                active
                  ? "font-semibold text-accent"
                  : selected
                    ? "text-foreground"
                    : "text-muted"
              )}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepOutputCard({
  step,
  shortLabel,
  contextLabel,
  engine,
  selected,
  hasRerun,
  rerunReady,
  busy,
  onSelect,
  onRerun,
}: {
  step: PipelineStepState;
  shortLabel?: string;
  contextLabel: string | null;
  engine: "cursor" | "studio";
  selected: boolean;
  hasRerun: boolean;
  rerunReady: boolean;
  busy: boolean;
  onSelect: () => void;
  onRerun: () => void;
}) {
  const done = step.status === "complete" && !step.skipped;
  const active = step.status === "active";
  const dotClass =
    step.status === "error"
      ? "bg-danger"
      : step.skipped
        ? "bg-muted/40"
        : done
          ? "bg-[var(--success)]"
          : active
            ? "bg-accent animate-pulse"
            : "bg-muted/30";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white/30 transition",
        selected ? "border-accent/50 ring-1 ring-accent/30" : "border-border/30 hover:border-accent/40"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative flex aspect-square items-center justify-center bg-white/40"
        title={`Step ${step.order} · ${step.label} — view prompt`}
      >
        <span className="absolute left-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-md bg-black/45 text-[8px] font-bold text-white">
          {step.order}
        </span>
        <span className={cn("absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full", dotClass)} />
        {step.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={step.previewUrl}
            alt={`Step ${step.order} output`}
            className="h-full w-full object-contain p-1.5"
          />
        ) : step.skipped ? (
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">Skipped</span>
        ) : active ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : (
          <Layers className="h-5 w-5 text-muted/25" />
        )}
      </button>
      <div className="flex items-center justify-between gap-1 border-t border-border/20 px-2 pt-1.5">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <p
            className={cn(
              "truncate text-[10px] font-medium leading-tight",
              active ? "text-accent" : "text-foreground/85"
            )}
          >
            {step.order}. {shortLabel ?? step.label}
          </p>
          {contextLabel && <p className="truncate text-[9px] text-muted">{contextLabel}</p>}
        </button>
        {hasRerun && (
          <button
            type="button"
            onClick={onRerun}
            disabled={busy || !rerunReady}
            title={`Rerun step ${step.order}`}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
              busy || !rerunReady
                ? "cursor-not-allowed text-muted/30"
                : "text-muted hover:bg-accent/10 hover:text-accent"
            )}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
        <EngineBadge engine={engine} />
        {done && (
          <span className="text-[8px] font-semibold uppercase tracking-wide text-[var(--success)]">done</span>
        )}
      </div>
    </div>
  );
}

function ModeToggle({
  active,
  onClick,
  label,
  sub,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-all",
        active
          ? "border-accent bg-accent/10 ring-1 ring-accent/30"
          : "border-border/40 bg-white/20 hover:bg-white/40",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </button>
  );
}

function EngineBadge({ engine }: { engine: "cursor" | "studio" }) {
  return (
    <span
      title={engine === "cursor" ? "Runs on Cursor AI" : "On-device studio engine — no extra API key"}
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide",
        engine === "cursor"
          ? "bg-accent/12 text-accent"
          : "bg-muted/15 text-muted-light"
      )}
    >
      {engine === "cursor" ? "Cursor" : "Studio"}
    </span>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
        ok ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-warning-bg text-warning"
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function SummaryChip({ label, sub }: { label: string; sub?: string }) {
  return (
    <span className="glass-chip inline-flex flex-col rounded-xl px-3 py-1.5">
      <span className="text-xs font-medium">{label}</span>
      {sub && <span className="text-[10px] text-muted">{sub}</span>}
    </span>
  );
}

