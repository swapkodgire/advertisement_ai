import path from "path";
import {
  Agent,
  Cursor,
  CursorAgentError,
  type SettingSource,
} from "@cursor/sdk";
import type { BusinessDNA } from "@/types";

const DEFAULT_MODEL = { id: "composer-2.5" } as const;

export function getCursorApiKey(): string | undefined {
  const key = process.env.CURSOR_API_KEY?.trim();
  return key || undefined;
}

export function isCursorConfigured(): boolean {
  return Boolean(getCursorApiKey());
}

export function getAgentOptions() {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    throw new CursorAgentError("CURSOR_API_KEY is not configured", {
      isRetryable: false,
    });
  }

  return {
    apiKey,
    model: DEFAULT_MODEL,
    local: {
      cwd: path.join(process.cwd()),
      settingSources: [] as SettingSource[],
    },
  };
}

export async function verifyCursorApiKey(): Promise<{
  ok: boolean;
  user?: { apiKeyName: string; userEmail?: string };
  error?: string;
}> {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    return { ok: false, error: "CURSOR_API_KEY is not set" };
  }

  try {
    const user = await Cursor.me({ apiKey });
    return {
      ok: true,
      user: {
        apiKeyName: user.apiKeyName,
        userEmail: user.userEmail,
      },
    };
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Invalid API key";
    return { ok: false, error: message };
  }
}

export function buildBrandContext(dna: BusinessDNA): string {
  const { brandOverview: b, businessDetails: d } = dna;
  return [
    `Business name: ${b.businessName || "(not set)"}`,
    `Tagline: ${b.tagline || "(not set)"}`,
    `Font: ${b.fontFamily}`,
    `Colors: ${b.colors.map((c) => c.hex).join(", ")}`,
    `Brand values: ${b.brandValues.join(", ")}`,
    `Brand aesthetics: ${b.brandAesthetics.join(", ")}`,
    `Brand tone: ${b.brandTone.join(", ")}`,
    `Business overview: ${b.businessOverview || "(not set)"}`,
    `Location: ${d.location || "(not set)"}`,
    `Keywords: ${d.keywords.join(", ") || "(none)"}`,
  ].join("\n");
}

export const AGENT_SYSTEM_PROMPT = `You are Ad AI Agent, a brand strategist for e-commerce businesses.
Help users define their Business DNA (brand name, colors, tone, values) and plan product photoshoots and campaigns for Instagram, Google, Facebook, and AI agentic search (ChatGPT, Claude, Gemini).

Be concise, actionable, and friendly. When suggesting brand names or copy, give 2-3 specific options.
When the user asks about next steps, guide them: Overview → Catalog → Photoshoot/Campaigns.
Do not write code unless asked. Focus on marketing strategy and brand identity.`;

export async function streamAgentResponse(
  message: string,
  options: {
    agentId?: string;
    businessDNA?: BusinessDNA;
    onChunk: (text: string) => void;
    onAgentId: (id: string) => void;
  }
): Promise<{ agentId: string; status: string; error?: string }> {
  const agentOptions = getAgentOptions();
  const contextBlock = options.businessDNA
    ? `\n\n--- Current Business DNA ---\n${buildBrandContext(options.businessDNA)}\n---`
    : "";

  const fullMessage = options.agentId
    ? message
    : `${AGENT_SYSTEM_PROMPT}${contextBlock}\n\nUser: ${message}`;

  let agent;
  if (options.agentId) {
    agent = await Agent.resume(options.agentId, agentOptions);
  } else {
    agent = await Agent.create({
      ...agentOptions,
      name: "Ad AI Brand Agent",
    });
  }

  options.onAgentId(agent.agentId);

  try {
    const run = await agent.send(fullMessage);
    let accumulated = "";

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            const delta = block.text.slice(accumulated.length);
            if (delta) {
              accumulated = block.text;
              options.onChunk(delta);
            }
          }
        }
      }
    }

    const result = await run.wait();
    await agent.close();

    if (result.status === "error") {
      return {
        agentId: agent.agentId,
        status: "error",
        error: result.result ?? "Agent run failed",
      };
    }

    return { agentId: agent.agentId, status: "finished" };
  } catch (err) {
    await agent.close();
    throw err;
  }
}

