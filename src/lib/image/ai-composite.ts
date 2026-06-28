import fs from "fs/promises";
import sharp from "sharp";
import { compositeWithCursorAI } from "@/lib/image/cursor-image";
import { isCursorConfigured } from "@/lib/cursor-server";
import { buildSceneEditPrompt } from "@/lib/image/openai-image";
import {
  compositeProductOnScene,
  type CompositePlacementResult,
} from "@/lib/image/process-product";
import { aspectRatioHint, generationDimensions } from "@/lib/image/image-dimensions";
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

/** Sample a neutral background color from image corners for letterboxing. */
async function sampleEdgeBackgroundColor(buffer: Buffer): Promise<{ r: number; g: number; b: number }> {
  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 100;
    const h = meta.height ?? 100;
    const sample = 8;
    const regions = [
      { left: 0, top: 0 },
      { left: Math.max(0, w - sample), top: 0 },
      { left: 0, top: Math.max(0, h - sample) },
      { left: Math.max(0, w - sample), top: Math.max(0, h - sample) },
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const region of regions) {
      const { data } = await sharp(buffer)
        .extract({ left: region.left, top: region.top, width: Math.min(sample, w), height: Math.min(sample, h) })
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 3) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    if (n === 0) return { r: 240, g: 240, b: 240 };
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  } catch {
    return { r: 240, g: 240, b: 240 };
  }
}

/**
 * Standard quick mode: fit the full AI image inside the platform canvas and pad with a
 * solid edge-sampled color — never crop the product and never blur-fill (which ghosts it).
 */
async function conformStandardQuickOutput(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  const exact = await conformToPlatformSizeOrReject(buffer, width, height);
  if (exact) return exact;

  const fitted = await sharp(buffer)
    .resize(width, height, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const fittedMeta = await sharp(fitted).metadata();
  const fw = fittedMeta.width ?? width;
  const fh = fittedMeta.height ?? height;
  const padLeft = Math.floor((width - fw) / 2);
  const padRight = width - fw - padLeft;
  const padTop = Math.floor((height - fh) / 2);
  const padBottom = height - fh - padTop;
  const bg = await sampleEdgeBackgroundColor(buffer);

  return sharp(fitted)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: bg,
    })
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

export type StandardQuickMethod = "cursor-quick" | "cursor-quick-fit";

/**
 * Standard mode — single-shot Cursor transform with tolerant aspect handling.
 * Never throws on aspect mismatch; pads with edge color instead. Returns null only when
 * Cursor produces no image at all (caller should run deterministic fallback).
 */
export async function runStandardQuickGeneration(options: {
  sourcePath: string;
  outputPath: string;
  prompt: string;
  aspectRatio: string;
  width?: number;
  height?: number;
}): Promise<{ buffer: Buffer; method: StandardQuickMethod } | null> {
  if (!isCursorConfigured()) {
    throw new Error("CURSOR_API_KEY is required. Add it to .env.local");
  }

  const genSize =
    options.width && options.height
      ? { width: options.width, height: options.height }
      : generationDimensions(options.aspectRatio);

  const dimHint = aspectRatioHint(options.aspectRatio, genSize.width, genSize.height);
  const fullPrompt = `${options.prompt}\n\n${dimHint}`;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= CURSOR_COMPOSITE_ATTEMPTS + 1; attempt++) {
    try {
      const { buffer } = await compositeWithCursorAI({
        productPath: options.sourcePath,
        backgroundPath: options.sourcePath,
        draftCompositePath: options.sourcePath,
        outputAbsolutePath: options.outputPath,
        prompt: fullPrompt,
        width: genSize.width,
        height: genSize.height,
        singleImageMode: true,
        aspectRatio: options.aspectRatio,
      });

      const exact = await conformToPlatformSizeOrReject(buffer, genSize.width, genSize.height);
      if (exact) {
        await fs.writeFile(options.outputPath, exact);
        return { buffer: exact, method: "cursor-quick" };
      }

      const fitted = await conformStandardQuickOutput(buffer, genSize.width, genSize.height);
      await fs.writeFile(options.outputPath, fitted);
      return { buffer: fitted, method: "cursor-quick-fit" };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `Standard quick attempt ${attempt}/${CURSOR_COMPOSITE_ATTEMPTS + 1} failed:`,
        err
      );
      if (attempt <= CURSOR_COMPOSITE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  if (lastError) console.warn("Standard quick generation exhausted retries:", lastError.message);
  return null;
}
