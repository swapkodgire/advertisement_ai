import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { Agent } from "@cursor/sdk";
import { getAgentOptions, isCursorConfigured } from "@/lib/cursor-server";
import { aspectRatioHint } from "@/lib/image/image-dimensions";
import { getStepNegativePromptText } from "@/lib/photoshoot/step-prompts";

const SCENE_MAX_ATTEMPTS = 3;

interface GenerateImageToolResult {
  status?: string;
  value?: {
    imageData?: string;
    filePath?: string;
  };
  imageData?: string;
  filePath?: string;
}

function extractFilePathFromToolResult(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as GenerateImageToolResult;
  if (r.status === "success" && r.value?.filePath) return r.value.filePath;
  if (r.filePath) return r.filePath;
  return undefined;
}

function extractImageBufferFromToolResult(result: unknown): Buffer | null {
  if (!result || typeof result !== "object") return null;
  const r = result as GenerateImageToolResult;
  if (r.status === "success" && r.value?.imageData) {
    return Buffer.from(r.value.imageData, "base64");
  }
  if (r.imageData) return Buffer.from(r.imageData, "base64");
  return null;
}

async function readImageFile(filePath: string): Promise<Buffer | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

function bufferHash(buf: Buffer): string {
  return createHash("md5").update(buf).digest("hex");
}

function isRejectedSceneSourcePath(filePath: string | undefined): boolean {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  // Only reject raw uploads — NOT isolation outputs (product-isolated.png)
  return (
    lower.includes("/raw/original") ||
    /original\.(jpg|jpeg|png|webp)$/i.test(lower)
  );
}

export function validateSceneBackgroundBuffer(
  sceneBuffer: Buffer,
  sourceBuffer: Buffer | null,
  savedPath?: string
): void {
  if (isRejectedSceneSourcePath(savedPath)) {
    throw new Error("Scene image path points to source upload — rejected");
  }
  if (!sourceBuffer) return;
  if (sceneBuffer.length === sourceBuffer.length && bufferHash(sceneBuffer) === bufferHash(sourceBuffer)) {
    throw new Error("Scene image is identical to source — rejected");
  }
  // Near-duplicate detection (same file re-encoded)
  if (Math.abs(sceneBuffer.length - sourceBuffer.length) < 500) {
    const sceneHash = bufferHash(sceneBuffer);
    const sourceHash = bufferHash(sourceBuffer);
    if (sceneHash === sourceHash) {
      throw new Error("Scene image matches source — rejected");
    }
  }
}

function captureGenerateImageResult(
  result: unknown,
  state: { imageBuffer: Buffer | null; savedPath?: string }
) {
  const filePath = extractFilePathFromToolResult(result);
  if (filePath) state.savedPath = filePath;
  const buf = extractImageBufferFromToolResult(result);
  if (buf && buf.length > 0) state.imageBuffer = buf;
}

async function loadImageAttachment(filePath: string): Promise<{ data: string; mimeType: string }> {
  const sourceBuffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return { data: sourceBuffer.toString("base64"), mimeType };
}

