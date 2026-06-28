import fs from "fs/promises";
import sharp from "sharp";
import { compositeWithDirectionalShadows } from "@/lib/image/directional-shadow";
import { addIsolationPadding, gentleTrimPng } from "@/lib/image/isolation-utils";
import {
  clampProductPlacement,
  getProductFramingLimits,
} from "@/lib/image/product-framing";
import {
  getSceneLightingProfile,
  type SceneLightingProfile,
} from "@/lib/image/scene-lighting";
import type { SceneCategory } from "@/types";

/**
 * Retail product redesign: normalize, sharpen, pad on clean white background.
 * Prepares the raw upload for compositing / AI generation.
 */
export async function redesignProductImage(
  inputPath: string,
  outputPath: string
): Promise<{ width: number; height: number }> {
  const image = sharp(inputPath);
  const meta = await image.metadata();

  const maxDim = 2048;
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const scale = Math.min(1, maxDim / Math.max(width, height));

  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  // Square canvas with white background — standard e-commerce product pad
  const canvasSize = Math.max(targetW, targetH);
  const padX = Math.round((canvasSize - targetW) / 2);
  const padY = Math.round((canvasSize - targetH) / 2);

  const resized = await sharp(inputPath)
    .resize(targetW, targetH, { fit: "inside", withoutEnlargement: false })
    .sharpen({ sigma: 0.8 })
    .normalize()
    .toBuffer();

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: resized, left: padX, top: padY }])
    .png({ quality: 95 })
    .toFile(outputPath);

  return { width: canvasSize, height: canvasSize };
}

export function parseResolution(resolution: string): { width: number; height: number } {
  const [w, h] = resolution.split("x").map(Number);
  return { width: w || 1024, height: h || 1024 };
}

function sceneBackgroundColor(colorPalette: string): { r: number; g: number; b: number } {
  const map: Record<string, { r: number; g: number; b: number }> = {
    "white neutral": { r: 248, g: 248, b: 248 },
    "white beige gold": { r: 245, g: 240, b: 230 },
    "black charcoal": { r: 28, g: 28, b: 32 },
    "silver grey": { r: 200, g: 205, b: 210 },
    "sand green blue": { r: 230, g: 220, b: 190 },
    "beige gold": { r: 220, g: 200, b: 160 },
    "grey concrete": { r: 160, g: 160, b: 165 },
    "wood tones": { r: 180, g: 150, b: 120 },
    "purple cyan": { r: 60, g: 40, b: 90 },
    "white": { r: 255, g: 255, b: 255 },
    "neutral": { r: 235, g: 235, b: 238 },
    "white wood grey": { r: 240, g: 238, b: 235 },
    "white blue": { r: 240, g: 245, b: 250 },
    "white grey": { r: 245, g: 245, b: 247 },
    "white silver": { r: 242, g: 244, b: 248 },
    "grey stone": { r: 190, g: 188, b: 185 },
    "beige gold brown": { r: 210, g: 190, b: 165 },
    "earth tones": { r: 180, g: 150, b: 120 },
    "sand beige": { r: 225, g: 210, b: 185 },
    "black silver": { r: 25, g: 25, b: 30 },
    "gradient tones": { r: 220, g: 225, b: 235 },
    "blue silver": { r: 40, g: 60, b: 100 },
  };
  return map[colorPalette.toLowerCase()] ?? { r: 245, g: 245, b: 248 };
}

