import fs from "fs/promises";
import sharp from "sharp";

export function getOpenAIImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
}

export function getOpenAIApiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || undefined;
}

export function isOpenAIImageConfigured(): boolean {
  return Boolean(getOpenAIApiKey());
}

const EXTRACT_PROMPT = `Identify and isolate the main product in this image. Remove the background completely.

STRICT RULES — DO NOT VIOLATE:
- Do NOT change the product's colors, labels, logos, text, packaging, materials, texture, shape, or proportions
- Do NOT apply filters, sharpening, color grading, or retouching to the product
- Do NOT add or remove any product details
- Only remove the background; place the product on pure white (#FFFFFF)
- The product must look exactly as it does in the original photo`;

export function aspectRatioToOpenAISize(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return "1024x1024";
  if (Math.abs(w - h) < 0.01) return "1024x1024";
  if (w > h) return "1536x1024";
  return "1024x1536";
}

export function buildSceneEditPrompt(input: {
  sceneName: string;
  sceneDescription: string;
  lighting: string;
  mood: string;
  colorPalette: string;
  props: string;
  backgroundType: string;
  viewName: string;
  cameraAngle: string;
  platformName: string;
  brandName: string;
  productName: string;
  aspectRatio?: string;
  resolution?: string;
}): string {
  return `COMPLETELY TRANSFORM this product photo into a professional ${input.platformName} marketing image.

=== PRODUCT PRESERVATION (NON-NEGOTIABLE) ===
The product/subject in the uploaded photo must remain pixel-accurate and visually identical:
- Same exact colors, packaging, labels, logos, text, materials, textures, shape, proportions
- No retouching, filters, sharpening, color grading, or beautification on the product
- No added or removed product details
ONLY the background, environment, scene lighting, and camera framing may change.

=== PRODUCT CONTEXT ===
Product: ${input.productName}
Brand: ${input.brandName}

=== SCENE TRANSFORMATION (MAKE DRAMATIC, VISIBLE CHANGES) ===
Replace the entire background and environment with:
Scene: ${input.sceneName}
Description: ${input.sceneDescription}
Environment type: ${input.backgroundType}
Mood: ${input.mood}
Color palette (background and scene ONLY): ${input.colorPalette}
Surrounding props (never touching or covering the product): ${input.props}

=== LIGHTING ===
Lighting setup: ${input.lighting}
Apply professional studio/lifestyle lighting that matches the scene mood.
Add realistic shadows beneath and around the product that anchor it in the new environment.
Use rim light or fill light as appropriate for commercial product photography.

=== CAMERA & COMPOSITION ===
View: ${input.viewName}
Camera angle: ${input.cameraAngle}
Reframe the shot for ${input.platformName} at ${input.aspectRatio ?? "1:1"} aspect ratio (${input.resolution ?? "4096x4096"}).
Product is the clear hero — scale to fit fully inside frame with 10–14% safe margin on all edges.
For portrait formats (9:16, 4:5): product occupies ~35–42% of frame width max; leave headroom for Reels/Story UI overlays.
For square (1:1): product ~45% max dimension, centered with breathing room.
For landscape (16:9): product ~38% width max, centered in hero zone.
NEVER crop temples, lenses, packaging edges, or logos — scale down instead of clipping.

=== OUTPUT REQUIREMENTS ===
- Photorealistic commercial product photography
- High-end retail / e-commerce quality
- Target resolution feel: ${input.resolution ?? "4096x4096"}
- No text overlays, watermarks, borders, or logos added
- Background must look completely different from the original photo
- The scene change must be obvious and professional`;
}

/** Ensure PNG under 4MB for OpenAI edits API */
export async function preparePngForOpenAI(inputPath: string): Promise<Buffer> {
  let buffer = await sharp(inputPath).png().toBuffer();

  const maxBytes = 4 * 1024 * 1024;
  if (buffer.length <= maxBytes) return buffer;

  let meta = await sharp(inputPath).metadata();
  let width = meta.width ?? 1024;

  while (buffer.length > maxBytes && width > 512) {
    width = Math.round(width * 0.85);
    buffer = await sharp(inputPath)
      .resize(width, undefined, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  return buffer;
}

export async function openAIImageEdit(options: {
  apiKey: string;
  imageBuffer: Buffer;
  prompt: string;
  size?: string;
  filename?: string;
  model?: string;
  quality?: "high" | "medium" | "low" | "auto";
  inputFidelity?: "high" | "low";
}): Promise<{ buffer: Buffer; error?: string }> {
  const model = options.model ?? getOpenAIImageModel();
  const form = new FormData();
  form.append("model", model);
  form.append(
    "image[]",
    new Blob([new Uint8Array(options.imageBuffer)], { type: "image/png" }),
    options.filename ?? "product.png"
  );
  form.append("prompt", options.prompt);
  form.append("n", "1");
  form.append("size", options.size ?? "1024x1024");
  form.append("quality", options.quality ?? "high");
  form.append("output_format", "png");

  // low fidelity allows dramatic background/scene changes while prompt preserves product
  if (!model.includes("gpt-image-2")) {
    form.append("input_fidelity", options.inputFidelity ?? "low");
  }

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      buffer: Buffer.alloc(0),
      error: `OpenAI image edit failed (${res.status}): ${errText}`,
    };
  }

  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };

  const b64 = data.data?.[0]?.b64_json;
  if (b64) {
    return { buffer: Buffer.from(b64, "base64") };
  }

  const url = data.data?.[0]?.url;
  if (url) {
    const imgRes = await fetch(url);
    if (imgRes.ok) {
      return { buffer: Buffer.from(await imgRes.arrayBuffer()) };
    }
  }

  return { buffer: Buffer.alloc(0), error: "OpenAI returned no image data" };
}

export async function extractProductWithOpenAI(
  inputPath: string,
  apiKey: string
): Promise<Buffer> {
  const png = await preparePngForOpenAI(inputPath);
  const result = await openAIImageEdit({
    apiKey,
    imageBuffer: png,
    prompt: EXTRACT_PROMPT,
    size: "1024x1024",
    filename: "original.png",
    inputFidelity: "high",
  });

  if (result.error || result.buffer.length === 0) {
    throw new Error(result.error ?? "Product extraction failed");
  }

  return result.buffer;
}

export async function generateSceneWithOpenAI(
  inputPath: string,
  apiKey: string,
  prompt: string,
  size: string
): Promise<Buffer> {
  const png = await preparePngForOpenAI(inputPath);
  const result = await openAIImageEdit({
    apiKey,
    imageBuffer: png,
    prompt,
    size,
    filename: "product.png",
    quality: "high",
    inputFidelity: "low",
  });

  if (result.error || result.buffer.length === 0) {
    throw new Error(result.error ?? "Scene generation failed");
  }

  return result.buffer;
}

/** Fallback: copy original pixels without any aesthetic changes */
export async function preserveCopyAsPng(
  inputPath: string,
  outputPath: string
): Promise<{ width: number; height: number }> {
  const meta = await sharp(inputPath).metadata();
  await sharp(inputPath).png().toFile(outputPath);
  return {
    width: meta.width ?? 1024,
    height: meta.height ?? 1024,
  };
}

export { EXTRACT_PROMPT };
