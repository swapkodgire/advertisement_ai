import { Agent } from "@cursor/sdk";
import { buildBrandContext, getAgentOptions } from "@/lib/cursor-server";
import { getPlatformPostType } from "@/lib/data/platform-post-types";
import type { BusinessDNA } from "@/types";

export type ContentTarget = "caption" | "hashtags" | "all";

export interface PostContentInput {
  platformPostTypeId: string;
  brandName: string;
  productName: string;
  productCategory?: string;
  productDescription?: string;
  sceneLabel?: string;
  viewLabel?: string;
  /** Optional extra steering, e.g. "playful, launch announcement" */
  tone?: string;
  /** When regenerating only part, or refining an existing caption */
  existingCaption?: string;
  target: ContentTarget;
  businessDNA?: BusinessDNA;
}

export interface PostContent {
  /** Platform-native caption, SEO + semantically optimized, ready to post */
  caption: string;
  /** Viral + relevant hashtags for the category on this platform (no leading spaces) */
  hashtags: string[];
  /** <=60 char SEO title */
  seoTitle: string;
  /** <=160 char meta description */
  metaDescription: string;
  /** Primary SEO/search keywords */
  keywords: string[];
  /** Accessible, descriptive alt text (also read by AI agents) */
  altText: string;
  /** Concise factual summary optimized for AI answer engines (AEO/GEO) */
  aiSummary: string;
}

/** Recommended hashtag volume per platform — matches platform best practices. */
function hashtagGuidance(group: string): string {
  switch (group) {
    case "Instagram":
      return "12–20 hashtags: 3-4 broad/high-volume, 6-8 mid-tier niche, 3-5 long-tail/branded. Avoid banned or spammy tags.";
    case "Twitter / X":
      return "2–3 sharp, high-signal hashtags only — X penalizes hashtag stuffing.";
    case "LinkedIn":
      return "3–5 professional, industry hashtags (no slang, no emojis in tags).";
    case "Pinterest":
      return "5–8 descriptive, search-intent keyword hashtags (Pinterest is a visual search engine).";
    case "Facebook":
      return "2–4 relevant hashtags — Facebook rewards conversational copy over tags.";
    case "YouTube":
      return "4–6 discovery hashtags relevant to the thumbnail/short topic.";
    default:
      return "5–10 relevant, search-friendly hashtags.";
  }
}

/** Caption voice + length per platform. */
function captionGuidance(group: string): string {
  switch (group) {
    case "Instagram":
      return "Scroll-stopping hook in line 1, 2-4 short value lines, a clear CTA, tasteful emojis. ~125-220 words max.";
    case "Twitter / X":
      return "One punchy tweet under 240 characters. Strong hook, 0-1 emoji, optional CTA. No fluff.";
    case "LinkedIn":
      return "Professional, value-first. Hook line, 2-3 insight lines on craftsmanship/quality, soft CTA. No hashtag stuffing.";
    case "Pinterest":
      return "Keyword-rich, descriptive caption that reads like a search result — what it is, the style, the use case.";
    case "Facebook":
      return "Warm, conversational, story-driven. Hook + benefit + CTA. Emojis optional.";
    case "YouTube":
      return "Click-worthy, curiosity-driven description line for the thumbnail/short.";
    default:
      return "Clear, benefit-led marketing copy with a hook and CTA.";
  }
}