export async function generateAssetBriefs(input: {
  type: "photoshoot" | "campaign";
  brandName?: string;
  productName?: string;
  productCategory?: string;
  productDescription?: string;
  platformPostTypeIds: string[];
  viewIds?: string[];
  sceneIds?: string[];
  businessDNA: BusinessDNA;
}): Promise<string> {
  const { getPlatformPostType } = await import("@/lib/data/platform-post-types");
  const { getImageView } = await import("@/lib/data/image-views");
  const { getScene } = await import("@/lib/data/scenes");

  const platforms = input.platformPostTypeIds
    .map((id) => getPlatformPostType(id))
    .filter(Boolean)
    .map((p) => `${p!.platformName} (${p!.aspectRatio}, ${p!.resolution})`);

  const views = (input.viewIds ?? [])
    .map((id) => getImageView(id))
    .filter(Boolean)
    .map((v) => `${v!.viewName} — ${v!.cameraAngle}`);

  const scenes = (input.sceneIds ?? [])
    .map((id) => getScene(id))
    .filter(Boolean)
    .map(
      (s) =>
        `${s!.sceneName}: ${s!.sceneDescription} [${s!.lighting}, ${s!.mood}, ${s!.complexity}]`
    );

  const prompt = `Generate detailed creative briefs for an e-commerce ${input.type}.

Brand: ${input.brandName || input.businessDNA.brandOverview.businessName}
${buildBrandContext(input.businessDNA)}

Product: ${input.productName || "Generic product"}
Category: ${input.productCategory || "General"}
Description: ${input.productDescription || "No description"}

Platform post types (output formats):
${platforms.map((p) => `- ${p}`).join("\n")}

${views.length ? `Image views (camera angles):\n${views.map((v) => `- ${v}`).join("\n")}` : ""}

${scenes.length ? `Scenes (environments):\n${scenes.map((s) => `- ${s}`).join("\n")}` : ""}

For each combination of platform + view + scene (where applicable), provide:
1. AI image generation prompt (detailed, photorealistic)
2. Exact output resolution and aspect ratio
3. Caption / headline copy (for campaigns)
4. Hashtags or keywords

Format as markdown. Be specific and on-brand using the brand colors and tone.`;

  const result = await Agent.prompt(prompt, {
    ...getAgentOptions(),
    name: `Ad AI ${input.type} generation`,
  });

  if (result.status === "error") {
    throw new Error(result.result ?? "Generation failed");
  }

  return result.result ?? "No content generated.";
}