/** Core: run Cursor generateImage once and read result from disk */
async function runCursorGenerateImage(options: {
  agentName: string;
  instruction: string;
  imagePrompt: string;
  outputAbsolutePath: string;
  sourceImagePath?: string;
  sourceImagePaths?: string[];
  sourceBufferForValidation?: Buffer;
  /** When true, reject outputs that match the source upload (scene step only) */
  validateSceneOutput?: boolean;
}): Promise<{ buffer: Buffer; filePath?: string }> {
  if (!isCursorConfigured()) {
    throw new Error("CURSOR_API_KEY is required");
  }

  await fs.mkdir(path.dirname(options.outputAbsolutePath), { recursive: true });

  const images: { data: string; mimeType: string }[] = [];
  const paths = options.sourceImagePaths?.length
    ? options.sourceImagePaths
    : options.sourceImagePath
      ? [options.sourceImagePath]
      : [];

  for (const p of paths) {
    images.push(await loadImageAttachment(p));
  }

  const agent = await Agent.create({
    ...getAgentOptions(),
    name: options.agentName,
  });

  const state: { imageBuffer: Buffer | null; savedPath?: string } = {
    imageBuffer: null,
  };

  const sourceBuffer =
    options.sourceBufferForValidation ??
    (options.sourceImagePath ? await readImageFile(options.sourceImagePath) : null);

  const promptForAgent = options.imagePrompt;

  const fullInstruction = `${options.instruction}

You MUST call generateImage exactly ONCE and nothing else.
- description: use the PROMPT block below
- filePath: "${options.outputAbsolutePath}"

=== PROMPT ===
${promptForAgent}
=== END PROMPT ===

Do NOT use shell, glob, read, edit, or search tools. Only generateImage once, then stop.`;

  try {
    const run = await agent.send(
      images.length
        ? { text: fullInstruction, images }
        : fullInstruction,
      {
        onDelta: ({ update }) => {
          if (update.type !== "tool-call-completed") return;
          if (update.toolCall.type !== "generateImage") return;
          captureGenerateImageResult(update.toolCall.result, state);
        },
      }
    );

    for await (const event of run.stream()) {
      if (event.type !== "tool_call") continue;
      if (event.name !== "generateImage" || event.status !== "completed") continue;
      if (event.result) captureGenerateImageResult(event.result, state);
    }

    await run.wait();

    if (!state.imageBuffer && state.savedPath) {
      if (options.validateSceneOutput && isRejectedSceneSourcePath(state.savedPath)) {
        state.savedPath = undefined;
        state.imageBuffer = null;
      } else {
        state.imageBuffer = await readImageFile(state.savedPath);
      }
    }
    if (!state.imageBuffer) {
      state.imageBuffer = await readImageFile(options.outputAbsolutePath);
    }
    if (!state.imageBuffer) {
      try {
        const artifacts = await agent.listArtifacts();
        const imageArtifact = artifacts
          .filter((a) => /\.(png|jpg|jpeg|webp)$/i.test(a.path))
          .filter((a) => !options.validateSceneOutput || !isRejectedSceneSourcePath(a.path))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (imageArtifact) {
          state.imageBuffer = await agent.downloadArtifact(imageArtifact.path);
          state.savedPath = imageArtifact.path;
        }
      } catch {
        // ignore
      }
    }

    if (state.imageBuffer && !state.savedPath) {
      await fs.writeFile(options.outputAbsolutePath, state.imageBuffer);
      state.savedPath = options.outputAbsolutePath;
    }

    if (state.imageBuffer && options.validateSceneOutput) {
      validateSceneBackgroundBuffer(state.imageBuffer, sourceBuffer, state.savedPath);
    }

    await agent.close();

    if (!state.imageBuffer?.length) {
      throw new Error("Cursor generateImage did not produce a file");
    }

    return { buffer: state.imageBuffer, filePath: state.savedPath };
  } catch (err) {
    await agent.close();
    throw err;
  }
}

export const ISOLATION_PROMPT = `Background removal ONLY — product preservation is mandatory.

Using the attached source photograph as the single source of truth:
- Identify the main product in the photo
- Remove ALL background, surfaces, props, furniture, and environment
- Output a transparent PNG cutout (alpha channel) — NOT a white fill
- The product must be the EXACT same item from the photo: same shape, frame, color, material, labels, logos, lenses, packaging, proportions
- For eyewear: include COMPLETE temple arms / ear stems — do NOT crop tips of temples or hinges
- Leave generous transparent padding around the product — do not trim close to edges
- Do NOT replace the product with a different item
- Do NOT change product style (e.g. do not turn eyeglasses into sunglasses)
- Do NOT apply filters, retouching, color grading, or stylization to the product
- Clean anti-aliased edges, ready for compositing onto AI scene backgrounds

NEGATIVE — Step "remove_bg" must avoid: ${getStepNegativePromptText("remove_bg")}`;

