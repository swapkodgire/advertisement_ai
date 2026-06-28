import fs from "fs/promises";
import sharp from "sharp";

/** Minimum long-edge before isolation — upscales small phone uploads */
const DEFAULT_MIN_LONG_EDGE = 2048;

/**
 * Step 1 — real upscale/enhance (not prompt-only).
 * Lanczos upscale, mild sharpen, normalize exposure on the source before isolation.
 */
export async function enhanceSourceImage(
  inputPath: string,
  minLongEdge = DEFAULT_MIN_LONG_EDGE
): Promise<Buffer> {
  const meta = await sharp(inputPath).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const longEdge = Math.max(width, height);

  let pipeline = sharp(inputPath);

  if (longEdge < minLongEdge) {
    const scale = minLongEdge / longEdge;
    pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale), {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    });
  }

  return pipeline
    .sharpen({ sigma: 0.55, m1: 0.45, m2: 0.25 })
    .normalize()
    .png({ quality: 95 })
    .toBuffer();
}

export async function enhanceSourceToFile(
  inputPath: string,
  outputPath: string,
  minLongEdge = DEFAULT_MIN_LONG_EDGE
): Promise<{ enhanced: boolean; width: number; height: number }> {
  const meta = await sharp(inputPath).metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  const buffer = await enhanceSourceImage(inputPath, minLongEdge);
  await fs.writeFile(outputPath, buffer);
  const outMeta = await sharp(buffer).metadata();
  return {
    enhanced: longEdge < minLongEdge,
    width: outMeta.width ?? longEdge,
    height: outMeta.height ?? longEdge,
  };
}
