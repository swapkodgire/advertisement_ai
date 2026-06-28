import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { getPlatformPostType } from "@/lib/data/platform-post-types";
import { getImageView } from "@/lib/data/image-views";
import { getScene } from "@/lib/data/scenes";
import sharp from "sharp";
import {
  buildSceneBackgroundPrompt,
  generateSceneBackgroundWithRetries,
  getCursorImageModelLabel,
} from "@/lib/image/cursor-image";
import {
  runAICompositePass,
  buildProModePrompt,
  runProModeGeneration,
  type AICompositeMethod,
} from "@/lib/image/ai-composite";
import { applyFinishPipeline } from "@/lib/image/finish-pipeline";
import { getSceneLightingProfile } from "@/lib/image/scene-lighting";
import { exportDimensions, generationDimensions } from "@/lib/image/image-dimensions";
import {
  isolateProductImage,
  isolationMethodDetail,
  isolationMethodLabel,
  type IsolationMethod,
} from "@/lib/image/isolate-product";
import { enhanceSourceToFile } from "@/lib/image/enhance-product";
import { preserveCopyAsPng } from "@/lib/image/openai-image";
import {
  generateSceneBackgroundFallback,
  parseResolution,
} from "@/lib/image/process-product";
import { isCursorConfigured } from "@/lib/cursor-server";
import { buildPhotoshootPrompts } from "@/lib/photoshoot/prompt-builder";
import {
  composePhotoshootAgentPlan,
  researchPhotoshootContext,
  type PhotoshootAgentPlan,
  type PhotoshootWizardInput,
} from "@/lib/photoshoot/prompt-agent";
import {
  appendGenerationMeta,
  filePublicUrl,
  getGeneratedDir,
  getRawDir,
  saveFile,
} from "@/lib/storage/product-storage";
import {
  getPrimarySource,
  readSourceManifest,
} from "@/lib/storage/source-manifest";
import { primaryOriginalFilename } from "@/lib/image/normalize-upload";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";
import type { GenerationProgressHandler } from "@/lib/photoshoot/generation-progress";
import { emitPipelineStep } from "@/lib/photoshoot/pipeline-progress";
import { withStepNegatives } from "@/lib/photoshoot/step-prompts";

export const ISOLATED_FILENAME = "product-isolated.png";
const ENHANCED_SOURCE_FILENAME = "source-enhanced.png";

/** Persist a per-step output image and return its cache-busted public URL. */
async function saveStepPreview(
  brandId: string,
  productId: string,
  genId: string,
  stepId: string,
  buffer: Buffer
): Promise<string> {
  const filename = `${genId}-step-${stepId}.png`;
  await saveFile(brandId, productId, "generated", filename, buffer);
  return cacheBust(filePublicUrl(brandId, productId, "generated", filename));
}

export type PipelineMode = "standard" | "pro";

export type RegeneratePhase = "isolate" | "scene" | "composite";

export interface PhotoshootGenerationInput {
  brandId: string;
  productId: string;
  brandName: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  businessDNA: BusinessDNA;
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
  /** standard = isolate→scene→AI composite→finish; pro = single-shot Cursor scene transform */
  pipelineMode?: PipelineMode;
  /** Optional user "modify" instruction appended to the composite prompt when regenerating */
  modifyInstruction?: string;
  onProgress?: GenerationProgressHandler;
}

export interface PhotoshootSession {
  genId: string;
  sceneBgFilename: string;
}

const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

