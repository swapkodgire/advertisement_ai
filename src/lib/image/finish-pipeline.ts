import sharp from "sharp";
import { applyDirectionalShadowPass } from "@/lib/image/directional-shadow";
import { aspectRatiosMatch } from "@/lib/image/product-framing";
import {
  getSceneLightingProfile,
  type SceneLightingProfile,
} from "@/lib/image/scene-lighting";
import type { SceneCategory } from "@/types";

export interface ProductPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FinishPipelineOptions {
  targetWidth: number;
  targetHeight: number;
  aspectRatio?: string;
  sceneMood: string;
  sceneLighting: string;
  colorPalette: string;
  sceneCategory?: SceneCategory;
  backgroundType?: string;
  sceneProps?: string;
  placement?: ProductPlacement;
  /** Isolated product layer for shadow pass + product relight mask */
  productLayerPath?: string;
  lightingProfile?: SceneLightingProfile;
  /**
   * When the input already has directional shadows baked in (the deterministic
   * `compositeProductOnScene` draft), skip re-applying them to avoid doubled/too-dark
   * shadows. The AI relight output has no baked shadows, so it leaves this false.
   */
  shadowsAlreadyApplied?: boolean;
}

function moodColorAdjustments(mood: string, lighting: string): {
  brightness: number;
  saturation: number;
  hue: number;
} {
  const text = `${mood} ${lighting}`.toLowerCase();
  if (text.includes("warm") || text.includes("golden") || text.includes("sun"))
    return { brightness: 1.05, saturation: 1.1, hue: 4 };
  if (text.includes("cool") || text.includes("clinical") || text.includes("blue"))
    return { brightness: 1.01, saturation: 0.98, hue: -2 };
  if (text.includes("dark") || text.includes("moody") || text.includes("night"))
    return { brightness: 0.97, saturation: 1.02, hue: 0 };
  if (text.includes("luxury") || text.includes("editorial"))
    return { brightness: 1.02, saturation: 0.95, hue: 1 };
  return { brightness: 1.02, saturation: 1.04, hue: 0 };
}

/** Step 5 — local polish: sharpen, mild clarity, denoise */
async function applyAIEdit(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .sharpen({ sigma: 0.65, m1: 0.5, m2: 0.35 })
    .median(1)
    .png({ quality: 95 })
    .toBuffer();
}