/** Step 1: isolate product from source — attach source image */
export async function isolateProductWithCursor(
  sourceImagePath: string,
  outputAbsolutePath: string
): Promise<{ buffer: Buffer }> {
  const { buffer } = await runCursorGenerateImage({
    agentName: "Product Isolation Agent",
    instruction:
      "The user attached their SOURCE PRODUCT PHOTO. Remove the background only. The product must remain the exact same item from the photo.",
    imagePrompt: ISOLATION_PROMPT,
    outputAbsolutePath,
    sourceImagePath,
  });
  return { buffer };
}

/** Step 2: generate empty scene background — NO product in prompt or attachment */
export async function generateSceneBackgroundWithCursor(
  scenePrompt: string,
  outputAbsolutePath: string,
  sourceBufferForValidation?: Buffer,
  dimensions?: { width: number; height: number; aspectRatio?: string }
): Promise<{ buffer: Buffer }> {
  const dimHint =
    dimensions?.width && dimensions?.height
      ? `\n${aspectRatioHint(dimensions.aspectRatio ?? "1:1", dimensions.width, dimensions.height)}`
      : "";

  const { buffer } = await runCursorGenerateImage({
    agentName: "Scene Background Agent",
    instruction:
      "Generate an EMPTY environment/background plate only. No products, no eyewear, no bags, no objects, no people, no text. The scene must be a completely new environment.",
    imagePrompt: `${scenePrompt}${dimHint}`,
    outputAbsolutePath,
    sourceBufferForValidation,
    validateSceneOutput: true,
  });
  return { buffer };
}

/** Scene generation with retries before caller falls back to SVG */
export async function generateSceneBackgroundWithRetries(options: {
  scenePrompt: string;
  outputAbsolutePath: string;
  sourceBufferForValidation?: Buffer;
  width: number;
  height: number;
  aspectRatio: string;
}): Promise<{ buffer: Buffer; attempts: number }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= SCENE_MAX_ATTEMPTS; attempt++) {
    try {
      const { buffer } = await generateSceneBackgroundWithCursor(
        options.scenePrompt,
        options.outputAbsolutePath,
        options.sourceBufferForValidation,
        { width: options.width, height: options.height, aspectRatio: options.aspectRatio }
      );
      return { buffer, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Scene generation attempt ${attempt}/${SCENE_MAX_ATTEMPTS} failed:`, err);
      if (attempt < SCENE_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  throw lastError ?? new Error("Scene generation failed after retries");
}

const COMPOSITE_CURSOR_PROMPT = (prompt: string, w: number, h: number) =>
  `${prompt}

OUTPUT: Single photorealistic commercial composite ${w}×${h}px.

INTEGRATION (CRITICAL — not a sticker):
- Product rests ON the ground/surface in the scene — never floating in sky
- Directional cast shadow on surface matching scene sun/key light (lower-right for golden hour)
- Environmental light wrap on product edges only — warm highlights on sun-facing side, subtle cool fill in shadow
- Remove cut-out halos and white fringing
- Product shape, color, logos, materials unchanged — but must look lit BY the scene

FRAMING (PRODUCT PHOTOSHOOT — product is the HERO, but MUST be fully in frame):
- RULE #1 (non-negotiable): the ENTIRE product is inside the frame — every edge, temple arm, lens, hinge, logo and corner fully visible with clear margin from all four sides. NEVER crop, clip, or bleed any part of the product off any edge.
- Match draft composite #3 EXACTLY for product scale and position — do NOT zoom in, do NOT enlarge past the draft, do NOT push it into the distance
- The product is the dominant, in-focus hero — but "hero" means prominent and centered, NOT zoomed so tight that edges get cut. If the whole product cannot fit at the current size, SCALE IT DOWN until it fits with margin.
- For wide products (e.g. eyewear temple-to-temple) keep generous LEFT/RIGHT margin; for tall products keep TOP/BOTTOM margin
- Keep the product TACK-SHARP and in crisp focus; let the environment sit in shallow depth-of-field behind it
- Leave safe margins on all sides for ${w}×${h} delivery

NEGATIVE — Step "ai_edit" composite must avoid: ${getStepNegativePromptText("ai_edit")}`;

/** Step 5–10: AI relight composite — product + scene + draft placement reference */
export async function compositeWithCursorAI(options: {
  productPath: string;
  backgroundPath: string;
  draftCompositePath: string;
  outputAbsolutePath: string;
  prompt: string;
  width: number;
  height: number;
  singleImageMode?: boolean;
  aspectRatio?: string;
}): Promise<{ buffer: Buffer }> {
  const imagePaths = options.singleImageMode
    ? [options.productPath]
    : [options.productPath, options.backgroundPath, options.draftCompositePath];

  const aspectHint = options.aspectRatio
    ? `\n${aspectRatioHint(options.aspectRatio, options.width, options.height)}`
    : "";

  const instruction = options.singleImageMode
    ? `Transform the attached product photo into a professional marketing image per the prompt.
Preserve the product identity exactly — same shape, color, logos, materials.
The ENTIRE product must remain fully visible inside the frame with safe margins on all four sides.
Output must match the requested aspect ratio and dimensions.${aspectHint}`
    : `You are given reference images:
1) ISOLATED PRODUCT (transparent cutout) — preserve product identity exactly
2) EMPTY SCENE BACKGROUND — environment plate with ground/surface in lower portion
3) DRAFT COMPOSITE — placement reference showing product on surface with directional shadow