function cacheBust(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

function assertCursorConfigured() {
  if (!isCursorConfigured()) {
    throw new Error(
      "CURSOR_API_KEY is required. Add it to .env.local — get a key at cursor.com/dashboard/integrations"
    );
  }
}

function resolveSelection(input: Pick<PhotoshootGenerationInput, "platformPostTypeId" | "viewId" | "sceneId">) {
  const platform = getPlatformPostType(input.platformPostTypeId);
  const view = getImageView(input.viewId);
  const scene = getScene(input.sceneId);
  if (!platform || !view || !scene) {
    throw new Error("Invalid platform, view, or scene selection");
  }
  return { platform, view, scene };
}

async function composePromptBundle(
  input: PhotoshootGenerationInput,
  platform: NonNullable<ReturnType<typeof getPlatformPostType>>,
  view: NonNullable<ReturnType<typeof getImageView>>,
  scene: NonNullable<ReturnType<typeof getScene>>,
  research?: string | null
) {
  const agentPlan = await composePhotoshootAgentPlan(
    {
      brandName: input.brandName,
      productName: input.productName || "Product",
      productCategory: input.productCategory || "General",
      productDescription: input.productDescription || "",
      businessDNA: input.businessDNA,
      platformPostTypeId: input.platformPostTypeId,
      viewId: input.viewId,
      sceneId: input.sceneId,
    },
    { research }
  );

  const rulesPrompts = buildPhotoshootPrompts({
    brandName: input.brandName,
    productName: input.productName || "Product",
    productCategory: input.productCategory || "General",
    productDescription: input.productDescription || "",
    businessDNA: input.businessDNA,
    platformPostTypeId: input.platformPostTypeId,
    viewId: input.viewId,
    sceneId: input.sceneId,
  });

  const sceneBackgroundPrompt =
    agentPlan.sceneBackgroundPrompt?.trim() ||
    rulesPrompts.sceneBackgroundPrompt ||
    buildSceneBackgroundPrompt({
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

  const sceneImagePrompt = agentPlan.sceneImagePrompt?.trim() || rulesPrompts.sceneImagePrompt;

  return { agentPlan, rulesPrompts, sceneBackgroundPrompt, sceneImagePrompt };
}

/** Resolve the on-disk product image, syncing primary source → original.* when needed */
export async function findOriginalImagePath(
  brandId: string,
  productId: string
): Promise<string> {
  const rawDir = getRawDir(brandId, productId);
  const files = await fs.readdir(rawDir).catch(() => [] as string[]);

  const existingOriginal = files.find((f) => f.startsWith("original.") && IMAGE_EXT.test(f));
  if (existingOriginal) {
    return path.join(rawDir, existingOriginal);
  }

  const manifest = await readSourceManifest(brandId, productId);
  const primary = getPrimarySource(manifest);
  const candidateFilename =
    primary?.filename && files.includes(primary.filename)
      ? primary.filename
      : files.find((f) => f.startsWith("source-") && IMAGE_EXT.test(f));

  if (!candidateFilename) {
    throw new Error(
      `No product image found for product ${productId}. Upload an image first.`
    );
  }

  const sourcePath = path.join(rawDir, candidateFilename);
  const ext = candidateFilename.split(".").pop()?.toLowerCase() || "jpg";
  const destName = primaryOriginalFilename(ext);
  const destPath = path.join(rawDir, destName);

  try {
    await fs.copyFile(sourcePath, destPath);
    return destPath;
  } catch {
    return sourcePath;
  }
}

export async function executeIsolatePhase(
  brandId: string,
  productId: string,
  emit?: GenerationProgressHandler,
  productCategory?: string
): Promise<{ isolationMethod: IsolationMethod; isolatedUrl: string; productLayerPath: string }> {
  emitPipelineStep(emit, "upscale", "start", {
    detail: "Analyzing source resolution and enhancing detail via Cursor pipeline",
  });

  const originalPath = await findOriginalImagePath(brandId, productId);
  const rawDir = getRawDir(brandId, productId);
  const enhancedPath = path.join(rawDir, ENHANCED_SOURCE_FILENAME);
  const isolatedPath = path.join(rawDir, ISOLATED_FILENAME);

  let isolationInput = originalPath;
  let upscaleDetail = "Source resolution sufficient — no upscale needed";
  let upscalePreviewUrl = cacheBust(
    filePublicUrl(brandId, productId, "raw", path.basename(originalPath))
  );
  try {
    const enhanced = await enhanceSourceToFile(originalPath, enhancedPath);
    if (enhanced.enhanced) {
      isolationInput = enhancedPath;
      upscaleDetail = `Upscaled to ${enhanced.width}×${enhanced.height} · sharpened for isolation`;
      upscalePreviewUrl = cacheBust(
        filePublicUrl(brandId, productId, "raw", ENHANCED_SOURCE_FILENAME)
      );
    }
  } catch (err) {
    console.warn("Source enhance step skipped:", err);
    upscaleDetail = "Enhance skipped — using original resolution";
  }

  emitPipelineStep(emit, "upscale", "done", {
    detail: upscaleDetail,
    previewUrl: upscalePreviewUrl,
  });

  emitPipelineStep(emit, "remove_bg", "start", {
    detail: "Cursor generateImage — pixel-faithful product cutout on transparent alpha",
  });

  let isolationMethod: IsolationMethod = "cursor";
  try {
    const isolated = await isolateProductImage(isolationInput, isolatedPath, {
      productCategory,
    });
    isolationMethod = isolated.method;
    await saveFile(brandId, productId, "raw", ISOLATED_FILENAME, isolated.buffer);
  } catch (err) {
    console.warn("Isolation step failed, using source copy:", err);
    isolationMethod = "preserve";
    await preserveCopyAsPng(originalPath, isolatedPath);
  }

  const isolatedUrl = cacheBust(filePublicUrl(brandId, productId, "raw", ISOLATED_FILENAME));

  emitPipelineStep(emit, "remove_bg", "done", {
    message: isolationMethodLabel(isolationMethod),
    detail: isolationMethodDetail(isolationMethod),
    previewUrl: isolatedUrl,
    method: isolationMethod,
  });

  return { isolationMethod, isolatedUrl, productLayerPath: isolatedPath };
}

export async function executeScenePhase(options: {
  brandId: string;
  productId: string;
  genId: string;
  sceneImagePrompt: string;
  platform: NonNullable<ReturnType<typeof getPlatformPostType>>;
  scene: NonNullable<ReturnType<typeof getScene>>;
  sourceBuffer?: Buffer;
  emit?: GenerationProgressHandler;
}): Promise<{
  sceneMethod: "cursor" | "fallback";
  sceneBgFilename: string;
  sceneBgUrl: string;
  sceneBgPath: string;
  sceneAttempts?: number;
}> {
  assertCursorConfigured();

  const exportSize = exportDimensions(options.platform.resolution);
  const genSize = generationDimensions(options.platform.aspectRatio);
  const sceneBgFilename = `${options.genId}-scene-bg.png`;
  const sceneBgPath = path.join(getGeneratedDir(options.brandId, options.productId), sceneBgFilename);

  let sourceBuffer = options.sourceBuffer;
  if (!sourceBuffer) {
    const originalPath = await findOriginalImagePath(options.brandId, options.productId);
    sourceBuffer = await fs.readFile(originalPath);
  }

  options.emit?.({
    phase: "scene_start",
    message: "Generating empty scene background…",
    detail: `${options.scene.sceneName} · ${genSize.width}×${genSize.height} (${options.platform.aspectRatio}) — up to 3 attempts`,
  });

  emitPipelineStep(options.emit, "ai_backgrounds", "start", {
    detail: `${options.scene.sceneName} · ${genSize.width}×${genSize.height} · Cursor empty plate (no product)`,
  });

  let sceneMethod: "cursor" | "fallback" = "cursor";
  let sceneAttempts = 0;

  try {
    const { buffer, attempts } = await generateSceneBackgroundWithRetries({
      scenePrompt: withStepNegatives(options.sceneImagePrompt, "ai_backgrounds"),
      outputAbsolutePath: sceneBgPath,
      sourceBufferForValidation: sourceBuffer,
      width: genSize.width,
      height: genSize.height,
      aspectRatio: options.platform.aspectRatio,
    });
    sceneAttempts = attempts;

    const resized = await sharp(buffer)
      .resize(exportSize.width, exportSize.height, { fit: "cover", position: "centre" })
      .png({ quality: 95 })
      .toBuffer();
    await fs.writeFile(sceneBgPath, resized);
  } catch (err) {
    console.warn("Scene generation failed after retries, using styled fallback:", err);
    sceneMethod = "fallback";
    await generateSceneBackgroundFallback({
      outputPath: sceneBgPath,
      width: exportSize.width,
      height: exportSize.height,
      sceneColorPalette: options.scene.colorPalette,
      sceneMood: options.scene.mood,
      sceneName: options.scene.sceneName,
      sceneId: options.scene.id,
      lighting: options.scene.lighting,
      sceneCategory: options.scene.sceneCategory,
      backgroundType: options.scene.backgroundType,
    });
  }

  const sceneBgUrl = cacheBust(
    filePublicUrl(options.brandId, options.productId, "generated", sceneBgFilename)
  );

  options.emit?.({
    phase: "scene_done",
    message: sceneMethod === "cursor" ? "Scene background generated" : "Scene fallback applied",
    detail:
      sceneMethod === "cursor"
        ? `Empty environment ready (${sceneAttempts} attempt${sceneAttempts === 1 ? "" : "s"})`
        : "Styled gradient/marble fallback used",
    previewUrl: sceneBgUrl,
    method: sceneMethod,
  });

  emitPipelineStep(options.emit, "ai_backgrounds", "done", {
    message: sceneMethod === "cursor" ? "AI background ready" : "Fallback background applied",
    detail:
      sceneMethod === "cursor"
        ? `${options.scene.sceneName} · attempt ${sceneAttempts ?? 1}`
        : "Cursor failed — local styled fallback used",
    previewUrl: sceneBgUrl,
    method: sceneMethod,
  });

  return { sceneMethod, sceneBgFilename, sceneBgUrl, sceneBgPath, sceneAttempts };
}

export async function executeCompositePhase(options: {
  input: PhotoshootGenerationInput;
  genId: string;
  sceneBgFilename: string;
  productLayerPath: string;
  platform: NonNullable<ReturnType<typeof getPlatformPostType>>;
  view: NonNullable<ReturnType<typeof getImageView>>;
  scene: NonNullable<ReturnType<typeof getScene>>;
  agentPlan: PhotoshootAgentPlan;
  rulesPrompts: ReturnType<typeof buildPhotoshootPrompts>;
  sceneBackgroundPrompt: string;
  sceneImagePrompt: string;
  isolationMethod: IsolationMethod;
  sceneMethod: "cursor" | "fallback";
  emit?: GenerationProgressHandler;
}) {
  const { input } = options;
  const genDir = getGeneratedDir(input.brandId, input.productId);
  const filename = `${options.genId}.png`;
  const outputAbsolutePath = path.join(genDir, filename);
  const sceneBgPath = path.join(genDir, options.sceneBgFilename);
  const exportSize = exportDimensions(options.platform.resolution);
  const genSize = generationDimensions(options.platform.aspectRatio);
  const { width, height } = exportSize;

  await fs.access(sceneBgPath).catch(() => {
    throw new Error("Scene background not found — generate or regenerate the scene first");
  });
  await fs.access(options.productLayerPath).catch(() => {
    throw new Error("Isolated product not found — generate or regenerate isolation first");
  });

  const draftFilename = `${options.genId}-draft.png`;
  const aiFilename = `${options.genId}-ai.png`;
  const draftPath = path.join(genDir, draftFilename);
  const aiPath = path.join(genDir, aiFilename);

  const baseCompositePrompt =
    options.agentPlan.compositePrompt ??
    options.rulesPrompts.compositePrompt ??
    options.agentPlan.imageEditPrompt;
  const modify = input.modifyInstruction?.trim();
  const compositePrompt = modify
    ? `${baseCompositePrompt}\n\nUSER MODIFICATION REQUEST (apply to scene/lighting/placement only — keep product identity unchanged):\n${modify}`
    : baseCompositePrompt;

  emitPipelineStep(options.emit, "ai_edit", "start", {
    detail: "Building draft composite → Cursor AI relight (2 retries)",
  });

  options.emit?.({
    phase: "composite_start",
    message: "AI composite pass…",
    detail: "Draft placement → Cursor AI relight (2 retries) → finish pipeline",
  });

  const sceneContext = {
    sceneName: options.scene.sceneName,
    sceneDescription: options.scene.sceneDescription,
    lighting: options.scene.lighting,
    mood: options.scene.mood,
    colorPalette: options.scene.colorPalette,
    props: options.scene.props,
    backgroundType: options.scene.backgroundType,
    sceneCategory: options.scene.sceneCategory,
    platformName: options.platform.platformName,
    brandName: input.brandName,
    productName: input.productName,
    aspectRatio: options.platform.aspectRatio,
    resolution: options.platform.resolution,
    cameraAngle: options.view.cameraAngle,
  };

  const lightingProfile = getSceneLightingProfile({
    lighting: options.scene.lighting,
    mood: options.scene.mood,
    sceneCategory: options.scene.sceneCategory,
    backgroundType: options.scene.backgroundType,
    props: options.scene.props,
  });

  const aiResult = await runAICompositePass({
    productPath: options.productLayerPath,
    backgroundPath: sceneBgPath,
    draftOutputPath: draftPath,
    aiOutputPath: aiPath,
    width: genSize.width,
    height: genSize.height,
    viewName: options.view.viewName,
    aspectRatio: options.platform.aspectRatio,
    compositePrompt,
    sceneContext,
  });

  // Step 5 — AI Edit / composite output (real per-step image)
  const aiEditPreviewUrl = await saveStepPreview(
    input.brandId,
    input.productId,
    options.genId,
    "ai_edit",
    aiResult.buffer
  );
  emitPipelineStep(options.emit, "ai_edit", "done", {
    detail: `Composite method: ${aiResult.method}`,
    previewUrl: aiEditPreviewUrl,
    method: aiResult.method,
  });

  options.emit?.({
    phase: "finish_start",
    message: "Applying finish pipeline…",
    detail: "Step 6: shadows · Step 7: split relight · Step 8: DOF · Step 10: export",
    method: aiResult.method,
  });

  // Step 6 — directional shadows (start; done emitted from onStep)
  emitPipelineStep(options.emit, "shadows", "start", {
    detail: `Directional cast shadow — ${lightingProfile.sunDescription}`,
  });

  const finishStepDoneDetail: Record<string, string> = {
    shadows: `Directional shadow on ${lightingProfile.isOutdoor ? "ground plane" : "surface"} — angle ${lightingProfile.shadowAngleDeg}°`,
    light_color: `Environment grade + product light wrap · ${lightingProfile.sunDescription}`,
    blur_bg: "Natural depth-of-field — sharp product, soft environment bokeh",
  };
  const finishNextStart: Record<string, { id: string; detail: string }> = {
    shadows: { id: "light_color", detail: "Split grade — environment + product environmental relight" },
    light_color: { id: "blur_bg", detail: "Applying depth-of-field — sharp product, soft environment" },
    blur_bg: { id: "final", detail: `Exporting ${width}×${height} (${options.platform.aspectRatio})` },
  };

  const finished = await applyFinishPipeline(
    aiResult.buffer,
    {
      targetWidth: width,
      targetHeight: height,
      aspectRatio: options.platform.aspectRatio,
      sceneMood: options.scene.mood,
      sceneLighting: options.scene.lighting,
      colorPalette: options.scene.colorPalette,
      sceneCategory: options.scene.sceneCategory,
      backgroundType: options.scene.backgroundType,
      sceneProps: options.scene.props,
      placement: aiResult.placement,
      productLayerPath: options.productLayerPath,
      lightingProfile,
      shadowsAlreadyApplied: aiResult.method === "sharp",
    },
    async (stepId, buf) => {
      const previewUrl = await saveStepPreview(
        input.brandId,
        input.productId,
        options.genId,
        stepId,
        buf
      );
      emitPipelineStep(options.emit, stepId, "done", {
        detail: finishStepDoneDetail[stepId],
        previewUrl,
      });
      // Step 9 — fashion model is skipped in product-only mode; surface it in order (after step 8)
      if (stepId === "blur_bg") {
        emitPipelineStep(options.emit, "fashion_model", "skip", {
          detail: "Product-only pipeline — no fashion model in frame",
        });
      }
      const next = finishNextStart[stepId];
      if (next) emitPipelineStep(options.emit, next.id, "start", { detail: next.detail });
    }
  );

  await saveFile(input.brandId, input.productId, "generated", filename, finished);

  const url = cacheBust(filePublicUrl(input.brandId, input.productId, "generated", filename));
  const compositeMethod: AICompositeMethod = aiResult.method;
  const imageModel = getCursorImageModelLabel();

  const meta = {
    id: options.genId,
    createdAt: new Date().toISOString(),
    platformPostTypeId: input.platformPostTypeId,
    viewId: input.viewId,
    sceneId: input.sceneId,
    filename,
    prompt: options.agentPlan.imageEditPrompt,
    sceneBackgroundPrompt: options.sceneBackgroundPrompt,
    sceneImagePrompt: options.sceneImagePrompt,
    isolationPrompt: options.agentPlan.isolationPrompt ?? options.rulesPrompts.isolationPrompt,
    compositePrompt,
    creativeBrief: options.agentPlan.creativeBrief ?? options.rulesPrompts.creativeBrief,
    negativePrompt: options.rulesPrompts.negativePrompt,
    selectionDetails: options.rulesPrompts.selectionDetails,
    promptMethod: options.agentPlan.promptMethod,
    imageModel,
    resolution: options.platform.resolution,
    aspectRatio: options.platform.aspectRatio,
    pipeline: "studio-pipeline-v2",
    pipelineMode: "pro" as PipelineMode,
    isolationMethod: options.isolationMethod,
    sceneMethod: options.sceneMethod,
    compositeMethod,
  };

  await appendGenerationMeta(input.brandId, input.productId, meta);

  emitPipelineStep(options.emit, "final", "done", {
    detail: `Catalog export ${width}×${height}`,
    previewUrl: url,
    method: compositeMethod,
  });

  options.emit?.({
    phase: "finish_done",
    message: "Finish pipeline complete",
    detail: `Exported ${width}×${height}`,
    previewUrl: url,
  });

  options.emit?.({
    phase: "composite_done",
    message: "AI composite complete",
    detail: `Method: ${compositeMethod} · ${width}×${height} (${options.platform.aspectRatio})`,
    previewUrl: url,
    method: compositeMethod,
  });

  options.emit?.({
    phase: "complete",
    message: "Photoshoot complete",
    detail: `Isolation: ${options.isolationMethod} · Scene: ${options.sceneMethod} · Composite: ${compositeMethod}`,
    previewUrl: url,
    method: compositeMethod,
  });

  return {
    id: options.genId,
    url,
    meta,
    agentPlan: options.agentPlan,
    usedAI: true,
    method: `studio-${compositeMethod}`,
    message: `Studio pipeline complete — composite via ${compositeMethod}`,
    sceneBgFilename: options.sceneBgFilename,
    isolationMethod: options.isolationMethod,
    compositeMethod,
  };
}

/** Step 1: isolate product — Cursor generateImage only */
export async function runExtractProduct(brandId: string, productId: string) {
  const result = await executeIsolatePhase(brandId, productId);
  const buffer = await fs.readFile(result.productLayerPath);
  const meta = await import("sharp").then((s) => s.default(buffer).metadata());

  return {
    url: result.isolatedUrl,
    isolatedUrl: result.isolatedUrl,
    width: meta.width ?? 1024,
    height: meta.height ?? 1024,
    method: result.isolationMethod,
    message: isolationMethodLabel(result.isolationMethod),
  };
}

export const runRedesign = runExtractProduct;

export async function runComposePhotoshootPlan(input: PhotoshootWizardInput) {
  return composePhotoshootAgentPlan(input);
}

export async function runRegeneratePhase(
  phase: RegeneratePhase,
  input: PhotoshootGenerationInput & {
    genId?: string;
    sceneBgFilename?: string;
    sceneImagePrompt?: string;
    agentPlan?: PhotoshootAgentPlan;
  }
) {
  const emit = input.onProgress;
  const { platform, view, scene } = resolveSelection(input);

  if (phase === "isolate") {
    const result = await executeIsolatePhase(
      input.brandId,
      input.productId,
      emit,
      input.productCategory
    );
    return {
      phase,
      ...result,
      genId: input.genId,
      sceneBgFilename: input.sceneBgFilename,
      message: "Product isolation regenerated",
    };
  }

  assertCursorConfigured();

  const genId = input.genId ?? randomUUID();
  const sceneBgFilename = input.sceneBgFilename ?? `${genId}-scene-bg.png`;

  let agentPlan = input.agentPlan;
  let rulesPrompts: ReturnType<typeof buildPhotoshootPrompts>;
  let sceneBackgroundPrompt: string;
  let sceneImagePrompt: string;

  if (input.sceneImagePrompt && agentPlan) {
    rulesPrompts = buildPhotoshootPrompts({
      brandName: input.brandName,
      productName: input.productName || "Product",
      productCategory: input.productCategory || "General",
      productDescription: input.productDescription || "",
      businessDNA: input.businessDNA,
      platformPostTypeId: input.platformPostTypeId,
      viewId: input.viewId,
      sceneId: input.sceneId,
    });
    sceneBackgroundPrompt =
      agentPlan.sceneBackgroundPrompt?.trim() || rulesPrompts.sceneBackgroundPrompt;
    sceneImagePrompt = input.sceneImagePrompt;
  } else {
    const bundle = await composePromptBundle(input, platform, view, scene);
    agentPlan = bundle.agentPlan;
    rulesPrompts = bundle.rulesPrompts;
    sceneBackgroundPrompt = bundle.sceneBackgroundPrompt;
    sceneImagePrompt = bundle.sceneImagePrompt;
  }

  const isolatedPath = path.join(getRawDir(input.brandId, input.productId), ISOLATED_FILENAME);
  await fs.access(isolatedPath).catch(() => {
    throw new Error("Isolated product not found — regenerate isolation first");
  });

  if (phase === "scene") {
    const sceneResult = await executeScenePhase({
      brandId: input.brandId,
      productId: input.productId,
      genId,
      sceneImagePrompt,
      platform,
      scene,
      emit,
    });

    return {
      phase,
      genId,
      sceneBgFilename: sceneResult.sceneBgFilename,
      sceneBgUrl: sceneResult.sceneBgUrl,
      sceneMethod: sceneResult.sceneMethod,
      agentPlan,
      message: "Scene background regenerated — regenerate composite when ready",
    };
  }

  if (phase === "composite") {
    const scenePath = path.join(getGeneratedDir(input.brandId, input.productId), sceneBgFilename);
    await fs.access(scenePath).catch(() => {
      throw new Error("Scene background not found — regenerate the scene first");
    });

    const compositeGenId = randomUUID();

    const result = await executeCompositePhase({
      input,
      genId: compositeGenId,
      sceneBgFilename,
      productLayerPath: isolatedPath,
      platform,
      view,
      scene,
      agentPlan: agentPlan!,
      rulesPrompts,
      sceneBackgroundPrompt,
      sceneImagePrompt,
      isolationMethod: "cursor",
      sceneMethod: "cursor",
      emit,
    });

    return {
      phase,
      ...result,
      sceneBgFilename,
      message: "Final composite regenerated",
    };
  }

  throw new Error(`Unknown regenerate phase: ${phase satisfies never}`);
}

/**
 * STANDARD mode — quick generation. Relies mostly on the LLM image model: one unified
 * Cursor pass turns the source product into a fully-realized scene with integrated
 * lighting, then a light studio finish + export. Minimum steps, fastest path.
 */
export async function runStandardQuickPhotoshoot(input: PhotoshootGenerationInput) {
  assertCursorConfigured();

  const { platform, view, scene } = resolveSelection(input);
  const genId = randomUUID();
  const emit = input.onProgress;
  const exportSize = exportDimensions(platform.resolution);

  emit?.({
    phase: "compose_start",
    message: "Standard — composing quick scene prompt…",
    detail: "Cursor AI unified scene transform (integrated lighting)",
  });

  const { agentPlan, rulesPrompts } = await composePromptBundle(input, platform, view, scene);

  emit?.({
    phase: "compose_done",
    message: "Quick prompts ready",
    agentPlan,
    prompts: {
      isolationPrompt: agentPlan.isolationPrompt ?? rulesPrompts.isolationPrompt,
      sceneBackgroundPrompt: rulesPrompts.sceneBackgroundPrompt,
      sceneImagePrompt: rulesPrompts.sceneImagePrompt,
      compositePrompt: rulesPrompts.compositePrompt,
      negativePrompt: rulesPrompts.negativePrompt,
      creativeBrief: agentPlan.creativeBrief ?? rulesPrompts.creativeBrief,
      fullPrompt: agentPlan.imageEditPrompt,
    },
  });

  const originalPath = await findOriginalImagePath(input.brandId, input.productId);
  const rawDir = getRawDir(input.brandId, input.productId);
  const enhancedPath = path.join(rawDir, ENHANCED_SOURCE_FILENAME);

  try {
    await enhanceSourceToFile(originalPath, enhancedPath);
  } catch {
    // use original
  }

  const sourceForPro = (await fs.access(enhancedPath).then(() => true).catch(() => false))
    ? enhancedPath
    : originalPath;

  emit?.({
    phase: "composite_start",
    message: "Standard — Cursor generating integrated scene…",
    detail: "Single quick Cursor AI pass: product in scene with lighting & shadows",
  });

  const proPrompt = buildProModePrompt({
    sceneName: scene.sceneName,
    sceneDescription: scene.sceneDescription,
    lighting: scene.lighting,
    mood: scene.mood,
    colorPalette: scene.colorPalette,
    props: scene.props,
    backgroundType: scene.backgroundType,
    platformName: platform.platformName,
    brandName: input.brandName,
    productName: input.productName,
    aspectRatio: platform.aspectRatio,
    resolution: platform.resolution,
    cameraAngle: view.cameraAngle,
    viewName: view.viewName,
  });

  const genDir = getGeneratedDir(input.brandId, input.productId);
  const filename = `${genId}.png`;
  const proRawPath = path.join(genDir, `${genId}-pro-raw.png`);

  const genSize = generationDimensions(platform.aspectRatio);

  const proResult = await runProModeGeneration({
    sourcePath: sourceForPro,
    outputPath: proRawPath,
    prompt: proPrompt,
    aspectRatio: platform.aspectRatio,
    width: genSize.width,
    height: genSize.height,
  });

  emit?.({
    phase: "finish_start",
    message: "Applying quick finish…",
    detail: `Quick output via ${proResult.method}`,
    method: proResult.method,
  });

  const finished = await applyFinishPipeline(proResult.buffer, {
    targetWidth: exportSize.width,
    targetHeight: exportSize.height,
    aspectRatio: platform.aspectRatio,
    sceneMood: scene.mood,
    sceneLighting: scene.lighting,
    colorPalette: scene.colorPalette,
  });

  await saveFile(input.brandId, input.productId, "generated", filename, finished);
  const url = cacheBust(filePublicUrl(input.brandId, input.productId, "generated", filename));

  emit?.({
    phase: "finish_done",
    message: "Finish pipeline complete",
    detail: `Exported ${exportSize.width}×${exportSize.height}`,
    previewUrl: url,
  });

  const meta = {
    id: genId,
    createdAt: new Date().toISOString(),
    platformPostTypeId: input.platformPostTypeId,
    viewId: input.viewId,
    sceneId: input.sceneId,
    filename,
    prompt: proPrompt,
    creativeBrief: agentPlan.creativeBrief,
    pipeline: "standard-quick",
    pipelineMode: "standard" as PipelineMode,
    compositeMethod: proResult.method,
    imageModel: getCursorImageModelLabel(),
    resolution: platform.resolution,
    aspectRatio: platform.aspectRatio,
  };

  await appendGenerationMeta(input.brandId, input.productId, meta);

  emit?.({
    phase: "complete",
    message: "Standard photoshoot complete",
    detail: `Integrated scene via ${proResult.method}`,
    previewUrl: url,
    method: proResult.method,
  });

  return {
    id: genId,
    url,
    meta,
    agentPlan,
    usedAI: true,
    method: proResult.method,
    message: `Standard complete — ${proResult.method}`,
    sceneBgFilename: undefined,
    compositeMethod: proResult.method,
  };
}

export async function runPhotoshootGeneration(input: PhotoshootGenerationInput) {
  // Standard = quick LLM single-shot (minimum steps). Pro = full studio pipeline + research.
  if (input.pipelineMode !== "pro") {
    return runStandardQuickPhotoshoot(input);
  }

  return runProStudioPhotoshoot(input);
}

/**
 * PRO mode — deep agentic flow. Runs a research pass, then the full 10-step studio
 * pipeline: upscale → isolate → research-informed plan → AI background plate →
 * AI composite/relight → shadows → color → DOF → export. Highest quality.
 */
async function runProStudioPhotoshoot(input: PhotoshootGenerationInput) {
  assertCursorConfigured();

  const { platform, view, scene } = resolveSelection(input);
  const genId = randomUUID();
  const sceneBgFilename = `${genId}-scene-bg.png`;
  const emit = input.onProgress;

  // Steps 1–2 — upscale + isolate (run first so the rail advances 1 → 2 → 3 …)
  const originalPath = await findOriginalImagePath(input.brandId, input.productId);
  const sourceBuffer = await fs.readFile(originalPath);

  const { isolationMethod, productLayerPath } = await executeIsolatePhase(
    input.brandId,
    input.productId,
    emit,
    input.productCategory
  );

  // Step 3 — deep research + AI photoshoot plan (compose all prompts)
  emitPipelineStep(emit, "ai_photoshoot", "start", {
    detail: "Researching category, platform trends & art direction, then composing prompts",
  });

  emit?.({
    phase: "compose_start",
    message: "Researching & composing prompts with Cursor agent…",
    detail: "Pro mode — deep research → studio brief, camera, lighting & composite prompts",
  });

  // Deep agentic research pass — informs the art-direction prompts.
  const research = await researchPhotoshootContext({
    brandName: input.brandName,
    productName: input.productName || "Product",
    productCategory: input.productCategory || "General",
    productDescription: input.productDescription || "",
    businessDNA: input.businessDNA,
    platformPostTypeId: input.platformPostTypeId,
    viewId: input.viewId,
    sceneId: input.sceneId,
  });

  if (research) {
    emit?.({
      phase: "compose_start",
      message: "Research complete — composing art direction…",
      detail: research.slice(0, 200),
    });
  }

  const { agentPlan, rulesPrompts, sceneBackgroundPrompt, sceneImagePrompt } =
    await composePromptBundle(input, platform, view, scene, research);

  emitPipelineStep(emit, "ai_photoshoot", "done", {
    detail:
      agentPlan.promptMethod === "cursor-agent"
        ? "Cursor agent composed all shoot prompts"
        : "Template prompts assembled",
  });

  emit?.({
    phase: "compose_done",
    message: "Prompts ready",
    detail: agentPlan.promptMethod === "cursor-agent" ? "Cursor agent composed prompts" : "Template prompts assembled",
    agentPlan,
    prompts: {
      isolationPrompt: agentPlan.isolationPrompt ?? rulesPrompts.isolationPrompt,
      sceneBackgroundPrompt,
      sceneImagePrompt,
      compositePrompt: agentPlan.compositePrompt ?? rulesPrompts.compositePrompt,
      negativePrompt: rulesPrompts.negativePrompt,
      creativeBrief: agentPlan.creativeBrief ?? rulesPrompts.creativeBrief,
      fullPrompt: agentPlan.imageEditPrompt,
    },
  });

  // Step 4 — AI background plate
  const sceneResult = await executeScenePhase({
    brandId: input.brandId,
    productId: input.productId,
    genId,
    sceneImagePrompt,
    platform,
    scene,
    sourceBuffer,
    emit,
  });

  return executeCompositePhase({
    input,
    genId,
    sceneBgFilename: sceneResult.sceneBgFilename,
    productLayerPath,
    platform,
    view,
    scene,
    agentPlan,
    rulesPrompts,
    sceneBackgroundPrompt,
    sceneImagePrompt,
    isolationMethod,
    sceneMethod: sceneResult.sceneMethod,
    emit,
  });
}