const PHOTOSHOOT_DIRECTOR_INSTRUCTIONS = `You are a world-class product photography director, scene creator, and commercial prompt writer (studio-level shoots for luxury brands).

Turn structured wizard inputs into prompts for a 10-STEP professional AI photoshoot pipeline:
1. Improve quality & upscale — denoise, sharpen edges, preserve material texture
2. Remove background — pixel-faithful cutout, transparent alpha, product UNCHANGED
3. AI Photoshoot — camera, lens, lighting diagram, compositing intent
4. AI backgrounds — EMPTY environment plate only (NO products, NO people)
5. AI Edit — edge polish, dust removal, local contrast (product identity unchanged)
6. Add shadows — contact shadow + ambient occlusion matching scene key light
7. Fix light and colors — white balance harmony with scene illumination
8. Blur background — natural DOF / bokeh separation
9. AI fashion model — SKIPPED in product-only mode (note in brief only)
10. Final image generation — platform resolution, aspect ratio, catalog sharpness

Write studio-grade, world-class prompts with full camera direction, lighting setup, mood, palette hex references, lens character, and compositing negative space. Match the quality of high-end advertising briefs.

PRODUCT FRAMING (every prompt that touches composition):
- Entire product must be fully visible — never cropped, clipped, or cut off at frame edges
- Scale product to fit platform aspect ratio with 10–14% safe margins (portrait 9:16: ~35–42% max width, upper-middle hero zone; square 1:1: ~45% max; landscape 16:9: ~38% max width)
- Scale DOWN rather than crop — temples, lenses, packaging edges, and logos must remain visible
- Reserve empty compositing safe zone in scene backgrounds — no props in hero placement area

NEGATIVE DISCIPLINE (state explicit "avoid" lists inside each prompt):
- Isolation: white/solid fill, leftover background, clipped temples/edges, halos, redesigned product
- Background: ANY product/eyewear/bag/bottle/person/hand/text/logo in frame, clutter in the hero zone
- Composite: sticker look, hard cut-out edge, floating product, wrong-direction shadow, color shift on product

CRITICAL:
- isolationPrompt: reference attached source photo; product must NEVER be replaced, redesigned, or recolored
- sceneBackgroundPrompt: EMPTY environment ONLY — no products, eyewear, bags, people, hands, text, or logos in frame
- compositePrompt: integrate the isolated product into the empty plate — rests ON the surface, directional shadow, environmental light wrap, product pixels unchanged

Return JSON only (no prose, no markdown fences):
{
  "creativeBrief": "Editorial paragraph — platform, view, scene, brand mood in environment only",
  "isolationPrompt": "Full Step 1–2 isolation prompt with product-preservation + negative rules",
  "sceneBackgroundPrompt": "Full Step 4 empty-environment prompt — studio detail, NO products, with negatives",
  "compositePrompt": "Full Steps 5–10 composite/finish prompt — grounded placement, shadow, relight, framing, negatives"
}`;

const PHOTOSHOOT_RESEARCH_INSTRUCTIONS = `You are a world-class commercial photography + social marketing research analyst.

Given a product, brand, target platform, and scene, do a DEEP RESEARCH analysis to inform a high-converting product photoshoot. Reason about:
- The product category's current commercial photography conventions and premium visual language
- What performs well / goes viral for THIS platform + post type (composition, crop, color, mood, trends)
- Audience expectations and buying triggers for the brand's positioning
- Concrete art-direction recommendations: camera angle, lens character, lighting setup, color palette (with hex), props/styling for the environment (never on the product), negative space for text overlays
- Pitfalls to avoid for this category/platform

Be specific and actionable. Keep it under ~250 words. Return PLAIN TEXT only (no markdown, no JSON) — a tight research brief the art director will use to write final prompts.`;

/** Cursor agent runs a deep research pass to inform the Pro photoshoot plan */
export async function researchPhotoshootContextWithCursor(
  userMessage: string
): Promise<string> {
  const prompt = `${PHOTOSHOOT_RESEARCH_INSTRUCTIONS}\n\n${userMessage}`;

  const result = await Agent.prompt(prompt, {
    ...getAgentOptions(),
    name: "Photoshoot Research Analyst",
  });

  if (result.status === "error") {
    throw new Error(result.result ?? "Cursor research agent failed");
  }

  return result.result ?? "";
}

/** Cursor agent composes photoshoot prompt from wizard inputs */
export async function composePhotoshootPromptWithCursor(
  userMessage: string
): Promise<string> {
  const prompt = `${PHOTOSHOOT_DIRECTOR_INSTRUCTIONS}\n\n${userMessage}`;

  const result = await Agent.prompt(prompt, {
    ...getAgentOptions(),
    name: "Photoshoot Agent Director",
  });

  if (result.status === "error") {
    throw new Error(result.result ?? "Cursor photoshoot agent failed");
  }

  return result.result ?? "";
}