/** Composite product into a retail scene canvas (fallback when no AI image API). */
export async function compositePhotoshootImage(options: {
  productPath: string;
  outputPath: string;
  width: number;
  height: number;
  sceneColorPalette: string;
  sceneMood: string;
  viewName: string;
  brandName: string;
  productName: string;
}): Promise<void> {
  const bg = sceneBackgroundColor(options.sceneColorPalette);

  const productMeta = await sharp(options.productPath).metadata();
  const productMaxW = Math.round(options.width * 0.55);
  const productMaxH = Math.round(options.height * 0.55);

  const productBuf = await sharp(options.productPath)
    .resize(productMaxW, productMaxH, { fit: "inside" })
    .toBuffer();

  const resizedMeta = await sharp(productBuf).metadata();
  const pw = resizedMeta.width ?? productMaxW;
  const ph = resizedMeta.height ?? productMaxH;

  // Position based on view
  let left = Math.round((options.width - pw) / 2);
  let top = Math.round((options.height - ph) / 2);

  if (options.viewName.toLowerCase().includes("flat lay")) {
    top = Math.round(options.height * 0.25);
  } else if (options.viewName.toLowerCase().includes("floating")) {
    top = Math.round(options.height * 0.15);
  } else if (options.viewName.toLowerCase().includes("elevated")) {
    top = Math.round(options.height * 0.2);
  }

  const labelSvg = `
    <svg width="${options.width}" height="80">
      <text x="40" y="50" font-family="Arial, sans-serif" font-size="28" fill="#333" font-weight="600">
        ${escapeXml(options.brandName)}
      </text>
      <text x="40" y="72" font-family="Arial, sans-serif" font-size="16" fill="#666">
        ${escapeXml(options.productName)} · ${escapeXml(options.sceneMood)}
      </text>
    </svg>`;

  await sharp({
    create: {
      width: options.width,
      height: options.height,
      channels: 3,
      background: bg,
    },
  })
    .composite([
      { input: productBuf, left, top },
      { input: Buffer.from(labelSvg), top: options.height - 90, left: 0 },
    ])
    .png({ quality: 92 })
    .toFile(options.outputPath);
}

/** True when PNG already has a proper alpha cutout (remove.bg / imgly) */
async function hasAlphaCutout(inputPath: string): Promise<boolean> {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const total = info.width * info.height;
  if (total === 0) return false;

  let transparent = 0;
  let semiTransparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < 16) transparent++;
    else if (a < 240) semiTransparent++;
  }

  return transparent > total * 0.08 || semiTransparent > total * 0.02;
}

/**
 * Prepare product layer for compositing.
 * Uses existing alpha when present — avoids destroying white/silver product parts.
 */
export async function prepareProductLayerForComposite(inputPath: string): Promise<Buffer> {
  if (await hasAlphaCutout(inputPath)) {
    let buf = await sharp(inputPath).ensureAlpha().png().toBuffer();
    buf = await gentleTrimPng(buf, 2);
    return addIsolationPadding(buf, 0.04);
  }

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 245;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }

  let buf = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  buf = await gentleTrimPng(buf, 2);
  return addIsolationPadding(buf, 0.04);
}

