import fs from "fs/promises";
import path from "path";
import { removeBackgroundLocal } from "@/lib/image/local-bg-removal";
import { finalizeIsolationCutout, gentleTrimPng } from "@/lib/image/isolation-utils";
import { preserveCopyAsPng } from "@/lib/image/openai-image";

export type IsolationMethod = "imgly" | "cursor" | "preserve";

/** Trim transparent padding — gentle threshold preserves thin temple-arm alpha */
async function postProcessIsolated(buffer: Buffer, productCategory?: string): Promise<Buffer> {
  return finalizeIsolationCutout(buffer, productCategory);
}

/**
 * Isolate product with PIXEL-FAITHFUL background removal.
 *
 * Uses a local alpha-matting model that masks the ORIGINAL product pixels — the
 * product is never redrawn, so shape, colors, logos, and proportions stay exactly
 * as the source photo from any angle. No generative redraw, no API key needed.
 * Falls back to preserving the original image only if matting fails.
 */
export async function isolateProductImage(
  inputPath: string,
  outputAbsolutePath: string,
  options?: { productCategory?: string }
): Promise<{ buffer: Buffer; method: IsolationMethod }> {
  await fs.mkdir(path.dirname(outputAbsolutePath), { recursive: true });

  try {
    const raw = await removeBackgroundLocal(inputPath);
    const buffer = await postProcessIsolated(raw, options?.productCategory);
    await fs.writeFile(outputAbsolutePath, buffer);
    return { buffer, method: "imgly" };
  } catch (err) {
    console.warn("Local background removal failed, preserving original (no product changes):", err);
    await preserveCopyAsPng(inputPath, outputAbsolutePath);
    const raw = await fs.readFile(outputAbsolutePath);
    const buffer = await gentleTrimPng(raw, 2);
    await fs.writeFile(outputAbsolutePath, buffer);
    return { buffer, method: "preserve" };
  }
}

export function isolationMethodLabel(method: IsolationMethod): string {
  switch (method) {
    case "imgly":
      return "Pixel-faithful cutout (product unchanged)";
    case "cursor":
      return "Cursor AI product isolation";
    case "preserve":
      return "Original preserved (matting unavailable)";
  }
}

export function isolationMethodDetail(method: IsolationMethod): string {
  switch (method) {
    case "imgly":
      return "Background masked from the original pixels — product shape, colors & logos unchanged";
    case "cursor":
      return "Background removed via Cursor generateImage";
    case "preserve":
      return "Matting unavailable — using original upload unchanged. Regenerate to retry.";
  }
}

/** @deprecated Cursor-only pipeline — always false */
export function isRemoveBgConfigured(): boolean {
  return false;
}
