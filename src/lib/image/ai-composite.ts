import fs from "fs/promises";
import sharp from "sharp";
import { compositeWithCursorAI } from "@/lib/image/cursor-image";
import { isCursorConfigured } from "@/lib/cursor-server";
import { buildSceneEditPrompt } from "@/lib/image/openai-image";
import {
  compositeProductOnScene,
  type CompositePlacementResult,
} from "@/lib/image/process-product";
import { generationDimensions } from "@/lib/image/image-dimensions";
import type { SceneCategory } from "@/types";

export type AICompositeMethod = "cursor-ai" | "sharp";

const CURSOR_COMPOSITE_ATTEMPTS = 2;

// Allowable difference between the AI output aspect and the platform aspect before we
// reject the AI output. The Cursor image model does not honor exact dimensions (size is
// only a text hint), so it frequently returns a square/landscape image for portrait
// platforms. We must NOT crop (cuts the product) or blur-fill (ghosts the product) to
// force a wrong-aspect image to fit — instead the caller falls back to the deterministic
// composite, which is always the correct platform aspect with the full product in frame.
const ASPECT_REJECT_TOLERANCE = 0.06;

/**
 * Conform a Cursor image to the exact platform generation dimensions ONLY when its aspect
 * already matches the platform (within tolerance). Returns null when the aspect differs
 * too much, signalling the caller to fall back to the deterministic composite rather than
 * crop or pad (both of which damage the product framing).
 */
async function conformToPlatformSizeOrReject(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer | null> {
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? width;
  const srcH = meta.height ?? height;

  const targetRatio = width / height;
  const srcRatio = srcW / srcH;
  if (Math.abs(targetRatio - srcRatio) / targetRatio > ASPECT_REJECT_TOLERANCE) {
    return null;
  }

  if (srcW === width && srcH === height) return buffer;
  return sharp(buffer)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ quality: 95 })
    .toBuffer();
}

export interface AICompositeInput {
  productPath: string;
  backgroundPath: string;
  draftOutputPath: string;
  aiOutputPath: string;
  width: number;
  height: number;
  viewName: string;
  aspectRatio?: string;
  compositePrompt: string;
  sceneContext?: {
    sceneName: string;
    sceneDescription: string;
    lighting: string;
    mood: string;
    colorPalette: string;
    props: string;
    backgroundType: string;
    sceneCategory?: SceneCategory;
    platformName: string;
    brandName: string;
    productName: string;
    aspectRatio: string;
    resolution: string;
    cameraAngle: string;
  };
}

export interface AICompositeResult extends CompositePlacementResult {
  method: AICompositeMethod;
}

async function tryCursorComposite(input: AICompositeInput): Promise<Buffer | null> {
  if (!isCursorConfigured()) return null;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= CURSOR_COMPOSITE_ATTEMPTS; attempt++) {
    try {
      const { buffer } = await compositeWithCursorAI({
        productPath: input.productPath,
        backgroundPath: input.backgroundPath,
        draftCompositePath: input.draftOutputPath,
        outputAbsolutePath: input.aiOutputPath,
        prompt: input.compositePrompt,
        width: input.width,
        height: input.height,
      });
      return buffer;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Cursor composite attempt ${attempt}/${CURSOR_COMPOSITE_ATTEMPTS} failed:`, err);
      if (attempt < CURSOR_COMPOSITE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  if (lastError) console.warn("Cursor composite exhausted retries:", lastError.message);
  return null;
}

export async function runAICompositePass(input: AICompositeInput): Promise<AICompositeResult> {
  const draft = await compositeProductOnScene({
    productPath: input.productPath,
    backgroundPath: input.backgroundPath,
    outputPath: input.draftOutputPath,
    width: input.width,
    height: input.height,
    viewName: input.viewName,
    aspectRatio: input.aspectRatio ?? input.sceneContext?.aspectRatio,
    sceneContext: input.sceneContext
      ? {
          lighting: input.sceneContext.lighting,
          mood: input.sceneContext.mood,
          sceneCategory: input.sceneContext.sceneCategory ?? "studio",
          backgroundType: input.sceneContext.backgroundType,
          props: input.sceneContext.props,
        }
      : undefined,
  });

  const cursorBuffer = await tryCursorComposite(input);
  if (cursorBuffer) {
    const conformed = await conformToPlatformSizeOrReject(
      cursorBuffer,
      input.width,
      input.height
    );
    if (conformed) {
      await fs.writeFile(input.aiOutputPath, conformed);
      return { ...draft, buffer: conformed, method: "cursor-ai" };
    }
    // AI ignored the requested aspect ratio (common for portrait/landscape platforms).
    // Cropping would cut the product and padding would ghost it, so use the deterministic
    // composite (draft) which is guaranteed the correct platform aspect with the full
    // product in frame. The finish pipeline still adds shadows/grade/DOF on top.
    console.warn(
      "Cursor composite aspect mismatch — using deterministic composite to keep product fully in frame"
    );
  }

  return { ...draft, method: "sharp" };
}

export function buildProModePrompt(
  input: AICompositeInput["sceneContext"] & { viewName: string }
): string {
  if (!input) return "";
  return buildSceneEditPrompt({
    sceneName: input.sceneName,
    sceneDescription: input.sceneDescription,
    lighting: input.lighting,
    mood: input.mood,
    colorPalette: input.colorPalette,
    props: input.props,
    backgroundType: input.backgroundType,
    viewName: input.viewName,
    cameraAngle: input.cameraAngle,
    platformName: input.platformName,
    brandName: input.brandName,
    productName: input.productName,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
  });
}

export async function runProModeGeneration(options: {
  sourcePath: string;
  outputPath: string;
  prompt: string;
  aspectRatio: string;
  width?: number;
  height?: number;
}): Promise<{ buffer: Buffer; method: "cursor-pro" }> {
  if (!isCursorConfigured()) {
    throw new Error("CURSOR_API_KEY is required for Pro mode. Add it to .env.local");
  }

  const genSize =
    options.width && options.height
      ? { width: options.width, height: options.height }
      : generationDimensions(options.aspectRatio);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= CURSOR_COMPOSITE_ATTEMPTS; attempt++) {
    try {
      const { buffer } = await compositeWithCursorAI({
        productPath: options.sourcePath,
        backgroundPath: options.sourcePath,
        draftCompositePath: options.sourcePath,
        outputAbsolutePath: options.outputPath,
        prompt: options.prompt,
        width: genSize.width,
        height: genSize.height,
        singleImageMode: true,
      });
      const conformed = await conformToPlatformSizeOrReject(
        buffer,
        genSize.width,
        genSize.height
      );
      if (!conformed) {
        throw new Error(
          `Pro mode output aspect did not match ${options.aspectRatio} — retrying`
        );
      }
      await fs.writeFile(options.outputPath, conformed);
      return { buffer: conformed, method: "cursor-pro" };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Cursor Pro mode attempt ${attempt}/${CURSOR_COMPOSITE_ATTEMPTS} failed:`, err);
      if (attempt < CURSOR_COMPOSITE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("Cursor Pro mode generation failed");
}