/** @deprecated Use compositeWithDirectionalShadows via compositeProductOnScene */
async function buildContactShadowLayer(
  productBuf: Buffer,
  blurSigma: number,
  opacity: number
): Promise<Buffer> {
  const { data, info } = await sharp(productBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const a = (data[i + 3] / 255) * opacity;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = Math.round(Math.min(255, a * 255));
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .blur(blurSigma)
    .png()
    .toBuffer();
}

export interface CompositePlacementResult {
  buffer: Buffer;
  placement: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface CompositeSceneContext {
  lighting: string;
  mood: string;
  sceneCategory: SceneCategory;
  backgroundType: string;
  props?: string;
}

function compositePlacement(
  viewName: string,
  canvasW: number,
  canvasH: number,
  pw: number,
  ph: number,
  aspectRatio: string,
  sceneContext?: CompositeSceneContext,
  lightingProfile?: SceneLightingProfile
): { left: number; top: number } {
  const limits = getProductFramingLimits(aspectRatio, viewName, {
    sceneCategory: sceneContext?.sceneCategory,
    backgroundType: sceneContext?.backgroundType,
    isOutdoor: lightingProfile?.isOutdoor,
  });
  const { left, top } = clampProductPlacement(canvasW, canvasH, pw, ph, limits, {
    groundAnchorY: lightingProfile?.groundAnchorY ?? limits.verticalAnchor,
  });
  return { left, top };
}

/**
 * Composite isolated product (unchanged pixels) onto AI scene background.
 */
export async function compositeProductOnScene(options: {
  productPath: string;
  backgroundPath: string;
  outputPath: string;
  width: number;
  height: number;
  viewName: string;
  aspectRatio?: string;
  sceneContext?: CompositeSceneContext;
}): Promise<CompositePlacementResult> {
  const aspectRatio = options.aspectRatio ?? "1:1";
  const lightingProfile = options.sceneContext
    ? getSceneLightingProfile(options.sceneContext)
    : getSceneLightingProfile({
        lighting: "studio softbox",
        mood: "neutral",
        sceneCategory: "studio",
        backgroundType: "studio",
      });

  const limits = getProductFramingLimits(aspectRatio, options.viewName, {
    sceneCategory: options.sceneContext?.sceneCategory,
    backgroundType: options.sceneContext?.backgroundType,
    isOutdoor: lightingProfile.isOutdoor,
  });

  const backgroundBuf = await sharp(options.backgroundPath)
    .resize(options.width, options.height, { fit: "cover", position: "centre" })
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .png()
    .toBuffer();

  let productBuf: Buffer;
  try {
    productBuf = await prepareProductLayerForComposite(options.productPath);
  } catch {
    productBuf = await sharp(options.productPath).ensureAlpha().png().toBuffer();
  }

  const productMaxW = Math.round(options.width * limits.maxWidthPct);
  const productMaxH = Math.round(options.height * limits.maxHeightPct);

  productBuf = await sharp(productBuf)
    .resize(productMaxW, productMaxH, { fit: "inside", withoutEnlargement: false })
    .sharpen({ sigma: 0.35 })
    .png()
    .toBuffer();

  const resizedMeta = await sharp(productBuf).metadata();
  const pw = resizedMeta.width ?? productMaxW;
  const ph = resizedMeta.height ?? productMaxH;

  const { left, top } = compositePlacement(
    options.viewName,
    options.width,
    options.height,
    pw,
    ph,
    aspectRatio,
    options.sceneContext,
    lightingProfile
  );

  const result = await compositeWithDirectionalShadows(
    backgroundBuf,
    productBuf,
    left,
    top,
    lightingProfile,
    options.width,
    options.height
  );

  await fs.writeFile(options.outputPath, result);
  return {
    buffer: result,
    placement: { left, top, width: pw, height: ph },
  };
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function tryOpenAIImageGeneration(
  prompt: string,
  apiKey: string
): Promise<Buffer | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

export async function tryGeminiImageGeneration(
  prompt: string,
  apiKey: string
): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      predictions?: { bytesBase64Encoded?: string }[];
    };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

export async function resizeToTarget(
  input: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(input)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png({ quality: 92 })
    .toBuffer();
}

/** Fallback scene plate when Cursor generateImage fails */
export async function generateSceneBackgroundFallback(options: {
  outputPath: string;
  width: number;
  height: number;
  sceneColorPalette: string;
  sceneMood: string;
  sceneName: string;
  sceneId?: string;
  lighting: string;
  sceneCategory?: string;
  backgroundType?: string;
}): Promise<Buffer> {
  const nameLower = options.sceneName.toLowerCase();
  const idLower = (options.sceneId ?? "").toLowerCase();
  const bgLower = (options.backgroundType ?? "").toLowerCase();
  const isDesert =
    nameLower.includes("desert") ||
    idLower.includes("desert") ||
    bgLower.includes("desert") ||
    bgLower.includes("sand");

  if (isDesert || options.sceneCategory === "outdoor") {
    return generateOutdoorForegroundFallback(options);
  }

  if (nameLower.includes("marble") || idLower.includes("marble")) {
    return generateMarbleStudioFallback(options);
  }

  const base = sceneBackgroundColor(options.sceneColorPalette);
  const isDark =
    options.sceneMood.toLowerCase().includes("dark") ||
    options.sceneName.toLowerCase().includes("night") ||
    base.r + base.g + base.b < 200;
  const top = isDark
    ? { r: Math.min(255, base.r + 30), g: Math.min(255, base.g + 30), b: Math.min(255, base.b + 35) }
    : { r: Math.min(255, base.r + 18), g: Math.min(255, base.g + 18), b: Math.min(255, base.b + 22) };
  const bottom = isDark
    ? { r: Math.max(0, base.r - 20), g: Math.max(0, base.g - 20), b: Math.max(0, base.b - 15) }
    : { r: Math.max(0, base.r - 12), g: Math.max(0, base.g - 12), b: Math.max(0, base.b - 8) };

  const svg = `
    <svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${top.r},${top.g},${top.b})"/>
          <stop offset="100%" style="stop-color:rgb(${bottom.r},${bottom.g},${bottom.b})"/>
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="35%" r="55%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,${isDark ? 0.08 : 0.35})"/>
          <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#spot)"/>
      <ellipse cx="${Math.round(options.width * 0.5)}" cy="${Math.round(options.height * 0.72)}"
        rx="${Math.round(options.width * 0.28)}" ry="${Math.round(options.height * 0.04)}"
        fill="rgba(0,0,0,${isDark ? 0.35 : 0.12})"/>
    </svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const result = await sharp(buf)
    .resize(options.width, options.height, { fit: "cover" })
    .blur(0.3)
    .png({ quality: 90 })
    .toBuffer();

  await fs.writeFile(options.outputPath, result);
  return result;
}

async function generateOutdoorForegroundFallback(options: {
  outputPath: string;
  width: number;
  height: number;
  sceneColorPalette: string;
  sceneMood: string;
  sceneName: string;
  lighting: string;
}): Promise<Buffer> {
  const w = options.width;
  const h = options.height;
  const base = sceneBackgroundColor(options.sceneColorPalette);
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${Math.min(255, base.r + 40)},${Math.min(255, base.g + 20)},${Math.min(255, base.b + 10)})"/>
          <stop offset="55%" style="stop-color:rgb(${base.r},${base.g},${base.b})"/>
          <stop offset="100%" style="stop-color:rgb(${Math.max(0, base.r - 30)},${Math.max(0, base.g - 40)},${Math.max(0, base.b - 50)})"/>
        </linearGradient>
        <radialGradient id="sun" cx="22%" cy="18%" r="35%">
          <stop offset="0%" style="stop-color:rgba(255,220,140,0.95)"/>
          <stop offset="100%" style="stop-color:rgba(255,200,100,0)"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#sky)"/>
      <rect width="100%" height="100%" fill="url(#sun)"/>
      <ellipse cx="${Math.round(w * 0.5)}" cy="${Math.round(h * 0.78)}"
        rx="${Math.round(w * 0.55)}" ry="${Math.round(h * 0.12)}"
        fill="rgb(${Math.max(0, base.r - 20)},${Math.max(0, base.g - 30)},${Math.max(0, base.b - 40)})"/>
      <rect x="0" y="${Math.round(h * 0.62)}" width="${w}" height="${Math.round(h * 0.38)}"
        fill="rgb(${Math.max(0, base.r - 10)},${Math.max(0, base.g - 25)},${Math.max(0, base.b - 35)})"/>
      <ellipse cx="${Math.round(w * 0.5)}" cy="${Math.round(h * 0.72)}"
        rx="${Math.round(w * 0.32)}" ry="${Math.round(h * 0.035)}"
        fill="rgba(0,0,0,0.06)"/>
    </svg>`;

  const result = await sharp(Buffer.from(svg))
    .resize(w, h, { fit: "cover" })
    .blur(0.4)
    .png({ quality: 90 })
    .toBuffer();

  await fs.writeFile(options.outputPath, result);
  return result;
}

async function generateMarbleStudioFallback(options: {
  outputPath: string;
  width: number;
  height: number;
}): Promise<Buffer> {
  const w = options.width;
  const h = options.height;
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="marble" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f8f6f2"/>
          <stop offset="35%" style="stop-color:#ece8e0"/>
          <stop offset="70%" style="stop-color:#faf8f5"/>
          <stop offset="100%" style="stop-color:#e8e2d8"/>
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="30%" r="60%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.7)"/>
          <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="1.5"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#marble)"/>
      <path d="M0 ${Math.round(h * 0.2)} Q ${Math.round(w * 0.3)} ${Math.round(h * 0.15)} ${Math.round(w * 0.5)} ${Math.round(h * 0.25)} T ${w} ${Math.round(h * 0.18)}"
        stroke="rgba(200,190,170,0.35)" stroke-width="3" fill="none" filter="url(#blur)"/>
      <path d="M0 ${Math.round(h * 0.55)} Q ${Math.round(w * 0.4)} ${Math.round(h * 0.5)} ${Math.round(w * 0.7)} ${Math.round(h * 0.58)} T ${w} ${Math.round(h * 0.52)}"
        stroke="rgba(180,165,140,0.25)" stroke-width="2" fill="none" filter="url(#blur)"/>
      <rect width="100%" height="100%" fill="url(#spot)"/>
      <rect x="${Math.round(w * 0.15)}" y="${Math.round(h * 0.55)}" width="${Math.round(w * 0.7)}" height="${Math.round(h * 0.08)}"
        rx="4" fill="rgba(220,210,195,0.6)" stroke="rgba(200,185,160,0.3)" stroke-width="1"/>
      <ellipse cx="${Math.round(w * 0.5)}" cy="${Math.round(h * 0.78)}"
        rx="${Math.round(w * 0.22)}" ry="${Math.round(h * 0.025)}"
        fill="rgba(0,0,0,0.08)"/>
    </svg>`;

  const result = await sharp(Buffer.from(svg))
    .resize(w, h, { fit: "cover" })
    .png({ quality: 92 })
    .toBuffer();

  await fs.writeFile(options.outputPath, result);
  return result;
}