Generate a photorealistic integrated commercial composite:
- Place product ON the ground/surface — NOT floating in the sky
- Add directional cast shadow on the surface matching scene lighting (golden hour = sun upper-left, shadow lower-right)
- Apply environmental light wrap on product edges — warm rim on lit side, scene color in shadows
- Remove halos and cut-out artifacts
- Do NOT replace, redesign, or recolor the product — but it must look naturally lit by the scene
- Keep ENTIRE product visible — no cropping or zooming past draft placement`;

  const { buffer } = await runCursorGenerateImage({
    agentName: options.singleImageMode ? "Pro Photoshoot Agent" : "AI Composite Agent",
    instruction,
    imagePrompt: COMPOSITE_CURSOR_PROMPT(options.prompt, options.width, options.height),
    outputAbsolutePath: options.outputAbsolutePath,
    sourceImagePaths: imagePaths,
  });
  return { buffer };
}

export function buildSceneBackgroundPrompt(input: {
  sceneName: string;
  sceneDescription: string;
  lighting: string;
  mood: string;
  colorPalette: string;
  backgroundType: string;
  props: string;
  viewName: string;
  cameraAngle: string;
  platformName: string;
  aspectRatio: string;
}): string {
  return `Empty professional photoshoot ENVIRONMENT PLATE for e-commerce compositing.

IMPORTANT: Do NOT include any product, object, package, or item in the scene. This is a background-only plate. A real product photo will be composited on top later.

Platform style: ${input.platformName} (${input.aspectRatio})
Scene: ${input.sceneName} — ${input.sceneDescription}
Environment: ${input.backgroundType}
Lighting: ${input.lighting}
Mood: ${input.mood}
Color palette: ${input.colorPalette}
Surrounding environment props (in scene only, not products): ${input.props}
Camera feel: ${input.viewName} — ${input.cameraAngle}

Composition:
- Leave clear central space (lower-center) where a product will be placed
- Photorealistic commercial photography quality
- Dramatic, visible environment distinct from a plain white studio
- No text, watermarks, logos, or branded items
- No sunglasses, bags, bottles, or any sellable product in frame`;
}

export function getCursorImageModelLabel(): string {
  return "cursor-studio-pipeline";
}