function buildPrompt(input: PostContentInput): string {
  const platform = getPlatformPostType(input.platformPostTypeId);
  const group = platform?.platformGroup ?? "Social";
  const platformName = platform?.platformName ?? group;

  const brandBlock = input.businessDNA
    ? `\n--- Brand DNA ---\n${buildBrandContext(input.businessDNA)}\n`
    : "";

  const refine = input.existingCaption?.trim()
    ? `\nThe user has a current caption draft to improve (keep what works, elevate the rest):\n"""${input.existingCaption.trim()}"""\n`
    : "";

  const wants =
    input.target === "caption"
      ? "Focus on the CAPTION + SEO fields. Still return hashtags (they are cheap), but the caption is the priority."
      : input.target === "hashtags"
        ? "Focus on researching the best HASHTAGS for this category on this platform. Still return a caption."
        : "Produce the full set: caption, hashtags, and all SEO/AEO fields.";

  return `You are a world-class social media strategist + SEO and Answer Engine Optimization (AEO/GEO) expert.
You craft marketing copy that ranks in search AND is easy for AI answer engines (ChatGPT, Claude, Gemini, Perplexity, Google AI Overviews) to understand, quote, and recommend.

TASK: Write publish-ready content for ONE post.
${wants}

POST CONTEXT
- Platform: ${platformName} (${group})
- Brand: ${input.brandName}
- Product: ${input.productName}
- Category: ${input.productCategory || "general product"}
- Description: ${input.productDescription || "(none provided)"}
${input.sceneLabel ? `- Scene / setting in image: ${input.sceneLabel}` : ""}
${input.viewLabel ? `- Product view in image: ${input.viewLabel}` : ""}
${input.tone ? `- Desired tone/angle: ${input.tone}` : ""}
${brandBlock}${refine}

CAPTION RULES (${group}): ${captionGuidance(group)}
- Weave 1-2 primary keywords in naturally for SEO. Be semantically rich and specific (materials, use-cases, benefits) so AI agents can extract facts.
- Never invent specs that aren't implied by the product/description. Stay truthful.

HASHTAG RESEARCH (${group}): ${hashtagGuidance(group)}
- Choose tags that are currently relevant and high-engagement for the "${input.productCategory || "product"}" category on ${group}.
- Mix reach tiers (broad → niche → long-tail) and include 1-2 branded tags. Return WITHOUT the leading '#'.

SEO + AEO FIELDS
- seoTitle: <=60 chars, keyword-first, compelling.
- metaDescription: <=160 chars, benefit + keyword + soft CTA.
- keywords: 6-10 high-intent search keywords/phrases for this product+category.
- altText: one descriptive, accessible sentence of exactly what's in the image (product, material, scene) — also consumed by AI agents and screen readers.
- aiSummary: 1-2 factual sentences an AI answer engine could quote to recommend this product (what it is, who it's for, standout qualities).

Return ONLY valid minified JSON (no markdown, no code fences, no commentary) with EXACTLY these keys:
{"caption":"","hashtags":[],"seoTitle":"","metaDescription":"","keywords":[],"altText":"","aiSummary":""}`;
}

function stripFences(text: string): string {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function extractJson(text: string): string | null {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function normalizeHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${tag}`);
  }
  return out;
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

export async function generatePostContent(input: PostContentInput): Promise<PostContent> {
  const prompt = buildPrompt(input);

  const result = await Agent.prompt(prompt, {
    ...getAgentOptions(),
    name: "Ad AI Caption & Hashtag Strategist",
  });

  if (result.status === "error") {
    throw new Error(result.result ?? "Caption generation failed");
  }

  const raw = result.result ?? "";
  const json = extractJson(raw);
  if (!json) {
    throw new Error("AI returned an unparseable response. Try again.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned malformed JSON. Try again.");
  }

  return {
    caption: typeof parsed.caption === "string" ? parsed.caption.trim() : "",
    hashtags: normalizeHashtags(parsed.hashtags),
    seoTitle: typeof parsed.seoTitle === "string" ? parsed.seoTitle.trim() : "",
    metaDescription:
      typeof parsed.metaDescription === "string" ? parsed.metaDescription.trim() : "",
    keywords: toStringArray(parsed.keywords),
    altText: typeof parsed.altText === "string" ? parsed.altText.trim() : "",
    aiSummary: typeof parsed.aiSummary === "string" ? parsed.aiSummary.trim() : "",
  };
}