/** Step 7a — grade environment globally + subtle vignette for a premium "shot" look */
async function applyEnvironmentColorGrade(
  buffer: Buffer,
  options: FinishPipelineOptions
): Promise<Buffer> {
  const adj = moodColorAdjustments(options.sceneMood, options.sceneLighting);
  const graded = await sharp(buffer)
    .modulate({
      brightness: adj.brightness,
      saturation: adj.saturation,
      hue: adj.hue,
    })
    .png({ quality: 95 })
    .toBuffer();

  const meta = await sharp(graded).metadata();
  const w = meta.width ?? options.targetWidth;
  const h = meta.height ?? options.targetHeight;

  // Radial vignette: transparent center → soft dark edges, applied with multiply.
  const vignetteSvg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="v" cx="50%" cy="46%" r="78%">
          <stop offset="62%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.5"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`;

  try {
    const vignette = await sharp(Buffer.from(vignetteSvg)).png().toBuffer();
    return sharp(graded)
      .composite([{ input: vignette, blend: "multiply" }])
      .png({ quality: 95 })
      .toBuffer();
  } catch {
    return graded;
  }
}

/** Step 7b — warm environmental highlights on product region only (shape/colors unchanged) */
async function applyProductEnvironmentalRelight(
  buffer: Buffer,
  options: FinishPipelineOptions
): Promise<Buffer> {
  if (!options.placement) return buffer;

  const meta = await sharp(buffer).metadata();
  const cw = meta.width ?? options.targetWidth;
  const ch = meta.height ?? options.targetHeight;
  const { left, top, width: pw, height: ph } = options.placement;

  const profile =
    options.lightingProfile ??
    getSceneLightingProfile({
      lighting: options.sceneLighting,
      mood: options.sceneMood,
      sceneCategory: options.sceneCategory ?? "studio",
      backgroundType: options.backgroundType ?? "studio",
      props: options.sceneProps,
    });

  const pad = Math.round(Math.max(pw, ph) * 0.08);
  const cx = left + pw / 2;
  const cy = top + ph / 2;
  const rx = pw / 2 + pad;
  const ry = ph / 2 + pad;

  const maskSvg = `
    <svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="black"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>
    </svg>`;

  const warmBrightness = profile.ambientWarmth;
  const warmSaturation = profile.isOutdoor ? 1.12 : 1.06;
  const warmHue = profile.isOutdoor ? 6 : 2;

  // Feather the mask so the relight blends instead of showing a hard oval edge.
  const featherR = Math.max(6, Math.round(Math.max(pw, ph) * 0.06));

  try {
    const mask = await sharp(Buffer.from(maskSvg)).blur(featherR).png().toBuffer();
    const relitProduct = await sharp(buffer)
      .modulate({
        brightness: warmBrightness,
        saturation: warmSaturation,
        hue: warmHue,
      })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();

    return sharp(buffer)
      .composite([{ input: relitProduct, blend: "over" }])
      .png({ quality: 95 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/** Step 6 — real directional shadow pass using isolated product + placement */
async function applyShadowStep(
  buffer: Buffer,
  options: FinishPipelineOptions
): Promise<Buffer> {
  if (!options.placement || !options.productLayerPath) return buffer;

  const profile =
    options.lightingProfile ??
    getSceneLightingProfile({
      lighting: options.sceneLighting,
      mood: options.sceneMood,
      sceneCategory: options.sceneCategory ?? "studio",
      backgroundType: options.backgroundType ?? "studio",
      props: options.sceneProps,
    });

  try {
    const productBuf = await sharp(options.productLayerPath).ensureAlpha().png().toBuffer();
    return applyDirectionalShadowPass(buffer, productBuf, options.placement, profile);
  } catch {
    return buffer;
  }
}

/** Step 8 — blur environment, keep hero product sharp via elliptical mask */
async function applyBackgroundBlur(
  buffer: Buffer,
  options: FinishPipelineOptions
): Promise<Buffer> {
  if (!options.placement) return buffer;

  const meta = await sharp(buffer).metadata();
  const cw = meta.width ?? options.targetWidth;
  const ch = meta.height ?? options.targetHeight;
  const { left, top, width: pw, height: ph } = options.placement;

  const pad = Math.round(Math.max(pw, ph) * 0.18);
  const cx = left + pw / 2;
  const cy = top + ph / 2;
  const rx = pw / 2 + pad;
  const ry = ph / 2 + pad;

  const maskSvg = `
    <svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="black"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>
    </svg>`;

  // Wide feather → the sharp product region melts smoothly into the soft background
  // (no visible oval boundary / seam), and a stronger blur dissolves floor seams and
  // any faint background artifacts so the product clearly pops.
  const featherR = Math.max(10, Math.round(Math.max(pw, ph) * 0.1));

  try {
    const blurred = await sharp(buffer).blur(Math.max(6, cw / 240)).toBuffer();
    const mask = await sharp(Buffer.from(maskSvg)).blur(featherR).png().toBuffer();
    const sharpRegion = await sharp(buffer)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();

    return sharp(blurred)
      .composite([{ input: sharpRegion, blend: "over" }])
      .png({ quality: 95 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/** Step 10 — lanczos upscale to platform export size without cropping the product */
async function exportFinal(
  buffer: Buffer,
  width: number,
  height: number,
  aspectRatio?: string
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? width;
  const srcH = meta.height ?? height;
  const targetRatio = width / height;
  const srcRatio = srcW / srcH;
  const sameAspect =
    Math.abs(targetRatio - srcRatio) / targetRatio < 0.02 ||
    (aspectRatio != null && aspectRatiosMatch(aspectRatio, srcW, srcH));

  if (sameAspect) {
    return sharp(buffer)
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 0.4 })
      .png({ quality: 95 })
      .toBuffer();
  }

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

  return sharp(fitted)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .sharpen({ sigma: 0.4 })
    .png({ quality: 95 })
    .toBuffer();
}

/** Optional callback fired with the intermediate buffer after each finish sub-step. */
export type FinishStepId = "shadows" | "light_color" | "blur_bg";
export type FinishStepHandler = (stepId: FinishStepId, buffer: Buffer) => Promise<void> | void;

/**
 * Steps 5–8 + 10: polish, shadow, split color grade, DOF separation, final export.
 * When `onStep` is provided, fires after steps 6 (shadows), 7 (light_color), 8 (blur_bg)
 * so callers can persist + emit a real per-step output image.
 */
export async function applyFinishPipeline(
  input: Buffer,
  options: FinishPipelineOptions,
  onStep?: FinishStepHandler
): Promise<Buffer> {
  let buf = input;

  // Step 5 polish folds into the composite; not surfaced as its own image here.
  buf = await applyAIEdit(buf);

  // Step 6 — directional shadows (skip when the draft already baked them in)
  if (!options.shadowsAlreadyApplied) {
    buf = await applyShadowStep(buf, options);
  }
  if (onStep) await onStep("shadows", buf);

  // Step 7 — split grade (environment + masked product relight)
  buf = await applyEnvironmentColorGrade(buf, options);
  buf = await applyProductEnvironmentalRelight(buf, options);
  if (onStep) await onStep("light_color", buf);

  // Step 8 — background depth-of-field
  buf = await applyBackgroundBlur(buf, options);
  if (onStep) await onStep("blur_bg", buf);

  // Step 10 — export to platform resolution
  buf = await exportFinal(buf, options.targetWidth, options.targetHeight, options.aspectRatio);
  return buf;
}
